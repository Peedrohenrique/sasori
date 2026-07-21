# Marionette — direção do projeto

Este documento é o ponto de continuidade para qualquer pessoa ou IA que assumir o projeto.
Ele descreve o que já existe, para onde o produto deve caminhar e quais decisões não devem ser
revertidas sem uma boa razão.

## Visão do produto

O Marionette deve ser uma IDE visual para planejar e executar trabalho de desenvolvimento com
agentes de IA. O usuário escolhe um projeto, descreve uma ideia, aprova um plano de tarefas,
distribui o trabalho entre agentes especializados e acompanha a execução — com Git, contexto,
skills, histórico e aprovação humana quando necessário.

O fluxo de produto desejado é:

```text
ideia → perguntas de esclarecimento → plano revisável → tarefas → agentes → revisão → resultado
```

O canvas continua sendo a metáfora principal, mas não deve obrigar o usuário a planejar tudo
manualmente antes de obter ajuda do sistema.

## Estado atual

Já implementado:

- canvas React Flow com nós de entrada, tarefas, agentes, humano e resultado;
- workspaces persistentes, troca rápida de projetos e sidebar recolhível;
- agentes Claude Code e Codex via subprocessos não interativos;
- resolução de CLI em `PATH` e em diretórios comuns de instalação;
- instrução principal, escopo, contexto Markdown e skills por agente;
- biblioteca para criar/editar/remover `SKILL.md` gerenciadas pelo Marionette;
- presets globais e por projeto;
- planejador que transforma um objetivo em tarefas estruturadas;
- distribuição automática de tarefas por agente;
- dependências com estados `blocked`, `ready`, `running`, `completed` e `failed`;
- agendamento paralelo de ramos independentes;
- Git worktrees temporárias para paralelismo quando o repositório está limpo;
- integração de commits das worktrees e abort em conflitos;
- fallback sequencial quando não há isolamento Git seguro;
- painel de progresso, logs recentes, resumos e resultados por agente;
- modelos de desenvolvimento completo, revisão de código e correção de bug;
- histórico persistente por workspace com restauração e repetição;
- documentação operacional em `README.md` e `CLAUDE.md`.

## Próximas prioridades

As prioridades devem ser executadas nesta ordem. Não começar uma fase posterior deixando a
anterior sem os testes e estados de erro básicos.

### 1. Testar o caminho crítico real

Validar manualmente com Claude Code e Codex instalados:

- abrir dois projetos e trocar entre eles;
- criar uma skill, selecioná-la e confirmar que seu conteúdo chega ao agente;
- gerar um plano, editar uma tarefa e executar;
- executar dois agentes independentes em um repositório Git limpo;
- provocar uma falha de agente e um conflito de merge;
- parar um fluxo em execução;
- restaurar e repetir uma execução do histórico.

Depois transformar esses cenários em testes automatizados do servidor.

### 2. Aprovação humana e segurança de integração

Antes de integrar worktrees, mostrar uma tela de revisão com:

- arquivos alterados por agente;
- diff resumido;
- commits que serão integrados;
- conflitos e arquivos afetados;
- ações separadas: integrar, manter worktree para inspeção ou descartar.

O merge automático atual é um MVP. Não ampliar ações destrutivas sem confirmação explícita.

### 3. Planejamento conversacional

Evoluir o botão “gerar tarefas” para um modo de planejamento:

- o planejador faz perguntas quando faltam informações;
- o usuário responde em uma conversa curta;
- o plano fica em rascunho até aprovação;
- cada tarefa mostra objetivo, critério de conclusão, risco e agente sugerido;
- o usuário pode regenerar somente uma tarefa sem perder as demais.

### 4. Tarefas mais completas

- permitir múltiplas dependências na edição visual;
- permitir reordenar tarefas e agrupar por etapa;
- separar tarefas de análise, implementação, teste e revisão;
- permitir reexecutar apenas tarefas falhas;
- permitir assumir uma tarefa manualmente ou trocar o agente responsável;
- mostrar progresso do plano no canvas e no histórico.

### 5. Histórico profissional

- filtros por status, data, agente e tarefa;
- comparação entre duas execuções;
- visualização de diffs e logs completos;
- exportação de relatório Markdown/JSON;
- retenção e limpeza configuráveis;
- reexecução a partir de um ponto intermediário.

### 6. Biblioteca de agentes e skills

- editar e excluir presets próprios pela interface;
- importar/exportar presets e skills;
- versionar recursos por projeto;
- busca e tags;
- indicar claramente origem global, projeto, Claude, Codex e Marionette;
- validar frontmatter e avisar quando uma skill estiver incompleta.

### 7. Experiência e acessibilidade

- estados de carregamento em todas as telas;
- mensagens de erro acionáveis;
- layout funcional em telas menores;
- navegação completa por teclado;
- foco visível, labels e contraste nos temas claro e escuro;
- atalhos para adicionar tarefa, agente, humano e executar.

### 8. Distribuição e operação

- documentar instalação e diagnóstico das CLIs;
- criar uma configuração inicial guiada;
- adicionar health check visível do servidor;
- preparar empacotamento desktop ou uma forma simples de iniciar web/server;
- só considerar execução remota depois que o modo local estiver estável.

## Invariantes técnicos

Estas regras devem ser preservadas:

1. `packages/shared/src/index.ts` é a fonte única dos contratos entre web e server.
2. Toda alteração de contrato exige typecheck e build.
3. O usuário nunca perde arquivos do projeto ao remover um workspace.
4. Não executar paralelismo em projeto com alterações locais sem avisar e oferecer fallback.
5. Worktrees devem ser removidas ou explicitamente mantidas após a execução.
6. Conflito de merge deve abortar o merge e deixar a branch principal recuperável.
7. Ações destrutivas e integração de código devem ter confirmação na interface.
8. Logs podem ser grandes: limitar o que fica em memória, mas oferecer acesso ao histórico.
9. Prompt, contexto e skills devem ser enviados por stdin ou pelo mecanismo seguro do runner,
   nunca concatenados em argumentos de shell.
10. A interface é pt-BR, com linguagem simples e consistência visual entre temas.

## Limitações conhecidas do MVP

- o planejador responde uma vez; ainda não existe conversa de esclarecimento;
- o editor de dependências mostra apenas uma dependência direta por tarefa;
- a integração de worktrees é automática, sem tela de diff/aprovação;
- o histórico é salvo ao final da execução, não como journal transacional a cada evento;
- a distribuição automática usa o plano do modelo e uma heurística de fallback;
- não há testes automatizados do orquestrador nem dos conflitos Git;
- execução remota, autenticação multiusuário e colaboração em tempo real estão fora do escopo.

## Critério de pronto para uma próxima fase

Uma fase só deve ser considerada concluída quando:

- o caminho feliz funciona com Claude Code e Codex;
- falhas e cancelamentos têm estado visível e histórico coerente;
- o projeto continua recuperável após conflito ou interrupção;
- `npm run typecheck`, `npm run build` e `git diff --check` passam;
- `README.md`, `CLAUDE.md` e este documento refletem o comportamento real.

## Como uma próxima IA deve começar

1. Ler este arquivo, `CLAUDE.md` e `README.md`.
2. Verificar `git status`, o último commit e os scripts disponíveis.
3. Rodar typecheck antes de assumir que uma regressão é causada pela tarefa atual.
4. Reproduzir o caminho crítico antes de redesenhar a arquitetura.
5. Escolher uma única prioridade deste documento e atualizar o documento ao concluí-la.
