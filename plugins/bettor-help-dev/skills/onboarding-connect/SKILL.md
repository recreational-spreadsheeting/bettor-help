---
name: onboarding-connect
description: First-run guide for Bettor Help — get a new user from a fresh start into a live MLB session with their first profile and first build. Use when a new user asks how to get started, says they're new, or when the bettor.help onboarding hook flags an un-onboarded user.
---

# Onboarding — get started with Bettor Help

Walk a (possibly brand-new) user from setup to their first built lineups. Be
warm and concrete, **one step at a time**, and confirm each step worked before
moving on — assume they may be new to both Claude Code and DFS tooling.

## How they most likely got here

If they ran **`bettor-help start`** (the one-command onboarding), then the CLI is
installed, they're signed in, the plugins are enabled in `~/bettor-help`, and
they launched Claude Code there. In that case **everything below from step 2 is
already done — skip straight to "Start a sport session."**

If they're NOT set up yet (no CLI, not signed in), the fastest path is the single
command — have them run it in their terminal, then come back:

```
curl -fsSL https://get.bettor.help | sh   # macOS/Linux, one-time
bettor-help start                         # creates ~/bettor-help, enables the plugins, signs in
cd ~/bettor-help && claude                # reopen Claude Code here
```

On Windows (PowerShell):

```
irm https://get.bettor.help/install.ps1 | iex
```

## 1. Confirm they're signed in

```
bettor-help whoami
```

Shows the signed-in account + token expiry. If it says "Not signed in," have them
run `bettor-help login` (opens a browser for Clerk sign-in; the token is stored
locally — the server never sees their DK cookie or local files).

## 2. Start a sport session

```
start_sport_session(sport="mlb")
```

MLB is the most built-out sport. This activates the sport-specific tools — they're
**gated by your active sport**, so without a session the MLB tools aren't exposed.
If it returns `subscription_required`, their account doesn't cover that sport yet.

## 3. Create their first profile

Profiles drive every build — and they're **user-owned**: there are no preset
profiles, so the first real step is making one. Use the **`profiles`** skill to
explain the knobs and save a first profile (`save_profile`). Keep it simple for a
first pass; they can tune later.

## 4. Build their first lineups

```
build_lineups
```

Walk through the output with them — what was built and why. This is the payoff;
make sure they see it land.

## 5. Hand off

They're onboarded. From here, route via the **`sport-session-orchestrator`** skill
to build again, switch sports, see results (`dfs-results`), or reconcile contests
(`reconcile-contests`).

## If something's off

- **`bettor-help` not found** — the installer puts it in `~/.local/bin` (macOS/Linux) or
  `%LOCALAPPDATA%\bettor-help` (Windows); make sure that's on your PATH, or reopen your
  terminal. To update: `bettor-help update`.
- **"Not signed in" / token expired** — `bettor-help login` again.
- **MLB tools missing after `start_sport_session`** — re-list tools in the client;
  if still missing, the subscription may not cover the sport (`subscription_required`).
