import type { FastifyInstance } from "fastify";
import { disperseClone, gitInfo, gitInit, mergeClone, summonClone } from "../git.js";

// ─── Rotas Git · Kage Bunshin ───────────────────────────────────────────────
// A UI só chama merge/disperse depois do usuário confirmar explicitamente.

interface PathBody {
  path: string;
}

export async function gitRoutes(app: FastifyInstance) {
  app.post<{ Body: PathBody }>("/git/info", async (req) => gitInfo(req.body.path));

  app.post<{ Body: PathBody }>("/git/init", async (req, reply) => {
    try {
      await gitInit(req.body.path);
      return gitInfo(req.body.path);
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // "invocar clone" → cria branch sasori/<tarefa>
  app.post<{ Body: PathBody & { task: string } }>("/git/summon", async (req, reply) => {
    try {
      return await summonClone(req.body.path, req.body.task || "tarefa");
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // "trazer de volta" → merge na branch original
  app.post<{ Body: PathBody & { branch: string; previousBranch: string } }>("/git/merge", async (req, reply) => {
    try {
      await mergeClone(req.body.path, req.body.branch, req.body.previousBranch);
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // "dispersar clone" → apaga a branch
  app.post<{ Body: PathBody & { branch: string; previousBranch: string } }>("/git/disperse", async (req, reply) => {
    try {
      await disperseClone(req.body.path, req.body.branch, req.body.previousBranch);
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
