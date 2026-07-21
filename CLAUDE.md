# Marionette — instruções para o Claude Code

Orquestrador visual de agentes de IA (ex-"Sasori"): canvas React Flow onde o usuário monta um fluxo de
agentes que disparam **Claude Code** ou **Codex** (subprocessos não-interativos) num
projeto-alvo da máquina dele. Tema: Naruto/Sasori (marionetes, fios de chakra, Kage Bunshin).

## Comandos

```bash
npm run dev        # sobe web (:3000) + server (:4001) juntos via concurrently
npm run typecheck  # tsc nos dois workspaces — rode antes de encerrar qualquer tarefa
npm run build      # build de produção
```

Dev servers via `.claude/launch.json` (`marionette-web`, `marionette-server`).

## Arquitetura

- `packages/shared/src/index.ts` — ÚNICA fonte dos tipos (FlowMap, FlowNode, RunStatus,
  eventos SSE). Web e server importam `@marionette/shared`. Mudou contrato? Muda aqui primeiro.
- `apps/server` — Fastify. Rotas: `/fs/browse`, `/project/validate`, `/agents/presets/*`,
  `/agents/skills`, `/skills/*`, `/tools`, `/workspaces`, `/templates`, `/plan`, `/flows/*`,
  `/run`, `/run/continue`, `/run/stop`, `/history/*`, `/git/*`, `/events` (SSE).
  - `src/agents/` — runners com interface comum (`types.ts`). Prompt vai por **stdin**
    (nunca argv — quoting no Windows). `shell: true` só no win32. Overrides de binário:
    `MARIONETTE_CLAUDE_BIN` / `MARIONETTE_CODEX_BIN`. `toolPath.ts` resolve as CLIs no
    `PATH` e em locais comuns de instalação quando o app gráfico recebe um ambiente reduzido.
  - `src/orchestrator.ts` — valida o DAG, distribui tarefas por agente, libera tarefas por
    dependência e executa agentes independentes em paralelo. Em repositório Git limpo, cada
    ramo paralelo usa `worktrees.ts`; commits são integrados um a um e conflitos interrompem
    o merge. Sem Git ou com alterações locais, usa fallback sequencial. Nó `human` pausa numa
    Promise até `/run/continue`.
  - `src/history.ts` — snapshots de execução em `~/.marionette/history/<workspaceId>/`.
  - `src/git.ts` — "Kage Bunshin": branch `marionette/<slug>`; merge/delete SÓ via rota chamada
    após confirmação explícita do usuário na UI.
- `apps/web` — Next 15 App Router + Tailwind v4 + Zustand (`lib/store.ts`) + React Flow.
  - Tipos de nó RF: `input-node`, `tasks-node`, `agent-node`, `human-node`, `output-node` (components/nodes.tsx).
  - `WorkspaceSidebar.tsx` gerencia vários projetos, troca rápida de canvas, estado recolhido e
    remoção da lista. Remover um workspace nunca apaga a pasta do projeto nem o canvas salvo.
  - Cada workspace aponta para seu próprio canvas em `~/.marionette/flows/<flowId>.json`; a
    lista fica em `~/.marionette/workspaces.json`. Autosave com debounce de 800 ms — sem banco.
  - Presets de agentes: `.md` com frontmatter de `~/.claude/agents`, `<projeto>/.claude/agents`
    e pastas custom (`agentDirs` no FlowMap, chips no Inspector).
  - O Inspector separa instruções, contexto Markdown e skills. Skills reutilizáveis são
    `SKILL.md` descobertos em `.claude/skills`, `.codex/skills` ou `.marionette/skills`, tanto
    globais quanto no projeto. `skillRefs` guarda as seleções no agente.
  - `ResourcePanel.tsx` concentra skills, presets, modelos de fluxo e histórico.

## Pegadinhas conhecidas

- Fastify devolve **400** em POST com `Content-Type: application/json` e body vazio — o
  helper `req()` em `apps/web/lib/api.ts` só manda o header quando há body. Não regredir.
- Multiplataforma é requisito: sempre `path`/`os` do Node; nada hardcoded de macOS.
- `claude`/`codex` podem não estar no `PATH` de apps gráficos. Detecção e execução devem usar
  a mesma resolução de `src/agents/toolPath.ts`; não duplicar essa lógica nos runners.
- UI toda em pt-BR, tom Naruto ("invocar clone", "dispersar clone", painel "Ombro").
- Tema claro e escuro usam os mesmos tokens semânticos definidos em `globals.css`. Preserve
  contraste explícito em botões de ação vermelhos (texto/ícone brancos nos dois temas).

## Estilo

- TypeScript estrito em tudo; comentários só onde há decisão não-óbvia (runners, SSE, git).
- Execução paralela e "andares" (cópias isoladas) usam o agendador quando o projeto está em Git
  limpo; o fallback sequencial continua obrigatório para projetos sem isolamento seguro.
