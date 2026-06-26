import { describe, expect, it } from "bun:test";

import { parseStructuredOutput } from "../src/structured.js";

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["ok"],
  properties: {
    ok: { type: "boolean" }
  }
};

describe("parseStructuredOutput", () => {
  it("returns null when no schema is supplied", () => {
    const result = parseStructuredOutput(JSON.stringify({ ok: true }), undefined);

    expect(result).toEqual({ parsedOutput: null, validationErrors: [] });
  });

  it("parses direct JSON matching schema", () => {
    const result = parseStructuredOutput(JSON.stringify({ ok: true }), schema);

    expect(result.parsedOutput).toEqual({ ok: true });
    expect(result.validationErrors).toEqual([]);
  });

  it("parses nested Claude JSON result payload", () => {
    const result = parseStructuredOutput(JSON.stringify({
      type: "result",
      result: JSON.stringify({ ok: true })
    }), schema);

    expect(result.parsedOutput).toEqual({ ok: true });
  });

  it("parses fenced JSON", () => {
    const result = parseStructuredOutput([
      "Result:",
      "```json",
      JSON.stringify({ ok: true }),
      "```"
    ].join("\n"), schema);

    expect(result.parsedOutput).toEqual({ ok: true });
  });

  it("returns validation errors for invalid JSON shape", () => {
    const result = parseStructuredOutput(JSON.stringify({ ok: "yes" }), schema);

    expect(result.parsedOutput).toBeNull();
    expect(result.validationErrors.join("\n")).toContain("must be boolean");
  });

  it("returns parse error when stdout has no JSON", () => {
    const result = parseStructuredOutput("plain text", schema);

    expect(result.parsedOutput).toBeNull();
    expect(result.validationErrors).toEqual(["stdout did not contain parseable JSON"]);
  });
});
