import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { FlowMap, FlowNode, NodeRunRecord, RunRecord, RunStatus, WorkTask } from "@marionette/shared";
import { RUNNERS } from "./agents/index.js";
import { saveRunRecord } from "./history.js";
import { broadcast } from "./sse.js";
import { commitWorktree, createWorktree, discardWorktree, integrateWorktree, type WorktreeHandle } from "./worktrees.js";

// ─── Orquestrador · DAG, tarefas e paralelismo seguro ───────────────────────
// Agentes independentes podem rodar juntos em worktrees Git; ramos dependentes
// aguardam seus pré-requisitos. A saída de cada etapa é anexada ao contexto seguinte.

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
  const selected = (paths ?? []).slice(0, 8).map((ref) => ref.includes(":") ? ref.slice(ref.indexOf(":") + 1) : ref);
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

function distributeTasks(flow: FlowMap): WorkTask[] {
  const source = flow.nodes.find((node) => node.type === "tasks")?.tasks?.tasks ?? [];
  const agents = flow.nodes.filter((node) => node.type === "agent" && node.agent);
  if (!agents.length) return source;
  return source.map((task, index) => {
    if (agents.some((agent) => agent.id === task.assignedAgentId)) return { ...task };
    const words = `${task.title} ${task.description}`.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
    const scored = agents.map((agent) => ({
      id: agent.id,
      score: words.filter((word) => `${agent.agent!.role} ${agent.agent!.prompt} ${agent.agent!.scope}`.toLowerCase().includes(word)).length,
    })).sort((a, b) => b.score - a.score);
    return { ...task, assignedAgentId: scored[0]?.score ? scored[0].id : agents[index % agents.length].id };
  });
}

