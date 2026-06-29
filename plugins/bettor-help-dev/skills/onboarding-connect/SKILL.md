---
name: onboarding-connect
description: First-run setup for Bettor Help — install the CLI, authenticate via Clerk, confirm your subscription and active sport, then start a sport session. Use when a new user asks how to get started, install the plugin, log in, or connect to Bettor Help for the first time.
---

# Onboarding — connect to Bettor Help

One-time setup to go from a fresh plugin install to a live sport session.

## 1. Install the CLI

```
npm install -g @bettor-help/cli
```

The `bettor-help` CLI handles authentication and local session tokens. Node 18+ required.

## 2. Log in (Clerk OAuth)

```
bettor-help login
```

This opens a browser window for Clerk authentication. After you approve, the CLI writes a local session token. The token is stored on your machine only — the server never sees your DK cookie or local files.

## 3. Confirm your subscription

```
bettor-help status
```

The output shows which sports your subscription covers and the active tier (single-sport at $25/mo or all-access at $50/mo). A 7-day trial is available without a credit card. If the command shows "not authenticated," re-run `bettor-help login`.

## 4. Start a sport session

Once authenticated, start a session for your active sport via the MCP tool:

```
start_sport_session(sport="mlb")
```

This activates the sport-specific tool surface. Tools are **gated by your active sport** — without a session, sport-specific tools are not exposed. After starting, re-list the available tools (`list_tools` in your MCP client) to see what's live for your sport and subscription.

## 5. Hand off to the orchestrator

You're connected. From here, use the **`sport-session-orchestrator`** skill to discover available tools, switch sports, or route to build / results / reconcile workflows.

## Troubleshooting

- **"Not authenticated"** — run `bettor-help login` again. The token may have expired.
- **Sport tools missing after `start_sport_session`** — confirm your subscription covers the sport (`bettor-help status`), then re-list tools. A subscription that doesn't cover a sport returns "subscription_required."
- **CLI not found** — confirm Node is installed (`node --version`) and your PATH includes the npm global bin directory (`npm bin -g`).
