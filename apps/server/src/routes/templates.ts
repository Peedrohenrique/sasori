import type { FastifyInstance } from "fastify";
import type { AgentNodeData, FlowMap, FlowTemplate } from "@marionette/shared";

const agent = (role: string, prompt: string): AgentNodeData => ({ role, prompt, tool: "claude-code", scope: "" });

function flow(id: string, name: string, agents: AgentNodeData[]): FlowMap {
  const nodes: FlowMap["nodes"] = [
    { id: `${id}-input`, type: "input", position: { x: 40, y: 220 }, input: { task: "" } },
    { id: `${id}-tasks`, type: "tasks", position: { x: 700, y: 180 }, tasks: { objective: "", tasks: [] } },
    ...agents.map((item, index) => ({ id: `${id}-agent-${index}`, type: "agent" as const, position: { x: 1380 + index * 680, y: 80 + (index % 2) * 520 }, agent: item })),
    { id: `${id}-output`, type: "output", position: { x: 1380 + agents.length * 680, y: 220 } },
  ];
  const agentIds = agents.map((_, index) => `${id}-agent-${index}`);
  return {
    id,
    name,
    projectPath: null,
    updatedAt: new Date(0).toISOString(),
    nodes,
    edges: [
      { id: `${id}-e-input`, source: `${id}-input`, target: `${id}-tasks` },
      ...agentIds.map((agentId, index) => ({ id: `${id}-e-agent-${index}`, source: `${id}-tasks`, target: agentId })),
      ...agentIds.map((agentId, index) => ({ id: `${id}-e-output-${index}`, source: agentId, target: `${id}-output` })),
    ],
  };
}

const templates: FlowTemplate[] = [
  {
    id: "full-development",
    name: "Desenvolvimento completo",
    description: "Planejamento, implementação, testes e revisão com especialidades separadas.",
    flow: flow("full", "Desenvolvimento completo", [
      agent("Arquiteto", "Analise o objetivo, a arquitetura e os riscos. Produza decisões claras para os executores."),
      agent("FullStack", "Implemente as tarefas atribuídas com código limpo e integrado ao projeto."),
      agent("Testes", "Crie e execute testes para os requisitos e mudanças implementadas."),
      agent("Revisor", "Revise código, segurança, acessibilidade e requisitos; corrija problemas encontrados."),
    ]),
  },
  {
    id: "code-review",
    name: "Revisão de código",
    description: "Auditoria técnica seguida de correções e validação.",
    flow: flow("review", "Revisão de código", [
      agent("Auditor", "Inspecione o projeto e registre problemas objetivos, riscos e prioridades."),
      agent("Corretor", "Corrija os problemas confirmados pelo auditor sem mudanças fora do escopo."),
      agent("Validador", "Execute testes e confirme se cada problema foi resolvido sem regressões."),
    ]),
  },
  {
    id: "bug-fix",
    name: "Correção de bug",
    description: "Reprodução, diagnóstico, correção mínima e teste de regressão.",
    flow: flow("bug", "Correção de bug", [
      agent("Investigador", "Reproduza o problema, encontre a causa raiz e indique a correção mais segura."),
      agent("Implementador", "Implemente a correção mínima para a causa raiz identificada."),
      agent("Teste de regressão", "Crie ou ajuste testes e valide que o bug não retorna."),
    ]),
  },
];

export async function templatesRoutes(app: FastifyInstance) {
  app.get("/templates", async () => templates);
}
