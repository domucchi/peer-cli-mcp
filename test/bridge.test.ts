import { describe, expect, it } from "bun:test";

import { callClaude, callCodex } from "../src/bridge.js";
import type { ProcessOptions, ProcessResult } from "../src/process.js";

type ProcessCall = {
  command: string;
  args: string[];
  options: ProcessOptions;
};

const outputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary"],
  properties: {
    summary: { type: "string" }
  }
};

describe("callCodex", () => {
  it("passes prompt through stdin and uses safe defaults", async () => {
    const calls: ProcessCall[] = [];

    const result = await callCodex({
      cwd: "/tmp",
      prompt: "review this diff",
      timeout_seconds: 10,
      sandbox: "read-only",
      skip_git_repo_check: false
    }, { processRunner: fakeAgent(calls, "raw output") });

    expect(result.agent).toBe("codex");
    expect(result.stdout).toBe("raw output");
    expect(result.parsed_output).toBeNull();
    expect(calls[0]?.command).toBe("codex");
    expect(calls[0]?.args).toContain("exec");
    expect(calls[0]?.args).toContain("--sandbox");
    expect(calls[0]?.args).toContain("read-only");
    expect(calls[0]?.args).toContain("--ephemeral");
    expect(calls[0]?.args).toContain("--ignore-user-config");
    expect(calls[0]?.args).toContain("--ignore-rules");
    expect(calls[0]?.args.at(-1)).toBe("-");
    expect(calls[0]?.options.input).toBe("review this diff");
    expect(calls[0]?.options.timeoutMs).toBe(10_000);
    expect(calls[0]?.options.rejectOnFailure).toBe(false);
  });

  it("passes model, sandbox, git check, and output schema options", async () => {
    const calls: ProcessCall[] = [];

    const result = await callCodex({
      cwd: "/tmp",
      prompt: "summarize",
      timeout_seconds: 10,
      model: "gpt-test",
      sandbox: "workspace-write",
      skip_git_repo_check: true,
      output_schema: outputSchema
    }, { processRunner: fakeAgent(calls, JSON.stringify({ summary: "ok" })) });

    expect(result.parsed_output).toEqual({ summary: "ok" });
    expect(calls[0]?.args).toContain("workspace-write");
    expect(calls[0]?.args).toContain("--skip-git-repo-check");
    expect(calls[0]?.args).toContain("--output-schema");
    expect(calls[0]?.args).toContain("--model");
    expect(calls[0]?.args).toContain("gpt-test");
  });

  it("returns nonzero process results instead of throwing", async () => {
    const result = await callCodex({
      cwd: "/tmp",
      prompt: "fail",
      timeout_seconds: 10,
      sandbox: "read-only",
      skip_git_repo_check: false
    }, { processRunner: fakeAgent([], "bad", { exitCode: 2, stderr: "failed" }) });

    expect(result.exit_code).toBe(2);
    expect(result.stderr).toBe("failed");
  });
});

describe("callClaude", () => {
  it("defaults to no tools and text output", async () => {
    const calls: ProcessCall[] = [];

    const result = await callClaude({
      cwd: "/tmp",
      prompt: "review this diff",
      timeout_seconds: 12,
      tool_mode: "none"
    }, { processRunner: fakeAgent(calls, "raw output") });

    expect(result.agent).toBe("claude");
    expect(calls[0]?.command).toBe("claude");
    expect(calls[0]?.args).toContain("-p");
    expect(calls[0]?.args).toContain("--output-format");
    expect(calls[0]?.args).toContain("text");
    expect(calls[0]?.args).toContain("--no-session-persistence");
    expect(calls[0]?.args).toContain("--permission-mode");
    expect(calls[0]?.args).toContain("dontAsk");
    expect(calls[0]?.args).toContain("--safe-mode");
    expect(calls[0]?.args).toContain("--tools");
    expect(calls[0]?.args).toContain("");
    expect(calls[0]?.options.input).toBe("review this diff");
    expect(calls[0]?.options.timeoutMs).toBe(12_000);
  });

  it("can enable read-only tools, model override, and JSON schema", async () => {
    const calls: ProcessCall[] = [];

    const result = await callClaude({
      cwd: "/tmp",
      prompt: "summarize",
      timeout_seconds: 12,
      model: "sonnet",
      tool_mode: "read-only",
      output_schema: outputSchema
    }, { processRunner: fakeAgent(calls, JSON.stringify({ result: JSON.stringify({ summary: "ok" }) })) });

    expect(result.parsed_output).toEqual({ summary: "ok" });
    expect(calls[0]?.args).toContain("json");
    expect(calls[0]?.args).toContain("--json-schema");
    expect(calls[0]?.args).toContain("Read,Grep,Glob");
    expect(calls[0]?.args).toContain("--model");
    expect(calls[0]?.args).toContain("sonnet");
  });
});

function fakeAgent(calls: ProcessCall[], stdout: string, overrides: Partial<ProcessResult> = {}) {
  return async (command: string, args: string[], options: ProcessOptions): Promise<ProcessResult> => {
    calls.push({ command, args, options });
    return {
      command,
      args,
      cwd: options.cwd,
      exitCode: 0,
      signal: null,
      stdout,
      stderr: "",
      timedOut: false,
      ...overrides
    };
  };
}
