---
name: sport-session-orchestrator
description: Discover and navigate the Bettor Help MCP tool surface after connecting — list available sports and tools, switch sports mid-session, and route to the right build, results, or reconcile workflow. Use when a connected user asks what they can do, which sport to use, how to switch sports, or where to start a build or results workflow.
---

# Sport session orchestrator

Once you have a live sport session (see **`onboarding-connect`** if you haven't logged in yet), this skill guides you to the right workflow.

## What's available on your subscription

Your tool surface depends on:
1. **Active sport** — only the tools for the sport you started a session for are exposed.
2. **Subscription tier** — single-sport ($25/mo) covers one sport; all-access ($50/mo) covers all.

After `start_sport_session`, call your MCP client's `list_tools` to see the live surface. Re-list any time the sport changes.

## Switching sports

```
switch_sport(sport="nascar")
```

**After switching, re-list tools.** The available set changes with the sport. Do not assume a tool from a previous sport is still present.

To peek at a sport's tools without committing the session:

```
preview_sport(sport="golf")
```

## Where to go from here

| Goal | Skill to use |
|------|-------------|
| Build lineups | **`mlb-build`** (MLB) — or the equivalent skill for your sport |
| Manage build profiles | **`profiles`** — create, save, tune, and recommend profiles |
| Score and report results | **`dfs-results`** — dollar-ROI, DK payout API, standings |
| Upload contest field after contests settle | **`reconcile-contests`** — fetch standings + upload field |
| Understand MCP tool operating doctrine | **`bettor-help-mcp`** — refresh before build, full tool reference |

## Checking session settings

```
show_settings()
```

Returns the current session configuration (active sport, active profile, build defaults). Useful for verifying state before building.

## If tools are missing

- Confirm the sport session is active: `start_sport_session` returns a session ID.
- Confirm the sport is in your subscription: `bettor-help status` in the CLI.
- Re-list tools after any `start_sport_session` or `switch_sport`.
