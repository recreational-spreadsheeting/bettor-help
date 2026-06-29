> **Dev channel.** Generated from the `bettor-help-mlb` plugin by `scripts/gen-dev-plugin.mjs`; points at `mcp.dev.bettor.help`. Do not edit by hand — edit the `bettor-help-mlb` plugin and regenerate.

# bettor-help-mlb

MLB-specific DFS lineup builder for Claude Code.

> **Note:** This plugin is **inert without a Clerk subscription.** The MCP server at `https://mcp.bettor.help/mcp` requires authentication via `bettor-help login`.

## Installation

```
/plugin marketplace add recreational-spreadsheeting/bettor-help
/plugin install bettor-help-mlb@bettor-help
/reload-plugins
```

Then authenticate:

```
npm install -g @bettor-help/cli
bettor-help login
```

## What this plugin does

Once authenticated, this plugin gives Claude access to MLB-specific tools:

- MLB projections, stacking strategies, and ownership modeling
- Slate parsing and pitcher/hitter analysis
- DraftKings lineup optimization for MLB contests
- Vegas lines, weather forecasts, and game environment data

## Plugins in this marketplace

| Plugin | Description |
|--------|-------------|
| `bettor-help` | General multi-sport plugin |
| `bettor-help-mlb` | MLB-specific tools and projections (this plugin) |

Dev channel variants (`bettor-help-dev`, `bettor-help-mlb-dev`) point at the dev environment and are for testing only.
