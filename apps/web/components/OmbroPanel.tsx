"use client";

import { useSasori } from "@/lib/store";
import { STATUS_LABELS } from "@marionette/shared";

// ─── "Ombro" · resumos curtos de cada agente ao concluir ────────────────────

export function OmbroPanel() {
  const summaries = useSasori((s) => s.summaries);
  const runError = useSasori((s) => s.runError);
  const running = useSasori((s) => s.running);
  const statuses = useSasori((s) => s.statuses);
  const logs = useSasori((s) => s.logs);
  const nodes = useSasori((s) => s.nodes);

  if (summaries.length === 0 && !runError && !running) return null;
  const agents = nodes.filter((node) => node.type === "agent-node");
  const completed = agents.filter((node) => statuses[node.id] === "done").length;

  return (
    <aside className="absolute bottom-4 left-4 z-20 flex max-h-[55vh] w-[360px] flex-col rounded-2xl border border-line bg-ink-2/95 shadow-[0_20px_50px_rgba(0,0,0,.5)] backdrop-blur">
      <div className="border-b border-line px-4 py-3 text-[11px] font-bold uppercase tracking-[2px] text-sand">
        <div className="flex items-center gap-2">ombro · execução <span className="ml-auto text-[10px] tracking-normal text-text-dim">{completed}/{agents.length} agentes</span></div>
        {running && <div className="mt-2 h-1 overflow-hidden rounded bg-ink"><div className="h-full rounded bg-sand transition-all" style={{ width: `${agents.length ? (completed / agents.length) * 100 : 8}%` }} /></div>}
      </div>
      <div className="flex-1 overflow-auto p-3">
        {agents.map((node) => {
          const role = (node.data.agent as { role: string }).role;
          const status = statuses[node.id] ?? "idle";
          const nodeSummary = summaries.find((item) => item.nodeId === node.id);
          return <div key={node.id} className="mb-2.5 rounded-lg border border-line bg-ink p-3"><div className="flex items-center gap-2 text-xs font-bold text-sand"><span className={status === "done" ? "h-2 w-2 rounded-full bg-leaf" : status === "error" ? "h-2 w-2 rounded-full bg-blood" : "h-2 w-2 rounded-full bg-sand animate-pulse"} />{role}<span className="ml-auto text-[10px] font-normal text-text-dim">{STATUS_LABELS[status]}</span></div>{nodeSummary && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text-dim">{nodeSummary.summary}</p>}{running && logs[node.id]?.length ? <pre className="nowheel mt-2 max-h-20 overflow-auto whitespace-pre-wrap text-[10px] leading-relaxed text-ph">{logs[node.id].slice(-3).join("\n")}</pre> : null}</div>;
        })}
        {summaries.map((s, i) => (
          !agents.some((node) => node.id === s.nodeId) && <div key={i} className="mb-2.5 rounded-lg border border-line bg-ink p-3"><div className="mb-1 text-[12px] font-bold text-sand">{s.role}</div><p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-dim">{s.summary}</p></div>
        ))}
        {runError && (
          <div className="rounded-lg border border-blood/50 bg-ink p-3">
            <div className="mb-1 text-[12px] font-bold text-blood">erro</div>
            <p className="text-[13px] leading-relaxed text-text-dim">{runError}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
