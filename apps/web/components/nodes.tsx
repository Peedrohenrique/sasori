"use client";

import { useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  STATUS_LABELS,
  type AgentNodeData,
  type HumanTask,
  type RunStatus,
} from "@sasori/shared";
import { Check, ListTodo, Plus, UserRound, X } from "lucide-react";
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
      <span className="text-[11px] text-sand-dim">{STATUS_LABELS[status]}</span>
    </span>
  );
}

function shell(selected: boolean, status: RunStatus) {
  return cn(
    "w-[380px] rounded-2xl border border-line-2 bg-gradient-to-b from-ink-3 to-[#191410] p-4 shadow-[0_10px_30px_rgba(0,0,0,.45)]",
    selected && "border-sand shadow-[0_0_0_1px_#c9a25f,0_12px_36px_rgba(0,0,0,.55)]",
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
      <div className="mb-2.5 flex items-center gap-2 text-[15px] font-bold">
        <span className="h-2 w-2 rounded-full bg-leaf" /> tarefa inicial
      </div>
      <textarea
        className="nodrag nowheel h-48 w-full resize-none overflow-auto rounded-xl border border-line bg-ink p-3.5 text-sm leading-relaxed text-text outline-none placeholder:text-[#5f5540] focus:border-sand"
        placeholder="o que o Sasori deve fazer?"
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
    <div className="mt-3 rounded-xl border border-line bg-ink p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-sand">
        <ListTodo size={13} /> plano da marionete
        <span className="ml-auto font-semibold text-sand-dim">
          {done}/{items.length}
        </span>
      </div>
      <div className="nowheel nodrag max-h-44 overflow-auto">
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
                "text-[13px] leading-snug",
                t.status === "completed" && "text-[#5f5540] line-through",
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
      <div className="flex items-center gap-2 text-[15px] font-bold">
        <span className="h-2 w-2 rounded-full bg-sand" />
        <span className="truncate">{agent.role}</span>
        <StatusLight status={status} />
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-sand-dim">
          {agent.tool === "claude-code" ? "Claude Code" : "Codex"}
        </span>
        {agent.scope && (
          <span className="truncate rounded-md bg-ink px-2 py-0.5 text-[11px] text-sand-dim">
            {agent.scope}
          </span>
        )}
      </div>
      <div className="nowheel nodrag mt-2.5 max-h-32 min-h-[3.4rem] overflow-auto text-[13px] leading-relaxed text-text-dim">
        {agent.prompt || <span className="italic text-[#5f5540]">sem instrução — clique para editar</span>}
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
      <div className="mb-2.5 flex items-center gap-2 text-[15px] font-bold">
        <UserRound size={15} className="text-sand-bright" /> tarefas de humano
        <StatusLight status={status} />
      </div>

      {/* bloco de anotações pautado */}
      <div className="rounded-xl border border-line bg-ink p-1.5 [background-image:repeating-linear-gradient(transparent,transparent_35px,#221c12_35px,#221c12_36px)]">
        {items.length === 0 && (
          <p className="px-2.5 py-3 text-[13px] italic text-[#5f5540]">
            liste aqui o que só um humano pode fazer (criar conta, pegar API key, aprovar algo…)
          </p>
        )}
        <div className="nowheel nodrag max-h-52 overflow-auto">
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
                  "flex-1 truncate text-[13px]",
                  t.done ? "text-[#5f5540] line-through" : "text-text",
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
            className="nodrag w-full bg-transparent text-[13px] text-text outline-none placeholder:text-[#5f5540]"
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
            "mt-3 w-full cursor-pointer rounded-xl border px-3 py-2.5 text-[13px] font-bold transition-colors",
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

export function OutputNode({ id, selected }: NodeProps) {
  const status = useSasori((s) => s.statuses[id] ?? "idle");
  const finalOutput = useSasori((s) => s.finalOutput);
  const runError = useSasori((s) => s.runError);
  return (
    <div className={cn(shell(!!selected, status), "border-t-2 border-t-sand")}>
      <div className="mb-2.5 flex items-center gap-2 text-[15px] font-bold">
        <span className="h-2 w-2 rounded-full bg-sand" /> resultado final
        <StatusLight status={status} />
      </div>
      <div className="nowheel nodrag max-h-64 min-h-[5.5rem] overflow-auto whitespace-pre-wrap rounded-xl bg-ink p-3.5 text-[13px] leading-relaxed">
        {runError ? (
          <span className="text-blood">{runError}</span>
        ) : finalOutput ? (
          <span className="text-text">{finalOutput}</span>
        ) : (
          <span className="italic text-[#5f5540]">o resultado aparece aqui</span>
        )}
      </div>
      <Handle type="target" position={Position.Left} />
    </div>
  );
}
