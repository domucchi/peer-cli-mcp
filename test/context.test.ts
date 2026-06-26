import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { readContextFiles } from "../src/context.js";
import { withTempDir, writeRepoFile } from "./helpers.js";

describe("readContextFiles", () => {
  it("resolves relative context files from repo root", async () => {
    await withTempDir("peer-review-mcp-context-", async (dir) => {
      await writeRepoFile(dir, "docs/contract.md", "contract\n");

      const files = await readContextFiles(dir, ["docs/contract.md"]);

      expect(files).toEqual([{
        path: "docs/contract.md",
        content: "contract\n",
        truncated: false
      }]);
    });
  });

  it("supports absolute context files intentionally", async () => {
    await withTempDir("peer-review-mcp-context-", async (dir) => {
      await writeRepoFile(dir, "absolute.md", "absolute\n");
      const absolute = path.join(dir, "absolute.md");

      const files = await readContextFiles("/tmp", [absolute]);

      expect(files[0]?.path).toBe(absolute);
      expect(files[0]?.content).toBe("absolute\n");
    });
  });

  it("marks context truncation", async () => {
    await withTempDir("peer-review-mcp-context-", async (dir) => {
      await writeRepoFile(dir, "long.md", "abcdef");

      const files = await readContextFiles(dir, ["long.md"], 3);

      expect(files[0]?.truncated).toBe(true);
      expect(files[0]?.content).toContain("abc");
      expect(files[0]?.content).toContain("[context file truncated at 3 bytes]");
    });
  });

  it("fails clearly for missing files", async () => {
    await withTempDir("peer-review-mcp-context-", async (dir) => {
      try {
        await readContextFiles(dir, ["missing.md"]);
        throw new Error("expected readContextFiles to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to read context file "missing.md" resolved to');
      }
    });
  });

  it("documents trusted-agent-only absolute path behavior", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

    expect(readme).toContain("Absolute paths are intentionally supported for trusted local agent workflows.");
    expect(readme).toContain("Do not expose it to untrusted callers or network clients.");
  });
});
