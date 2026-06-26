import { describe, expect, it } from "bun:test";

import { buildReviewPrompt } from "../src/prompt.js";
import type { DiffBundle } from "../src/git.js";
import type { ReviewRequest } from "../src/schema.js";

describe("buildReviewPrompt", () => {
  it("keeps review read-only and diff-scoped", () => {
    const request: ReviewRequest = {
      cwd: ".",
      timeout_seconds: 600,
      max_diff_bytes: 300_000
    };
    const diff: DiffBundle = {
      repoRoot: "/repo",
      baseRef: "HEAD",
      targetRef: null,
      files: [],
      status: " M src/a.ts",
      diff: "diff --git a/src/a.ts b/src/a.ts",
      truncated: false,
      diffBytes: 35
    };

    const prompt = buildReviewPrompt("claude", request, diff, []);

    expect(prompt).toContain("Do not edit files.");
    expect(prompt).toContain("Review only the supplied diff");
    expect(prompt).toContain("HEAD..WORKTREE");
  });
});
