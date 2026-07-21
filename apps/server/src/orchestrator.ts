import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FlowMap, FlowNode, RunStatus } from "@marionette/shared";
import { RUNNERS } from "./agents/index.js";
import { broadcast } from "./sse.js";

// ─── Orquestrador · execução sequencial (topológica) ────────────────────────
// MVP: um agente por vez, na ordem dos fios. Sem paralelismo (evita conflito
// de arquivos). A saída de cada agente é anexada ao prompt do próximo.

let currentAbort: AbortController | null = null;
let running = false;
let pendingHuman: (() => void) | null = null;

export function isRunning(): boolean {
  return running;
}

export function stopRun(): void {
  pendingHuman?.(); // solta a pausa humana, o abort encerra em seguida
  currentAbort?.abort();
}

/** Chamado pela rota /run/continue quando o humano conclui as tarefas manuais. */
export function continueRun(): boolean {
  if (!pendingHuman) return false;
  const resolve = pendingHuman;
  pendingHuman = null;
  resolve();
  return true;
}

/** Ordenação topológica por Kahn. Lança erro se houver ciclo. */
function topoOrder(flow: FlowMap): FlowNode[] {
  const indegree = new Map<string, number>();
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  for (const n of flow.nodes) indegree.set(n.id, 0);
  for (const e of flow.edges) {
    if (byId.has(e.target)) indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
  }
  const queue = flow.nodes.filter((n) => indegree.get(n.id) === 0);
  const order: FlowNode[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const e of flow.edges.filter((e) => e.source === n.id)) {
      const d = (indegree.get(e.target) ?? 0) - 1;
      indegree.set(e.target, d);
      if (d === 0) queue.push(byId.get(e.target)!);
    }
  }
  if (order.length !== flow.nodes.length) {
    throw new Error("O fluxo tem um ciclo — desfaça o fio circular antes de executar.");
  }
  return order;
}

/** Extrai o bloco "RESUMO:" que pedimos ao agente para escrever no final. */
function extractSummary(output: string): string {
  const m = output.match(/RESUMO:\s*([\s\S]{1,600})/i);
  if (m) return m[1].trim();
  return output.slice(-400).trim() || "(sem resumo)";
}

async function readSelectedSkills(paths?: string[]): Promise<string> {
  const selected = (paths ?? []).slice(0, 8);
  const contents = await Promise.all(
    selected.map(async (filePath) => {
      try {
        return (await fs.readFile(filePath, "utf8")).slice(0, 12000).trim();
      } catch {
        return "";
      }
    }),
  );
  return contents
    .filter(Boolean)
    .map((content, index) => `\n\n### Skill reutilizável ${index + 1}\n${content}`)
    .join("");
}

