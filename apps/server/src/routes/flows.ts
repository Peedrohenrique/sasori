import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { FlowMap } from "@sasori/shared";

// ─── Persistência dos canvases em JSON local (sem banco) ────────────────────
// Arquivos em ~/.sasori/flows/<id>.json — fora do repo, multiplataforma.

const FLOWS_DIR = path.join(os.homedir(), ".sasori", "flows");

const safeId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

export async function flowsRoutes(app: FastifyInstance) {
  app.get("/flows", async () => {
    await fs.mkdir(FLOWS_DIR, { recursive: true });
    const files = (await fs.readdir(FLOWS_DIR)).filter((f) => f.endsWith(".json"));
    const flows: FlowMap[] = [];
    for (const f of files) {
      try {
        flows.push(JSON.parse(await fs.readFile(path.join(FLOWS_DIR, f), "utf8")));
      } catch {
        /* json corrompido, pula */
      }
    }
    return flows.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  });

  app.get<{ Params: { id: string } }>("/flows/:id", async (req, reply) => {
    if (!safeId(req.params.id)) return reply.code(400).send({ error: "id inválido" });
    try {
      return JSON.parse(await fs.readFile(path.join(FLOWS_DIR, `${req.params.id}.json`), "utf8"));
    } catch {
      return reply.code(404).send({ error: "fluxo não encontrado" });
    }
  });

  app.put<{ Params: { id: string }; Body: FlowMap }>("/flows/:id", async (req, reply) => {
    if (!safeId(req.params.id)) return reply.code(400).send({ error: "id inválido" });
    await fs.mkdir(FLOWS_DIR, { recursive: true });
    const flow: FlowMap = { ...req.body, id: req.params.id, updatedAt: new Date().toISOString() };
    await fs.writeFile(path.join(FLOWS_DIR, `${req.params.id}.json`), JSON.stringify(flow, null, 2));
    return flow;
  });
}
