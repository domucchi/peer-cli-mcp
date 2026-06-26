#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { reviewWith } from "./reviewer.js";
import { ReviewRequestSchema } from "./schema.js";

const server = new McpServer({
  name: "peer-review-mcp",
  version: "0.1.0"
});

server.registerTool(
  "review_with_claude",
  {
    title: "Review current diff with Claude Code",
    description: "Ask Claude Code for read-only review of a git diff. Returns normalized findings.",
    inputSchema: ReviewRequestSchema.shape
  },
  async (input) => {
    const request = ReviewRequestSchema.parse(input);
    const result = await reviewWith("claude", request);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result
    };
  }
);

server.registerTool(
  "review_with_codex",
  {
    title: "Review current diff with Codex",
    description: "Ask Codex for read-only review of a git diff. Returns normalized findings.",
    inputSchema: ReviewRequestSchema.shape
  },
  async (input) => {
    const request = ReviewRequestSchema.parse(input);
    const result = await reviewWith("codex", request);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