export async function runFlow(flow: FlowMap, projectPath: string): Promise<{ runId: string }> {
  if (running) throw new Error("Já existe um fluxo em execução.");
  const runId = randomUUID();
  running = true;
  currentAbort = new AbortController();
  const signal = currentAbort.signal;

  // roda em background; status vai por SSE
  (async () => {
    const status = (nodeId: string, s: RunStatus, detail?: string) =>
      broadcast({ type: "node-status", runId, nodeId, status: s, detail });

    try {
      const order = topoOrder(flow);
      broadcast({ type: "run-started", runId, order: order.map((n) => n.id) });

      // entradas: junta as tarefas dos nós input que alimentam cada nó
      const outputs = new Map<string, string>();
      for (const n of order) {
        if (n.type === "input") outputs.set(n.id, n.input?.task ?? "");
      }

      const incomingOf = (id: string) =>
        flow.edges
          .filter((e) => e.target === id)
          .map((e) => outputs.get(e.source))
          .filter((s): s is string => Boolean(s && s.trim()))
          .join("\n\n---\n\n");

      let finalOutput = "";

      for (const node of order) {
        if (signal.aborted) throw new Error("Execução interrompida pelo usuário.");
        if (node.type === "input") continue;

        const upstream = incomingOf(node.id);

        if (node.type === "output") {
          outputs.set(node.id, upstream);
          finalOutput = upstream;
          status(node.id, "done");
          continue;
        }

        // nó de tarefas humanas: pausa o fluxo até o usuário clicar em continuar
        if (node.type === "human") {
          const items = node.human?.items ?? [];
          if (items.length > 0) {
            status(node.id, "waiting-human");
            await new Promise<void>((resolve) => {
              pendingHuman = resolve;
              signal.addEventListener("abort", () => resolve(), { once: true });
            });
            pendingHuman = null;
            if (signal.aborted) throw new Error("Execução interrompida pelo usuário.");
          }
          const doneList = items.map((t) => `- [x] ${t.text}`).join("\n");
          outputs.set(
            node.id,
            upstream + (doneList ? `\n\nTarefas manuais concluídas pelo humano:\n${doneList}` : ""),
          );
          status(node.id, "done");
          continue;
        }

        const agent = node.agent!;
        const runner = RUNNERS[agent.tool];
        status(node.id, "starting");

        // escopo: MVP restringe via instrução (enforcement duro fica p/ v2)
        const scopeNote = agent.scope
          ? `\nVocê SÓ pode criar/editar/apagar arquivos dentro de "${agent.scope}" (relativo à raiz do projeto: ${path.normalize(agent.scope)}). Pode LER o resto do projeto para contexto.`
          : "";

        const contextNote = agent.contextMarkdown?.trim()
          ? `\n\n## Contexto Markdown do agente\n${agent.contextMarkdown.trim()}`
          : "";
        const skillsNote = agent.skills?.filter((skill) => skill.trim()).length
          ? `\n\n## Skills e procedimentos adicionais\n${agent.skills.filter((skill) => skill.trim()).map((skill) => `- ${skill.trim()}`).join("\n")}`
          : "";
        const selectedSkills = await readSelectedSkills(agent.skillRefs);
        const selectedSkillsNote = selectedSkills
          ? `\n\n## SKILL.md selecionadas para este agente${selectedSkills}`
          : "";
        const systemPrompt = `Você é o agente "${agent.role}" de um fluxo orquestrado (Marionette).\n${agent.prompt}${scopeNote}${contextNote}${skillsNote}${selectedSkillsNote}`;

        const userPrompt =
          (upstream
            ? `Contexto vindo das etapas anteriores do fluxo:\n\n${upstream}\n\n---\n\nContinue o trabalho a partir daí.`
            : "Execute sua função no projeto atual.") +
          `\n\nAo terminar, encerre sua resposta com um bloco iniciado por "RESUMO:" contendo 2-3 frases: o que você fez e qual o próximo passo sugerido.`;

        const result = await runner({
          systemPrompt,
          userPrompt,
          cwd: projectPath,
          signal,
          onEvent: (ev) => {
            if (ev.status) status(node.id, ev.status);
            if (ev.log) broadcast({ type: "node-log", runId, nodeId: node.id, line: ev.log });
            if (ev.todos) broadcast({ type: "node-todos", runId, nodeId: node.id, items: ev.todos });
          },
        });

        if (!result.ok) {
          status(node.id, "error", result.error);
          throw new Error(`Agente "${agent.role}" falhou: ${result.error}`);
        }

        outputs.set(node.id, result.output);
        finalOutput = result.output;
        status(node.id, "done");
        broadcast({
          type: "node-summary",
          runId,
          nodeId: node.id,
          role: agent.role,
          summary: extractSummary(result.output),
        });
      }

      broadcast({ type: "run-finished", runId, ok: true, finalOutput });
    } catch (err: any) {
      broadcast({ type: "run-finished", runId, ok: false, error: err.message });
    } finally {
      running = false;
      currentAbort = null;
    }
  })();

  return { runId };
}
