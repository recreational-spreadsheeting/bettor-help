---
name: mlb-build
description: Build DraftKings MLB lineups with a Bettor Help profile — covers tuning knobs for floor-oriented vs ceiling-oriented profiles, the full pre-build refresh sequence, operational invariants, and the save/edit-entries flow. Use when the user wants to build MLB DraftKings lineups, tune an MLB profile, run the pre-lock build sequence, or enter lineups for a DraftKings MLB slate.
---

# MLB lineup build

The profile-driven process for building DraftKings MLB lineups and entering them into contests. All builds run against a saved **profile** — see the **`profiles`** skill to create, tune, and save one before building.

## Strategy framing

- **Build to the cash line, not the winner.** A floor-oriented profile asks "does this raise our 25th–50th percentile?" — not "does this raise our 90th?" Chasing a ceiling score hurts expected value on floor contests.
- **One lineup → many Double-Ups.** Build one lineup per slate and enter it into every Double-Up you want. All-cash/all-miss is expected and by design — it is not concentration risk.
- **Play every slate, every day.** Default to building on all of today's slates at small-stakes. Broad daily coverage is the strategy; never trim to "the 1-2 best slates."
- **Cashing IS winning.** Payout is binary: top-50% doubles up. Frame results as cushion above the cash line, never as a gap to the winner.
- **Build a portfolio for large-field tournaments.** When using a ceiling-oriented profile for tournament entries, build multiple distinct lineups with `count > 1` and `max_exposure` set to enforce diversity. Coverage across cheap players (not projection-selection) is the portfolio edge.

## MLB profile knobs for MLB

Key knobs from the MLB catalog (see **`profiles`** for the full list):

| Knob | Floor-oriented tuning | Ceiling-oriented tuning |
|------|----------------------|------------------------|
| `objective` | `cash_field_match` or `cash_p60_floor` | `ceiling` or `leverage_ceiling` |
| `ownership_source` | `auto` (size-gated default) | `auto` or `vendor` |
| `min_cash_ownership` | Positive value to anchor on chalk | `0.0` (no floor) |
| `max_hitters_per_team` | `3` (default) | `4` or `5` for stacking |
| `max_exposure` | `0.60` (default) | Lower (e.g. `0.30`) for more diversity |
| `count` | `1` (one lineup per slate) | `10`–`50`+ for tournament coverage |

**Small slates (≤3 games):** set `max_hitters_per_team: 5` in your profile. The default of `3` can make the LP infeasible on 4-team or 6-team slates given DK's positional requirements (C, 1B, 2B, 3B, SS, 3×OF). Symptom: "Could not generate a valid lineup" — the team-stack ceiling is the binding constraint.

**Size-conditional profiles:** use `rules.resolution` to wire `ownership_source: rank_vendor` on ≥8-game slates (see the **`profiles`** skill for the exact syntax). `ownership_source: auto` is the default and applies the right source based on slate size.

## Build sequence — the daily loop

Run this per draft group you'll play. The full walkthrough (DK mechanics, timings, worked call sequence) lives in the **`bettor-help-mcp`** skill's `references/daily-process.md`.

1. **Check freshness** — `mlb_get_freshness` and `mlb_pipeline_status` before any build. The pipeline self-serves, but the refresh plane runs on a schedule and can lag near lock. If data is stale, wait a cycle.

2. **List slates** — `mlb_list_slates` returns one row per draft group (main / early / night / turbo / afternoon), each with its `draft_group_id`, game count, and lock-relevant game times. Note the game count (used by `recommend_profile`).

3. **Choose a profile** — `recommend_profile(format="cash", games=N)` picks among your saved profiles by slate size, or specify one directly. Profiles are USER-owned — see the **`profiles`** skill.

4. **Build the draft group** — `build_for_dg(draft_group_id=<dg>, slate_type=<"main"|"early"|"night"|"turbo"|"afternoon">, profile="my-profile", slate_date=today)`.
   - **Pass `slate_type` explicitly.** A known issue defaults a draft-group-only build to `main`, which mis-scopes any non-main slate. Always name the slate type.
   - Double-Ups often live on sub-slates with their own `draft_group_id` distinct from the headline slate — a lineup is only coherent on the slate it was built for, so build against the contest's own draft group.
   - The response carries the lineup (projection + real Stokastic `ownership` + `lineup_confidence` per player), a paste-ready **`dk_upload_csv`**, and honest `starting_status` diagnostics (e.g. "8/10 predicted — re-run near lock"; a night slate before probable SPs post reports "0 pitchers" — build it later, not an error).

