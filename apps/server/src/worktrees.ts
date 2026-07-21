import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const git = async (cwd: string, args: string[]) => (await exec("git", args, { cwd })).stdout.trim();

export interface WorktreeHandle {
  cwd: string;
  branch: string;
  baseCwd: string;
}

export async function createWorktree(baseCwd: string, runId: string, nodeId: string): Promise<WorktreeHandle | null> {
  try {
    await git(baseCwd, ["rev-parse", "HEAD"]);
    if (await git(baseCwd, ["status", "--porcelain"])) return null;
  } catch {
    return null;
  }
  const root = path.join(os.homedir(), ".marionette", "worktrees", runId);
  await fs.mkdir(root, { recursive: true });
  const safeNode = nodeId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const cwd = path.join(root, safeNode);
  const branch = `marionette/parallel-${runId.slice(0, 8)}-${safeNode.slice(0, 24)}`;
  await git(baseCwd, ["worktree", "add", "-b", branch, cwd, "HEAD"]);
  return { cwd, branch, baseCwd };
}

export async function commitWorktree(handle: WorktreeHandle, role: string): Promise<boolean> {
  const dirty = await git(handle.cwd, ["status", "--porcelain"]);
  if (!dirty) return false;
  await git(handle.cwd, ["add", "-A"]);
  await git(handle.cwd, ["commit", "-m", `marionette: trabalho paralelo de ${role}`]);
  return true;
}

export async function integrateWorktree(handle: WorktreeHandle, hasCommit: boolean): Promise<void> {
  await git(handle.baseCwd, ["worktree", "remove", "--force", handle.cwd]);
  if (hasCommit) {
    try {
      await git(handle.baseCwd, ["merge", "--no-ff", handle.branch, "-m", `marionette: integrar ${handle.branch}`]);
    } catch (error) {
      await git(handle.baseCwd, ["merge", "--abort"]).catch(() => "");
      throw error;
    }
  }
  await git(handle.baseCwd, ["branch", "-D", handle.branch]).catch(() => "");
}

export async function discardWorktree(handle: WorktreeHandle): Promise<void> {
  await git(handle.baseCwd, ["worktree", "remove", "--force", handle.cwd]).catch(() => "");
  await git(handle.baseCwd, ["branch", "-D", handle.branch]).catch(() => "");
}
