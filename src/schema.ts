import { z } from "zod";

export const SeveritySchema = z.enum(["critical", "high", "medium", "low", "nit"]);
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const FindingSchema = z.object({
  severity: SeveritySchema,
  file: z.string(),
  line: z.number().int().positive().nullable(),
  title: z.string(),
  rationale: z.string(),
  suggested_fix: z.string(),
  confidence: ConfidenceSchema
});

export const AgentReviewSchema = z.object({
  summary: z.string(),
  findings: z.array(FindingSchema)
});

export type AgentReview = z.infer<typeof AgentReviewSchema>;

export const ReviewRequestSchema = z.object({
  cwd: z.string().default("."),
  base_ref: z.string().optional(),
  target_ref: z.string().optional(),
  files: z.array(z.string()).optional(),
  context_files: z.array(z.string()).optional(),
  focus: z.string().optional(),
  extra_context: z.string().optional(),
  timeout_seconds: z.number().int().positive().max(1800).default(600),
  max_diff_bytes: z.number().int().positive().max(2_000_000).default(300_000),
  model: z.string().optional()
});

export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

export type ReviewerName = "claude" | "codex";

export const agentReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings"],
  properties: {
    summary: {
      type: "string",
      description: "Concise review summary."
    },
    findings: {
      type: "array",
      description: "Actionable review findings only.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "file", "line", "title", "rationale", "suggested_fix", "confidence"],
        properties: {
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "nit"]
          },
          file: {
            type: "string",
            description: "Repo-relative file path."
          },
          line: {
            type: ["integer", "null"],
            minimum: 1,
            description: "New-side line number, or null when not knowable."
          },
          title: {
            type: "string"
          },
          rationale: {
            type: "string"
          },
          suggested_fix: {
            type: "string"
          },
          confidence: {
            type: "string",
            enum: ["high", "medium", "low"]
          }
        }
      }
    }
  }
} as const;

export function normalizeAgentReview(value: unknown): AgentReview {
  const parsed = AgentReviewSchema.parse(value);
  return {
    summary: parsed.summary.trim(),
    findings: parsed.findings.map((finding) => ({
      severity: finding.severity,
      file: finding.file.trim(),
      line: finding.line,
      title: finding.title.trim(),
      rationale: finding.rationale.trim(),
      suggested_fix: finding.suggested_fix.trim(),
      confidence: finding.confidence
    }))
  };
}
