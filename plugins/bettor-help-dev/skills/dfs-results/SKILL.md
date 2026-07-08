---
name: dfs-results
description: Score and report DFS contest results — dollar-ROI as the headline metric, DK payout API as ground truth, standings capture, and logging via MCP tools. Use when the user wants to log results, check contest outcomes, calculate ROI, score an un-entered slate, or report on DraftKings DFS performance.
---

# DFS contest results — score, report, log

How to score and reconcile DraftKings DFS contest results faithfully: the headline metric, where the ground truth lives, and techniques that avoid common ingest failure modes.

**Always pull the data first.** Never narrate outcomes from session memory or an unverified ingest.

## Entries come from DK, not local artifacts

"What did I enter last night" is answered by **DK's entry history**, never by local files. The one-command path:

```
bettor-help daily-capture --date <YYYY-MM-DD> --sport mlb --fetch
```

`--fetch` pulls your entry history straight from DK via your cookie session, fetches standings for each entered contest, uploads the field, and reconciles results — see the **`reconcile-contests`** skill.

Local `DKEntries*.csv` exports, build outputs, and edit-entries overlays are **pre-lock intentions**: they show what was uploaded or planned at some moment, not what was live at lock. Entries get added, canceled, and swapped after any export. Never assert contest counts, entry fees, or "you had N entries across M slates" from local artifacts — if the live DK pull is unavailable, say so and stop; do not substitute a weaker source silently.

## Dollar-ROI is the headline metric

Report performance as **dollar ROI = (total winnings − total cost) / total cost**, on actual winnings. Never lead with "X/Y cashed" or a cash-count %:

- Different slates have different cost/payout — $5 and $10 Double-Ups are not equal units, so counting entries equal-weights unequal dollars.
- DU/50-50 ties pay partial (approximately entry back, not a full 2×), so "cashed" is not a binary 2×. Always compute from actual winnings.

Cash-count % can be a secondary color stat, never the headline.

## Winnings are actual DK dollars — trust the report

Recorded winnings come straight from DraftKings on every path: `daily-capture --fetch` writes each entry's real winnings from DK's own entry-history ledger, and `update_results` computes payouts live from the DK public payout API (a contest whose tiers can't be fetched is **skipped and left pending**, never recorded as $0). There is no local payout cache anywhere in the pipeline, so a $0 day in the report is a real $0 day — report it plainly.

**Use `update_results` (the MCP tool)** to reconcile pending entries — it calls the DK public payout API directly, no cookie needed, and writes accurate winnings to the per-user plane.

```
update_results(date="2026-06-28", standings_map={"contest_id": "<standings-csv-text>"})
```

## Report the numbers; don't editorialize the strategy

Cash play intentionally repeats a small number of lineups across many Double-Ups on the same slates — correlated wins and losses per slate are the **intended structure**, not a caveat. Never soften or qualify a result with observations like "these were repeated lineups so they missed together." State the dollar ROI and move on.

## Grep our entry FIRST in standings

The first action on a contest standings CSV is to find your own entry — that single row is ground truth for what you actually scored:

```
grep -i <your-dk-username> contest-standings-<id>.csv
```

The matching row shows your rank, actual score, and the actual scored lineup. Do this **before** narrating anything. Reading from session memory of which lineups were uploaded ≠ reading the data of which lineups actually scored — late edits and lock-time changes produce divergences the session log won't reflect. If memory and the standings file conflict, **the standings file wins**.

## Log results via MCP

- **`log_contest_result`** — record a single contest result.
- **`update_results`** — reconcile a day's contests via the DK public payout API (no cookie needed). Pass `{date, standings_map: {contest_id: standings-csv-text}}`.

After logging, you can review your recorded history for dollar-ROI across slates.

## Score an un-entered slate (via a large GPP field)

When you didn't enter a slate but want to know what you would have scored:

1. **Find a contest on the locked draft group.** Locked slates drop out of the public lobby. Exhaustively probe the contest-ID space near a known same-day contest (the `draftGroupId` field in the DK contests API response identifies the draft group). Sample broadly to locate the cluster, then scan every ID in that window.

2. **Pull a large GPP, not a small Double-Up.** DK prunes small contests' standings within days. A large-field GPP on the same draft group keeps its standings and covers the full player pool.

3. **Score and assess.** Build player→FPTS from the GPP standings (verify the slate is final, i.e. `TimeRemaining == 0`). Sum your 10 players and compare against the GPP field median as a Double-Up cash-line proxy. A score well above median (e.g. +25 points on an ~84 median) would cash a DU robustly.

## Upload the field to the shared lake

The standings you fetch also feed the global shared data. After scoring, run the **`reconcile-contests`** skill to push the full per-contest field (cash-line source + per-player %Drafted, usernames kept) to the cloud via the `upload_contest_field` MCP tool. Your own entries and results go to the per-user plane via `save_entries` / `update_results`.

See the **`reconcile-contests`** skill for the complete upload flow.
