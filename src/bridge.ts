import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runProcess, type ProcessResult, type ProcessRunner } from "./process.js";
import { parseStructuredOutput } from "./structured.js";
import type { AgentName, CallClaudeRequest, CallCodexRequest, JsonValue, OutputSchema } from "./schema.js";

export type AgentCallResult = {
  agent: AgentName;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  signal: string | null;
  timed_out: boolean;
  parsed_output: JsonValue | null;
  validation_errors: string[];
};

export type BridgeDependencies = {
  processRunner?: ProcessRunner;
};

export async function callCodex(request: CallCodexRequest, dependencies: BridgeDependencies = {}): Promise<AgentCallResult> {
  const processRunner = dependencies.processRunner ?? runProcess;
  const tempDir = await mkdtemp(path.join(tmpdir(), "peer-cli-mcp-"));
  const schemaFile = path.join(tempDir, "output.schema.json");

  try {
    const args = [
      "exec",
      "--sandbox",
      request.sandbox,
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules"
    ];
    if (request.skip_git_repo_check) args.push("--skip-git-repo-check");
    if (request.output_schema !== undefined) {
      await writeFile(schemaFile, JSON.stringify(request.output_schema), "utf8");
      args.push("--output-schema", schemaFile);
    }
    if (request.model) args.push("--model", request.model);
    args.push("-");

    const result = await processRunner("codex", args, {
      cwd: request.cwd,
      input: request.prompt,
      timeoutMs: request.timeout_seconds * 1000,
      rejectOnFailure: false
    });
    return buildResult("codex", result, request.output_schema);
  } catch (error) {
    throw agentError("codex", error);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function callClaude(request: CallClaudeRequest, dependencies: BridgeDependencies = {}): Promise<AgentCallResult> {
  const processRunner = dependencies.processRunner ?? runProcess;
  const args = [
    "-p",
    "--output-format",
    request.output_schema === undefined ? "text" : "json",
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--safe-mode"
  ];

  if (request.output_schema !== undefined) {
    args.push("--json-schema", JSON.stringify(request.output_schema));
  }
  if (request.tool_mode === "none") {
    args.push("--tools", "");
  } else {
    args.push("--tools", "Read,Grep,Glob");
  }
  if (request.model) args.push("--model", request.model);

  try {
    const result = await processRunner("claude", args, {
      cwd: request.cwd,
      input: request.prompt,
      timeoutMs: request.timeout_seconds * 1000,
      rejectOnFailure: false
    });
    return buildResult("claude", result, request.output_schema);
  } catch (error) {
    throw agentError("claude", error);
  }
}

function buildResult(agent: AgentName, result: ProcessResult, outputSchema: OutputSchema | undefined): AgentCallResult {
  const structured = parseStructuredOutput(result.stdout, outputSchema);
  return {
    agent,
    stdout: result.stdout,
    stderr: result.stderr,
    exit_code: result.exitCode,
    signal: result.signal,
    timed_out: result.timedOut,
    parsed_output: structured.parsedOutput,
    validation_errors: structured.validationErrors
  };
}

function agentError(command: AgentName, error: unknown): Error {
  if (isMissingCommandError(error)) {
    return new Error(`Agent CLI "${command}" was not found on PATH. Install it or adjust the MCP server environment.`);
  }

  if (error instanceof Error) {
    error.message = `${command} call failed: ${error.message}`;
    return error;
  }

  return new Error(`${command} call failed: ${String(error)}`);
}

function isMissingCommandError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { code?: unknown };
  return candidate.code === "ENOENT";
}
