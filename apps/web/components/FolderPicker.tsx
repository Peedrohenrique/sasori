"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Check, Folder } from "lucide-react";
import type { BrowseResult } from "@marionette/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

// ─── Navegador de pastas genérico ───────────────────────────────────────────
// Usado tanto para escolher a pasta do projeto-alvo quanto para apontar uma
// pasta de agentes prontos. Navega via server (o navegador não acessa o disco)
// e aceita colar caminho absoluto. `onPick` retorna string de erro para exibir,
// ou null/undefined para fechar.

export function FolderPicker({
  open,
  onClose,
  title,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  onPick: (path: string) => Promise<string | null | void>;
}) {
  const [browse, setBrowse] = useState<BrowseResult | null>(null);
  const [manual, setManual] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nav = async (path?: string) => {
    setError(null);
    try {
      const r = await api.browse(path);
      setBrowse(r);
      setManual(r.path);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (open && !browse) nav();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async (path: string) => {
    setError(null);
    const err = await onPick(path.trim());
    if (err) setError(err);
    else onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="flex gap-2">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="/Users/voce/meu-app ou C:\Users\voce\meu-app"
          onKeyDown={(e) => e.key === "Enter" && confirm(manual)}
        />
        <Button variant="sand" size="sm" className="h-auto shrink-0" onClick={() => confirm(manual)}>
          <Check size={13} /> usar
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-sand-dim">
        <button
          className="flex items-center gap-1 rounded border border-line px-2 py-1 hover:text-text cursor-pointer disabled:opacity-40"
          disabled={!browse?.parent}
          onClick={() => browse?.parent && nav(browse.parent)}
        >
          <ArrowUp size={12} /> subir
        </button>
        <span className="truncate">{browse?.path}</span>
      </div>

      <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-line">
        {browse?.dirs.length === 0 && (
          <p className="p-3 text-xs italic text-sand-dim">sem subpastas aqui</p>
        )}
        {browse?.dirs.map((d) => (
          <button
            key={d.path}
            className="flex w-full items-center gap-2 border-b border-line/50 px-3 py-2 text-left text-xs text-text-dim hover:bg-ink-3 hover:text-text cursor-pointer"
            onClick={() => nav(d.path)}
            onDoubleClick={() => confirm(d.path)}
          >
            <Folder size={13} className="text-sand" /> {d.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-sand-dim">
        clique para entrar · duplo-clique (ou "usar") para escolher a pasta atual
      </p>
      {error && <p className="mt-2 text-xs text-blood">{error}</p>}
    </Dialog>
  );
}
