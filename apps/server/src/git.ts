import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// ─── Kage Bunshin · rede de segurança com Git ───────────────────────────────
// Tudo roda via `git` CLI dentro da pasta-alvo. Nenhum merge/delete acontece
// sem o usuário confirmar na UI (as rotas só são chamadas após confirmação).

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await exec("git", args, { cwd });
  return stdout.trim();
}

export interface GitInfo {
  isRepo: boolean;
  branch: string | null;
  dirty: boolean;
}

export async function gitInfo(cwd: string): Promise<GitInfo> {
  try {
    await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return { isRepo: false, branch: null, dirty: false };
  }
  let branch: string | null = null;
  try {
    branch = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {
    branch = null; // repo sem commits ainda
  }
  const status = await git(cwd, ["status", "--porcelain"]);
  return { isRepo: true, branch, dirty: status.length > 0 };
}

export async function gitInit(cwd: string): Promise<void> {
  await git(cwd, ["init"]);
}

/** Transforma o nome da tarefa em slug de branch: "Refazer landing" → sasori/refazer-landing */
export function branchSlug(task: string): string {
  const slug = task
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `sasori/${slug || "tarefa"}`;
}

/** "Invocar clone": cria e troca para a branch do Sasori. Retorna {branch, previousBranch}. */
export async function summonClone(cwd: string, task: string): Promise<{ branch: string; previousBranch: string }> {
  const previousBranch = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  let branch = branchSlug(task);
  // evita colisão com branch existente
  try {
    await git(cwd, ["rev-parse", "--verify", branch]);
    branch = `${branch}-${Date.now().toString(36)}`;
  } catch {
    /* branch livre */
  }
  await git(cwd, ["checkout", "-b", branch]);
  return { branch, previousBranch };
}

/** "Trazer de volta": commita o que estiver pendente e faz merge na branch original. */
export async function mergeClone(cwd: string, branch: string, previousBranch: string): Promise<void> {
  const status = await git(cwd, ["status", "--porcelain"]);
  if (status.length > 0) {
    await git(cwd, ["add", "-A"]);
    await git(cwd, ["commit", "-m", `sasori: trabalho do clone ${branch}`]);
  }
  await git(cwd, ["checkout", previousBranch]);
  await git(cwd, ["merge", "--no-ff", branch, "-m", `sasori: merge do clone ${branch}`]);
}

/** "Dispersar clone": volta para a branch original e apaga a branch do clone. */
export async function disperseClone(cwd: string, branch: string, previousBranch: string): Promise<void> {
  await git(cwd, ["checkout", previousBranch]);
  await git(cwd, ["branch", "-D", branch]);
}
