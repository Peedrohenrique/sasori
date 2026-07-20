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
  TodoItem,
  ToolAvailability,
} from "@sasori/shared";
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
    position: { x: 420, y: 180 },
    data: { agent: { ...DEFAULT_AGENT } },
  },
  { id: "start-output", type: "output-node", position: { x: 800, y: 220 }, data: {} },
];

const START_EDGES: Edge[] = [
  { id: "e1", source: "start-input", target: "start-agent" },
  { id: "e2", source: "start-agent", target: "start-output" },
];

interface SasoriState {
  nodes: RFNode[];
  edges: Edge[];
  project: ProjectInfo | null;
  tools: ToolAvailability[];
  presets: AgentPreset[];
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

  onNodesChange: (changes: NodeChange<RFNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (conn: Connection) => void;
  addAgentNode: (preset?: AgentPreset) => void;
  addHumanNode: () => void;
  addAgentDir: (dir: string) => void;
  removeAgentDir: (dir: string) => void;
  deleteNode: (id: string) => void;
  updateAgent: (id: string, patch: Partial<AgentNodeData>) => void;
  updateTask: (id: string, task: string) => void;
  updateHumanItems: (id: string, items: HumanTask[]) => void;
  select: (id: string | null) => void;
  setProject: (p: ProjectInfo | null) => void;
  setTools: (t: ToolAvailability[]) => void;
  setPresets: (p: AgentPreset[]) => void;
  setClone: (c: CloneInfo | null) => void;
  setRunning: (r: boolean) => void;
  applyEvent: (ev: SasoriEvent) => void;
  toFlowMap: () => FlowMap;
  loadFlowMap: (flow: FlowMap) => void;
}

export const useSasori = create<SasoriState>((set, get) => ({
  nodes: START_NODES,
  edges: START_EDGES,
  project: null,
  tools: [],
  presets: [],
  selectedId: null,
  agentDirs: [],
  statuses: {},
  todos: {},
  summaries: [],
  running: false,
  runError: null,
  finalOutput: null,
  clone: null,

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

  select: (id) => set({ selectedId: id }),
  setProject: (project) => set({ project }),
  setTools: (tools) => set({ tools }),
  setPresets: (presets) => set({ presets }),
  setClone: (clone) => set({ clone }),
  setRunning: (running) => set({ running }),

  applyEvent: (ev) => {
    if (ev.type === "run-started") {
      const statuses: Record<string, RunStatus> = {};
      for (const id of ev.order) statuses[id] = "idle";
      set({ running: true, statuses, todos: {}, summaries: [], runError: null, finalOutput: null });
    } else if (ev.type === "node-status") {
      set({ statuses: { ...get().statuses, [ev.nodeId]: ev.status } });
    } else if (ev.type === "node-todos") {
      set({ todos: { ...get().todos, [ev.nodeId]: ev.items } });
    } else if (ev.type === "node-summary") {
      set({
        summaries: [...get().summaries, { nodeId: ev.nodeId, role: ev.role, summary: ev.summary, ts: Date.now() }],
      });
    } else if (ev.type === "run-finished") {
      set({
        running: false,
        finalOutput: ev.ok ? (ev.finalOutput ?? null) : null,
        runError: ev.ok ? null : (ev.error ?? "erro desconhecido"),
      });
    }
  },

  toFlowMap: () => {
    const { nodes, edges, project, agentDirs } = get();
    const typeOf = (t?: string) =>
      t === "input-node" ? ("input" as const)
      : t === "output-node" ? ("output" as const)
      : t === "human-node" ? ("human" as const)
      : ("agent" as const);
    return {
      id: "default",
      name: "Fluxo principal",
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
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
  },

  loadFlowMap: (flow) =>
    set({
      agentDirs: flow.agentDirs ?? [],
      nodes: flow.nodes.map((n) => ({
        id: n.id,
        type:
          n.type === "input" ? "input-node"
          : n.type === "output" ? "output-node"
          : n.type === "human" ? "human-node"
          : "agent-node",
        position: n.position,
        data:
          n.type === "agent" ? { agent: n.agent }
          : n.type === "input" ? { task: n.input?.task ?? "" }
          : n.type === "human" ? { items: n.human?.items ?? [] }
          : {},
      })),
      edges: flow.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    }),
}));

/** Recarrega os agentes prontos de todas as fontes (padrão + pastas escolhidas). */
export function refreshPresets(): void {
  const { project, agentDirs, setPresets } = useSasori.getState();
  api.presets(project?.path ?? null, agentDirs).then(setPresets).catch(() => {});
}
