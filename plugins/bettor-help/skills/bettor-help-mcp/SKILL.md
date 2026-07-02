---
name: bettor-help-mcp
description: Operating doctrine and full tool reference for the Bettor Help MCP server — sessions, the proven daily loop, profile-driven builds, projections, vegas, freshness, entries, results. Use when the user asks how to use the MCP tools, what tools are available, how to run a build workflow, how to save entries, or how to upload contest standings.
---

# Bettor Help MCP — tool reference and operating doctrine

A practical guide to running DFS workflows through the Bettor Help MCP server. Tools are namespaced `mcp__claude_ai_Bettor_Help__*`. All calls require an active sport session.

## Operating doctrine

Three rules apply to every workflow:

1. **Refresh before you build.** Query freshness (`mlb_get_freshness` / `mlb_pipeline_status`) before building. The daily pipeline self-serves (projections + ownership land automatically), but the refresh plane runs on a schedule and can lag near lock. Building on stale data risks old batting orders, injury status, or projections.
2. **Verify before asserting.** Never narrate data from session memory. Use the tools to pull current state, then summarize what the data says.
3. **The cloud never contacts DraftKings.** Anything that needs your DK login — uploading lineups, exporting entries, pulling standings — happens on your machine. Your CSV exports are the bridge. That's privacy by design.

## The daily loop

The proven end-to-end day. The full walkthrough — DK mechanics, timings, the late-swap doctrine, and a worked call sequence — is in **`references/daily-process.md`**. The short version:

1. **See the menu.** `start_sport_session("mlb")`, then `mlb_list_slates` — one row per draft group (main / early / night / turbo / afternoon), each with its `draft_group_id`, game count, and lock-relevant game times.
2. **Build each slate you'll play.** `build_for_dg(draft_group_id=<dg>, slate_type=<type>, profile=<yours>, slate_date=today)`. **Pass `slate_type` explicitly** — a known issue defaults a draft-group-only build to `main`, which mis-scopes any non-main slate. The response carries the lineup (projections + real Stokastic `ownership` + `lineup_confidence` per player), a paste-ready `dk_upload_csv`, and honest diagnostics (`starting_status` like "8/10 predicted — re-run near lock"; a night slate built before probable SPs post reports "0 pitchers" — build it later, not an error).
3. **Enter on DK.** Upload `dk_upload_csv` via DK's bulk **Upload Lineups**, then export **DKEntries.csv** from the contest's Edit Entries page (one export per draft group).
4. **Track.** `ingest_entries(dg, slate_date, dk_entries_csv=<export>, profile_version="cash@1")` records every entry to the cloud ledger, stamped with the `profile_version` so results attribute to the exact config you ran.
5. **Near lock, late-swap.** Re-run `build_for_dg` for fresh confirmed lineups; if players changed, `export_edit_entries(dg, new_lineup_csv=<fresh dk_upload_csv>)` returns a DK Edit-Entries CSV of ONLY the changed entries, overlaid onto existing entry IDs (never delete + re-enter — that forfeits the slot). `late_swap_check` flags exposure before lock.
6. **After settle, reconcile.** Run the **`reconcile-contests`** skill → `upload_contest_field` to pull standings, compute P&L attributed to the ingested `profile_version`, and feed the lake (cash lines + ownership corpus).

## Sessions — start one first

Tools are gated by your **active sport** and your **subscription**. Without a session, sport-specific tools are not exposed.

- **`start_sport_session`** — opens a session for a sport (e.g. MLB). First call in any workflow.
- **`switch_sport`** — changes the active sport mid-session.
- **After starting or switching, re-list tools.** The tool surface changes with the sport and subscription.
- **`preview_sport`** — peeks at a sport without committing the session.

## Profile-driven build flow

Builds are **profile-driven** — a profile is your declarative build configuration (objective, ownership source, constraints). Profiles are USER-owned; there are no shipped profiles. See the **`profiles`** skill to create and manage them.

### Build entry points

