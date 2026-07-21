"use client";

import { useEffect, useRef } from "react";
import type { SasoriEvent } from "@marionette/shared";
import { Canvas } from "@/components/Canvas";
import { Inspector } from "@/components/Inspector";
import { OmbroPanel } from "@/components/OmbroPanel";
import { TopBar } from "@/components/TopBar";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { API, api } from "@/lib/api";
import { openWorkspace, refreshPresets, refreshSkills, useSasori } from "@/lib/store";

export default function Home() {
  const booted = useRef(false);

  // bootstrap: CLIs, agentes existentes, fluxo salvo, stream SSE, autosave
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const s = useSasori.getState();

    api.tools().then(s.setTools).catch(() => {});

    const bootstrapWorkspace = async () => {
      let workspaces = await api.workspaces();
      if (workspaces.length === 0) {
        const legacy = await api.loadFlow("default").catch(() => null);
        if (legacy?.projectPath) {
          const migrated = await api.createWorkspace(legacy.projectPath, legacy.name).catch(() => null);
          if (migrated) {
            await api.saveFlow({ ...legacy, id: migrated.flowId, name: migrated.name });
            workspaces = [migrated];
          }
        } else if (legacy?.nodes.length) {
          s.loadFlowMap(legacy);
        }
      }
      s.setWorkspaces(workspaces);
      if (workspaces[0]) await openWorkspace(workspaces[0]);
      else {
        refreshPresets();
        refreshSkills();
      }
    };
    bootstrapWorkspace().catch(() => {
      refreshPresets();
      refreshSkills();
    });

    // status em tempo real (marcos, não micro-passos)
    const es = new EventSource(`${API}/events`);
    es.onmessage = (e) => {
      try {
        useSasori.getState().applyEvent(JSON.parse(e.data) as SasoriEvent);
      } catch {
        /* ignora */
      }
    };

    // autosave do canvas em JSON local (debounce)
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = useSasori.subscribe((state, prev) => {
      if (
        state.nodes === prev.nodes &&
        state.edges === prev.edges &&
        state.project === prev.project &&
        state.agentDirs === prev.agentDirs
      )
        return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        api.saveFlow(useSasori.getState().toFlowMap()).catch(() => {});
      }, 800);
    });

    return () => {
      es.close();
      unsub();
    };
  }, []);

  return (
    <main className="flex h-screen flex-col">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        <WorkspaceSidebar />
        <div className="relative min-w-0 flex-1">
          <Canvas />
          <Inspector />
          <OmbroPanel />
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-line bg-ink-2/80 px-3 py-1 text-[11px] text-sand-dim">
            arraste os nós · puxe um fio da bolinha direita até outro nó · clique num agente para editar
          </div>
        </div>
      </div>
    </main>
  );
}
