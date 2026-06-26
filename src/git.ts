import { readFile } from "node:fs/promises";
import path from "node:path";

import { runProcess } from "./process.js";

export type DiffBundle = {
  repoRoot: string;
  baseRef: string;
  targetRef: string | null;
  files: string[];
  status: string;
  diff: string;
  truncated: boolean;
  diffBytes: number;
};

export async function collectDiff(cwd: string, options: {
  baseRef?: string;
  targetRef?: string;
  files?: string[];
  maxDiffBytes: number;
}): Promise<DiffBundle> {
  const repoRoot = await resolveRepoRoot(cwd);
  const baseRef = options.baseRef ?? "HEAD";
  const files = options.files ?? [];
  const status = await gitStdout(repoRoot, ["status", "--short"]);
  const trackedDiff = await collectTrackedDiff(repoRoot, baseRef, options.targetRef, files);
  const untrackedDiff = options.targetRef ? "" : await collectUntrackedDiff(repoRoot, files, options.maxDiffBytes);
  const rawDiff = [trackedDiff, untrackedDiff].filter(Boolean).join("\n");
  const truncated = Buffer.byteLength(rawDiff, "utf8") > options.maxDiffBytes;
  const diff = truncateUtf8(rawDiff, options.maxDiffBytes);

  return {
    repoRoot,
    baseRef,
    targetRef: options.targetRef ?? null,
    files,
    status,
    diff,
    truncated,
    diffBytes: Buffer.byteLength(rawDiff, "utf8")
  };
}

export async function resolveRepoRoot(cwd: string): Promise<string> {
  const absoluteCwd = path.resolve(cwd);
  const result = await runProcess("git", ["rev-parse", "--show-toplevel"], {
    cwd: absoluteCwd,
    timeoutMs: 15_000
  });
  return result.stdout.trim();
}

async function collectTrackedDiff(repoRoot: string, baseRef: string, targetRef: string | undefined, files: string[]): Promise<string> {
  const range = targetRef ? `${baseRef}...${targetRef}` : baseRef;
  const args = ["diff", "--no-ext-diff", "--unified=80", range, "--", ...files];
  const result = await runProcess("git", args, {
    cwd: repoRoot,
    timeoutMs: 60_000
  });
  return result.stdout;
}

async function collectUntrackedDiff(repoRoot: string, files: string[], maxDiffBytes: number): Promise<string> {
  const args = ["ls-files", "--others", "--exclude-standard", "--", ...files];
  const result = await runProcess("git", args, {
    cwd: repoRoot,
    timeoutMs: 30_000
  });
  const untracked = result.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  const chunks: string[] = [];
  let bytes = 0;

  for (const file of untracked) {
    const chunk = await untrackedFileDiff(repoRoot, file);
    chunks.push(chunk);
    bytes += Buffer.byteLength(chunk, "utf8");
    if (bytes >= maxDiffBytes) break;
  }

  return chunks.join("\n");
}

async function untrackedFileDiff(repoRoot: string, file: string): Promise<string> {
  const absolute = path.join(repoRoot, file);
  const content = await readTextPreview(absolute);
  if (content === null) {
    return [
      `diff --git a/${file} b/${file}`,
      "new file mode 100644",
      "index 0000000..0000000",
      "--- /dev/null",
      `+++ b/${file}`,
      "@@",
      "[binary or unreadable file omitted]",
      ""
    ].join("\n");
  }

  const lines = content.endsWith("\n") ? content.slice(0, -1).split("\n") : content.split("\n");
  return [
    `diff --git a/${file} b/${file}`,
    "new file mode 100644",
    "index 0000000..0000000",
    "--- /dev/null",
    `+++ b/${file}`,
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map((line) => `+${line}`),
    ""
  ].join("\n");
}

async function readTextPreview(file: string): Promise<string | null> {
  const buffer = await readFile(file);
  if (buffer.includes(0)) return null;
  return buffer.toString("utf8");
}

function truncateUtf8(value: string, maxBytes: number): string {
  const buffer = Buffer.from(value, "utf8");
  if (buffer.byteLength <= maxBytes) return value;
  return `${buffer.subarray(0, maxBytes).toString("utf8")}\n\n[diff truncated at ${maxBytes} bytes]\n`;
}

async function gitStdout(repoRoot: string, args: string[]): Promise<string> {
  const result = await runProcess("git", args, {
    cwd: repoRoot,
    timeoutMs: 30_000
  });
  return result.stdout;
}
