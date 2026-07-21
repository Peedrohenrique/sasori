import type { FastifyInstance } from "fastify";
import { listRunRecords, readRunRecord } from "../history.js";

export async function historyRoutes(app: FastifyInstance) {
  app.get<{ Params: { workspaceId: string } }>("/history/:workspaceId", async (req) =>
    listRunRecords(req.params.workspaceId),
  );

  app.get<{ Params: { workspaceId: string; runId: string } }>(
    "/history/:workspaceId/:runId",
    async (req, reply) => {
      const record = await readRunRecord(req.params.workspaceId, req.params.runId);
      return record ?? reply.code(404).send({ error: "execução não encontrada" });
    },
  );
}
