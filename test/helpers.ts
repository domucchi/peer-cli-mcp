import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { runProcess } from "../src/process.js";

export async function withTempDir<T>(prefix: string, callback: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  try {
    return await callback(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function withGitRepo<T>(callback: (repo: string) => Promise<T>): Promise<T> {
  return await withTempDir("peer-review-mcp-test-", async (repo) => {
    await runGit(repo, ["init", "-b", "main"]);
    await runGit(repo, ["config", "user.email", "test@example.com"]);
    await runGit(repo, ["config", "user.name", "Test User"]);
    await writeRepoFile(repo, "tracked.txt", "hello\n");
    await runGit(repo, ["add", "tracked.txt"]);
    await runGit(repo, ["commit", "-m", "initial"]);
    return await callback(repo);
  });
}

export async function writeRepoFile(repo: string, file: string, content: string | Uint8Array): Promise<void> {
  const target = path.join(repo, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
}

export async function runGit(repo: string, args: string[]): Promise<string> {
  const result = await runProcess("git", args, {
    cwd: repo,
    timeoutMs: 30_000
  });
  return result.stdout;
}
