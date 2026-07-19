import type { FastifyInstance } from "fastify";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BrowseResult, ProjectInfo } from "@sasori/shared";
import { gitInfo } from "../git.js";

// ─── Navegação de pastas + validação da pasta-alvo ──────────────────────────
// O navegador não acessa o disco; o server lista pastas para o seletor da UI.
// Sempre `path` do Node — funciona em macOS (/Users/…) e Windows (C:\Users\…).

export async function fsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { path?: string } }>("/fs/browse", async (req, reply) => {
    const target = path.resolve(req.query.path?.trim() || os.homedir());

    let entries;
    try {
      entries = await fs.readdir(target, { withFileTypes: true });
    } catch {
      return reply.code(400).send({ error: `Não consegui ler a pasta: ${target}` });
    }

    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => ({ name: e.name, path: path.join(target, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parent = path.dirname(target);
    const result: BrowseResult = {
      path: target,
      parent: parent === target ? null : parent, // raiz do disco não tem pai
      dirs,
    };
    return result;
  });

  app.post<{ Body: { path?: string } }>("/project/validate", async (req, reply) => {
    const raw = req.body?.path?.trim();
    if (!raw) return reply.code(400).send({ error: "Informe o caminho da pasta." });

    const target = path.resolve(raw);
    let exists = false;
    try {
      exists = (await fs.stat(target)).isDirectory();
    } catch {
      exists = false;
    }

    const git = exists ? await gitInfo(target) : { isRepo: false, branch: null, dirty: false };
    const info: ProjectInfo = {
      path: target,
      exists,
      isGitRepo: git.isRepo,
      branch: git.branch,
      dirty: git.dirty,
    };
    return info;
  });
}
