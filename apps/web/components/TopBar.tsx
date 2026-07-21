"use client";

import { useEffect, useState } from "react";
import {
  FolderOpen,
  GitBranch,
  Moon,
  Play,
  Plus,
  Square,
  Sun,
  UserRound,
  Workflow,
  ListTodo,
  LibraryBig,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useSasori } from "@/lib/store";

// ─── Barra superior: projeto · agentes · clone (git) · tema · executar ──────

/** Alterna dark/light aplicando a classe `light` no <html> (persistido). */
function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    try {
      localStorage.setItem("marionette-theme", next ? "light" : "dark");
    } catch {
      /* modo anônimo */
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={toggle} title={light ? "modo escuro" : "modo claro"}>
      {light ? <Moon size={14} /> : <Sun size={14} />}
    </Button>
  );
}

export function TopBar() {
  const project = useSasori((s) => s.project);
  const running = useSasori((s) => s.running);
  const clone = useSasori((s) => s.clone);
  const nodes = useSasori((s) => s.nodes);
  const addAgentNode = useSasori((s) => s.addAgentNode);
  const addHumanNode = useSasori((s) => s.addHumanNode);
  const addTaskNode = useSasori((s) => s.addTaskNode);
  const toFlowMap = useSasori((s) => s.toFlowMap);
  const setProject = useSasori((s) => s.setProject);
  const setClone = useSasori((s) => s.setClone);
  const setResourcePanel = useSasori((s) => s.setResourcePanel);
  const activeWorkspaceId = useSasori((s) => s.activeWorkspaceId);

  const [preRunOpen, setPreRunOpen] = useState(false);
  const [postRunOpen, setPostRunOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const task = (nodes.find((n) => n.type === "input-node")?.data.task as string) ?? "";

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 5000);
  };

  const startRun = async () => {
    setPreRunOpen(false);
    try {
      await api.run(toFlowMap(), project!.path, activeWorkspaceId);
    } catch (e: any) {
      flash(e.message);
    }
  };

  const onRunClick = () => {
    if (running) return;
    if (!project) return flash("Selecione a pasta do projeto primeiro.");
    if (!task.trim()) return flash("Escreva a tarefa inicial no nó verde.");
    setPreRunOpen(true); // oferece invocar clone antes de executar
  };

  const summon = async () => {
    setBusy(true);
    try {
      const c = await api.gitSummon(project!.path, task);
      setClone(c);
      const info = await api.validateProject(project!.path);
      setProject(info);
      await startRun();
    } catch (e: any) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  };

  const gitInit = async () => {
    setBusy(true);
    try {
      setProject(await api.gitInit(project!.path));
      flash("git init feito — agora dá para invocar clone.");
    } catch (e: any) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  };

  const mergeBack = async () => {
    setBusy(true);
    try {
      await api.gitMerge(project!.path, clone!.branch, clone!.previousBranch);
      setClone(null);
      setPostRunOpen(false);
      setProject(await api.validateProject(project!.path));
      flash("Clone trazido de volta (merge concluído).");
    } catch (e: any) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  };

  const disperse = async () => {
    setBusy(true);
    try {
      await api.gitDisperse(project!.path, clone!.branch, clone!.previousBranch);
      setClone(null);
      setPostRunOpen(false);
      setProject(await api.validateProject(project!.path));
      flash("Clone dispersado (branch apagada).");
    } catch (e: any) {
      flash(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="z-10 flex items-center justify-between border-b border-line bg-gradient-to-b from-ink-2 to-ink px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[radial-gradient(circle_at_30%_30%,#a52222,#651010)] text-white shadow-[0_0_18px_rgba(138,28,28,.5)]">
          <Workflow size={21} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div>
          <div className="text-lg font-extrabold tracking-[4px]">MARIONETTE</div>
          <div className="text-[11px] tracking-wide text-sand-dim">orquestrador de agentes</div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {msg && <span className="max-w-72 truncate text-xs text-sand">{msg}</span>}

        <div className="flex max-w-64 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-sand-dim">
          <FolderOpen size={13} />
          <span className="truncate">{project ? project.path.split(/[/\\]/).pop() : "nenhum projeto"}</span>
        </div>

        {project && (
          <span className="flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[10px] text-sand-dim">
            <GitBranch size={11} />
            {project.isGitRepo ? (clone ? clone.branch : (project.branch ?? "sem commits")) : "sem git"}
          </span>
        )}

        {clone && !running && (
          <Button variant="sand" size="sm" onClick={() => setPostRunOpen(true)}>
            resolver clone
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={() => addAgentNode()}>
          <Plus size={13} /> agente
        </Button>

        <Button variant="ghost" size="sm" onClick={() => addHumanNode()}>
          <UserRound size={13} /> humano
        </Button>

        <Button variant="ghost" size="sm" onClick={() => addTaskNode()}>
          <ListTodo size={13} /> tarefas
        </Button>

        <Button variant="ghost" size="sm" onClick={() => setResourcePanel("skills")}>
          <LibraryBig size={13} /> biblioteca
        </Button>

        <ThemeToggle />

        {running ? (
          <Button variant="subtle" size="sm" onClick={() => api.stopRun()}>
            <Square size={12} /> puxando os fios… parar
          </Button>
        ) : (
          <Button size="sm" onClick={onRunClick}>
            <Play size={12} /> executar fluxo
          </Button>
        )}
      </div>

      {/* pré-execução: rede de segurança Git */}
      <Dialog open={preRunOpen} onClose={() => setPreRunOpen(false)} title="Kage Bunshin no Jutsu">
        {project?.isGitRepo ? (
          <>
            <p className="text-xs leading-relaxed text-text-dim">
              Invocar um clone cria a branch <code className="text-sand">marionette/…</code> e os agentes
              trabalham nela. Sua branch <code className="text-sand">{project.branch}</code> fica
              intocada até você decidir trazer o trabalho de volta.
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={summon} disabled={busy || !!clone}>
                {clone ? "clone já ativo" : "invocar clone e executar"}
              </Button>
              <Button variant="ghost" size="sm" onClick={startRun} disabled={busy}>
                executar sem clone
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-text-dim">
              Esta pasta não é um repositório Git — sem rede de segurança, os agentes editam os
              arquivos direto. Recomendado: criar o repositório primeiro.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="sand" size="sm" onClick={gitInit} disabled={busy}>
                git init
              </Button>
              <Button variant="ghost" size="sm" onClick={startRun} disabled={busy}>
                executar mesmo assim
              </Button>
            </div>
          </>
        )}
      </Dialog>

      {/* pós-execução: decidir o destino do clone (só com confirmação sua) */}
      <Dialog open={postRunOpen} onClose={() => setPostRunOpen(false)} title="Destino do clone">
        <p className="text-xs leading-relaxed text-text-dim">
          Branch do clone: <code className="text-sand">{clone?.branch}</code>. Trazer de volta faz
          merge em <code className="text-sand">{clone?.previousBranch}</code>. Dispersar apaga a
          branch e descarta o trabalho.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="sand" size="sm" onClick={mergeBack} disabled={busy}>
            trazer de volta (merge)
          </Button>
          <Button variant="subtle" size="sm" onClick={disperse} disabled={busy}>
            dispersar clone (apagar)
          </Button>
        </div>
      </Dialog>
    </header>
  );
}
