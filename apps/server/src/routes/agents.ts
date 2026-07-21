import type { FastifyInstance } from "fastify";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentPreset, SkillDocument, SkillPreset, ToolAvailability, ToolId } from "@marionette/shared";
import { toolCommand } from "../agents/toolPath.js";

// ─── Agentes pré-existentes + detecção das CLIs ─────────────────────────────
// O usuário já tem agentes criados (arquivos .md com frontmatter em
// ~/.claude/agents e <projeto>/.claude/agents). Aqui listamos todos para a UI
// oferecer "selecionar agente" em vez de criar do zero.

type PresetSource = AgentPreset["source"];
const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || "item";

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

async function scanSkillsDir(dir: string, source: SkillPreset["source"]): Promise<SkillPreset[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const skills: SkillPreset[] = [];
  for (const entry of entries.filter((item) => item.isDirectory() && !item.name.startsWith("."))) {
    const filePath = path.join(dir, entry.name, "SKILL.md");
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
      const body = frontmatter ? raw.slice(frontmatter[0].length) : raw;
      const readField = (field: string) =>
        frontmatter?.[1].split(/\r?\n/).find((line) => line.startsWith(`${field}:`))?.slice(field.length + 1).trim();
      const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
      skills.push({
        id: `${source}:${filePath}`,
        name: readField("name") || heading || entry.name,
        description: readField("description") || "Skill reutilizável do workspace",
        filePath,
        source,
      });
    } catch {
      /* sem SKILL.md válido, não aparece na biblioteca */
    }
  }
  return skills;
}

function detectTool(id: ToolId): Promise<ToolAvailability> {
  return new Promise((resolve) => {
    execFile(
      toolCommand(id),
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
    const lists = [
      await scanAgentsDir(path.join(os.homedir(), ".claude", "agents"), "user"),
      await scanAgentsDir(path.join(os.homedir(), ".marionette", "agents"), "marionette"),
    ];
    if (projectPath) {
      lists.push(await scanAgentsDir(path.join(projectPath, ".claude", "agents"), "project"));
      lists.push(await scanAgentsDir(path.join(projectPath, ".marionette", "agents"), "project"));
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

  app.post<{ Body: { name: string; description?: string; prompt: string; scope: "global" | "project"; projectPath?: string } }>(
    "/agents/presets/save",
    async (req, reply) => {
      const body = req.body;
      if (!body?.name?.trim() || !body.prompt?.trim()) return reply.code(400).send({ error: "Nome e prompt são obrigatórios." });
      if (body.scope === "project" && !body.projectPath) return reply.code(400).send({ error: "Selecione um projeto." });
      const dir = body.scope === "project"
        ? path.join(path.resolve(body.projectPath!), ".marionette", "agents")
        : path.join(os.homedir(), ".marionette", "agents");
      await fs.mkdir(dir, { recursive: true });
      const slug = slugify(body.name);
      const raw = `---\nname: ${body.name.trim()}\ndescription: ${(body.description ?? "").trim()}\n---\n\n${body.prompt.trim()}\n`;
      await fs.writeFile(path.join(dir, `${slug}.md`), raw);
      return parseAgentMd(raw, slug, body.scope === "project" ? "project" : "marionette", dir);
    },
  );

  app.post<{ Body: { dir: string; slug: string; projectPath?: string } }>("/agents/presets/delete", async (req, reply) => {
    const dir = path.resolve(req.body?.dir ?? "");
    const allowed = [path.join(os.homedir(), ".marionette", "agents")];
    if (req.body?.projectPath) allowed.push(path.join(path.resolve(req.body.projectPath), ".marionette", "agents"));
    if (!allowed.some((root) => dir === path.resolve(root))) return reply.code(403).send({ error: "Apenas presets criados pelo Marionette podem ser removidos aqui." });
    await fs.unlink(path.join(dir, `${slugify(req.body.slug)}.md`)).catch(() => {});
    return { ok: true };
  });

  app.post<{ Body: { projectPath?: string } }>("/agents/skills", async (req) => {
    const projectPath = req.body?.projectPath;
    const roots: Array<[string, SkillPreset["source"]]> = [
      [path.join(os.homedir(), ".marionette", "skills"), "marionette"],
      [path.join(os.homedir(), ".claude", "skills"), "user"],
      [path.join(os.homedir(), ".codex", "skills"), "user"],
    ];
    if (projectPath) {
      roots.push([path.join(projectPath, ".marionette", "skills"), "project"]);
      roots.push([path.join(projectPath, ".claude", "skills"), "project"]);
      roots.push([path.join(projectPath, ".codex", "skills"), "project"]);
    }
    const lists = await Promise.all(roots.map(([dir, source]) => scanSkillsDir(dir, source)));
    const seen = new Set<string>();
    return lists.flat().filter((skill) => {
      if (seen.has(skill.id)) return false;
      seen.add(skill.id);
      return true;
    });
  });

  app.post<{ Body: { filePath: string } }>("/skills/read", async (req, reply) => {
    const filePath = path.resolve(req.body?.filePath ?? "");
    if (path.basename(filePath) !== "SKILL.md") return reply.code(400).send({ error: "Arquivo de skill inválido." });
    try {
      const content = await fs.readFile(filePath, "utf8");
      return { filePath, content };
    } catch {
      return reply.code(404).send({ error: "Skill não encontrada." });
    }
  });

  app.post<{ Body: { name: string; description?: string; content: string; scope: "global" | "project"; projectPath?: string } }>(
    "/skills/save",
    async (req, reply) => {
      const body = req.body;
      if (!body?.name?.trim() || !body.content?.trim()) return reply.code(400).send({ error: "Nome e conteúdo são obrigatórios." });
      if (body.scope === "project" && !body.projectPath) return reply.code(400).send({ error: "Selecione um projeto." });
      const source: SkillPreset["source"] = body.scope === "project" ? "project" : "marionette";
      const dir = body.scope === "project"
        ? path.join(path.resolve(body.projectPath!), ".marionette", "skills", slugify(body.name))
        : path.join(os.homedir(), ".marionette", "skills", slugify(body.name));
      await fs.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, "SKILL.md");
      const content = `---\nname: ${body.name.trim()}\ndescription: ${(body.description ?? "").trim()}\n---\n\n${body.content.trim()}\n`;
      await fs.writeFile(filePath, content);
      const skill: SkillDocument = { id: `${source}:${filePath}`, name: body.name.trim(), description: body.description?.trim() || "Skill reutilizável", filePath, source, content };
      return skill;
    },
  );

  app.post<{ Body: { filePath: string; projectPath?: string } }>("/skills/delete", async (req, reply) => {
    const filePath = path.resolve(req.body?.filePath ?? "");
    const allowed = [path.join(os.homedir(), ".marionette", "skills")];
    if (req.body?.projectPath) allowed.push(path.join(path.resolve(req.body.projectPath), ".marionette", "skills"));
    if (!allowed.some((root) => filePath.startsWith(`${path.resolve(root)}${path.sep}`))) return reply.code(403).send({ error: "Apenas skills criadas pelo Marionette podem ser removidas aqui." });
    await fs.unlink(filePath).catch(() => {});
    await fs.rmdir(path.dirname(filePath)).catch(() => {});
    return { ok: true };
  });

  app.get("/tools", async () => {
    const [claude, codex] = await Promise.all([
      detectTool("claude-code"),
      detectTool("codex"),
    ]);
    return [claude, codex];
  });
}
