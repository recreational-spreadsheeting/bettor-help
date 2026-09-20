# bettor-help-nfl

NFL-specific DFS lineup builder for Claude Code.

> **Note:** This plugin is **inert without a Clerk subscription.** The MCP server at `https://mcp.bettor.help/mcp` requires authentication via `bettor-help login`.

## Installation

```
/plugin marketplace add recreational-spreadsheeting/bettor-help
/plugin install bettor-help-nfl@bettor-help
/reload-plugins
```

Then authenticate:

```
curl -fsSL https://get.bettor.help | sh   # macOS/Linux
```

On Windows (PowerShell):

```
irm https://get.bettor.help/install.ps1 | iex
```

Then:

```
bettor-help login
```

## What this plugin does

Once authenticated, this plugin gives Claude access to NFL-specific tools:

- NFL projections, ownership modeling, and game-environment data
- Slate parsing and DraftKings lineup optimization for NFL contests
- Private ETR content intelligence — list, search, and retrieve immutable,
  cited source passages during a build

The **`nfl-build`** skill drives three explicit workflows:

- **`projections_only`** (default) — a real blind build that makes **zero** content calls.
- **`etr_informed`** — retrieves and cites approved source passages, then asks before any change.
- **`compare`** — persists a blind baseline *before* the first content call, then measures the
  effect of informed changes under an identical profile/slate/policies/count/seed.

Content is read-only. It never changes a projection, locks a player, excludes a player, or
mutates a lineup without an ordinary explicit user instruction through the builder's existing
controls.

## Plugins in this marketplace

| Plugin | Description |
|--------|-------------|
| `bettor-help` | General multi-sport plugin |
| `bettor-help-mlb` | MLB-specific tools and projections |
| `bettor-help-nfl` | NFL-specific tools, projections, and ETR content intelligence (this plugin) |

Dev channel variants (`bettor-help-dev`, `bettor-help-mlb-dev`, `bettor-help-nfl-dev`) point at the dev environment and are for testing only.
