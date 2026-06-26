import { AgentReviewSchema, normalizeAgentReview, type AgentReview } from "./schema.js";

export function extractReview(stdout: string): AgentReview {
  const candidates = collectCandidates(stdout);

  for (const candidate of candidates) {
    const parsed = parseCandidate(candidate);
    if (parsed !== null) return parsed;
  }

  throw new Error("Could not find review JSON in agent output");
}

function collectCandidates(stdout: string): unknown[] {
  const trimmed = stdout.trim();
  const candidates: unknown[] = [trimmed];

  const direct = tryJson(trimmed);
  if (direct !== null) {
    candidates.push(direct);
    collectNested(direct, candidates);
  }

  for (const match of trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
    candidates.push(match[1]?.trim() ?? "");
  }

  for (const line of trimmed.split("\n")) {
    const json = tryJson(line.trim());
    if (json !== null) {
      candidates.push(json);
      collectNested(json, candidates);
    }
  }

  return candidates;
}

function parseCandidate(candidate: unknown): AgentReview | null {
  if (typeof candidate === "string") {
    const json = tryJson(candidate);
    if (json === null) return null;
    return parseCandidate(json);
  }

  const direct = AgentReviewSchema.safeParse(candidate);
  if (direct.success) return normalizeAgentReview(direct.data);

  return null;
}

function collectNested(value: unknown, candidates: unknown[]): void {
  if (typeof value === "string") {
    candidates.push(value);
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
