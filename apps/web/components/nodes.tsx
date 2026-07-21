"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  STATUS_LABELS,
  type AgentNodeData,
  type HumanTask,
  type TaskNodeData,
  type WorkTask,
  type RunStatus,
} from "@marionette/shared";
import { Check, ListTodo, Plus, Sparkles, UserRound, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSasori } from "@/lib/store";

// ─── Nós do canvas: tarefa inicial · agente · humano · resultado final ──────
// Áreas de texto usam "nowheel nodrag": sem isso o React Flow captura a roda
// do mouse como zoom e o clique como arraste — e o scroll interno não funciona.

const ACTIVE: RunStatus[] = ["starting", "planning", "editing", "running-commands"];

function StatusLight({ status }: { status: RunStatus }) {
  const active = ACTIVE.includes(status);
  return (
    <span className="ml-auto flex items-center gap-1.5">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          status === "done" && "bg-leaf shadow-[0_0_8px_#4a7c59]",
          status === "error" && "bg-blood shadow-[0_0_8px_#a52222]",
          status === "waiting-human" && "bg-sand-bright animate-pulse shadow-[0_0_8px_#f4e4c0]",
          active && "bg-sand animate-pulse shadow-[0_0_8px_#c9a25f]",
          status === "idle" && "bg-line-2",
        )}
      />
      <span className="text-xs text-sand-dim">{STATUS_LABELS[status]}</span>
    </span>
  );
}

function shell(selected: boolean, status: RunStatus) {
  return cn(
    "flex min-h-[440px] w-[620px] flex-col rounded-2xl border border-line-2 bg-gradient-to-b from-ink-3 to-card-2 p-5 shadow-[0_14px_38px_var(--color-shadow)]",
    selected && "border-sand shadow-[0_0_0_1px_var(--color-sand),0_12px_36px_var(--color-shadow)]",
    status === "done" && "border-leaf",
    status === "error" && "border-blood",
    (ACTIVE.includes(status) || status === "waiting-human") && "node-running",
  );
}

function DeleteButton({ id }: { id: string }) {
  const deleteNode = useSasori((s) => s.deleteNode);
  return (
    <button
      className="absolute -right-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full border border-line-2 bg-ink-3 text-text-dim hover:bg-blood hover:text-white cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        deleteNode(id);
      }}
    >
      <X size={12} />
    </button>
  );
}

