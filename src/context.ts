import { readFile } from "node:fs/promises";
import path from "node:path";

export type ContextFile = {
  path: string;
  content: string;
  truncated: boolean;
};

export async function readContextFiles(cwd: string, files: string[] | undefined, maxBytes = 80_000): Promise<ContextFile[]> {
  if (!files || files.length === 0) return [];

  const entries = await Promise.all(files.map(async (file) => {
    const resolved = path.isAbsolute(file) ? file : path.join(cwd, file);
    let buffer: Buffer;
    try {
      buffer = await readFile(resolved);
    } catch (error) {
      throw new Error(`Failed to read context file "${file}" resolved to "${resolved}": ${errorMessage(error)}`);
    }
    const truncated = buffer.byteLength > maxBytes;
    const content = buffer.subarray(0, maxBytes).toString("utf8");
    return {
      path: file,
      content: truncated ? `${content}\n\n[context file truncated at ${maxBytes} bytes]\n` : content,
      truncated
    };
  }));

  return entries;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
