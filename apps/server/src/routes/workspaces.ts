import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Workspace, WorkspaceCreateRequest } from "@marionette/shared";

const MARIONETTE_DIR = path.join(os.homedir(), ".marionette");
const WORKSPACES_FILE = path.join(MARIONETTE_DIR, "workspaces.json");
const safeId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

async function readWorkspaces(): Promise<Workspace[]> {
  try {
    const raw = await fs.readFile(WORKSPACES_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeWorkspaces(workspaces: Workspace[]): Promise<void> {
  await fs.mkdir(MARIONETTE_DIR, { recursive: true });
  await fs.writeFile(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2));
}

function displayName(projectPath: string): string {
  return path.basename(projectPath) || projectPath;
}

export async function workspacesRoutes(app: FastifyInstance) {
  app.get("/workspaces", async () => readWorkspaces());

  app.post<{ Body: WorkspaceCreateRequest }>("/workspaces", async (req, reply) => {
    const projectPath = path.resolve(req.body?.projectPath?.trim() ?? "");
    if (!projectPath) return reply.code(400).send({ error: "Informe a pasta do projeto." });

    try {
      if (!(await fs.stat(projectPath)).isDirectory()) throw new Error();
    } catch {
      return reply.code(400).send({ error: `Pasta não existe: ${projectPath}` });
    }

    const now = new Date().toISOString();
    const workspace: Workspace = {
      id: `ws_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      name: req.body?.name?.trim() || displayName(projectPath),
      projectPath,
      flowId: `flow_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      icon: req.body?.icon || "folder",
      updatedAt: now,
    };
    const workspaces = await readWorkspaces();
    workspaces.unshift(workspace);
    await writeWorkspaces(workspaces);
    return workspace;
  });

  app.put<{ Params: { id: string }; Body: Partial<Workspace> }>("/workspaces/:id", async (req, reply) => {
    if (!safeId(req.params.id)) return reply.code(400).send({ error: "id inválido" });
    const workspaces = await readWorkspaces();
    const index = workspaces.findIndex((workspace) => workspace.id === req.params.id);
    if (index < 0) return reply.code(404).send({ error: "workspace não encontrado" });
    const current = workspaces[index];
    const next: Workspace = {
      ...current,
      ...(req.body ?? {}),
      id: current.id,
      flowId: current.flowId,
      updatedAt: new Date().toISOString(),
    };
    workspaces[index] = next;
    await writeWorkspaces(workspaces);
    return next;
  });

  // Remove apenas o workspace da lista. A pasta do projeto e o canvas salvo permanecem no disco.
  app.delete<{ Params: { id: string } }>("/workspaces/:id", async (req, reply) => {
    if (!safeId(req.params.id)) return reply.code(400).send({ error: "id inválido" });
    const workspaces = await readWorkspaces();
    const next = workspaces.filter((workspace) => workspace.id !== req.params.id);
    if (next.length === workspaces.length) return reply.code(404).send({ error: "workspace não encontrado" });
    await writeWorkspaces(next);
    return { ok: true };
  });
}
