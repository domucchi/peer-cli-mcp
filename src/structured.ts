import { Ajv } from "ajv";

import type { JsonValue, OutputSchema } from "./schema.js";

export type StructuredParseResult = {
  parsedOutput: JsonValue | null;
  validationErrors: string[];
};

export function parseStructuredOutput(stdout: string, schema: OutputSchema | undefined): StructuredParseResult {
  if (schema === undefined) {
    return { parsedOutput: null, validationErrors: [] };
  }

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const candidates = collectCandidates(stdout);
  const validationErrors: string[] = [];

  for (const candidate of candidates) {
    if (validate(candidate)) {
      return { parsedOutput: candidate as JsonValue, validationErrors: [] };
    }
    validationErrors.push(ajv.errorsText(validate.errors));
  }

  if (candidates.length === 0) {
    return {
      parsedOutput: null,
      validationErrors: ["stdout did not contain parseable JSON"]
    };
  }

  return {
    parsedOutput: null,
    validationErrors: [...new Set(validationErrors)]
  };
}

function collectCandidates(stdout: string): unknown[] {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return [];

  const candidates: unknown[] = [];
  collectJson(trimmed, candidates);

  for (const match of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
    collectJson(match[1]?.trim() ?? "", candidates);
  }

  for (const line of trimmed.split("\n")) {
    collectJson(line.trim(), candidates);
  }

  return candidates;
}

function collectJson(value: string, candidates: unknown[]): void {
  const parsed = tryJson(value);
  if (parsed === null) return;
  candidates.push(parsed);
  collectNested(parsed, candidates);
}

function collectNested(value: unknown, candidates: unknown[]): void {
  if (typeof value === "string") {
    collectJson(value, candidates);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectNested(item, candidates);
    return;
  }

  if (value !== null && typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["result", "content", "text", "structured_output", "structuredContent", "message"]) {
      if (key in object) collectNested(object[key], candidates);
    }
  }
}

function tryJson(value: string): unknown | null {
  if (value.length === 0) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
