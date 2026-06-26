import { z } from "zod";

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(JsonValueSchema),
  z.record(z.string(), JsonValueSchema)
]));

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };
export type OutputSchema = boolean | JsonObject;

export const OutputSchemaSchema: z.ZodType<OutputSchema> = z.union([
  z.boolean(),
  z.record(z.string(), JsonValueSchema)
]);

const BaseCallRequestSchema = z.object({
  cwd: z.string().default("."),
  prompt: z.string().min(1),
  timeout_seconds: z.number().int().positive().max(1800).default(600),
  model: z.string().optional(),
  output_schema: OutputSchemaSchema.optional()
});

export const CodexSandboxSchema = z.enum(["read-only", "workspace-write", "danger-full-access"]);

export const CallCodexRequestSchema = BaseCallRequestSchema.extend({
  sandbox: CodexSandboxSchema.default("read-only"),
  skip_git_repo_check: z.boolean().default(false)
});

export const ClaudeToolModeSchema = z.enum(["none", "read-only"]);

export const CallClaudeRequestSchema = BaseCallRequestSchema.extend({
  tool_mode: ClaudeToolModeSchema.default("none")
});

export type CallCodexRequest = z.infer<typeof CallCodexRequestSchema>;
export type CallClaudeRequest = z.infer<typeof CallClaudeRequestSchema>;
export type AgentName = "codex" | "claude";
