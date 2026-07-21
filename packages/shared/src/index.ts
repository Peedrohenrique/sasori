// ─── Sasori · mapa de agentes (tipos compartilhados web ↔ server) ───────────

/** Ferramenta de IA que executa o agente como subprocesso. */
export type ToolId = "claude-code" | "codex";

export type NodeType = "input" | "agent" | "output" | "human";

/** Marcos de status emitidos via SSE durante a execução de um nó. */
export type RunStatus =
  | "idle"
  | "starting" // iniciando
  | "planning" // planejando
  | "editing" // editando arquivos
  | "running-commands" // rodando comandos
  | "waiting-human" // aguardando humano concluir as tarefas manuais
  | "done" // concluído
  | "error"; // erro

export interface AgentNodeData {
  /** Papel/nome: Sasori, Front, Back, Testes, Revisor… */
  role: string;
  /** Instrução (system prompt) do agente. */
  prompt: string;
  tool: ToolId;
  /** Subpasta do projeto onde o agente pode mexer (vazio = projeto todo). */
  scope: string;
  /** Contexto Markdown específico que acompanha este agente. */
  contextMarkdown?: string;
  /** Skills ou procedimentos adicionais, uma instrução por item. */
  skills?: string[];
  /** IDs de skills reutilizáveis descobertas no workspace. */
  skillRefs?: string[];
  /** Slug do agente pré-existente selecionado (~/.claude/agents), se houver. */
  presetSlug?: string;
}

export interface InputNodeData {
  /** Tarefa inicial digitada pelo usuário. */
  task: string;
}

export interface HumanTask {
  id: string;
  text: string;
  done: boolean;
}

/** Nó "tarefas de humano": o fluxo pausa aqui até o usuário concluir e continuar. */
export interface HumanNodeData {
  items: HumanTask[];
}

/** Item do plano vivo do agente (todo list emitida pela própria CLI durante o trabalho). */
export interface TodoItem {
  text: string;
  status: "pending" | "in_progress" | "completed";
}

export interface FlowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  agent?: AgentNodeData; // quando type === "agent"
  input?: InputNodeData; // quando type === "input"
  human?: HumanNodeData; // quando type === "human"
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
}

/** O "mapa de agentes": um canvas completo, persistido em JSON local. */
export interface FlowMap {
  id: string;
  name: string;
  projectPath: string | null;
  /** Pastas extras (escolhidas pelo usuário) onde buscar agentes pré-existentes. */
  agentDirs?: string[];
  nodes: FlowNode[];
  edges: FlowEdge[];
  updatedAt: string;
}

/** Projeto aberto no Marionette: cada workspace guarda seu canvas e contexto. */
export interface Workspace {
  id: string;
  name: string;
  projectPath: string | null;
  flowId: string;
  icon?: string;
  updatedAt: string;
}

export interface WorkspaceCreateRequest {
  name?: string;
  projectPath: string;
  icon?: string;
}

// ─── Agentes pré-existentes (arquivos .md em .claude/agents) ────────────────

export interface AgentPreset {
  slug: string;
  name: string;
  description: string;
  prompt: string;
  /** "user" = ~/.claude/agents · "project" = <projeto>/.claude/agents · "custom" = pasta escolhida */
  source: "user" | "project" | "custom";
  /** Pasta de origem (para exibir/agrupar fontes custom). */
  dir: string;
}

export interface SkillPreset {
  id: string;
  name: string;
  description: string;
  filePath: string;
  source: "user" | "project" | "marionette";
}

// ─── Server API ─────────────────────────────────────────────────────────────

export interface DirEntry {
  name: string;
  path: string;
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  dirs: DirEntry[];
}

export interface ProjectInfo {
  path: string;
  exists: boolean;
  isGitRepo: boolean;
  branch: string | null;
  dirty: boolean;
}

export interface ToolAvailability {
  id: ToolId;
  available: boolean;
  version: string | null;
}

export interface RunRequest {
  flow: FlowMap;
  projectPath: string;
}

// ─── Eventos SSE ────────────────────────────────────────────────────────────

export type SasoriEvent =
  | { type: "run-started"; runId: string; order: string[] }
  | { type: "node-status"; runId: string; nodeId: string; status: RunStatus; detail?: string }
  | {
      type: "node-summary"; // bloco "Ombro": o que foi feito + próximo passo
      runId: string;
      nodeId: string;
      role: string;
      summary: string;
    }
  | { type: "node-log"; runId: string; nodeId: string; line: string }
  | { type: "node-todos"; runId: string; nodeId: string; items: TodoItem[] }
  | { type: "run-finished"; runId: string; ok: boolean; error?: string; finalOutput?: string };

export const STATUS_LABELS: Record<RunStatus, string> = {
  idle: "aguardando",
  starting: "iniciando",
  planning: "planejando",
  editing: "editando arquivos",
  "running-commands": "rodando comandos",
  "waiting-human": "aguardando humano",
  done: "concluído",
  error: "erro",
};
