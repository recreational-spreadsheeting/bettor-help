# bettor-help plugin marketplace

Public Claude Code plugin marketplace for the bettor-help DFS product.

> **This marketplace is public and inert without a Clerk subscription.** Installing the plugins gives Claude the MCP server connection; the server itself requires authentication via `bettor-help login`.

## Available plugins

| Plugin | Description |
|--------|-------------|
| `bettor-help` | Multi-sport DFS lineup builder and optimizer |
| `bettor-help-mlb` | MLB-specific tools: projections, stacking, ownership modeling |
| `bettor-help-dev` | Dev channel — points at `mcp.dev.bettor.help` (for testing) |
| `bettor-help-mlb-dev` | Dev channel MLB variant (for testing) |

## Installation

### Step 1 — Add the marketplace

```
/plugin marketplace add recreational-spreadsheeting/bettor-help
```

### Step 2 — Install a plugin

```
/plugin install bettor-help@bettor-help
```

or for the MLB-specific plugin:

```
/plugin install bettor-help-mlb@bettor-help
```

### Step 3 — Reload plugins

```
/reload-plugins
```

### Step 4 — Authenticate

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

## Repository structure

```
.claude-plugin/marketplace.json   # marketplace manifest
plugins/
  bettor-help/                    # canonical general plugin
  bettor-help-mlb/                # canonical MLB plugin
  bettor-help-dev/                # generated dev variant (do not edit by hand)
  bettor-help-mlb-dev/            # generated dev variant (do not edit by hand)
scripts/
  validate-plugin.mjs             # validates manifests + skill frontmatter
  gen-dev-plugin.mjs              # generates -dev plugins from canonical sources
.github/workflows/validate.yml    # CI: validate + check dev plugins are in sync
```

## Development

Dev plugins are generated — do not edit them by hand.

```bash
# Generate dev plugins from canonical sources
node scripts/gen-dev-plugin.mjs

# Validate all manifests
node scripts/validate-plugin.mjs

# Check dev plugins are in sync (used in CI)
node scripts/gen-dev-plugin.mjs --check
```

## Branch model

`feat/*` → `dev` → `main`
