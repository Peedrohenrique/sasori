"use client";

import { useEffect, useState } from "react";
import { BookOpen, Clock3, Copy, FileText, LayoutTemplate, Save, Trash2, X } from "lucide-react";
import type { AgentNodeData, FlowTemplate, RunRecord, SkillPreset } from "@marionette/shared";
import { api } from "@/lib/api";
import { refreshPresets, refreshSkills, useSasori } from "@/lib/store";
import { cn } from "@/lib/utils";

type Tab = "skills" | "presets" | "templates" | "history";

export function ResourcePanel() {
  const panel = useSasori((s) => s.resourcePanel);
  const setPanel = useSasori((s) => s.setResourcePanel);
  const project = useSasori((s) => s.project);
  const workspace = useSasori((s) => s.workspaces.find((item) => item.id === s.activeWorkspaceId));
  const skills = useSasori((s) => s.skillLibrary);
  const presets = useSasori((s) => s.presets);
  const nodes = useSasori((s) => s.nodes);
  const loadFlowMap = useSasori((s) => s.loadFlowMap);
  const running = useSasori((s) => s.running);
  const [tab, setTab] = useState<Tab>(panel ?? "skills");
  const [selectedSkill, setSelectedSkill] = useState<SkillPreset | null>(null);
  const [skillForm, setSkillForm] = useState({ name: "", description: "", content: "", scope: "project" as "global" | "project" });
  const [presetScope, setPresetScope] = useState<"global" | "project">("project");
  const [templates, setTemplates] = useState<FlowTemplate[]>([]);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => { if (panel) setTab(panel); }, [panel]);
  useEffect(() => { if (panel === "templates") api.templates().then(setTemplates).catch(() => {}); }, [panel]);
  useEffect(() => { if (panel === "history" && workspace) api.history(workspace.id).then(setHistory).catch(() => setHistory([])); }, [panel, workspace]);
  if (!panel) return null;

  const close = () => setPanel(null);
  const activeAgent = nodes.find((node) => node.type === "agent-node")?.data.agent as AgentNodeData | undefined;
  const openSkill = async (skill: SkillPreset) => {
    setSelectedSkill(skill);
    try {
      const doc = await api.readSkill(skill.filePath);
      setSkillForm({ name: skill.name, description: skill.description, content: doc.content.replace(/^---[\s\S]*?---\s*/, "").trim(), scope: skill.source === "project" ? "project" : "global" });
    } catch { setMessage("Não foi possível ler esta skill."); }
  };
  const saveSkill = async () => {
    if (!skillForm.name.trim() || !skillForm.content.trim()) return setMessage("Nome e conteúdo são obrigatórios.");
    try { await api.saveSkill({ ...skillForm, projectPath: project?.path }); refreshSkills(); setMessage("Skill salva."); } catch (error: any) { setMessage(error.message); }
  };
  const deleteSkill = async () => {
    if (!selectedSkill) return;
    await api.deleteSkill(selectedSkill.filePath, project?.path).catch(() => {}); setSelectedSkill(null); setSkillForm({ name: "", description: "", content: "", scope: "project" }); refreshSkills();
  };
  const savePreset = async () => {
    if (!activeAgent) return setMessage("Adicione um agente antes de salvá-lo.");
    try { await api.savePreset({ name: activeAgent.role, prompt: activeAgent.prompt, scope: presetScope, projectPath: project?.path }); refreshPresets(); setMessage("Agente salvo como preset."); } catch (error: any) { setMessage(error.message); }
  };
  const applyTemplate = async (template: FlowTemplate) => {
    if (!workspace) return setMessage("Selecione um projeto antes de aplicar um modelo.");
    loadFlowMap({ ...template.flow, id: workspace.flowId, name: workspace.name, projectPath: project?.path ?? null, updatedAt: new Date().toISOString() });
    await api.saveFlow(useSasori.getState().toFlowMap()).catch(() => {});
    setMessage(`Modelo “${template.name}” aplicado.`);
  };
  const restoreRun = (run: RunRecord) => { loadFlowMap(run.flow); setMessage("Fluxo restaurado no canvas."); };
  const repeatRun = async (run: RunRecord) => {
    if (running || !project || !workspace) return setMessage("Pare a execução atual e selecione um projeto.");
    try { await api.run(run.flow, project.path, workspace.id); close(); } catch (error: any) { setMessage(error.message); }
  };

  const tabs: Array<[Tab, string, typeof BookOpen]> = [["skills", "skills", BookOpen], ["presets", "agentes", FileText], ["templates", "modelos", LayoutTemplate], ["history", "histórico", Clock3]];
  return (
    <aside className="absolute right-4 top-4 z-30 flex max-h-[calc(100%-2rem)] w-[470px] flex-col overflow-hidden rounded-2xl border border-line bg-ink-2/98 shadow-[0_24px_70px_rgba(0,0,0,.55)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-line px-4 py-3"><div><div className="text-[10px] font-bold uppercase tracking-[2px] text-sand">central do marionette</div><div className="mt-1 text-xs text-text-dim">recursos do projeto e execuções</div></div><button type="button" onClick={close} className="cursor-pointer text-text-dim hover:text-text"><X size={17} /></button></div>
      <div className="grid grid-cols-4 gap-1 border-b border-line p-2">{tabs.map(([value, label, Icon]) => <button key={value} type="button" onClick={() => { setTab(value); setPanel(value); }} className={cn("flex cursor-pointer items-center justify-center gap-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase", tab === value ? "bg-sand text-ink" : "text-text-dim hover:bg-ink-3 hover:text-text")}><Icon size={12} /> {label}</button>)}</div>
      {message && <div className="border-b border-line bg-sand/10 px-4 py-2 text-xs text-sand">{message}</div>}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {tab === "skills" && <div className="grid min-h-[420px] grid-cols-[155px_1fr] gap-3"><div className="space-y-1">{skills.map((skill) => <button type="button" key={skill.id} onClick={() => openSkill(skill)} className={cn("block w-full cursor-pointer rounded-lg px-2 py-2 text-left text-xs", selectedSkill?.id === skill.id ? "bg-sand/15 text-text" : "text-text-dim hover:bg-ink-3 hover:text-text")}><span className="block truncate font-semibold">{skill.name}</span><span className="text-[9px]">{skill.source}</span></button>)}{skills.length === 0 && <p className="p-2 text-[10px] text-text-dim">Nenhuma skill encontrada.</p>}<button type="button" onClick={() => { setSelectedSkill(null); setSkillForm({ name: "", description: "", content: "", scope: "project" }); }} className="mt-2 w-full cursor-pointer rounded-lg border border-dashed border-line px-2 py-2 text-[10px] text-sand">+ nova skill</button></div><div className="space-y-2"><input className="w-full rounded-lg border border-line bg-ink p-2 text-xs text-text outline-none focus:border-sand" placeholder="nome da skill" value={skillForm.name} onChange={(event) => setSkillForm({ ...skillForm, name: event.target.value })} /><input className="w-full rounded-lg border border-line bg-ink p-2 text-xs text-text outline-none focus:border-sand" placeholder="descrição curta" value={skillForm.description} onChange={(event) => setSkillForm({ ...skillForm, description: event.target.value })} /><select className="w-full rounded-lg border border-line bg-ink p-2 text-xs text-text" value={skillForm.scope} onChange={(event) => setSkillForm({ ...skillForm, scope: event.target.value as "global" | "project" })}><option value="project">skill deste projeto</option><option value="global">skill global</option></select><textarea className="nodrag nowheel h-64 w-full resize-none rounded-lg border border-line bg-ink p-2 text-xs leading-relaxed text-text outline-none focus:border-sand" placeholder="# Instruções da skill\n\nDescreva o procedimento…" value={skillForm.content} onChange={(event) => setSkillForm({ ...skillForm, content: event.target.value })} /><div className="flex gap-2"><button type="button" onClick={saveSkill} className="flex cursor-pointer items-center gap-1 rounded-lg bg-sand px-3 py-2 text-xs font-bold text-ink"><Save size={12} /> salvar</button>{selectedSkill && <button type="button" onClick={deleteSkill} className="flex cursor-pointer items-center gap-1 rounded-lg border border-blood/50 px-3 py-2 text-xs text-blood"><Trash2 size={12} /> remover</button>}</div></div></div>}
        {tab === "presets" && <div className="space-y-3"><div className="rounded-xl border border-line bg-ink p-3 text-xs text-text-dim">Salva o primeiro agente do canvas como preset reutilizável. Depois ele aparece no seletor do Inspetor.</div><div className="rounded-xl border border-line p-3"><div className="mb-2 text-xs font-bold text-sand">agente atual</div><div className="text-sm font-semibold text-text">{activeAgent?.role ?? "nenhum agente"}</div><div className="mt-1 max-h-28 overflow-auto text-xs text-text-dim">{activeAgent?.prompt ?? "Adicione um agente ao canvas."}</div><select className="mt-3 w-full rounded-lg border border-line bg-ink p-2 text-xs text-text" value={presetScope} onChange={(event) => setPresetScope(event.target.value as "global" | "project")}><option value="project">salvar neste projeto</option><option value="global">salvar globalmente</option></select><button type="button" onClick={savePreset} className="mt-2 flex cursor-pointer items-center gap-1 rounded-lg bg-sand px-3 py-2 text-xs font-bold text-ink"><Save size={12} /> salvar como preset</button></div><div className="space-y-1">{presets.map((preset) => <div key={`${preset.dir}:${preset.slug}`} className="flex items-center gap-2 rounded-lg border border-line bg-ink px-3 py-2"><FileText size={13} className="text-sand" /><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold text-text">{preset.name}</div><div className="truncate text-[10px] text-text-dim">{preset.source} · {preset.description}</div></div></div>)}</div></div>}
        {tab === "templates" && <div className="space-y-2">{templates.map((template) => <div key={template.id} className="rounded-xl border border-line bg-ink p-3"><div className="text-sm font-bold text-text">{template.name}</div><p className="mt-1 text-xs leading-relaxed text-text-dim">{template.description}</p><button type="button" onClick={() => applyTemplate(template)} className="mt-2 cursor-pointer rounded-lg border border-sand px-3 py-1.5 text-xs font-bold text-sand hover:bg-sand/10">usar modelo</button></div>)}</div>}
        {tab === "history" && <div className="space-y-2">{history.length === 0 && <p className="text-xs text-text-dim">Nenhuma execução salva neste projeto.</p>}{history.map((run) => <div key={run.id} className="rounded-xl border border-line bg-ink p-3"><div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", run.status === "completed" ? "bg-leaf" : run.status === "running" ? "bg-sand" : "bg-blood")} /><span className="text-xs font-bold text-text">{new Date(run.startedAt).toLocaleString("pt-BR")}</span><span className="ml-auto text-[10px] uppercase text-text-dim">{run.status}</span></div><div className="mt-1 text-[10px] text-text-dim">{run.tasks.length} tarefas · {Object.keys(run.nodes).length} nós</div><div className="mt-2 flex gap-1.5"><button type="button" onClick={() => { setSelectedRun(selectedRun?.id === run.id ? null : run); }} className="cursor-pointer rounded border border-line px-2 py-1 text-[10px] text-text-dim"><BookOpen size={11} className="mr-1 inline" /> detalhes</button><button type="button" onClick={() => restoreRun(run)} className="cursor-pointer rounded border border-sand px-2 py-1 text-[10px] text-sand"><Copy size={11} className="mr-1 inline" /> restaurar</button><button type="button" onClick={() => repeatRun(run)} className="cursor-pointer rounded border border-leaf px-2 py-1 text-[10px] text-leaf">repetir</button></div>{selectedRun?.id === run.id && <div className="mt-2 max-h-40 overflow-auto border-t border-line pt-2 text-[10px] text-text-dim">{Object.values(run.nodes).map((node) => <div key={node.nodeId} className="mb-2"><b className="text-sand">{node.role}</b> · {node.status}<div className="whitespace-pre-wrap">{node.summary ?? node.logs.slice(-2).join("\n")}</div></div>)}</div>}</div>)}</div>}
      </div>
      <div className="border-t border-line px-4 py-2 text-[10px] text-text-dim">{project ? project.path : "nenhum projeto selecionado"}</div>
    </aside>
  );
}
