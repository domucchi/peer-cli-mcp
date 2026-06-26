import type { DiffBundle } from "./git.js";
import type { ContextFile } from "./context.js";
import type { ReviewRequest, ReviewerName } from "./schema.js";

export function buildReviewPrompt(reviewer: ReviewerName, request: ReviewRequest, diff: DiffBundle, contextFiles: ContextFile[]): string {
  const focus = request.focus?.trim() || "correctness, regressions, security, data loss, concurrency, and meaningful missing tests";
  const extraContext = request.extra_context?.trim();

  return [
    "You are a senior code reviewer invoked by another coding agent.",
    "",
    "Review contract:",
    "- Review only the supplied diff and context.",
    "- Do not edit files.",
    "- Do not call peer-review tools or delegate to another agent.",
    "- Report actionable defects only. Skip style preferences unless they hide a real bug.",
    "- Prefer no finding over a weak finding.",
    "- Use new-side line numbers when possible; use null when not knowable.",
    "- Return JSON only, matching the requested schema exactly.",
    "",
    `Reviewer: ${reviewer}`,
    `Repository: ${diff.repoRoot}`,
    `Range: ${diff.targetRef ? `${diff.baseRef}...${diff.targetRef}` : `${diff.baseRef}..WORKTREE`}`,
    `Focus: ${focus}`,
    diff.truncated ? `Diff warning: truncated from ${diff.diffBytes} bytes to ${request.max_diff_bytes} bytes.` : `Diff bytes: ${diff.diffBytes}`,
    "",
    "Git status:",
    fence(diff.status || "(clean)"),
    "",
    contextFilesSection(contextFiles),
    extraContext ? ["Extra context:", fence(extraContext), ""].join("\n") : "",
    "Diff:",
    fence(diff.diff || "(empty diff)")
  ].filter(Boolean).join("\n");
}

function contextFilesSection(files: ContextFile[]): string {
  if (files.length === 0) return "";
  return `${files.map((file) => [`Context file: ${file.path}`, fence(file.content)].join("\n")).join("\n\n")}\n`;
}

function fence(value: string): string {
  return `\`\`\`\n${value.replaceAll("```", "'''")}\n\`\`\``;
}
