# peer-review-mcp

Read-only MCP broker for cross-agent code review.

MIT licensed. Built for trusted local workflows where one coding agent asks another coding agent to review a diff without giving the reviewer write access.

It exposes two tools:

- `review_with_claude`
- `review_with_codex`

Each tool collects the current git diff, optional caller-supplied context, asks the peer agent for review, and returns normalized findings.

## Install

```bash
git clone https://github.com/domucchi/peer-review-mcp.git
cd peer-review-mcp
bun install
bun run build
```

## Codex config

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.peer_review]
command = "bun"
args = ["/Users/domucchi/Code/personal/peer-review-mcp/src/index.ts"]
enabled = true
default_tools_approval_mode = "prompt"
tool_timeout_sec = 900
```

Then ask Codex:

```text
Review my current diff with Claude. Use peer_review.review_with_claude. Address valid high/medium findings only.
```

## Claude Code config

Add to `.mcp.json` or Claude MCP settings:

```json
{
  "peer-review": {
    "command": "bun",
    "args": ["/Users/domucchi/Code/personal/peer-review-mcp/src/index.ts"]
  }
}
```

Then ask Claude:

```text
Review my current diff with Codex via review_with_codex. Do not let Codex edit files.
```

## Tool input

```json
{
  "cwd": "/path/to/repo",
  "base_ref": "main",
  "target_ref": "HEAD",
  "files": ["src/file.ts"],
  "context_files": ["docs/review-contract.md"],
  "focus": "correctness and missing tests",
  "timeout_seconds": 600,
  "max_diff_bytes": 300000,
  "model": "optional model override"
}
```

Defaults:

- `cwd`: `.`
- `base_ref`: `HEAD`
- `target_ref`: omitted means current worktree diff from `base_ref`
- `timeout_seconds`: `600`
- `max_diff_bytes`: `300000`

`base_ref` and `target_ref` use `git diff base_ref...target_ref` semantics. For branch-vs-main review, use `"base_ref": "main", "target_ref": "HEAD"`.

When `target_ref` is omitted, the broker reviews `git diff base_ref` plus untracked files.

`context_files` are resolved from the repository root unless absolute paths are supplied. Absolute paths are intentionally supported for trusted local agent workflows.

## Workflow fit

The broker is workflow-agnostic. Pass review contracts, task artifacts, or planning notes through `context_files` or `extra_context`.

Reviewers are constrained to:

- read-only review
- supplied diff/context only
- no peer-review recursion
- JSON-only findings

## Safety boundary

This is a trusted local broker. Do not expose it to untrusted callers or network clients.

The broker can read any supplied `context_files`, including absolute paths. Treat tool arguments as trusted-agent input.

Reviewer prompts instruct both agents not to edit. Codex is also launched with `--sandbox read-only`; Claude Code is launched with no tools, safe mode, and non-interactive output, which is a tool-level restriction rather than an OS sandbox.

## Development

```bash
bun run check
bun test
bun run build
```

## License

MIT