export function InputNode({ id, selected }: NodeProps) {
  const task = useSasori((s) => (s.nodes.find((n) => n.id === id)?.data.task as string) ?? "");
  const updateTask = useSasori((s) => s.updateTask);
  return (
    <div className={cn(shell(!!selected, "idle"), "border-t-2 border-t-leaf")}>
      <div className="mb-3 flex items-center gap-2 text-[17px] font-bold">
        <span className="h-2 w-2 rounded-full bg-leaf" /> tarefa inicial
      </div>
      <textarea
        className="nodrag nowheel min-h-[350px] w-full flex-1 resize-none overflow-auto rounded-xl border border-line bg-ink p-4 text-base leading-7 text-text outline-none placeholder:text-ph focus:border-sand"
        placeholder="o que as marionetes devem fazer?"
        value={task}
        onChange={(e) => updateTask(id, e.target.value)}
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// plano vivo: a todo list que a própria CLI mantém, marcada em tempo real
function LivePlan({ nodeId }: { nodeId: string }) {
  const items = useSasori((s) => s.todos[nodeId]);
  if (!items?.length) return null;
  const done = items.filter((t) => t.status === "completed").length;
  return (
    <div className="mt-3 rounded-xl border border-line bg-ink p-3">
      <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-sand">
        <ListTodo size={14} /> plano da marionete
        <span className="ml-auto font-semibold text-sand-dim">
          {done}/{items.length}
        </span>
      </div>
      <div className="nowheel nodrag max-h-48 overflow-auto">
        {items.map((t, i) => (
          <div key={i} className="flex items-start gap-2 px-1 py-1">
            {t.status === "completed" ? (
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-leaf bg-leaf/20 text-leaf">
                <Check size={10} />
              </span>
            ) : t.status === "in_progress" ? (
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border border-sand">
                <span className="h-2 w-2 animate-pulse rounded-sm bg-sand" />
              </span>
            ) : (
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-line-2" />
            )}
            <span
              className={cn(
                "text-sm leading-snug",
                t.status === "completed" && "text-ph line-through",
                t.status === "in_progress" && "font-semibold text-sand-bright",
                t.status === "pending" && "text-text-dim",
              )}
            >
              {t.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentNode({ id, data, selected }: NodeProps) {
  const agent = data.agent as AgentNodeData;
  const status = useSasori((s) => s.statuses[id] ?? "idle");
  return (
    <div className={cn(shell(!!selected, status), "border-t-2 border-t-blood")}>
      <div className="flex items-center gap-2 text-[17px] font-bold">
        <span className="h-2 w-2 rounded-full bg-sand" />
        <span className="truncate">{agent.role}</span>
        <StatusLight status={status} />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-sand-dim">
          {agent.tool === "claude-code" ? "Claude Code" : "Codex"}
        </span>
        {agent.scope && (
          <span className="truncate rounded-md bg-ink px-2.5 py-1 text-xs text-sand-dim">
            {agent.scope}
          </span>
        )}
      </div>
      <div className="nowheel nodrag mt-3 min-h-[305px] flex-1 overflow-auto rounded-xl border border-line bg-ink p-4 text-[15px] leading-6 text-text-dim">
        {agent.prompt || <span className="italic text-ph">sem instrução — clique para editar</span>}
      </div>
      <LivePlan nodeId={id} />
      <DeleteButton id={id} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// nó "tarefas de humano": bloco de anotações — o fluxo PAUSA aqui até você
// marcar o que precisava fazer na mão e clicar em continuar
export function HumanNode({ id, selected }: NodeProps) {
  const items = useSasori(
    (s) => ((s.nodes.find((n) => n.id === id)?.data.items as HumanTask[]) ?? []),
  );
  const status = useSasori((s) => s.statuses[id] ?? "idle");
  const updateHumanItems = useSasori((s) => s.updateHumanItems);
  const [draft, setDraft] = useState("");

  // sempre lê a lista FRESCA do store — evita cliques consecutivos se sobrescreverem
  const itemsNow = () =>
    (useSasori.getState().nodes.find((n) => n.id === id)?.data.items as HumanTask[]) ?? [];

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    updateHumanItems(id, [...itemsNow(), { id: `t${Date.now()}`, text, done: false }]);
    setDraft("");
  };
  const toggle = (tid: string) =>
    updateHumanItems(id, itemsNow().map((t) => (t.id === tid ? { ...t, done: !t.done } : t)));
  const remove = (tid: string) => updateHumanItems(id, itemsNow().filter((t) => t.id !== tid));

  const allDone = items.length > 0 && items.every((t) => t.done);
  const waiting = status === "waiting-human";

  return (
    <div className={cn(shell(!!selected, status), "border-t-2 border-t-sand-bright")}>
      <div className="mb-3 flex items-center gap-2 text-[17px] font-bold">
        <UserRound size={17} className="text-sand-bright" /> tarefas de humano
        <StatusLight status={status} />
      </div>

      {/* bloco de anotações pautado */}
      <div className="flex min-h-[345px] flex-1 flex-col rounded-xl border border-line bg-ink p-1.5 [background-image:repeating-linear-gradient(transparent,transparent_35px,var(--color-rule)_35px,var(--color-rule)_36px)]">
        {items.length === 0 && (
          <p className="px-3 py-3 text-[15px] italic leading-6 text-ph">
            liste aqui o que só um humano pode fazer (criar conta, pegar API key, aprovar algo…)
          </p>
        )}
        <div className="nowheel nodrag min-h-0 flex-1 overflow-auto">
          {items.map((t) => (
            <div key={t.id} className="group flex h-9 items-center gap-2.5 px-2">
              <button
                className={cn(
                  "grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded border",
                  t.done ? "border-leaf bg-leaf/20 text-leaf" : "border-line-2 text-transparent hover:border-sand",
                )}
                onClick={() => toggle(t.id)}
              >
                <Check size={12} />
              </button>
              <span
                className={cn(
                  "flex-1 truncate text-[15px]",
                  t.done ? "text-ph line-through" : "text-text",
                )}
              >
                {t.text}
              </span>
              <button
                className="hidden cursor-pointer text-text-dim hover:text-blood group-hover:block"
                onClick={() => remove(t.id)}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex h-9 items-center gap-2.5 px-2">
          <Plus size={14} className="shrink-0 text-sand-dim" />
          <input
            className="nodrag w-full bg-transparent text-[15px] text-text outline-none placeholder:text-ph"
            placeholder="adicionar tarefa…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
        </div>
      </div>

      {waiting && (
        <button
          className={cn(
            "mt-3 w-full cursor-pointer rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors",
            allDone
              ? "border-leaf bg-leaf/15 text-leaf hover:bg-leaf/25"
              : "border-sand bg-sand/10 text-sand hover:bg-sand/20",
          )}
          onClick={() => api.continueRun()}
        >
          {allDone ? "tudo feito · continuar fluxo" : "continuar fluxo mesmo assim"}
        </button>
      )}

      <DeleteButton id={id} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function TaskNode({ id, selected }: NodeProps) {
  const data = useSasori((s) => (s.nodes.find((n) => n.id === id)?.data as unknown as TaskNodeData) ?? { objective: "", tasks: [] });
  const agents = useSasori((s) => s.nodes.filter((node) => node.type === "agent-node"));
  const project = useSasori((s) => s.project);
  const toFlowMap = useSasori((s) => s.toFlowMap);
  const updateTaskBoard = useSasori((s) => s.updateTaskBoard);
  const taskStatuses = useSasori((s) => s.taskStatuses);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const updateTask = (taskId: string, patch: Partial<WorkTask>) =>
    updateTaskBoard(id, { tasks: data.tasks.map((task) => task.id === taskId ? { ...task, ...patch } : task) });
  const addTask = () => updateTaskBoard(id, { tasks: [...data.tasks, { id: `task_${Date.now().toString(36)}`, title: "Nova tarefa", description: "", status: "ready", dependsOn: [], assignedAgentId: agents[0]?.id }] });
  const plan = async () => {
    const objective = data.objective.trim() || ((toFlowMap().nodes.find((node) => node.type === "input")?.input?.task) ?? "");
    if (!project || !objective.trim()) return setMessage("Selecione um projeto e escreva um objetivo.");
    setBusy(true); setMessage("");
    try {
      const result = await api.plan({ flow: toFlowMap(), projectPath: project.path, objective, tool: (agents[0]?.data as { agent?: AgentNodeData }).agent?.tool });
      updateTaskBoard(id, { objective, tasks: result.tasks, generatedAt: new Date().toISOString() });
    } catch (error: any) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return (
    <div className={cn(shell(!!selected, "idle"), "min-h-[420px] w-[560px] border-t-2 border-t-sand")}>
      <div className="mb-3 flex items-center gap-2 text-[17px] font-bold"><ListTodo size={17} className="text-sand" /> plano de tarefas</div>
      <textarea className="nodrag nowheel mb-2 min-h-20 w-full resize-none rounded-xl border border-line bg-ink p-3 text-sm text-text outline-none focus:border-sand" placeholder="objetivo que o orquestrador deve transformar em tarefas…" value={data.objective} onChange={(event) => updateTaskBoard(id, { objective: event.target.value })} />
      <div className="mb-3 flex gap-2">
        <button type="button" className="nodrag flex cursor-pointer items-center gap-1.5 rounded-lg border border-sand bg-sand/15 px-3 py-2 text-xs font-bold text-sand hover:bg-sand/25 disabled:cursor-wait disabled:opacity-60" onClick={plan} disabled={busy}><Sparkles size={13} /> {busy ? "planejando…" : "gerar tarefas"}</button>
        <button type="button" className="nodrag flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-text-dim hover:border-sand hover:text-text" onClick={addTask}><Plus size={13} /> tarefa manual</button>
      </div>
      {message && <p className="mb-2 text-xs text-blood">{message}</p>}
      <div className="nowheel nodrag min-h-0 flex-1 space-y-2 overflow-auto rounded-xl border border-line bg-ink p-2">
        {data.tasks.length === 0 && <p className="p-3 text-sm italic text-ph">As tarefas geradas aparecerão aqui.</p>}
        {data.tasks.map((task, index) => (
          <div key={task.id} className="rounded-lg border border-line bg-ink-2 p-2.5">
            <div className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", (taskStatuses[task.id] ?? task.status) === "completed" ? "bg-leaf" : (taskStatuses[task.id] ?? task.status) === "running" ? "bg-sand animate-pulse" : (taskStatuses[task.id] ?? task.status) === "failed" ? "bg-blood" : (taskStatuses[task.id] ?? task.status) === "blocked" ? "bg-line-2" : "bg-sand-dim")} /><input className="nodrag min-w-0 flex-1 bg-transparent text-xs font-bold text-text outline-none" value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} /><span className="text-[10px] uppercase text-text-dim">{taskStatuses[task.id] ?? task.status}</span></div>
            <textarea className="nodrag nowheel mt-1.5 h-12 w-full resize-none bg-transparent text-xs leading-relaxed text-text-dim outline-none" value={task.description} placeholder="descrição e critério de conclusão" onChange={(event) => updateTask(task.id, { description: event.target.value })} />
            <div className="mt-1 flex items-center gap-2"><select className="nodrag min-w-0 flex-1 rounded border border-line bg-ink px-1.5 py-1 text-[10px] text-text-dim" value={task.assignedAgentId ?? ""} onChange={(event) => updateTask(task.id, { assignedAgentId: event.target.value || undefined })}><option value="">distribuir automaticamente</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{(agent.data.agent as AgentNodeData).role}</option>)}</select><select className="nodrag max-w-40 rounded border border-line bg-ink px-1.5 py-1 text-[10px] text-text-dim" value={task.dependsOn[0] ?? ""} onChange={(event) => updateTask(task.id, { dependsOn: event.target.value ? [event.target.value] : [] })}><option value="">sem dependência</option>{data.tasks.slice(0, index).map((previous) => <option key={previous.id} value={previous.id}>depois de: {previous.title}</option>)}</select></div>
          </div>
        ))}
      </div>
      <DeleteButton id={id} />
      <Handle type="target" position={Position.Left} /><Handle type="source" position={Position.Right} />
    </div>
  );
}

export function OutputNode({ id, selected }: NodeProps) {
  const status = useSasori((s) => s.statuses[id] ?? "idle");
  const finalOutput = useSasori((s) => s.finalOutput);
  const runError = useSasori((s) => s.runError);
  return (
    <div className={cn(shell(!!selected, status), "border-t-2 border-t-sand")}>
      <div className="mb-3 flex items-center gap-2 text-[17px] font-bold">
        <span className="h-2 w-2 rounded-full bg-sand" /> resultado final
        <StatusLight status={status} />
      </div>
      <div className="nowheel nodrag min-h-[350px] flex-1 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-ink p-4 text-[15px] leading-6">
        {runError ? (
          <span className="text-blood">{runError}</span>
        ) : finalOutput ? (
          <span className="text-text">{finalOutput}</span>
        ) : (
          <span className="italic text-ph">o resultado aparece aqui</span>
        )}
      </div>
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
