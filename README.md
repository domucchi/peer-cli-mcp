# peer-cli-mcp

MCP bridge for calling local coding-agent CLIs from another agent.

MIT licensed. Built for trusted local workflows where one agent asks a peer agent to do a bounded task: review, verification, architecture critique, bug hunt, summarization, or another caller-authored job.

It exposes two tools:

- `call_codex`
- `call_claude`

The bridge does not collect diffs, build prompts, define review schemas, or interpret outcomes. The caller owns prompt, context, task semantics, and result handling.

## Install

```bash
git clone https://github.com/domucchi/peer-cli-mcp.git
cd peer-cli-mcp
bun install
bun run build
```

## Codex config

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.peer_cli]
command = "bun"
args = ["/Users/domucchi/Code/personal/peer-cli-mcp/src/index.ts"]
enabled = true
default_tools_approval_mode = "prompt"
tool_timeout_sec = 900
```

Then ask Codex:

```text
Use peer_cli.call_claude to review the current diff. I will provide the diff in the prompt.
```

## Claude Code config

Add to `.mcp.json` or Claude MCP settings:

```json
{
  "peer-cli": {
    "command": "bun",
    "args": ["/Users/domucchi/Code/personal/peer-cli-mcp/src/index.ts"]
  }
}
```

Then ask Claude:

```text
Use call_codex to review this diff. Keep Codex sandbox read-only.
```

## call_codex

Input:

```json
{
  "cwd": "/path/to/worktree",
  "prompt": "caller-authored prompt",
  "timeout_seconds": 600,
  "model": "optional model override",
  "sandbox": "read-only",
  "skip_git_repo_check": false,
  "output_schema": {
    "type": "object",
    "properties": {
      "summary": { "type": "string" }
    },
    "required": ["summary"]
  }
}
```

Defaults:

- `cwd`: `.`
- `timeout_seconds`: `600`
- `sandbox`: `read-only`
- `skip_git_repo_check`: `false`
- `output_schema`: omitted

Codex is launched with `codex exec --ephemeral --ignore-user-config --ignore-rules`.

## call_claude

Input:

```json
{
  "cwd": "/path/to/worktree",
  "prompt": "caller-authored prompt",
  "timeout_seconds": 600,
  "model": "optional model override",
  "tool_mode": "none",
  "output_schema": {
    "type": "object",
    "properties": {
      "summary": { "type": "string" }
    },
    "required": ["summary"]
  }
}
```

Defaults:

- `cwd`: `.`
- `timeout_seconds`: `600`
- `tool_mode`: `none`
- `output_schema`: omitted

`tool_mode: "none"` launches Claude Code with no tools. `tool_mode: "read-only"` allows `Read`, `Grep`, and `Glob`.

Claude Code is launched with `claude -p --no-session-persistence --permission-mode dontAsk --safe-mode`.

## Output

Both tools return:

```json
{
  "agent": "codex",
  "stdout": "...",
  "stderr": "...",
  "exit_code": 0,
  "signal": null,
  "timed_out": false,
  "parsed_output": null,
  "validation_errors": []
}
```

When `output_schema` is provided, the bridge tries to parse JSON from stdout, validates it with Ajv, and returns the matching value in `parsed_output`. If validation fails, `parsed_output` is `null` and `validation_errors` explains why.

## Review Example

The caller should gather context and write the review prompt.

```text
Review this diff for correctness, regressions, security issues, and missing tests.
Do not suggest style-only changes.
Return JSON matching:
{
  "summary": "string",
  "findings": [
    {
      "severity": "critical|high|medium|low|nit",
      "file": "string",
      "line": 123,
      "title": "string",
      "rationale": "string",
      "suggested_fix": "string",
      "confidence": "high|medium|low"
    }
  ]
}

Diff:
...
```

Then pass that prompt to `call_claude` or `call_codex` with an `output_schema` if structured output is required.

## Safety Boundary

This is a trusted local bridge. Do not expose it to untrusted callers or network clients.

The bridge runs local CLIs in the supplied `cwd` and passes caller-authored prompts through stdin. It does not sanitize prompts or decide whether a task is safe.

Codex defaults to `read-only` sandbox. Claude defaults to no tools; `tool_mode: "read-only"` is a Claude Code tool restriction, not an OS sandbox.

## Development

```bash
bun run check
bun test
bun run build
```

## License

MIT
