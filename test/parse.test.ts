import { describe, expect, it } from "bun:test";

import { extractReview } from "../src/parse.js";

describe("extractReview", () => {
  it("parses direct review JSON", () => {
    const review = extractReview(JSON.stringify({
      summary: "ok",
      findings: []
    }));

    expect(review).toEqual({ summary: "ok", findings: [] });
  });

  it("parses Claude json result payload", () => {
    const review = extractReview(JSON.stringify({
      type: "result",
      result: JSON.stringify({
        summary: "one finding",
        findings: [{
          severity: "medium",
          file: "src/a.ts",
          line: 10,
          title: "Bug",
          rationale: "Breaks behavior",
          suggested_fix: "Fix it",
          confidence: "high"
        }]
      })
    }));

    expect(review.findings).toHaveLength(1);
    expect(review.findings[0]?.file).toBe("src/a.ts");
  });

  it("parses fenced JSON", () => {
    const review = extractReview([
      "Result:",
      "```json",
      JSON.stringify({ summary: "clean", findings: [] }),
      "```"
    ].join("\n"));

    expect(review.summary).toBe("clean");
  });
});
