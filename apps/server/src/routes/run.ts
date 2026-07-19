import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import type { RunRequest } from "@sasori/shared";
import { continueRun, isRunning, runFlow, stopRun } from "../orchestrator.js";

export async function runRoutes(app: FastifyInstance) {
  app.post<{ Body: RunRequest }>("/run", async (req, reply) => {
    const { flow, projectPath } = req.body;
    if (!projectPath) return reply.code(400).send({ error: "Selecione a pasta do projeto antes de executar." });
    try {
      if (!(await fs.stat(projectPath)).isDirectory()) throw new Error();
    } catch {
      return reply.code(400).send({ error: `Pasta não existe: ${projectPath}` });
    }
    try {
      return await runFlow(flow, projectPath);
    } catch (err: any) {
      return reply.code(409).send({ error: err.message });
    }
  });

  // humano concluiu as tarefas manuais → fluxo segue
  app.post("/run/continue", async () => ({ ok: continueRun() }));

  app.post("/run/stop", async () => {
    stopRun();
    return { ok: true };
  });

  app.get("/run/status", async () => ({ running: isRunning() }));
}
