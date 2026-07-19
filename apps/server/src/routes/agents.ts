import type { FastifyInstance } from "fastify";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentPreset, ToolAvailability, ToolId } from "@sasori/shared";

// ─── Agentes pré-existentes + detecção das CLIs ─────────────────────────────
// O usuário já tem agentes criados (arquivos .md com frontmatter em
// ~/.claude/agents e <projeto>/.claude/agents). Aqui listamos todos para a UI
// oferecer "selecionar agente" em vez de criar do zero.

type PresetSource = AgentPreset["source"];

function parseAgentMd(raw: string, slug: string, source: PresetSource, dir: string): AgentPreset {
  let name = slug;
  let description = "";
  let body = raw;

  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fm) {
    body = fm[2].trim();
    for (const line of fm[1].split(/\r?\n/)) {
      const m = line.match(/^(name|description):\s*(.+)$/);
      if (m) {
        if (m[1] === "name") name = m[2].trim();
        else description = m[2].trim();
      }
    }
  }
  return { slug, name, description, prompt: body.trim(), source, dir };
}

async function scanAgentsDir(dir: string, source: PresetSource): Promise<AgentPreset[]> {
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return []; // pasta não existe — sem agentes desta fonte
  }
  const presets: AgentPreset[] = [];
  for (const file of files.filter((f) => f.endsWith(".md"))) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf8");
      presets.push(parseAgentMd(raw, path.basename(file, ".md"), source, dir));
    } catch {
      /* arquivo ilegível, pula */
    }
  }
  return presets;
}

function detectTool(id: ToolId, bin: string): Promise<ToolAvailability> {
  return new Promise((resolve) => {
    execFile(
      bin,
      ["--version"],
      { shell: process.platform === "win32", timeout: 8000 },
      (err, stdout) => {
        if (err) resolve({ id, available: false, version: null });
        else resolve({ id, available: true, version: stdout.trim().split("\n")[0] });
      },
    );
  });
}

export async function agentsRoutes(app: FastifyInstance) {
  // Busca agentes nas fontes padrão (~/.claude/agents, <projeto>/.claude/agents)
  // E em qualquer pasta extra que o usuário escolher navegando pelo disco.
  app.post<{ Body: { projectPath?: string; extraDirs?: string[] } }>("/agents/presets", async (req) => {
    const { projectPath, extraDirs = [] } = req.body ?? {};
    const lists = [await scanAgentsDir(path.join(os.homedir(), ".claude", "agents"), "user")];
    if (projectPath) {
      lists.push(await scanAgentsDir(path.join(projectPath, ".claude", "agents"), "project"));
    }
    for (const dir of extraDirs) {
      lists.push(await scanAgentsDir(path.resolve(dir), "custom"));
    }
    // remove duplicados (mesma pasta indicada duas vezes)
    const seen = new Set<string>();
    return lists.flat().filter((p) => {
      const key = `${p.dir}::${p.slug}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  app.get("/tools", async () => {
    const [claude, codex] = await Promise.all([
      detectTool("claude-code", process.env.SASORI_CLAUDE_BIN || "claude"),
      detectTool("codex", process.env.SASORI_CODEX_BIN || "codex"),
    ]);
    return [claude, codex];
  });
}
