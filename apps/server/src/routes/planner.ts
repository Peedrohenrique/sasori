import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import type { PlanRequest, PlanResponse, WorkTask } from "@marionette/shared";
import { RUNNERS } from "../agents/index.js";

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1);
  return JSON.parse(candidate);
}

export async function plannerRoutes(app: FastifyInstance) {
  app.post<{ Body: PlanRequest }>("/plan", async (req, reply) => {
    const { flow, projectPath, objective } = req.body;
    const agents = flow.nodes.filter((node) => node.type === "agent" && node.agent);
    if (!objective?.trim()) return reply.code(400).send({ error: "Descreva o objetivo antes de planejar." });
    if (agents.length === 0) return reply.code(400).send({ error: "Adicione ao menos um agente ao fluxo." });

    const tool = req.body.tool ?? agents[0].agent!.tool;
    const runner = RUNNERS[tool];
    const abort = new AbortController();
    const catalog = agents.map((node) => ({ id: node.id, role: node.agent!.role, prompt: node.agent!.prompt.slice(0, 500), scope: node.agent!.scope }));
    const result = await runner({
      cwd: projectPath,
      signal: abort.signal,
      onEvent: () => {},
      systemPrompt: "Você é o planejador do Marionette. Apenas analise: não edite arquivos nem execute comandos. Converta objetivos em tarefas pequenas, verificáveis e distribuíveis.",
      userPrompt: `Objetivo:\n${objective.trim()}\n\nAgentes disponíveis:\n${JSON.stringify(catalog, null, 2)}\n\nResponda SOMENTE com um array JSON. Cada item deve ter: title, description, dependsOn (índices anteriores, começando em 0) e assignedAgentId (um ID exato do catálogo). Crie dependências apenas quando realmente necessárias para permitir paralelismo.`,
    });
    if (!result.ok) return reply.code(500).send({ error: result.error ?? "O planejador falhou." });

    try {
      const parsed = extractJson(result.output);
      if (!Array.isArray(parsed)) throw new Error();
      const ids = parsed.map(() => `task_${randomUUID().replaceAll("-", "").slice(0, 10)}`);
      const validAgents = new Set(agents.map((agent) => agent.id));
      const tasks: WorkTask[] = parsed.slice(0, 30).map((item: any, index) => {
        const dependencies = Array.isArray(item.dependsOn)
          ? item.dependsOn.map(Number).filter((dep: number) => Number.isInteger(dep) && dep >= 0 && dep < index).map((dep: number) => ids[dep])
          : [];
        return {
          id: ids[index],
          title: String(item.title || `Tarefa ${index + 1}`).slice(0, 140),
          description: String(item.description || "").slice(0, 3000),
          dependsOn: dependencies,
          assignedAgentId: validAgents.has(item.assignedAgentId) ? item.assignedAgentId : agents[index % agents.length].id,
          status: dependencies.length ? "blocked" : "ready",
        };
      });
      return { tasks } satisfies PlanResponse;
    } catch {
      return reply.code(500).send({ error: "O planejador respondeu em formato inválido. Tente novamente." });
    }
  });
}
