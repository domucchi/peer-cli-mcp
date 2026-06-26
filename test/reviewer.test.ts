import { describe, expect, it } from "bun:test";

import { reviewWith, type PeerReviewResult } from "../src/reviewer.js";
import type { ProcessOptions, ProcessResult } from "../src/process.js";
import type { AgentReview } from "../src/schema.js";
import { withGitRepo, writeRepoFile } from "./helpers.js";

type ProcessCall = {
  command: string;
  args: string[];
  options: ProcessOptions;
};

describe("reviewWith", () => {
  it("constructs Claude command with read-only no-tools flags, model, and timeout", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "tracked.txt", "changed\n");
      const calls: ProcessCall[] = [];

      await reviewWith("claude", {
        cwd: repo,
        model: "sonnet",
        timeout_seconds: 7,
        max_diff_bytes: 300_000
      }, { processRunner: fakeReviewer(calls) });

      expect(calls).toHaveLength(1);
      expect(calls[0]?.command).toBe("claude");
      expect(calls[0]?.args).toContain("-p");
      expect(calls[0]?.args).toContain("--output-format");
      expect(calls[0]?.args).toContain("json");
      expect(calls[0]?.args).toContain("--json-schema");
      expect(calls[0]?.args).toContain("--no-session-persistence");
      expect(calls[0]?.args).toContain("--permission-mode");
      expect(calls[0]?.args).toContain("dontAsk");
      expect(calls[0]?.args).toContain("--tools");
      expect(calls[0]?.args).toContain("");
      expect(calls[0]?.args).toContain("--safe-mode");
      expect(calls[0]?.args).toContain("--model");
      expect(calls[0]?.args).toContain("sonnet");
      expect(calls[0]?.options.timeoutMs).toBe(7_000);
    });
  });

  it("constructs Codex command with read-only sandbox flags, model, and timeout", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "tracked.txt", "changed\n");
      const calls: ProcessCall[] = [];

      await reviewWith("codex", {
        cwd: repo,
        model: "gpt-test",
        timeout_seconds: 11,
        max_diff_bytes: 300_000
      }, { processRunner: fakeReviewer(calls) });

      expect(calls).toHaveLength(1);
      expect(calls[0]?.command).toBe("codex");
      expect(calls[0]?.args).toContain("exec");
      expect(calls[0]?.args).toContain("--sandbox");
      expect(calls[0]?.args).toContain("read-only");
      expect(calls[0]?.args).toContain("--ephemeral");
      expect(calls[0]?.args).toContain("--ignore-user-config");
      expect(calls[0]?.args).toContain("--ignore-rules");
      expect(calls[0]?.args).toContain("--output-schema");
      expect(calls[0]?.args).toContain("--model");
      expect(calls[0]?.args).toContain("gpt-test");
      expect(calls[0]?.args.at(-1)).toBe("-");
      expect(calls[0]?.options.timeoutMs).toBe(11_000);
    });
  });

  it("runs fake Codex integration path end-to-end", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "tracked.txt", "changed\n");
      await writeRepoFile(repo, "review.md", "must consider test coverage\n");
      const calls: ProcessCall[] = [];

      const result = await reviewWith("codex", {
        cwd: repo,
        context_files: ["review.md"],
        timeout_seconds: 30,
        max_diff_bytes: 300_000
      }, { processRunner: fakeReviewer(calls, {
        summary: "found issue",
        findings: [{
          severity: "medium",
          file: "tracked.txt",
          line: 1,
          title: "Missing test",
          rationale: "Changed behavior lacks coverage.",
          suggested_fix: "Add a focused regression test.",
          confidence: "high"
        }]
      }) });

      expectReviewResult(result);
      expect(calls[0]?.options.input).toContain("Context file: review.md");
      expect(calls[0]?.options.input).toContain("must consider test coverage");
      expect(calls[0]?.options.input).toContain("diff --git a/tracked.txt b/tracked.txt");
    });
  });

  it("runs fake Claude integration path end-to-end", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "tracked.txt", "changed\n");
      const calls: ProcessCall[] = [];

      const result = await reviewWith("claude", {
        cwd: repo,
        timeout_seconds: 30,
        max_diff_bytes: 300_000
      }, { processRunner: fakeReviewer(calls) });

      expect(result.summary).toBe("clean");
      expect(result.findings).toEqual([]);
      expect(calls[0]?.options.input).toContain("Reviewer: claude");
      expect(calls[0]?.options.input).toContain("Do not edit files.");
    });
  });

  it("reports truncated diff diagnostics", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "large.txt", `${"x".repeat(1000)}\n`);

      const result = await reviewWith("codex", {
        cwd: repo,
        timeout_seconds: 30,
        max_diff_bytes: 120
      }, { processRunner: fakeReviewer([]) });

      expect(result.diff_truncated).toBe(true);
      expect(result.diagnostics[0]).toContain("diff truncated from");
    });
  });
});

function fakeReviewer(calls: ProcessCall[], review: AgentReview = { summary: "clean", findings: [] }) {
  return async (command: string, args: string[], options: ProcessOptions): Promise<ProcessResult> => {
    calls.push({ command, args, options });
    return {
      command,
      args,
      cwd: options.cwd,
      exitCode: 0,
      signal: null,
      stdout: JSON.stringify(review),
      stderr: "",
      timedOut: false
    };
  };
}

function expectReviewResult(result: PeerReviewResult): void {
  expect(result.reviewer).toBe("codex");
  expect(result.summary).toBe("found issue");
  expect(result.findings).toHaveLength(1);
  expect(result.findings[0]?.title).toBe("Missing test");
}
