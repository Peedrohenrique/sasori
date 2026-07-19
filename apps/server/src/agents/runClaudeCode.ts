import { spawn } from "node:child_process";
import type { AgentRunner, RunnerEvent } from "./types.js";

// ─── Runner: Claude Code (modo não-interativo) ──────────────────────────────
//
// Comando: claude -p --output-format stream-json --verbose --dangerously-skip-permissions
//
// Decisões multiplataforma:
// - O prompt inteiro (instrução do agente + tarefa) vai via STDIN, nunca como
//   argumento — evita qualquer problema de escaping/quoting no Windows.
// - No Windows o `claude` é um shim .cmd, então spawn precisa de shell:true.
//   Como todos os argumentos são flags fixas sem espaços, shell:true é seguro.
// - cwd = pasta-alvo do projeto; o Claude Code trabalha relativo a ela.
// - --dangerously-skip-permissions: necessário para o agente editar arquivos e
//   rodar comandos sem prompt interativo. Troque por
//   ["--permission-mode", "acceptEdits"] se quiser bloquear comandos shell.

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

export const runClaudeCode: AgentRunner = ({ systemPrompt, userPrompt, cwd, onEvent, signal }) => {
  return new Promise((resolve) => {
    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--dangerously-skip-permissions",
    ];

    // SASORI_CLAUDE_BIN: caminho custom do binário (útil se fora do PATH)
    const child = spawn(process.env.SASORI_CLAUDE_BIN || "claude", args, {
      cwd,
      shell: process.platform === "win32",
      signal,
      env: process.env,
    });

    // instrução do agente + tarefa num prompt único via stdin
    child.stdin.write(`## Sua função\n${systemPrompt}\n\n## Tarefa\n${userPrompt}\n`);
    child.stdin.end();

    let finalOutput = "";
    let stderr = "";
    let buffer = "";

    const emit = (ev: RunnerEvent) => onEvent(ev);

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        emit({ log: line });
        try {
          const ev = JSON.parse(line);
          // converte o stream do Claude Code em marcos de status
          if (ev.type === "system" && ev.subtype === "init") {
            emit({ status: "planning" });
          } else if (ev.type === "assistant") {
            const content = ev.message?.content ?? [];
            for (const block of content) {
              if (block.type === "tool_use") {
                if (EDIT_TOOLS.has(block.name)) emit({ status: "editing" });
                else if (block.name === "Bash") emit({ status: "running-commands" });
              } else if (block.type === "text") {
                emit({ status: "planning" });
              }
            }
          } else if (ev.type === "result") {
            finalOutput = typeof ev.result === "string" ? ev.result : JSON.stringify(ev.result);
          }
        } catch {
          /* linha não-JSON, ignora */
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      resolve({ ok: false, output: "", error: `Falha ao iniciar o Claude Code: ${err.message}. Ele está instalado e no PATH?` });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, output: finalOutput || "(sem saída)" });
      } else {
        resolve({ ok: false, output: finalOutput, error: stderr.slice(-1000) || `claude saiu com código ${code}` });
      }
    });
  });
};
