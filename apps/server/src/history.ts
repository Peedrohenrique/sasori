import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { RunRecord } from "@marionette/shared";

const HISTORY_DIR = path.join(os.homedir(), ".marionette", "history");
const safeId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

export async function saveRunRecord(record: RunRecord): Promise<void> {
  const dir = path.join(HISTORY_DIR, safeId(record.workspaceId) ? record.workspaceId : "default");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${record.id}.json`), JSON.stringify(record, null, 2));
}

export async function listRunRecords(workspaceId: string): Promise<RunRecord[]> {
  if (!safeId(workspaceId)) return [];
  const dir = path.join(HISTORY_DIR, workspaceId);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const records = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => {
    try {
      return JSON.parse(await fs.readFile(path.join(dir, file), "utf8")) as RunRecord;
    } catch {
      return null;
    }
  }));
  return records.filter((record): record is RunRecord => Boolean(record)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function readRunRecord(workspaceId: string, runId: string): Promise<RunRecord | null> {
  if (!safeId(workspaceId) || !safeId(runId)) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(HISTORY_DIR, workspaceId, `${runId}.json`), "utf8"));
  } catch {
    return null;
  }
}
