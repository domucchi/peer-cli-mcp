#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { callClaude, callCodex } from "./bridge.js";
import { CallClaudeRequestSchema, CallCodexRequestSchema } from "./schema.js";

const server = new McpServer({
  name: "peer-cli-mcp",
  version: "0.1.0"
});

server.registerTool(
  "call_claude",
  {
    title: "Call Claude Code",
    description: "Run Claude Code non-interactively with a caller-authored prompt.",
    inputSchema: CallClaudeRequestSchema.shape
  },
  async (input) => {
    const request = CallClaudeRequestSchema.parse(input);
    const result = await callClaude(request);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result
    };
  }
);

server.registerTool(
  "call_codex",
  {
    title: "Call Codex",
    description: "Run Codex non-interactively with a caller-authored prompt.",
    inputSchema: CallCodexRequestSchema.shape
  },
  async (input) => {
    const request = CallCodexRequestSchema.parse(input);
    const result = await callCodex(request);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
