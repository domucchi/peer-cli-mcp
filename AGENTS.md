# instructions

- use Bun for package management and scripts
- keep defaults read-only; MCP tools must not mutate target repos themselves
- do not add workflow-specific behavior to the bridge
- prefer focused tests around structured parsing and command construction
- before changing CLI behavior, verify with `bun run check`, `bun test`, and `bun run build`

# workflow fit

- this tool is generic infrastructure for orchestrated coding flows
- caller owns prompts, context, task semantics, and result interpretation
- review is a use case, not a built-in behavior
