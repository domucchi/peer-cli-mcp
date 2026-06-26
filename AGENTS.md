# instructions

- use Bun for package management and scripts
- keep reviewers read-only; MCP tools must not mutate target repos
- preserve normalized review schema unless caller-facing contract intentionally changes
- prefer focused tests around parsing, prompt contract, and command construction
- before changing review behavior, verify with `bun run check`, `bun test`, and `bun run build`

# workflow fit

- this tool is review-stage infrastructure for any orchestrated coding flow
- include workflow artifacts only through generic `context_files` or `extra_context`
- reviewers report findings only; implementation agent decides whether to fix or reject them
