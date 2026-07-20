import type {
  AgentPreset,
  BrowseResult,
  FlowMap,
  ProjectInfo,
  ToolAvailability,
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
  tools: () => req<ToolAvailability[]>("/tools"),
  loadFlow: (id: string) => req<FlowMap>(`/flows/${id}`),
  saveFlow: (flow: FlowMap) =>
    req<FlowMap>(`/flows/${flow.id}`, { method: "PUT", body: JSON.stringify(flow) }),
  run: (flow: FlowMap, projectPath: string) =>
    req<{ runId: string }>("/run", { method: "POST", body: JSON.stringify({ flow, projectPath }) }),
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
