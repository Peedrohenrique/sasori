import { spawn } from "node:child_process";
import type { AgentRunner, RunnerEvent } from "./types.js";

// ─── Runner: Codex CLI (modo não-interativo) ────────────────────────────────
//
// Comando: codex exec --json --sandbox workspace-write --skip-git-repo-check -
//
// - `exec` roda sem prompt interativo; `-` lê o prompt do STDIN (mesma
//   estratégia multiplataforma do runner do Claude: nada de texto livre em argv).
// - --json emite eventos JSONL que convertemos em marcos de status.
// - --sandbox workspace-write permite editar arquivos e rodar comandos dentro
//   da pasta-alvo. --skip-git-repo-check evita abortar fora de repositório Git.
// - cwd = pasta-alvo (equivale ao -C, mas sem risco de quoting no Windows).

export const runCodex: AgentRunner = ({ systemPrompt, userPrompt, cwd, onEvent, signal }) => {
  return new Promise((resolve) => {
    const args = ["exec", "--json", "--sandbox", "workspace-write", "--skip-git-repo-check", "-"];

    // MARIONETTE_CODEX_BIN: caminho custom do binário (útil se fora do PATH)
    const child = spawn(process.env.MARIONETTE_CODEX_BIN || "codex", args, {
      cwd,
      shell: process.platform === "win32",
      signal,
      env: process.env,
    });

    child.stdin.write(`## Sua função\n${systemPrompt}\n\n## Tarefa\n${userPrompt}\n`);
    child.stdin.end();

    let lastMessage = "";
    let stderr = "";
    let buffer = "";

    const emit = (ev: RunnerEvent) => onEvent(ev);

    // o formato de eventos do codex já mudou entre versões; extraímos o "tipo
    // de item" de forma defensiva cobrindo os dois formatos conhecidos
    const itemOf = (ev: any) => ev.item ?? ev.msg ?? null;

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        emit({ log: line });
        try {
          const ev = JSON.parse(line);
          const item = itemOf(ev);
          const itemType: string = item?.type ?? item?.item_type ?? ev.type ?? "";

          if (itemType.includes("todo_list")) {
            // plano vivo: o Codex emite a própria todo list nos eventos --json
            const todos = (item?.items ?? [])
              .filter((t: any) => t?.text)
              .map((t: any) => ({
                text: String(t.text),
                status: t.completed ? ("completed" as const) : ("pending" as const),
              }));
            if (todos.length) emit({ todos });
          } else if (itemType.includes("reasoning") || itemType === "turn.started" || itemType === "thread.started") {
            emit({ status: "planning" });
          } else if (itemType.includes("command_execution") || itemType.includes("exec_command")) {
            emit({ status: "running-commands" });
          } else if (itemType.includes("file_change") || itemType.includes("patch")) {
            emit({ status: "editing" });
          } else if (itemType.includes("agent_message")) {
            const text = item?.text ?? item?.message ?? "";
            if (text) lastMessage = text;
            emit({ status: "planning" });
          }
        } catch {
          // codex sem --json compatível: trata stdout cru como mensagem final
          lastMessage = lastMessage ? `${lastMessage}\n${line}` : line;
        }
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      resolve({ ok: false, output: "", error: `Falha ao iniciar o Codex: ${err.message}. Ele está instalado e no PATH?` });
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ ok: true, output: lastMessage || "(sem saída)" });
      } else {
        resolve({ ok: false, output: lastMessage, error: stderr.slice(-1000) || `codex saiu com código ${code}` });
      }
    });
  });
};
