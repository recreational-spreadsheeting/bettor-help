---
name: bettor-help-mcp
description: Operating doctrine and full tool reference for the Bettor Help MCP server — sessions, profile-driven builds, projections, vegas, freshness, entries, results. Use when the user asks how to use the MCP tools, what tools are available, how to run a build workflow, how to save entries, or how to upload contest standings.
---

# Bettor Help MCP — tool reference and operating doctrine

A practical guide to running DFS workflows through the Bettor Help MCP server. Tools are namespaced `mcp__claude_ai_Bettor_Help__*`. All calls require an active sport session.

## Operating doctrine

Two rules apply to every workflow:

1. **Refresh before you build.** Query freshness (`mlb_get_freshness` / `mlb_pipeline_status`) before building. The refresh plane runs on a schedule and can lag. Building on stale data risks using old batting orders, injury status, or projections.
2. **Verify before asserting.** Never narrate data from session memory. Use the tools to pull current state, then summarize what the data says.

## Sessions — start one first

Tools are gated by your **active sport** and your **subscription**. Without a session, sport-specific tools are not exposed.

- **`start_sport_session`** — opens a session for a sport (e.g. MLB). First call in any workflow.
- **`switch_sport`** — changes the active sport mid-session.
- **After starting or switching, re-list tools.** The tool surface changes with the sport and subscription.
- **`preview_sport`** — peeks at a sport without committing the session.

## Profile-driven build flow

Builds are **profile-driven** — a profile is your declarative build configuration (objective, ownership source, constraints). See the **`profiles`** skill to create and manage profiles.

The standard flow:

1. Check freshness: `mlb_get_freshness` / `mlb_pipeline_status`
2. Choose or confirm the active profile: `list_profiles` → `recommend_profile(games=N)`
3. Build: `build_lineups(profile="my-profile", count=N)` or `build_all_today(profile="my-profile")`
4. Review the returned lineups — check salary used, players, confidence flags
5. Save: `save_entries(dkentries_csv=..., dg=..., profile_version=...)` to record entry IDs
6. Log results later: `update_results(date=..., standings_map={...})`

### Build entry points

- **`build_lineups`** — build for a specified slate/contest with the active profile.
- **`build_for_dg`** — build for a specific **draft group ID** (required for sub-slate Double-Ups whose `draftGroupId` differs from the headline slate — always match the contest's own draft group).
- **`build_all_today`** — build across all of today's slates in one call.

## Projections and data reads

- **`mlb_get_projections`** / **`mlb_get_player_projection`** — slate or single-player projections.
- **`mlb_get_vegas_lines`** / **`mlb_get_team_implied_total`** / **`mlb_get_line_movers`** — vegas data. **See the known gap below** — `mlb_get_vegas_lines` hides day games.
- **`mlb_get_freshness`** / **`mlb_pipeline_status`** — check data currency before building.
- Slate/game discovery: **`mlb_list_slates`**, **`mlb_get_slate_manifest`**, **`mlb_get_games_for_slate`**, **`mlb_get_probable_pitchers`**.
- **`mlb_get_weather_forecast`**, **`mlb_get_park_factors`**, **`mlb_get_game_environment`** — game-environment context.
- **`mlb_get_player_form`**, **`mlb_get_player_crosswalk`** — player-level detail.

## Entries — capture and edit

- **`save_entries`** — record entered contest + entry IDs. Capture at reserve; player-only upload CSVs carry no contest IDs and can't be reconciled later.
- **`edit_entries`** — apply an Edit-Entries CSV for post-upload swaps. Produces a minimal CSV covering only changed rows; the operator re-uploads via DK's Edit Entries → Import Lineups.
- **`log_contest_result`** / **`update_results`** — record your outcomes to the per-user plane (`update_results` uses the DK public payout API — no cookie needed).

## `upload_contest_field` — push the field to the shared lake

**`upload_contest_field`** pushes the **user-free** per-contest field (every entry's lineup total = the cash-line source + per-player %Drafted) to the global lake. This is the client-side path for cookie-authed contest standings: the cloud never fetches DraftKings, so you fetch standings on your machine and upload the field here.

- Inputs: `{slate_date, site?, contests:[{contest_id, draft_group_id?, entry_fee?, field?, places_paid?, payout?, standings_rows:[{entry_name, player, pct_drafted, fpts}]}]}`
- Idempotent — bronze is write-once on a deterministic key, so re-uploading the same contest is a no-op.
- **MLB only today** — rejects non-DK `site` and non-MLB sports.
- Use the **`reconcile-contests`** skill to build the payload from DK standings CSVs; do not hand-assemble it.

## Known gap — `mlb_get_vegas_lines` hides day games

The hosted vegas data is complete — the database holds the full daily card including day games. The **read tool** hides them due to two compounding reasons:

1. `mlb_get_vegas_lines` intersects the full card with a slate variant's team set, defaulting to `main` — only evening games survive.
2. Day games are classified `afternoon`, but the exposed enum is `{main, early, night}` — `afternoon` is rejected.

**Workaround until the fix ships:** call `mlb_get_vegas_lines` once per variant (`main` and `night`) and union the results. Vegas is slate-agnostic (one game = one line), so the union gives the full card. The proper fix — a `slate_type="all"` bypass — is backlogged in the bettor-help server.
