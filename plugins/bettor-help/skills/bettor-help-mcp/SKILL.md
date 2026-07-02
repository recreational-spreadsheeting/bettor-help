---
name: bettor-help-mcp
description: Drive the Bettor Help MCP server tools to run DFS workflows (sessions, builds, projections, vegas, freshness) with operating doctrine baked in. Use when interacting with the bettor-help MCP, switching sports, or pulling DFS data via the MCP.
---

# Driving the Bettor Help MCP

A practical guide to running DFS workflows through the hosted **Bettor Help** MCP server:
start a sport session, build lineups, and read the projection / vegas / freshness /
pipeline-status data. The tools are namespaced `mcp__claude_ai_Bettor_Help__*`.

## The daily loop

The proven end-to-end day (validated live 2026-07-02). Full walkthrough — DK
mechanics, timings, the late-swap doctrine, and a worked call sequence — is in
**`references/daily-process.md`**. The short version:

1. **See the menu.** `start_sport_session("mlb")`, then `mlb_list_slates` (today) —
   one row per draft group (main / early / night / turbo / afternoon), each with its
   `draft_group_id`, game count, and lock-relevant game times.
2. **Build each slate you'll play.** `build_for_dg(draft_group_id=<dg>,
   slate_type=<type>, profile=<yours>, slate_date=today)`. **Pass `slate_type`
   explicitly** — a known issue defaults dg-only builds to `main`
   (`build-for-dg-resolves-slate-type` tracks the fix). The response carries the
   lineup (projections + real Stokastic `ownership` + `lineup_confidence` per
   player), a paste-ready `dk_upload_csv`, and honest diagnostics
   (`starting_status` like "8/10 predicted — re-run near lock"; a night slate before
   probable SPs post reports "0 pitchers" — build it later, not an error). Profiles
   are USER-owned; `recommend_profile(format, games)` suggests by slate size.
3. **Enter on DK.** Upload `dk_upload_csv` via DK's bulk **Upload Lineups**, then
   export **DKEntries.csv** from the contest's Edit Entries page (one per draft group).
4. **Track.** `ingest_entries(dg, slate_date, dk_entries_csv=<export>,
   profile_version="cash@1")` records every entry to the cloud ledger. The cloud
   NEVER contacts DK — your exports are the bridge (privacy by design).
5. **Near lock, late-swap.** Re-run `build_for_dg` for fresh confirmed lineups; if
   players changed, `export_edit_entries(dg, new_lineup_csv=<fresh dk_upload_csv>)`
   returns a DK Edit-Entries CSV of ONLY the changed entries, overlaid onto existing
   entry IDs (never delete + re-enter — that forfeits the slot). Upload via DK's Edit
   Entries. `late_swap_check` flags exposure before lock.
6. **After settle, reconcile.** Run the **`reconcile-contests`** skill →
   `upload_contest_field` to pull standings, compute P&L attributed to the ingested
   `profile_version`, and feed the lake (cash lines + ownership corpus).

**Where files live:** working files go in the visible `~/bettor-help/<YYYY-MM-DD>/{builds,entries,swaps,results}/` (one dir per slate day); config (`token.json`, `dk_cookie_header.txt`) stays out of sight in `~/.config/bettor-help/`. See `references/daily-process.md`.

**Timings that matter:** early slates lock ~12:35 PM ET (enter first); main ~7 PM ET
first-pitch window; night slates can't build until probable SPs post (afternoon).
Slate data self-serves in the cloud (no manual refresh as of the 1.19.0 cycle); if a
just-discovered morning slate won't build, wait a refresh cycle.

**Backtest note (2026-07-02, 17 ≤7g slates):** ownership `auto` beat pinned
`rank_vendor` 70.6% vs 58.8% cash rate on ≤7g slates — the winning config is
size-gated (`auto` ≤7g / `rank_vendor` ≥8g).

## Sessions are sport-gated — start one first

Tools are gated by the **active sport** and your **subscription**. Until you start a
session, the sport-specific tools (everything under `mlb_*`, the build flows, etc.) are
not exposed.

1. **`start_sport_session`** — open a session for a sport (e.g. MLB). This is the first
   call in any workflow.
2. **`switch_sport`** — change the active sport mid-session.
3. **After starting or switching, re-list the tools.** The available tool set changes with
   the active sport and subscription, so call the server's `list_tools` after any
   `start_sport_session` / `switch_sport` — don't assume a tool is present from a previous
   sport.
4. **`preview_sport`** — peek at a sport without committing the session, when you just need
   to see what's available.

## Profiles (build configuration)

A profile is the declarative build config (objective, ownership, constraints). Manage them
before building:

- **`list_profiles`** / **`show_profile`** / **`check_profile`** — inspect available
  profiles and the active one.
- **`recommend_profile`** — route a build intent to the best-fit saved profile. A generic
  nearest-fit router scores each profile's declared target region (no hardcoded
  name→size map). **Declare `format` first** — `cash` | `h2h` (folds to cash) | `gpp` — then
  EITHER a single slate's `games` count (from `mlb_list_slates`) OR `today: true` to route
  **every draft group on today's menu** (one recommendation per group). Returns the
  recommended profile plus `escalation` (`none` / `no_fit` / `tie`) and the scored
  `candidates`. **Structural fit only** — never EV/ROI/dollars; the operator still picks
  what to play. Cash profiles are live (`field-match` ≤7g, `brew` ≥8g); GPP is router-ready
  but no GPP profiles are registered yet, so `format: gpp` returns `no_fit` today.
- **`test_profile`** — dry-run a profile against a slate (no live build).
- **`save_profile`** / **`copy_profile`** — persist or clone a profile.
- **`show_settings`** — see the current session/build settings.

## Build flows

Two build **tools**, plus **prompts** that orchestrate them:

- **`build_lineups`** — build with the active profile for a specified slate/contest.
- **`build_for_dg`** — build for a specific **draft group** (use this when entering a
  sub-slate Double-Up, whose `draftGroupId` differs from the headline slate). Pass the
  draft group's own `draft_group_id`; the build reads that group's pre-conformed data.
- **`build_today`** (**prompt** — `/mcp__bettor-help__build_today`) — the every-slate
  daily-coverage workflow (the supported way to build across all of the day's slates).
  It is client-side scaffolding, not a server fan-out: it calls `recommend_profile` in
  **today mode** (`{format: "cash", today: true}`) to route one cash profile per draft
  group, then calls **`build_for_dg` once per cleanly-routed group**. Groups that escalate
  (`tie` / `no_fit`) surface their candidates for the operator to pick — never auto-chosen.
- **`build_lineup`** / **`early_build_lineup`** (**prompts**) — single-slate guided builds
  (parse → project → rank stacks → generate → ownership). `early_build_lineup` is the
  before-batting-orders-post variant.

## Reads (projections, vegas, status)

- **`mlb_get_projections`** / **`mlb_get_player_projection`** — slate or single-player
  projections. Each player row carries real **`ownership`** plus an **`ownership_source`**
  provenance label (which source the value resolved to) and an `ownership_sources` map of
  every component present — so a flat `0` is real, not missing data. Today the served
  source is **`stokastic`** (the vendor projection), with `legacy` as the bare-field
  fallback. `model_cash` / `model_gpp` are **schema-reserved for a future in-house model
  and are NOT populated yet** — don't treat them as available.
- **`mlb_estimate_ownership`** — field-ownership estimates for a slate (same
  `ownership_source` / `ownership_sources` provenance as projections; optional
  `temperature`, default 0.7 — higher = flatter).
- **`mlb_get_vegas_lines`** / **`mlb_get_team_implied_total`** / **`mlb_get_line_movers`**
  — vegas data. **For the full day's card, pass `slate_type="all"` — see the vegas note below.**
- **`mlb_get_freshness`** / **`mlb_pipeline_status`** / **`mlb_refresh_report`** — is the
  hosted data current? The daily pipeline now **self-serves** — projections and ownership
  land in the cloud automatically and it completes unattended (no manual crosswalk
  babysitting / `--allow-errors` step for crosswalk misses). Still query these before
  treating any datum as live: the refresh plane runs on a schedule and can lag near lock.
- Slate/game discovery: **`mlb_list_slates`**, **`mlb_get_slate_manifest`**,
  **`mlb_get_games_for_slate`**, **`mlb_get_probable_pitchers`**. **Any Classic slate
  variant is buildable** — `slate_type` accepts `early`, `main`, `night`, `turbo`,
  `afternoon`, etc. (only `showdown` / `unknown` are rejected). Pass the variant the
  operator names.

## Entries (capture + edit)

- **`ingest_entries`** / **`save_entries`** — record entered contests / entry IDs (capture
  these at reserve; player-only upload CSVs carry no contest IDs).
- **`export_edit_entries`** / **`edit_entries`** — produce / apply an Edit-Entries CSV for
  post-upload swaps and overlays.
- **`late_swap_check`** — check entries for late-swap exposure before lock.
- **`log_contest_result`** / **`update_results`** — record YOUR outcomes to the per-user
  plane (then score per the `dfs-results` skill). `update_results` is cookie-free (public DK
  payout API).
- **`upload_contest_field`** — push the **user-free** per-contest field (every entry's
  lineup total = the cash-line source, + per-player %Drafted) to the **global** lake. This
  is the client-side path for cookie-authed contest standings: the cloud never fetches
  DraftKings, so you fetch standings on your machine and upload the field here. Idempotent
  (write-once bronze). Inputs: `{slate_date, site?, contests:[{contest_id, draft_group_id?,
  entry_fee?, field?, places_paid?, payout?, standings_rows:[{entry_name, player,
  pct_drafted, fpts}]}]}`. MLB only today; rejects non-DK `site`. **Build the payload with
  the `reconcile-contests` skill** (its reducer turns DK standings CSVs into this shape) —
  don't hand-assemble it.

## Vegas reads — use `slate_type="all"` for the full day's card

`mlb_get_vegas_lines` defaults to `slate_type="main"`, which intersects the card with the
main variant's team set and so **hides day / afternoon games**. Vegas lines are
slate-agnostic (one physical game = one line, regardless of which DK contest group it lands
in), so to get the FULL day's card in one call pass **`slate_type="all"`** — it skips the
variant-team intersection and returns every game on the date. You can also scope to a named
variant (`early`, `night`, `turbo`, `afternoon`, …); the old enum that rejected `afternoon`
is gone.

This supersedes the old workaround of unioning `main` + `night` calls (or pulling
the-odds-api locally) — `slate_type="all"` is the supported path.
