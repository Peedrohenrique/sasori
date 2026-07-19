# 糸 Sasori

Orquestrador visual de agentes de IA para desenvolvimento de código. Monte um fluxo de
marionetes num canvas, conecte-as com fios de chakra e deixe cada agente disparar o
**Claude Code** ou o **Codex** em modo não-interativo dentro do seu projeto real.
Multiplataforma: macOS e Windows.

## Pré-requisitos

| O quê | Por quê |
|---|---|
| **Node.js** ≥ 20 | roda o front e o server |
| **Git** | rede de segurança "Kage Bunshin" (branches) |
| **Claude Code** (`claude` no PATH, logado) | ferramenta de agente |
| **Codex** (`codex` no PATH, logado) | ferramenta de agente |

Basta UMA das duas CLIs para usar; a UI mostra o que foi detectado.
Se a CLI estiver fora do PATH, aponte o binário com as variáveis de ambiente
`SASORI_CLAUDE_BIN` / `SASORI_CODEX_BIN` antes de `npm run dev`.

## Instalar e rodar

```bash
npm install
npm run dev
```

Sobe os dois juntos: front em **http://localhost:3000**, server em **http://localhost:4001**
(porta do server configurável com `SASORI_PORT`).

## Como usar

1. **Selecionar pasta do projeto** (topo direito): navegue pelo disco ou cole o caminho
   absoluto (`/Users/voce/meu-app` ou `C:\Users\voce\meu-app`). O server valida se existe.
2. **Monte as marionetes**: `+ agente` adiciona nós. Clique num nó para abrir o inspetor e
   editar tudo: papel/nome, instrução (system prompt), ferramenta (Claude Code/Codex) e
   escopo (subpasta permitida). Dá também para **selecionar um agente já pronto**: além das
   fontes padrão (`~/.claude/agents` e `<projeto>/.claude/agents`), o botão
   *"buscar agentes em outra pasta…"* deixa você navegar até QUALQUER pasta com arquivos
   `.md` de agentes (ex.: uma pasta de agentes dentro do seu projeto) e usar os de lá.
3. **Tarefas de humano**: `+ humano` adiciona um bloco de anotações com checklist para o que
   só você pode fazer (criar conta, pegar API key, aprovar acesso…). Quando o fluxo chega
   nesse nó, ele PAUSA ("aguardando humano") até você marcar os itens e clicar em
   *continuar fluxo* — aí o contexto segue para o próximo agente.
4. **Conecte os fios**: arraste da bolinha direita de um nó até o próximo. A execução é
   sequencial na ordem dos fios (sem paralelismo no MVP), e a saída de cada agente vira
   contexto do seguinte.
5. **Escreva a tarefa inicial** no nó verde e clique **executar fluxo**.
6. **Kage Bunshin**: antes de executar, o Sasori oferece *invocar clone* — cria a branch
   `sasori/<tarefa>` e os agentes trabalham nela. Ao final, *trazer de volta* (merge) ou
   *dispersar clone* (apagar branch), sempre com sua confirmação. Pasta sem Git? Ele avisa
   e oferece `git init`.

Durante a execução cada nó mostra o marco atual (iniciando → planejando → editando
arquivos → rodando comandos → concluído) com um farol pulsante, e o painel **Ombro**
(canto inferior esquerdo) acumula o resumo de cada agente: o que foi feito + próximo passo.

## Arquitetura

```
sasori/
├── apps/web/       Next.js (App Router) + React Flow + Zustand + Tailwind — o canvas
├── apps/server/    Fastify — dispara as CLIs como subprocessos e emite status via SSE
│   └── src/agents/ runClaudeCode.ts · runCodex.ts (interface comum, fácil trocar/adicionar)
└── packages/shared/ tipos TypeScript do "mapa de agentes" (nós, fios, eventos SSE)
```

- **Sem banco**: canvases persistidos em JSON em `~/.sasori/flows/`.
- **Status em tempo real**: SSE (`GET /events`) com marcos, não micro-passos.
- **Claude Code**: `claude -p --output-format stream-json --dangerously-skip-permissions`
  (prompt via stdin; troque a flag por `--permission-mode acceptEdits` em
  `apps/server/src/agents/runClaudeCode.ts` se quiser bloquear comandos shell).
- **Codex**: `codex exec --json --sandbox workspace-write` (prompt via stdin).

## v2 (fora do MVP)

Execução paralela e "andares" (cópias isoladas do projeto por agente).
