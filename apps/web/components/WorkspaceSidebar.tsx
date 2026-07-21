"use client";

import { useEffect, useState } from "react";
import { Bot, Check, ChevronLeft, ChevronRight, Folder, FolderPlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import type { Workspace } from "@marionette/shared";
import { api } from "@/lib/api";
import { openWorkspace, useSasori } from "@/lib/store";
import { FolderPicker } from "./FolderPicker";

/** Navegação persistente entre projetos, como um workspace de IDE. */
export function WorkspaceSidebar() {
  const workspaces = useSasori((state) => state.workspaces);
  const activeWorkspaceId = useSasori((state) => state.activeWorkspaceId);
  const setWorkspaces = useSasori((state) => state.setWorkspaces);
  const presets = useSasori((state) => state.presets);
  const nodes = useSasori((state) => state.nodes);
  const addAgentNode = useSasori((state) => state.addAgentNode);
  const select = useSasori((state) => state.select);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("marionette-sidebar-collapsed") === "true");
    } catch {
      /* armazenamento local indisponível */
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("marionette-sidebar-collapsed", String(next));
    } catch {
      /* modo anônimo */
    }
  };

  const selectWorkspace = async (workspace: Workspace) => {
    if (workspace.id === activeWorkspaceId) return;
    setError(null);
    setOpeningId(workspace.id);
    try {
      await openWorkspace(workspace);
    } catch (err: any) {
      setError(err.message ?? "Não consegui abrir este projeto.");
    } finally {
      setOpeningId(null);
    }
  };

  const addWorkspace = async (projectPath: string) => {
    try {
      const info = await api.validateProject(projectPath);
      if (!info.exists) return `Pasta não existe: ${info.path}`;
      const workspace = await api.createWorkspace(info.path);
      const next = [...useSasori.getState().workspaces, workspace];
      setWorkspaces(next);
      await selectWorkspace(workspace);
      return null;
    } catch (err: any) {
      return err.message as string;
    }
  };

  const removeWorkspace = async (workspace: Workspace) => {
    if (!window.confirm(`Remover “${workspace.name}” da barra lateral? Os arquivos do projeto não serão apagados.`)) {
      return;
    }
    const next = workspaces.filter((item) => item.id !== workspace.id);
    if (next.length === 0 && workspace.id === activeWorkspaceId) {
      setError("Mantenha pelo menos um projeto aberto para remover o projeto ativo.");
      return;
    }
    setError(null);
    setOpeningId(workspace.id);
    try {
      if (workspace.id === activeWorkspaceId && next[0]) await openWorkspace(next[0]);
      await api.deleteWorkspace(workspace);
      setWorkspaces(next);
    } catch (err: any) {
      setError(err.message ?? "Não consegui remover este projeto.");
    } finally {
      setOpeningId(null);
    }
  };

  const canvasAgents = nodes.filter((node) => node.type === "agent-node");
  const projectPresets = presets.filter((preset) => preset.source === "project").slice(0, 6);
  const sharedPresets = presets.filter((preset) => preset.source !== "project").slice(0, 6);

  return (
    <aside className={`flex shrink-0 flex-col border-r border-line bg-ink-2/70 p-3 transition-[width] duration-200 ${collapsed ? "w-20" : "w-64"}`}>
      <div className={`mb-3 flex items-center ${collapsed ? "justify-center" : "justify-between px-2"}`}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[2px] text-sand">projetos</div>
              <div className="mt-0.5 text-[11px] text-text-dim">workspaces</div>
            </div>
            <button
              className="grid h-7 w-7 cursor-pointer place-items-center rounded-lg border border-line-2 text-text-dim transition-colors hover:border-sand hover:text-sand"
              onClick={() => {
                setError(null);
                setPickerOpen(true);
              }}
              title="adicionar projeto"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        ) : (
          <button
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-line-2 text-text-dim transition-colors hover:border-sand hover:text-sand"
            onClick={toggleCollapsed}
            title="abrir barra lateral"
          >
            <ChevronRight size={15} />
          </button>
        )}
        {!collapsed && <button
          className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-line-2 text-text-dim transition-colors hover:border-sand hover:text-sand"
          onClick={toggleCollapsed}
          title="recolher barra lateral"
        >
          <ChevronLeft size={15} />
        </button>}
      </div>

      {collapsed && (
        <button
          className="mx-auto mb-3 grid h-10 w-10 cursor-pointer place-items-center rounded-xl border border-line-2 text-text-dim transition-colors hover:border-sand hover:text-sand"
          onClick={() => {
            setError(null);
            setPickerOpen(true);
          }}
          title="adicionar projeto"
        >
          <FolderPlus size={15} />
        </button>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {workspaces.map((workspace) => {
          const active = workspace.id === activeWorkspaceId;
          return (
            <button
              key={workspace.id}
              className={`group flex cursor-pointer rounded-xl border text-left transition-colors ${
                collapsed ? "mx-auto h-11 w-11 items-center justify-center px-0" : "w-full items-center gap-2.5 px-3 py-2.5"
              } ${
                active
                  ? collapsed
                    ? "border-transparent bg-sand/15 text-text"
                    : "border-sand/60 bg-sand/10 text-text"
                  : "border-transparent text-text-dim hover:border-line-2 hover:bg-ink-3 hover:text-text"
              }`}
              onClick={() => selectWorkspace(workspace)}
              disabled={openingId !== null}
              title={collapsed ? workspace.name : undefined}
            >
              {collapsed ? (
                <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${active ? "bg-sand/30 text-sand" : "bg-ink-3/40 text-text-dim"}`}>
                  {workspace.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
              ) : (
                <Folder size={16} className={active ? "text-sand" : "text-text-dim"} />
              )}
              <span className={`${collapsed ? "hidden" : "block"} min-w-0 flex-1`}>
                <span className="block truncate text-xs font-semibold">{workspace.name}</span>
                <span className="mt-0.5 block truncate text-[9px] text-text-dim">
                  {workspace.projectPath}
                </span>
              </span>
              {openingId === workspace.id ? (
                <LoaderCircle size={14} className="animate-spin text-sand" />
              ) : (
                <span className="ml-auto flex items-center gap-1">
                  {!collapsed && active && <Check size={14} className="text-sand" />}
                  {!collapsed && <span
                    role="button"
                    tabIndex={0}
                    className="rounded p-1 text-text-dim hover:bg-blood/15 hover:text-blood"
                    title="remover da barra lateral"
                    onClick={(event) => {
                      event.stopPropagation();
                      void removeWorkspace(workspace);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        void removeWorkspace(workspace);
                      }
                    }}
                  >
                    <Trash2 size={13} />
                  </span>}
                </span>
              )}
            </button>
          );
        })}

        {!collapsed && workspaces.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-2 px-3 py-4 text-center text-xs leading-relaxed text-text-dim">
            Adicione seu primeiro projeto para começar.
          </div>
        )}
      </div>

      {!collapsed && (
        <section className="mt-3 min-h-0 max-h-[40%] overflow-y-auto border-t border-line pt-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[2px] text-sand">agentes</div>
              <div className="mt-0.5 text-[11px] text-text-dim">presets e agentes do canvas</div>
            </div>
            <Bot size={15} className="text-sand-dim" />
          </div>

          {canvasAgents.map((node) => (
            <button
              key={node.id}
              className="mb-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-text-dim hover:bg-ink-3 hover:text-text"
              onClick={() => select(node.id)}
            >
              <span className="h-2 w-2 rounded-full bg-blood" />
              <span className="truncate">{(node.data.agent as { role?: string })?.role ?? "agente"}</span>
              <span className="ml-auto text-[10px] text-sand-dim">no canvas</span>
            </button>
          ))}

          {projectPresets.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-dim">deste projeto</div>
              {projectPresets.map((preset) => (
                <button
                  key={`${preset.dir}:${preset.slug}`}
                  className="mb-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-text-dim hover:bg-ink-3 hover:text-text"
                  onClick={() => addAgentNode(preset)}
                  title="adicionar ao canvas"
                >
                  <Plus size={12} className="text-sand" />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          )}

          {sharedPresets.length > 0 && (
            <div className="mt-2">
              <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-dim">globais e extras</div>
              {sharedPresets.map((preset) => (
                <button
                  key={`${preset.dir}:${preset.slug}`}
                  className="mb-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-text-dim hover:bg-ink-3 hover:text-text"
                  onClick={() => addAgentNode(preset)}
                  title="adicionar ao canvas"
                >
                  <Plus size={12} className="text-sand" />
                  <span className="truncate">{preset.name}</span>
                </button>
              ))}
            </div>
          )}

          {canvasAgents.length === 0 && presets.length === 0 && (
            <p className="px-2 text-[11px] leading-relaxed text-text-dim">Nenhum agente encontrado ainda.</p>
          )}
        </section>
      )}

      {error && <p className="mt-3 rounded-lg border border-blood/50 bg-blood/10 p-2 text-[11px] text-blood">{error}</p>}

      <FolderPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Adicionar projeto"
        onPick={addWorkspace}
      />
    </aside>
  );
}
