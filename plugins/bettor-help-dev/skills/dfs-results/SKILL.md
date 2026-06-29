---
name: dfs-results
description: Score and report DFS contest results — dollar-ROI as the headline metric, DK payout API as ground truth, standings capture, and logging via MCP tools. Use when the user wants to log results, check contest outcomes, calculate ROI, score an un-entered slate, or report on DraftKings DFS performance.
---

# DFS contest results — score, report, log

How to score and reconcile DraftKings DFS contest results faithfully: the headline metric, where the ground truth lives, and techniques that avoid common ingest failure modes.

**Always pull the data first.** Never narrate outcomes from session memory or an unverified ingest.

## Dollar-ROI is the headline metric

Report performance as **dollar ROI = (total winnings − total cost) / total cost**, on actual winnings. Never lead with "X/Y cashed" or a cash-count %:

- Different slates have different cost/payout — $5 and $10 Double-Ups are not equal units, so counting entries equal-weights unequal dollars.
- DU/50-50 ties pay partial (approximately entry back, not a full 2×), so "cashed" is not a binary 2×. Always compute from actual winnings.

Cash-count % can be a secondary color stat, never the headline.

## DK payout API is ground truth

The DK payout API (`results-by-user` endpoint) returns true rank/score/payout/cashed per contest and requires no cookie. It is ground truth for whether you cashed.

A common ingest failure mode: when a contest has no cached payout structure, the ingest logs $0 winnings and the P&L is wrong (can be off by $100+ on a single day). Double-Ups often have no cached payout, so any ingest that depends on a local payout cache will under-report cashing.

**Use `update_results` (the MCP tool)** — it calls the DK public payout API directly, no cookie needed, and writes accurate winnings to the per-user plane.

```
update_results(date="2026-06-28", standings_map={"contest_id": "<standings-csv-text>"})
```

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

The standings you fetch also feed the global shared data. After scoring, run the **`reconcile-contests`** skill to push the user-free per-contest field (cash-line source + per-player %Drafted) to the cloud via the `upload_contest_field` MCP tool. Your own entries and results go to the per-user plane via `save_entries` / `update_results`.

See the **`reconcile-contests`** skill for the complete upload flow.
