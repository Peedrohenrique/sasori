import type { FastifyReply } from "fastify";
import type { SasoriEvent } from "@sasori/shared";

// ─── Broker SSE ─────────────────────────────────────────────────────────────
// Mantém as conexões abertas dos navegadores e transmite marcos de execução
// (não cada micro-passo) para todos os clientes conectados.

type Client = { id: number; reply: FastifyReply };

let nextId = 1;
const clients = new Map<number, Client>();

export function addClient(reply: FastifyReply): number {
  const id = nextId++;

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  reply.raw.write(`: conectado\n\n`);

  clients.set(id, { id, reply });

  // keep-alive: proxies derrubam conexões silenciosas
  const ping = setInterval(() => {
    reply.raw.write(`: ping\n\n`);
  }, 25_000);

  reply.raw.on("close", () => {
    clearInterval(ping);
    clients.delete(id);
  });

  return id;
}

/** Envia um evento para todos os clientes conectados. */
export function broadcast(event: SasoriEvent): void {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const { reply } of clients.values()) {
    reply.raw.write(payload);
  }
}
