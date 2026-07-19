# Sasori — instruções para o Claude Code

Orquestrador visual de agentes de IA: canvas React Flow onde o usuário monta um fluxo de
agentes que disparam **Claude Code** ou **Codex** (subprocessos não-interativos) num
projeto-alvo da máquina dele. Tema: Naruto/Sasori (marionetes, fios de chakra, Kage Bunshin).

## Comandos

```bash
npm run dev        # sobe web (:3000) + server (:4001) juntos via concurrently
npm run typecheck  # tsc nos dois workspaces — rode antes de encerrar qualquer tarefa
npm run build      # build de produção
```

Dev servers via `.claude/launch.json` (`sasori-web`, `sasori-server`).

## Arquitetura

- `packages/shared/src/index.ts` — ÚNICA fonte dos tipos (FlowMap, FlowNode, RunStatus,
  eventos SSE). Web e server importam `@sasori/shared`. Mudou contrato? Muda aqui primeiro.
- `apps/server` — Fastify. Rotas: `/fs/browse`, `/project/validate`, `/agents/presets` (POST),
  `/tools`, `/flows/*`, `/run`, `/run/continue`, `/run/stop`, `/git/*`, `/events` (SSE).
  - `src/agents/` — runners com interface comum (`types.ts`). Prompt vai por **stdin**
    (nunca argv — quoting no Windows). `shell: true` só no win32. Overrides de binário:
    `SASORI_CLAUDE_BIN` / `SASORI_CODEX_BIN`.
  - `src/orchestrator.ts` — ordem topológica, SEQUENCIAL (sem paralelismo no MVP). Nó
    `human` pausa numa Promise até `/run/continue`. Status são MARCOS (starting/planning/
    editing/running-commands/waiting-human/done/error), não micro-passos.
  - `src/git.ts` — "Kage Bunshin": branch `sasori/<slug>`; merge/delete SÓ via rota chamada
    após confirmação explícita do usuário na UI.
- `apps/web` — Next 15 App Router + Tailwind v4 + Zustand (`lib/store.ts`) + React Flow.
  - Tipos de nó RF: `input-node`, `agent-node`, `human-node`, `output-node` (components/nodes.tsx).
  - Canvas autosalva em `~/.sasori/flows/default.json` (debounce 800ms) — sem banco.
  - Presets de agentes: `.md` com frontmatter de `~/.claude/agents`, `<projeto>/.claude/agents`
    e pastas custom (`agentDirs` no FlowMap, chips no Inspector).

## Pegadinhas conhecidas

- Fastify devolve **400** em POST com `Content-Type: application/json` e body vazio — o
  helper `req()` em `apps/web/lib/api.ts` só manda o header quando há body. Não regredir.
- Multiplataforma é requisito: sempre `path`/`os` do Node; nada hardcoded de macOS.
- `claude`/`codex` podem não estar no PATH do shell do Claude Code, mas estarem no do server —
  a rota `/tools` é a fonte da verdade da detecção.
- UI toda em pt-BR, tom Naruto ("invocar clone", "dispersar clone", painel "Ombro").
- Tema fixo: bg `#14110d`, sand `#c9a25f`, blood `#a52222` (tokens no `globals.css`).

## Estilo

- TypeScript estrito em tudo; comentários só onde há decisão não-óbvia (runners, SSE, git).
- v2 planejada (NÃO implementar sem pedido): execução paralela e "andares" (cópias isoladas).
