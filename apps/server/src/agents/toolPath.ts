import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ToolId } from "@marionette/shared";

/** Resolve CLIs mesmo quando o servidor é iniciado por um app gráfico com PATH reduzido. */
export function toolCommand(id: ToolId): string {
  const envName = id === "claude-code" ? "MARIONETTE_CLAUDE_BIN" : "MARIONETTE_CODEX_BIN";
  const configured = process.env[envName]?.trim();
  if (configured) return configured;

  const binary = id === "claude-code" ? "claude" : "codex";
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const candidates = [
    ...pathEntries.map((dir) => path.join(dir, binary)),
    path.join(os.homedir(), ".local", "bin", binary),
    path.join(os.homedir(), ".npm-global", "bin", binary),
    "/opt/homebrew/bin/" + binary,
    "/usr/local/bin/" + binary,
  ];
  if (process.platform === "win32") candidates.push(path.join(os.homedir(), "AppData", "Roaming", "npm", `${binary}.cmd`));

  return candidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? binary;
}