- **`build_for_dg`** — build for a specific **draft group** (required for sub-slate Double-Ups whose `draft_group_id` differs from the headline slate — always match the contest's own draft group). **Pass `slate_type` explicitly** (see the daily loop). This is the primary daily-build tool.
- **`build_lineups`** — build for a specified slate/contest with the active profile.
- **`recommend_profile`** — route a build intent to the best-fit saved profile. Declare `format` (`cash` | `h2h` | `gpp`) first, then EITHER a single slate's `games` count OR `today: true` to route every draft group on today's menu. Structural fit only — never EV/ROI. `format: gpp` returns `no_fit` until you register a GPP profile.
- **`build_today`** (**prompt** — `/mcp__bettor-help__build_today`) — the every-slate daily-coverage workflow. Client-side scaffolding: it calls `recommend_profile` in today mode, then `build_for_dg` once per cleanly-routed group; escalations surface for the operator to pick.

> **`build_all_today` is retired — there is no such tool.** The daily all-slates build is now the `build_today` prompt (→ `recommend_profile` today mode → per-group `build_for_dg`). Update any older notes that reference `build_all_today`.

## Projections and data reads

- **`mlb_get_projections`** / **`mlb_get_player_projection`** — slate or single-player projections. Each row carries real **`ownership`** plus an **`ownership_source`** provenance label and an `ownership_sources` map — a flat `0` is real, not missing. The served source is **`stokastic`**; `model_cash` / `model_gpp` are schema-reserved for a future in-house model and are NOT populated yet.
- **`mlb_estimate_ownership`** — field-ownership estimates (same provenance; optional `temperature`, default 0.7 — higher = flatter).
- **`mlb_get_vegas_lines`** / **`mlb_get_team_implied_total`** / **`mlb_get_line_movers`** — vegas data. **For the full day's card pass `slate_type="all"`** (see below).
- **`mlb_get_freshness`** / **`mlb_pipeline_status`** / **`mlb_refresh_report`** — is the hosted data current? The daily pipeline self-serves (no manual crosswalk babysitting), but query these before treating any datum as live.
- Slate/game discovery: **`mlb_list_slates`**, **`mlb_get_slate_manifest`**, **`mlb_get_games_for_slate`**, **`mlb_get_probable_pitchers`**. Any Classic slate variant is buildable — `slate_type` accepts `early`, `main`, `night`, `turbo`, `afternoon`, etc. (only `showdown` / `unknown` are rejected).
- **`mlb_get_weather_forecast`**, **`mlb_get_park_factors`**, **`mlb_get_game_environment`** — game-environment context.
- **`mlb_get_player_form`**, **`mlb_get_player_crosswalk`** — player-level detail.

## Entries — capture and edit

- **`ingest_entries`** / **`save_entries`** — record entered contests / entry IDs (capture at reserve; player-only upload CSVs carry no contest IDs and can't be reconciled later). `ingest_entries` stamps the `profile_version`.
- **`export_edit_entries`** / **`edit_entries`** — produce / apply an Edit-Entries CSV for post-upload swaps and overlays. `export_edit_entries(dg, new_lineup_csv=...)` returns ONLY the changed entries overlaid onto existing entry IDs. The operator re-uploads via DK's Edit Entries → Import Lineups. Never delete + re-enter — that forfeits the slot.
- **`late_swap_check`** — check entries for late-swap exposure before lock.
- **`log_contest_result`** / **`update_results`** — record your outcomes to the per-user plane (`update_results` uses the DK public payout API — no cookie needed).

## `upload_contest_field` — push the field to the shared lake

**`upload_contest_field`** pushes the **user-free** per-contest field (every entry's lineup total = the cash-line source + per-player %Drafted) to the global lake. This is the client-side path for cookie-authed contest standings: the cloud never fetches DraftKings, so you fetch standings on your machine and upload the field here.

- Inputs: `{slate_date, site?, contests:[{contest_id, draft_group_id?, entry_fee?, field?, places_paid?, payout?, standings_rows:[{entry_name, player, pct_drafted, fpts}]}]}`
- Idempotent — bronze is write-once on a deterministic key, so re-uploading the same contest is a no-op.
- **MLB only today** — rejects non-DK `site` and non-MLB sports.
- Use the **`reconcile-contests`** skill to build the payload from DK standings CSVs; do not hand-assemble it.

## Vegas reads — use `slate_type="all"` for the full day's card

`mlb_get_vegas_lines` defaults to `slate_type="main"`, which intersects the card with the main variant's team set and so **hides day / afternoon games**. Vegas lines are slate-agnostic (one physical game = one line), so to get the FULL day's card in one call pass **`slate_type="all"`** — it skips the variant-team intersection and returns every game on the date. You can also scope to a named variant (`early`, `night`, `turbo`, `afternoon`, …).

This supersedes the old workaround of unioning `main` + `night` calls — `slate_type="all"` is the supported path.
