import type {
  AgentPreset,
  BrowseResult,
  FlowMap,
  FlowTemplate,
  ProjectInfo,
  PlanResponse,
  RunRecord,
  SkillDocument,
  ToolAvailability,
  Workspace,
  SkillPreset,
} from "@marionette/shared";

export const API = "http://localhost:4001";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    // Content-Type só quando há body — Fastify rejeita JSON com body vazio
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any).error ?? `Erro ${res.status}`);
  return body as T;
}

export const api = {
  browse: (path?: string) =>
    req<BrowseResult>(`/fs/browse${path ? `?path=${encodeURIComponent(path)}` : ""}`),
  validateProject: (path: string) =>
    req<ProjectInfo>("/project/validate", { method: "POST", body: JSON.stringify({ path }) }),
  presets: (projectPath?: string | null, extraDirs?: string[]) =>
    req<AgentPreset[]>("/agents/presets", {
      method: "POST",
      body: JSON.stringify({ projectPath: projectPath ?? undefined, extraDirs }),
    }),
  skills: (projectPath?: string | null) =>
    req<SkillPreset[]>("/agents/skills", {
      method: "POST",
      body: JSON.stringify({ projectPath: projectPath ?? undefined }),
    }),
  readSkill: (filePath: string) => req<{ filePath: string; content: string }>("/skills/read", { method: "POST", body: JSON.stringify({ filePath }) }),
  saveSkill: (body: { name: string; description?: string; content: string; scope: "global" | "project"; projectPath?: string }) => req<SkillDocument>("/skills/save", { method: "POST", body: JSON.stringify(body) }),
  deleteSkill: (filePath: string, projectPath?: string | null) => req<{ ok: boolean }>("/skills/delete", { method: "POST", body: JSON.stringify({ filePath, projectPath: projectPath ?? undefined }) }),
  savePreset: (body: { name: string; description?: string; prompt: string; scope: "global" | "project"; projectPath?: string }) => req<AgentPreset>("/agents/presets/save", { method: "POST", body: JSON.stringify(body) }),
  deletePreset: (dir: string, slug: string, projectPath?: string | null) => req<{ ok: boolean }>("/agents/presets/delete", { method: "POST", body: JSON.stringify({ dir, slug, projectPath: projectPath ?? undefined }) }),
  templates: () => req<FlowTemplate[]>("/templates"),
  plan: (body: { flow: FlowMap; projectPath: string; objective: string; tool?: "claude-code" | "codex" }) => req<PlanResponse>("/plan", { method: "POST", body: JSON.stringify(body) }),
  tools: () => req<ToolAvailability[]>("/tools"),
  loadFlow: (id: string) => req<FlowMap>(`/flows/${id}`),
  saveFlow: (flow: FlowMap) =>
    req<FlowMap>(`/flows/${flow.id}`, { method: "PUT", body: JSON.stringify(flow) }),
  workspaces: () => req<Workspace[]>("/workspaces"),
  createWorkspace: (projectPath: string, name?: string) =>
    req<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify({ projectPath, name }),
    }),
  updateWorkspace: (workspace: Workspace, patch: Partial<Workspace>) =>
    req<Workspace>(`/workspaces/${workspace.id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteWorkspace: (workspace: Workspace) =>
    req<{ ok: boolean }>(`/workspaces/${workspace.id}`, { method: "DELETE" }),
  run: (flow: FlowMap, projectPath: string, workspaceId?: string | null) =>
    req<{ runId: string }>("/run", { method: "POST", body: JSON.stringify({ flow, projectPath, workspaceId: workspaceId ?? undefined }) }),
  history: (workspaceId: string) => req<RunRecord[]>(`/history/${workspaceId}`),
  historyItem: (workspaceId: string, runId: string) => req<RunRecord>(`/history/${workspaceId}/${runId}`),
  stopRun: () => req<{ ok: boolean }>("/run/stop", { method: "POST" }),
  continueRun: () => req<{ ok: boolean }>("/run/continue", { method: "POST" }),
  gitInit: (path: string) =>
    req<ProjectInfo>("/git/init", { method: "POST", body: JSON.stringify({ path }) }),
  gitSummon: (path: string, task: string) =>
    req<{ branch: string; previousBranch: string }>("/git/summon", {
      method: "POST",
      body: JSON.stringify({ path, task }),
    }),
  gitMerge: (path: string, branch: string, previousBranch: string) =>
    req<{ ok: boolean }>("/git/merge", {
      method: "POST",
      body: JSON.stringify({ path, branch, previousBranch }),
    }),
  gitDisperse: (path: string, branch: string, previousBranch: string) =>
    req<{ ok: boolean }>("/git/disperse", {
      method: "POST",
      body: JSON.stringify({ path, branch, previousBranch }),
    }),
};
