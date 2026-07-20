"use client";

import { useSasori } from "@/lib/store";

// ─── "Ombro" · resumos curtos de cada agente ao concluir ────────────────────

export function OmbroPanel() {
  const summaries = useSasori((s) => s.summaries);
  const runError = useSasori((s) => s.runError);

  if (summaries.length === 0 && !runError) return null;

  return (
    <aside className="absolute bottom-4 left-4 z-20 flex max-h-[55vh] w-[360px] flex-col rounded-2xl border border-line bg-ink-2/95 shadow-[0_20px_50px_rgba(0,0,0,.5)] backdrop-blur">
      <div className="border-b border-line px-4 py-3 text-[11px] font-bold uppercase tracking-[2px] text-sand">
        ombro · o que os agentes fizeram
      </div>
      <div className="flex-1 overflow-auto p-3">
        {summaries.map((s, i) => (
          <div key={i} className="mb-2.5 rounded-lg border border-line bg-ink p-3">
            <div className="mb-1 text-[12px] font-bold text-sand">{s.role}</div>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-dim">{s.summary}</p>
          </div>
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
