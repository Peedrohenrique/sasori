import Fastify from "fastify";
import cors from "@fastify/cors";
import { addClient } from "./sse.js";
import { fsRoutes } from "./routes/fs.js";
import { agentsRoutes } from "./routes/agents.js";
import { flowsRoutes } from "./routes/flows.js";
import { gitRoutes } from "./routes/git.js";
import { runRoutes } from "./routes/run.js";

// ─── Marionette server · dispara Claude Code / Codex e transmite status via SSE

const app = Fastify({ logger: { level: "warn" } });

await app.register(cors, { origin: true });

await app.register(fsRoutes);
await app.register(agentsRoutes);
await app.register(flowsRoutes);
await app.register(gitRoutes);
await app.register(runRoutes);

// stream de eventos (marcos de execução) para o front
app.get("/events", (req, reply) => {
  addClient(reply);
});

app.get("/health", async () => ({ ok: true, name: "marionette-server" }));

const PORT = Number(process.env.MARIONETTE_PORT ?? 4001);
try {
  await app.listen({ port: PORT, host: "127.0.0.1" });
  console.log(`marionette-server ouvindo em http://localhost:${PORT}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
