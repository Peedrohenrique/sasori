import type { ToolId } from "@sasori/shared";
import type { AgentRunner } from "./types.js";
import { runClaudeCode } from "./runClaudeCode.js";
import { runCodex } from "./runCodex.js";

/** Registro de runners — adicione novas ferramentas aqui. */
export const RUNNERS: Record<ToolId, AgentRunner> = {
  "claude-code": runClaudeCode,
  codex: runCodex,
};
