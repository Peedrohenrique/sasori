"use client";

import { useState } from "react";
import { FolderSearch, X } from "lucide-react";
import type { AgentNodeData } from "@marionette/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useSasori } from "@/lib/store";
import { FolderPicker } from "./FolderPicker";

// ─── Inspetor · painel lateral de edição do agente selecionado ──────────────
// Tudo é editável: papel, instrução, ferramenta, escopo. O usuário pode criar
// do zero OU selecionar um agente pronto — das fontes padrão (.claude/agents)
// ou de QUALQUER pasta que ele escolher navegando pelo disco.

export function Inspector() {
  const selectedId = useSasori((s) => s.selectedId);
  const node = useSasori((s) => s.nodes.find((n) => n.id === s.selectedId));
  const presets = useSasori((s) => s.presets);
  const tools = useSasori((s) => s.tools);
  const agentDirs = useSasori((s) => s.agentDirs);
  const updateAgent = useSasori((s) => s.updateAgent);
  const addAgentDir = useSasori((s) => s.addAgentDir);
  const removeAgentDir = useSasori((s) => s.removeAgentDir);
  const [dirPickerOpen, setDirPickerOpen] = useState(false);

  if (!selectedId || !node || node.type !== "agent-node") return null;
  const agent = node.data.agent as AgentNodeData;

  const toolInfo = (id: string) => tools.find((t) => t.id === id);
  const keyOf = (p: { dir: string; slug: string }) => `${p.dir}::${p.slug}`;
  const shortDir = (dir: string) => dir.split(/[/\\]/).slice(-2).join("/");

  const groups: { label: string; items: typeof presets }[] = [
    { label: "seus agentes (~/.claude/agents)", items: presets.filter((p) => p.source === "user") },
    { label: "do projeto (.claude/agents)", items: presets.filter((p) => p.source === "project") },
    ...agentDirs.map((dir) => ({
      label: `pasta: ${shortDir(dir)}`,
      items: presets.filter((p) => p.source === "custom" && p.dir === dir),
    })),
  ].filter((g) => g.items.length > 0);

  return (
    <aside className="absolute right-4 top-4 z-20 w-[290px] rounded-2xl border border-line bg-ink-2 p-4 shadow-[0_20px_50px_rgba(0,0,0,.5)]">
      <div className="text-[10px] font-bold uppercase tracking-[2px] text-sand">marionete</div>

      <Label>agente pronto</Label>
      <Select
        value={agent.presetSlug ?? ""}
        onChange={(e) => {
          const p = presets.find((x) => keyOf(x) === e.target.value);
          if (p) updateAgent(selectedId, { role: p.name, prompt: p.prompt, presetSlug: keyOf(p) });
          else updateAgent(selectedId, { presetSlug: undefined });
        }}
      >
        <option value="">— criar do zero —</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((p) => (
              <option key={keyOf(p)} value={keyOf(p)}>
                {p.name}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>

      <Button
        variant="subtle"
        size="sm"
        className="mt-2 w-full"
        onClick={() => setDirPickerOpen(true)}
      >
        <FolderSearch size={13} /> buscar agentes em outra pasta…
      </Button>

      {agentDirs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {agentDirs.map((dir) => (
            <span
              key={dir}
              title={dir}
              className="flex items-center gap-1 rounded-md border border-line bg-ink px-2 py-1 text-[10px] text-sand-dim"
            >
              {shortDir(dir)}
              <button
                className="cursor-pointer hover:text-blood"
                onClick={() => removeAgentDir(dir)}
                title="remover esta pasta"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      {presets.length === 0 && (
        <p className="mt-1.5 text-[10px] text-sand-dim">
          nenhum agente .md encontrado nas fontes padrão — use o botão acima para apontar a pasta
          onde estão os seus
        </p>
      )}

      <Label>papel / nome</Label>
      <Input value={agent.role} onChange={(e) => updateAgent(selectedId, { role: e.target.value })} />

      <Label>instrução (system prompt)</Label>
      <Textarea
        className="h-28 text-xs"
        value={agent.prompt}
        onChange={(e) => updateAgent(selectedId, { prompt: e.target.value })}
      />

      <Label>ferramenta</Label>
      <Select
        value={agent.tool}
        onChange={(e) => updateAgent(selectedId, { tool: e.target.value as AgentNodeData["tool"] })}
      >
        <option value="claude-code">
          Claude Code{toolInfo("claude-code")?.available ? "" : " (não detectado)"}
        </option>
        <option value="codex">{`Codex${toolInfo("codex")?.available ? "" : " (não detectado)"}`}</option>
      </Select>
      {toolInfo(agent.tool) && !toolInfo(agent.tool)!.available && (
        <p className="mt-1 text-[10px] text-blood">
          ⚠ CLI não detectada no PATH — instale antes de executar
        </p>
      )}

      <Label>escopo (subpasta permitida)</Label>
      <Input
        placeholder="ex.: apps/web (vazio = projeto todo)"
        value={agent.scope}
        onChange={(e) => updateAgent(selectedId, { scope: e.target.value })}
      />

      <FolderPicker
        open={dirPickerOpen}
        onClose={() => setDirPickerOpen(false)}
        title="Pasta com agentes prontos (.md)"
        onPick={async (path) => {
          try {
            const info = await api.validateProject(path);
            if (!info.exists) return `Pasta não existe: ${info.path}`;
            addAgentDir(info.path);
            return null;
          } catch (e: any) {
            return e.message as string;
          }
        }}
      />
    </aside>
  );
}
