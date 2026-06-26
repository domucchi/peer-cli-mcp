import { describe, expect, it } from "bun:test";

import { collectDiff } from "../src/git.js";
import { runGit, withGitRepo, writeRepoFile } from "./helpers.js";

describe("collectDiff", () => {
  it("collects tracked file changes", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "tracked.txt", "hello changed\n");

      const diff = await collectDiff(repo, { maxDiffBytes: 300_000 });

      expect(diff.diff).toContain("diff --git a/tracked.txt b/tracked.txt");
      expect(diff.diff).toContain("-hello");
      expect(diff.diff).toContain("+hello changed");
      expect(diff.status).toContain("M tracked.txt");
    });
  });

  it("collects staged changes", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "tracked.txt", "staged\n");
      await runGit(repo, ["add", "tracked.txt"]);

      const diff = await collectDiff(repo, { maxDiffBytes: 300_000 });

      expect(diff.diff).toContain("+staged");
      expect(diff.status).toContain("M  tracked.txt");
    });
  });

  it("collects untracked text files", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "new.txt", "new line\nsecond\n");

      const diff = await collectDiff(repo, { maxDiffBytes: 300_000 });

      expect(diff.diff).toContain("diff --git a/new.txt b/new.txt");
      expect(diff.diff).toContain("new file mode 100644");
      expect(diff.diff).toContain("+new line");
      expect(diff.diff).toContain("+second");
    });
  });

  it("marks untracked binary files without dumping bytes", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "image.bin", new Uint8Array([0, 1, 2, 3]));

      const diff = await collectDiff(repo, { maxDiffBytes: 300_000 });

      expect(diff.diff).toContain("diff --git a/image.bin b/image.bin");
      expect(diff.diff).toContain("[binary or unreadable file omitted]");
    });
  });

  it("applies files filter to tracked and untracked files", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "tracked.txt", "changed\n");
      await writeRepoFile(repo, "other.txt", "other\n");
      await writeRepoFile(repo, "included.txt", "included\n");

      const diff = await collectDiff(repo, {
        files: ["included.txt"],
        maxDiffBytes: 300_000
      });

      expect(diff.diff).toContain("diff --git a/included.txt b/included.txt");
      expect(diff.diff).not.toContain("tracked.txt");
      expect(diff.diff).not.toContain("other.txt");
    });
  });

  it("truncates large diffs", async () => {
    await withGitRepo(async (repo) => {
      await writeRepoFile(repo, "large.txt", `${"x".repeat(1000)}\n`);

      const diff = await collectDiff(repo, { maxDiffBytes: 120 });

      expect(diff.truncated).toBe(true);
      expect(diff.diffBytes).toBeGreaterThan(120);
      expect(diff.diff).toContain("[diff truncated at 120 bytes]");
    });
  });
});
