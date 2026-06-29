# bettor-help

Multi-sport DFS lineup builder and optimizer for Claude Code.

> **Note:** This plugin is **inert without a Clerk subscription.** The MCP server at `https://mcp.bettor.help/mcp` requires authentication via `bettor-help login`.

> **TODO:** `PROD_CLERK_CLIENT_ID_PENDING` in `.mcp.json` must be replaced with the real OAuth client ID once the production Clerk OAuth client is created.

## Installation

```
/plugin marketplace add recreational-spreadsheeting/bettor-help
/plugin install bettor-help@bettor-help
/reload-plugins
```

Then authenticate:

```
npm install -g @bettor-help/cli
bettor-help login
```

## What this plugin does

Once authenticated, this plugin gives Claude access to:

- Multi-sport DFS lineup building tools
- MLB projections, stacking, and ownership modeling
- Contest lineup optimization for DraftKings

## Plugins in this marketplace

| Plugin | Description |
|--------|-------------|
| `bettor-help` | General multi-sport plugin (this plugin) |
| `bettor-help-mlb` | MLB-specific tools and projections |

Dev channel variants (`bettor-help-dev`, `bettor-help-mlb-dev`) point at the dev environment and are for testing only.