export async function runFlow(flow: FlowMap, projectPath: string, workspaceId = flow.id): Promise<{ runId: string }> {
  if (running) throw new Error("Já existe um fluxo em execução.");
  const runId = randomUUID();
  running = true;
  currentAbort = new AbortController();
  const signal = currentAbort.signal;
  const tasks = distributeTasks(flow);
  const record: RunRecord = {
    id: runId,
    workspaceId,
    flowId: flow.id,
    projectPath,
    status: "running",
    startedAt: new Date().toISOString(),
    flow: structuredClone(flow),
    tasks,
    nodes: {},
  };
  for (const node of flow.nodes.filter((item) => item.type !== "input")) {
    record.nodes[node.id] = {
      nodeId: node.id,
      role: node.agent?.role ?? (node.type === "tasks" ? "Planejamento" : node.type === "output" ? "Resultado" : "Humano"),
      status: "idle",
      logs: [],
    };
  }
  await saveRunRecord(record);

  // roda em background; status vai por SSE
  (async () => {
    const status = (nodeId: string, s: RunStatus, detail?: string) => {
      const nodeRecord = record.nodes[nodeId];
      if (nodeRecord) {
        nodeRecord.status = s;
        if (s === "starting") nodeRecord.startedAt = new Date().toISOString();
        if (s === "done" || s === "error") nodeRecord.finishedAt = new Date().toISOString();
      }
      broadcast({ type: "node-status", runId, nodeId, status: s, detail });
    };

    const setTask = (task: WorkTask, next: Partial<WorkTask>) => {
      Object.assign(task, next);
      broadcast({ type: "task-status", runId, task: { ...task } });
    };

    try {
      const order = topoOrder(flow);
      broadcast({ type: "run-started", runId, order: order.map((n) => n.id), tasks });

      // entradas: junta as tarefas dos nós input que alimentam cada nó
      const outputs = new Map<string, string>();
      const processed = new Set<string>();
      for (const n of order) {
        if (n.type === "input") {
          outputs.set(n.id, n.input?.task ?? "");
          processed.add(n.id);
        }
      }

      const incomingOf = (id: string) =>
        flow.edges
          .filter((e) => e.target === id)
          .map((e) => outputs.get(e.source))
          .filter((s): s is string => Boolean(s && s.trim()))
          .join("\n\n---\n\n");

      let finalOutput = "";
      const incomingIds = (id: string) => flow.edges.filter((edge) => edge.target === id).map((edge) => edge.source);

      const runAgent = async (node: FlowNode, cwd: string) => {
        const agent = node.agent!;
        const upstream = incomingOf(node.id);
        const assigned = tasks.filter((task) => task.assignedAgentId === node.id && task.status !== "completed");
        assigned.forEach((task) => setTask(task, { status: "running" }));
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

        const taskNote = assigned.length
          ? `\n\n## Tarefas atribuídas a você\n${assigned.map((task) => `### ${task.title}\n${task.description}\nDependências: ${task.dependsOn.join(", ") || "nenhuma"}`).join("\n\n")}`
          : "";
        const userPrompt =
          (upstream
            ? `Contexto vindo das etapas anteriores do fluxo:\n\n${upstream}\n\n---\n\nContinue o trabalho a partir daí.`
            : "Execute sua função no projeto atual.") +
          taskNote + `\n\nAo terminar, encerre sua resposta com um bloco iniciado por "RESUMO:" contendo 2-3 frases: o que você fez e qual o próximo passo sugerido.`;

        const result = await RUNNERS[agent.tool]({
          systemPrompt,
          userPrompt,
          cwd,
          signal,
          onEvent: (ev) => {
            if (ev.status) status(node.id, ev.status);
            if (ev.log) {
              const logs = record.nodes[node.id]?.logs;
              if (logs) {
                logs.push(ev.log);
                if (logs.length > 1000) logs.shift();
              }
              broadcast({ type: "node-log", runId, nodeId: node.id, line: ev.log });
            }
            if (ev.todos) broadcast({ type: "node-todos", runId, nodeId: node.id, items: ev.todos });
          },
        });

        if (!result.ok) {
          assigned.forEach((task) => setTask(task, { status: "failed", result: result.error }));
          status(node.id, "error", result.error);
          throw new Error(`Agente "${agent.role}" falhou: ${result.error}`);
        }

        outputs.set(node.id, result.output);
        finalOutput = result.output;
        assigned.forEach((task) => setTask(task, { status: "completed", result: extractSummary(result.output) }));
        status(node.id, "done");
        const nodeRecord = record.nodes[node.id] as NodeRunRecord;
        nodeRecord.output = result.output;
        nodeRecord.summary = extractSummary(result.output);
        broadcast({
          type: "node-summary",
          runId,
          nodeId: node.id,
          role: agent.role,
          summary: extractSummary(result.output),
        });
      };

      while (processed.size < flow.nodes.length) {
        if (signal.aborted) throw new Error("Execução interrompida pelo usuário.");
        const ready = order.filter((node) => {
          if (processed.has(node.id)) return false;
          if (!incomingIds(node.id).every((id) => processed.has(id))) return false;
          if (node.type !== "agent") return true;
          const assigned = tasks.filter((task) => task.assignedAgentId === node.id && task.status !== "completed");
          return assigned.every((task) => task.dependsOn.every((dependencyId) => {
            const dependency = tasks.find((item) => item.id === dependencyId);
            return !dependency || dependency.status === "completed" || dependency.assignedAgentId === node.id;
          }));
        });
        if (!ready.length) throw new Error("As dependências bloquearam o fluxo. Revise as tarefas e os fios.");

        const immediate = ready.filter((node) => node.type !== "agent");
        if (immediate.length) {
          for (const node of immediate) {
            const upstream = incomingOf(node.id);
            if (node.type === "tasks") {
              outputs.set(node.id, `Plano de tarefas:\n${tasks.map((task) => `- ${task.title}: ${task.description}`).join("\n")}`);
              status(node.id, "done");
            } else if (node.type === "output") {
              outputs.set(node.id, upstream);
              finalOutput = upstream;
              status(node.id, "done");
            } else if (node.type === "human") {
              const items = node.human?.items ?? [];
              if (items.length) {
                status(node.id, "waiting-human");
                await new Promise<void>((resolve) => {
                  pendingHuman = resolve;
                  signal.addEventListener("abort", () => resolve(), { once: true });
                });
                pendingHuman = null;
              }
              if (signal.aborted) throw new Error("Execução interrompida pelo usuário.");
              outputs.set(node.id, `${upstream}\n\nTarefas humanas concluídas:\n${items.map((item) => `- [x] ${item.text}`).join("\n")}`);
              status(node.id, "done");
            }
            processed.add(node.id);
          }
          continue;
        }

        const agents = ready.filter((node) => node.type === "agent");
        if (agents.length > 1) {
          const handles = await Promise.all(agents.map((node) => createWorktree(projectPath, runId, node.id)));
          if (handles.every((handle): handle is WorktreeHandle => Boolean(handle))) {
            try {
              await Promise.all(agents.map((node, index) => runAgent(node, handles[index].cwd)));
              const commits = await Promise.all(agents.map((node, index) => commitWorktree(handles[index], node.agent!.role)));
              for (let index = 0; index < handles.length; index++) await integrateWorktree(handles[index], commits[index]);
            } catch (error) {
              await Promise.all(handles.map(discardWorktree));
              throw error;
            }
          } else {
            await Promise.all(handles.filter((handle): handle is WorktreeHandle => Boolean(handle)).map(discardWorktree));
            for (const node of agents) await runAgent(node, projectPath);
          }
        } else {
          await runAgent(agents[0], projectPath);
        }
        agents.forEach((node) => processed.add(node.id));
      }

      record.status = "completed";
      record.finishedAt = new Date().toISOString();
      record.finalOutput = finalOutput;
      record.tasks = tasks;
      await saveRunRecord(record);
      broadcast({ type: "run-finished", runId, ok: true, finalOutput });
    } catch (err: any) {
      record.status = signal.aborted ? "stopped" : "failed";
      record.finishedAt = new Date().toISOString();
      record.error = err.message;
      record.tasks = tasks;
      await saveRunRecord(record).catch(() => {});
      broadcast({ type: "run-finished", runId, ok: false, error: err.message });
    } finally {
      running = false;
      currentAbort = null;
    }
  })();

  return { runId };
}