5. **Review the returned lineup** — check: 10 slots filled, 10 unique players, total salary ≤ $50,000, no PPD or IL players.

6. **Validate starters** — every rostered SP must be a confirmed or predicted starter. Verify each SP against MLB official probables before uploading. A `predicted_starting` status is not proof the player is pitching — cross-check the MLB Stats API. A 0-point SP score means the player started and did poorly; it does not mean a scratch.

7. **Enter on DK** — upload `dk_upload_csv` via DK's bulk **Upload Lineups**, then export **DKEntries.csv** from the contest's Edit Entries page (one export per draft group). The cloud never logs into DK — your export is the bridge.

8. **Track** — `ingest_entries(dg=<draft_group_id>, slate_date=today, dk_entries_csv=<DKEntries.csv text>, profile_version="cash@1")` records every entry to the cloud ledger, stamped with the `profile_version` so results attribute to the exact config you ran. (`save_entries` is the lower-level capture; `ingest_entries` is the daily-loop entry point.)

9. **Near lock — re-build and late-swap** — re-run `build_for_dg` for fresh confirmed lineups. If players changed, `export_edit_entries(dg=<draft_group_id>, new_lineup_csv=<fresh dk_upload_csv>)` returns a DK Edit-Entries CSV of ONLY the changed entries, overlaid onto your existing entry IDs — upload via DK's Edit Entries. **Never delete + re-enter — that forfeits the slot.** `late_swap_check` flags exposure before lock.

10. **After settle — reconcile** — run the **`reconcile-contests`** skill → `upload_contest_field` to pull standings, compute P&L attributed to the ingested `profile_version`, and feed the lake (cash lines + ownership corpus).

## Operational invariants (non-negotiable)

Each of these has cost real money when skipped.

### Refresh before every build

Re-check freshness immediately before every build. Probable starters, batting orders, and injury status change all day. Build on data that is current at the time of the build. Near lock, re-fetch right before any overlay — never apply a lineup built 45+ minutes ago without refreshing first.

### Rebuild on new information — do not swap individual players

When a scratch, batting-order posting, or IL move hits a slate you've already entered:

1. Re-check freshness.
2. Rebuild the lineup with the updated data.
3. Apply the rebuilt lineup to the existing entries via `edit_entries`.

Do not swap individual players. New information changes the whole optimization. The only exception is a stopgap at <10 minutes to lock when a rebuild can't finish — then swap to keep the entry legal, say so explicitly, and rebuild at the first opportunity.

### Pull the contest's own draft group

Confirm the contest's `draftGroupId` matches the slate you built for. A mismatch means you'd be entering a lineup built with the wrong players, projections, and park/pitcher context. `build_for_dg` takes the draft group ID explicitly to make this unambiguous.

### Validate the lineup before uploading

- slots-filled == 10
- unique players == 10
- total salary ≤ $50,000
- No PPD, no IL, starters are confirmed or predicted

The slots-filled check catches a known edge case: with multi-position scarcity (e.g. two `1B/3B`-eligible hitters), the export can leave a slot empty. If a slot is empty, do not upload — re-slot the multi-position player to cover the scarce position.

### Late swaps after upload

For scratches or batting-order changes after entries are live: use `edit_entries` to produce a minimal Edit-Entries CSV covering only the changed rows. The operator re-uploads via DK's Edit Entries → Import Lineups. Do not describe a UI click-through.

### Predicted starters belong in the build pool

The `eligibility` profile knob defaults to `predicted` — predicted-BO players belong in the build and ship to RESERVE. The upload gate blocks players whose status is `Starting = False` or `Unknown`. Do not propose waiting for confirmations before building; build on predicted starters and validate near lock.

## DK icon and scratch semantics

- DK's ❌ icon means "not in the announced starting batting order" — it conflates rest day, platoon, late sub, and actual scratch. Verify via the MLB Stats API box score before calling a player scratched.
- A score of 0 means the player started and produced poorly — not that they were scratched.
