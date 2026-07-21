"use client";

import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type {
  AgentNodeData,
  AgentPreset,
  FlowMap,
  HumanTask,
  ProjectInfo,
  RunStatus,
  SasoriEvent,
  SkillPreset,
  TaskNodeData,
  TodoItem,
  ToolAvailability,
  Workspace,
  WorkTaskStatus,
} from "@marionette/shared";
import { api } from "./api";

export type RFNode = Node<Record<string, unknown>>;

export interface Summary {
  nodeId: string;
  role: string;
  summary: string;
  ts: number;
}

export interface CloneInfo {
  branch: string;
  previousBranch: string;
}

let idc = 1;
const uid = () => `n_${Date.now().toString(36)}_${idc++}`;

const DEFAULT_AGENT: AgentNodeData = {
  role: "Sasori",
  prompt: "Analise a tarefa recebida e execute-a no projeto com cuidado.",
  tool: "claude-code",
  scope: "",
};

const START_NODES: RFNode[] = [
  { id: "start-input", type: "input-node", position: { x: 60, y: 220 }, data: { task: "" } },
  {
    id: "start-agent",
    type: "agent-node",
    position: { x: 740, y: 180 },
    data: { agent: { ...DEFAULT_AGENT } },
  },
  { id: "start-output", type: "output-node", position: { x: 1420, y: 220 }, data: {} },
];

const START_EDGES: Edge[] = [
  { id: "e1", source: "start-input", target: "start-agent" },
  { id: "e2", source: "start-agent", target: "start-output" },
];

// Reposiciona apenas o fluxo inicial legado; layouts que o usuário já organizou
// manualmente continuam exatamente onde foram salvos.
const upgradedStarterPosition = (id: string, position: { x: number; y: number }) => {
  if (id === "start-agent" && [420, 660].includes(position.x) && position.y === 180)
    return { x: 740, y: 180 };
  if (id === "start-output" && [800, 1260].includes(position.x) && position.y === 220)
    return { x: 1420, y: 220 };
  return position;
};

interface SasoriState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  nodes: RFNode[];
  edges: Edge[];
  project: ProjectInfo | null;
  tools: ToolAvailability[];
  presets: AgentPreset[];
  skillLibrary: SkillPreset[];
  selectedId: string | null;
  /** Pastas extras escolhidas pelo usuário onde buscar agentes prontos. */
  agentDirs: string[];
  statuses: Record<string, RunStatus>;
  /** Plano vivo por nó: todo list que a CLI vai marcando durante o trabalho. */
  todos: Record<string, TodoItem[]>;
  summaries: Summary[];
  running: boolean;
  runError: string | null;
  finalOutput: string | null;
  clone: CloneInfo | null;
  logs: Record<string, string[]>;
  taskStatuses: Record<string, WorkTaskStatus>;
  resourcePanel: "skills" | "presets" | "templates" | "history" | null;

  onNodesChange: (changes: NodeChange<RFNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  addAgentNode: (preset?: AgentPreset) => void;
  addHumanNode: () => void;
  addTaskNode: () => void;
  addAgentDir: (dir: string) => void;
  removeAgentDir: (dir: string) => void;
  deleteNode: (id: string) => void;
  updateAgent: (id: string, patch: Partial<AgentNodeData>) => void;
  updateTask: (id: string, task: string) => void;
  updateHumanItems: (id: string, items: HumanTask[]) => void;
  updateTaskBoard: (id: string, data: Partial<TaskNodeData>) => void;
  select: (id: string | null) => void;
  setProject: (p: ProjectInfo | null) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setActiveWorkspaceId: (id: string | null) => void;
  setTools: (t: ToolAvailability[]) => void;
  setPresets: (p: AgentPreset[]) => void;
  setSkillLibrary: (skills: SkillPreset[]) => void;
  setClone: (c: CloneInfo | null) => void;
  setRunning: (r: boolean) => void;
  setResourcePanel: (panel: SasoriState["resourcePanel"]) => void;
  applyEvent: (ev: SasoriEvent) => void;
  toFlowMap: () => FlowMap;
  loadFlowMap: (flow: FlowMap) => void;
}

