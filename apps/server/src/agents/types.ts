import type { RunStatus, TodoItem } from "@sasori/shared";

// ─── Interface comum dos runners ────────────────────────────────────────────
// runClaudeCode.ts e runCodex.ts implementam esta interface. Para adicionar
// outra ferramenta, crie runOutra.ts e registre em ./index.ts.

export interface RunnerEvent {
  status?: RunStatus;
  /** linha crua de log (stdout), para depuração na UI */
  log?: string;
  /** plano vivo: todo list que a própria CLI mantém enquanto trabalha */
  todos?: TodoItem[];
}

export interface RunnerOptions {
  /** Instrução do agente (system prompt). */
  systemPrompt: string;
  /** Tarefa + saída do agente anterior. */
  userPrompt: string;
  /** Pasta-alvo do projeto (cwd do subprocesso). */
  cwd: string;
  onEvent: (ev: RunnerEvent) => void;
  signal?: AbortSignal;
}

export interface RunnerResult {
  ok: boolean;
  /** Saída final do agente (texto), passada para o próximo nó. */
  output: string;
  error?: string;
}

export type AgentRunner = (opts: RunnerOptions) => Promise<RunnerResult>;
