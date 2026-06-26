import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { readContextFiles } from "./context.js";
import { collectDiff } from "./git.js";
import { extractReview } from "./parse.js";
import { runProcess, type ProcessRunner } from "./process.js";
import { buildReviewPrompt } from "./prompt.js";
import { agentReviewJsonSchema, type AgentReview, type ReviewerName, type ReviewRequest } from "./schema.js";

export type PeerReviewResult = {
  reviewer: ReviewerName;
  repo_root: string;
  base_ref: string;
  target_ref: string | null;
  files: string[];
  diff_bytes: number;
  diff_truncated: boolean;
  context_files: string[];
  summary: string;
  findings: AgentReview["findings"];
  diagnostics: string[];
};

export type ReviewDependencies = {
  processRunner?: ProcessRunner;
};

export async function reviewWith(reviewer: ReviewerName, request: ReviewRequest, dependencies: ReviewDependencies = {}): Promise<PeerReviewResult> {
  const diffOptions: Parameters<typeof collectDiff>[1] = {
    maxDiffBytes: request.max_diff_bytes
  };
  if (request.base_ref !== undefined) diffOptions.baseRef = request.base_ref;
  if (request.target_ref !== undefined) diffOptions.targetRef = request.target_ref;
  if (request.files !== undefined) diffOptions.files = request.files;

  const diff = await collectDiff(request.cwd, diffOptions);
  const contextFiles = await readContextFiles(diff.repoRoot, request.context_files);
  const prompt = buildReviewPrompt(reviewer, request, diff, contextFiles);
  const processRunner = dependencies.processRunner ?? runProcess;
  const agentReview = reviewer === "claude"
    ? await runClaude(request, diff.repoRoot, prompt, processRunner)
    : await runCodex(request, diff.repoRoot, prompt, processRunner);

  return {
    reviewer,
    repo_root: diff.repoRoot,
    base_ref: diff.baseRef,
    target_ref: diff.targetRef,
    files: diff.files,
    diff_bytes: diff.diffBytes,
    diff_truncated: diff.truncated,
    context_files: contextFiles.map((file) => file.path),
    summary: agentReview.summary,
    findings: agentReview.findings,
    diagnostics: buildDiagnostics(diff.diff.length === 0, diff.truncated, diff.diffBytes, request.max_diff_bytes)
  };
}

function buildDiagnostics(emptyDiff: boolean, truncated: boolean, diffBytes: number, maxDiffBytes: number): string[] {
  const diagnostics: string[] = [];
  if (emptyDiff) diagnostics.push("empty diff");
  if (truncated) diagnostics.push(`diff truncated from ${diffBytes} bytes to ${maxDiffBytes} bytes`);
  return diagnostics;
}

async function runClaude(request: ReviewRequest, cwd: string, prompt: string, processRunner: ProcessRunner): Promise<AgentReview> {
  const args = [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(agentReviewJsonSchema),
    "--no-session-persistence",
    "--permission-mode",
    "dontAsk",
    "--tools",
    "",
    "--safe-mode"
  ];
  if (request.model) args.push("--model", request.model);

  try {
    const result = await processRunner("claude", args, {
      cwd,
      input: prompt,
      timeoutMs: request.timeout_seconds * 1000
    });
    return extractReview(result.stdout);
  } catch (error) {
    throw reviewerError("claude", error);
  }
}

async function runCodex(request: ReviewRequest, cwd: string, prompt: string, processRunner: ProcessRunner): Promise<AgentReview> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "peer-review-mcp-"));
  const schemaFile = path.join(tempDir, "review.schema.json");

  try {
    await writeFile(schemaFile, JSON.stringify(agentReviewJsonSchema), "utf8");
    const args = [
      "exec",
      "--sandbox",
      "read-only",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--output-schema",
      schemaFile
    ];
    if (request.model) args.push("--model", request.model);
    args.push("-");

    const result = await processRunner("codex", args, {
      cwd,
      input: prompt,
      timeoutMs: request.timeout_seconds * 1000
    });
    return extractReview(result.stdout);
  } catch (error) {
    throw reviewerError("codex", error);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function reviewerError(command: "claude" | "codex", error: unknown): Error {
  if (isMissingCommandError(error)) {
    return new Error(`Reviewer CLI "${command}" was not found on PATH. Install it or adjust the MCP server environment.`);
  }

  if (error instanceof Error) {
    error.message = `${command} review failed: ${error.message}`;
    return error;
  }

  return new Error(`${command} review failed: ${String(error)}`);
}

function isMissingCommandError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const candidate = error as { code?: unknown };
  return candidate.code === "ENOENT";
}