export const useSasori = create<SasoriState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  nodes: START_NODES,
  edges: START_EDGES,
  project: null,
  tools: [],
  presets: [],
  skillLibrary: [],
  selectedId: null,
  agentDirs: [],
  statuses: {},
  todos: {},
  summaries: [],
  running: false,
  runError: null,
  finalOutput: null,
  clone: null,
  logs: {},
  taskStatuses: {},
  resourcePanel: null,

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),
  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
  onConnect: (conn) => {
    // um fio só: saída → entrada, sem duplicar
    const dup = get().edges.some((e) => e.source === conn.source && e.target === conn.target);
    if (dup || conn.source === conn.target) return;
    set({ edges: addEdge({ ...conn, id: uid() }, get().edges) });
  },

  addAgentNode: (preset) => {
    const agent: AgentNodeData = preset
      ? { role: preset.name, prompt: preset.prompt, tool: "claude-code", scope: "", presetSlug: preset.slug }
      : { ...DEFAULT_AGENT, role: "Novo agente" };
    const id = uid();
    set({
      nodes: [
        ...get().nodes,
        {
          id,
          type: "agent-node",
          position: { x: 300 + Math.random() * 160, y: 340 + Math.random() * 100 },
          data: { agent },
        },
      ],
      selectedId: id,
    });
  },

  addHumanNode: () => {
    const id = uid();
    set({
      nodes: [
        ...get().nodes,
        {
          id,
          type: "human-node",
          position: { x: 340 + Math.random() * 160, y: 420 + Math.random() * 100 },
          data: { items: [] as HumanTask[] },
        },
      ],
      selectedId: id,
    });
  },

  addTaskNode: () => {
    const id = uid();
    set({
      nodes: [...get().nodes, { id, type: "tasks-node", position: { x: 420, y: 260 }, data: { objective: "", tasks: [] } }],
      selectedId: id,
    });
  },

  addAgentDir: (dir) => {
    if (get().agentDirs.includes(dir)) return;
    set({ agentDirs: [...get().agentDirs, dir] });
    refreshPresets();
  },

  removeAgentDir: (dir) => {
    set({ agentDirs: get().agentDirs.filter((d) => d !== dir) });
    refreshPresets();
  },

  deleteNode: (id) =>
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    }),

  updateAgent: (id, patch) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, agent: { ...(n.data.agent as AgentNodeData), ...patch } } } : n,
      ),
    }),

  updateTask: (id, task) =>
    set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, task } } : n)) }),

  updateHumanItems: (id, items) =>
    set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, items } } : n)) }),

  updateTaskBoard: (id, patch) =>
    set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...(n.data as unknown as TaskNodeData), ...patch } } : n)) }),

  select: (id) => set({ selectedId: id }),
  setProject: (project) => set({ project }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
  setTools: (tools) => set({ tools }),
  setPresets: (presets) => set({ presets }),
  setSkillLibrary: (skillLibrary) => set({ skillLibrary }),
  setClone: (clone) => set({ clone }),
  setRunning: (running) => set({ running }),
  setResourcePanel: (resourcePanel) => set({ resourcePanel }),

  applyEvent: (ev) => {
    if (ev.type === "run-started") {
      const statuses: Record<string, RunStatus> = {};
      for (const id of ev.order) statuses[id] = "idle";
      set({ running: true, statuses, todos: {}, summaries: [], runError: null, finalOutput: null });
      set({ logs: {}, taskStatuses: Object.fromEntries((ev.tasks ?? []).map((task) => [task.id, task.status])) });
    } else if (ev.type === "node-status") {
      set({ statuses: { ...get().statuses, [ev.nodeId]: ev.status } });
    } else if (ev.type === "node-todos") {
      set({ todos: { ...get().todos, [ev.nodeId]: ev.items } });
    } else if (ev.type === "node-summary") {
      set({
        summaries: [...get().summaries, { nodeId: ev.nodeId, role: ev.role, summary: ev.summary, ts: Date.now() }],
      });
    } else if (ev.type === "node-log") {
      const logs = [...(get().logs[ev.nodeId] ?? []), ev.line].slice(-1000);
      set({ logs: { ...get().logs, [ev.nodeId]: logs } });
    } else if (ev.type === "task-status") {
      set({ taskStatuses: { ...get().taskStatuses, [ev.task.id]: ev.task.status } });
    } else if (ev.type === "run-finished") {
      set({
        running: false,
        finalOutput: ev.ok ? (ev.finalOutput ?? null) : null,
        runError: ev.ok ? null : (ev.error ?? "erro desconhecido"),
      });
    }
  },

  toFlowMap: () => {
    const { nodes, edges, project, agentDirs, activeWorkspaceId, workspaces } = get();
    const workspace = workspaces.find((item) => item.id === activeWorkspaceId);
    const typeOf = (t?: string) =>
      t === "input-node" ? ("input" as const)
      : t === "output-node" ? ("output" as const)
      : t === "human-node" ? ("human" as const)
      : t === "tasks-node" ? ("tasks" as const)
      : ("agent" as const);
    return {
      id: workspace?.flowId ?? "default",
      name: workspace?.name ?? "Fluxo principal",
      projectPath: project?.path ?? null,
      agentDirs,
      updatedAt: new Date().toISOString(),
      nodes: nodes.map((n) => ({
        id: n.id,
        type: typeOf(n.type),
        position: n.position,
        agent: n.type === "agent-node" ? (n.data.agent as AgentNodeData) : undefined,
        input: n.type === "input-node" ? { task: (n.data.task as string) ?? "" } : undefined,
        human: n.type === "human-node" ? { items: (n.data.items as HumanTask[]) ?? [] } : undefined,
        tasks: n.type === "tasks-node" ? (n.data as unknown as TaskNodeData) : undefined,
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
  },

  loadFlowMap: (flow) =>
    set({
      selectedId: null,
      statuses: {},
      todos: {},
      summaries: [],
      runError: null,
      finalOutput: null,
      logs: {},
      taskStatuses: {},
      clone: null,
      agentDirs: flow.agentDirs ?? [],
      nodes: flow.nodes.map((n) => ({
        id: n.id,
        type:
          n.type === "input" ? "input-node"
          : n.type === "output" ? "output-node"
          : n.type === "human" ? "human-node"
          : n.type === "tasks" ? "tasks-node"
          : "agent-node",
        position: upgradedStarterPosition(n.id, n.position),
        data:
          n.type === "agent" ? { agent: n.agent }
          : n.type === "input" ? { task: n.input?.task ?? "" }
          : n.type === "human" ? { items: n.human?.items ?? [] }
          : n.type === "tasks" ? n.tasks ?? { objective: "", tasks: [] }
          : {},
      })) as RFNode[],
      edges: flow.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    }),
}));

/** Recarrega os agentes prontos de todas as fontes (padrão + pastas escolhidas). */
export function refreshPresets(): void {
  const { project, agentDirs, setPresets } = useSasori.getState();
  api.presets(project?.path ?? null, agentDirs).then(setPresets).catch(() => {});
}

/** Descobre skills reutilizáveis do projeto e das pastas globais. */
export function refreshSkills(): void {
  const { project, setSkillLibrary } = useSasori.getState();
  api.skills(project?.path ?? null).then(setSkillLibrary).catch(() => setSkillLibrary([]));
}

/** Salva o canvas atual e abre outro workspace, mantendo cada projeto isolado. */
export async function openWorkspace(workspace: Workspace): Promise<void> {
  const state = useSasori.getState();
  if (state.running) throw new Error("Pare a execução atual antes de trocar de projeto.");

  if (state.activeWorkspaceId) {
    await api.saveFlow(state.toFlowMap());
  }

  let flow: FlowMap;
  try {
    flow = await api.loadFlow(workspace.flowId);
  } catch {
    flow = {
      id: workspace.flowId,
      name: workspace.name,
      projectPath: workspace.projectPath,
      agentDirs: [],
      updatedAt: new Date().toISOString(),
      nodes: [
        { id: "start-input", type: "input", position: { x: 60, y: 220 }, input: { task: "" } },
        {
          id: "start-agent",
          type: "agent",
          position: { x: 740, y: 180 },
          agent: { ...DEFAULT_AGENT },
        },
        { id: "start-output", type: "output", position: { x: 1420, y: 220 } },
      ],
      edges: [
        { id: "e1", source: "start-input", target: "start-agent" },
        { id: "e2", source: "start-agent", target: "start-output" },
      ],
    };
  }

  state.loadFlowMap(flow);
  state.setActiveWorkspaceId(workspace.id);
  if (workspace.projectPath) {
    try {
      const info = await api.validateProject(workspace.projectPath);
      state.setProject(info.exists ? info : null);
    } catch {
      state.setProject(null);
    }
  } else {
    state.setProject(null);
  }
  refreshPresets();
  refreshSkills();
}
