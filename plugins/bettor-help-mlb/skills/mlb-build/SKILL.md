---
name: mlb-build
description: Build DraftKings MLB lineups with a Bettor Help profile — covers tuning knobs for floor-oriented vs ceiling-oriented profiles, the full pre-build refresh sequence, operational invariants, and the save/edit-entries flow. Use when the user wants to build MLB DraftKings lineups, tune an MLB profile, run the pre-lock build sequence, or enter lineups for a DraftKings MLB slate.
---

# MLB lineup build

The profile-driven process for building DraftKings MLB lineups and entering them into contests. All builds run against a saved **profile** — see the **`profiles`** skill to create, tune, and save one before building.

## Where your files live

Working files live in the visible **`~/bettor-help/<YYYY-MM-DD>/`**, one directory per slate day (on **CLI 0.1.3+**, `bettor-help day` creates/opens today's):

```
~/bettor-help/<YYYY-MM-DD>/
├── builds/    # upload-ready DK CSVs from build_for_dg: <date>-<slate_type>-dg<id>-<profile>.csv
├── entries/   # DKEntries exports (Claude-maintained archive)
├── swaps/     # near-lock Edit-Entries CSVs from export_edit_entries
└── results/   # reconcile artifacts (standings, P&L)
```

`builds/` + `swaps/` are files **you** grab and upload to DK. `entries/` + `results/` are archives **Claude maintains for you** — you export DKEntries from DK as normal (it lands in `~/Downloads`), then hand the path to Claude ("grab my entries") and it ingests + archives a copy. No new habits; Downloads is fine. Config (`token.json`, `dk_cookie_header.txt`) stays out of sight in `~/.config/bettor-help/`.

## Strategy framing

- **Build to the cash line, not the winner.** A floor-oriented profile asks "does this raise our 25th–50th percentile?" — not "does this raise our 90th?" Chasing a ceiling score hurts expected value on floor contests.
- **One lineup → many Double-Ups.** Build one lineup per slate and enter it into every Double-Up you want. All-cash/all-miss is expected and by design — it is not concentration risk.
- **Play every slate, every day.** Default to building on all of today's slates at small-stakes — one `build_for_dg` per draft group (the `build_today` prompt scaffolds this across the full menu). Broad daily coverage is the strategy; never trim to "the 1-2 best slates."
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

## Build sequence — run every time, immediately before lock

1. **Check freshness** — `mlb_get_freshness` and `mlb_pipeline_status` before any build. If data is stale, wait for the refresh plane to catch up.

2. **List slates** — `mlb_list_slates` to confirm which draft groups are live. Note the game count (used by `recommend_profile`).

3. **Get the contest's draft group** — confirm the contest you're entering. Double-Ups often live on sub-slates (3-game, afternoon, turbo) with their own `draftGroupId` distinct from the headline slate. A lineup is only coherent on the slate it was built for. Pull the contest's own draft group, not the headline.

4. **Choose a profile** — `recommend_profile(games=N)` picks among your saved profiles by slate size. Or specify one directly.

5. **Build** — `build_for_dg(draft_group_id=<dg>, slate_type=<type>, profile="my-profile", slate_date=<today>)` for each draft group you'll play. **Pass `slate_type` explicitly** — a known issue defaults a draft-group-only build to `main`, mis-scoping any non-main slate (tracked as `build-for-dg-resolves-slate-type`). Use `build_lineups(profile=..., count=1)` for the active slate/contest; the `build_today` prompt scaffolds `build_for_dg` across the whole menu. Save each `dk_upload_csv` under `builds/`.

6. **Review the returned lineup(s)** — check: 10 slots filled, 10 unique players, total salary ≤ $50,000, no PPD or IL players. Read `starting_status` (e.g. "8/10 predicted — re-run near lock"); a night slate built before probable SPs post honestly reports "0 pitchers" — build it later, not an error.

7. **Validate starters** — every rostered SP must be a confirmed or predicted starter. Verify each SP against MLB official probables before uploading. A `predicted_starting` status is not proof the player is pitching — cross-check the MLB Stats API. A 0-point SP score means the player started and did poorly; it does not mean a scratch.

8. **Enter on DK, then track** — upload `dk_upload_csv` via DK's bulk **Upload Lineups**, then export **DKEntries.csv** from the contest's Edit Entries page (one per draft group; it lands in `~/Downloads` — hand it to Claude, or on **CLI 0.1.3+** run `bettor-help entries` to scan Downloads → archive → ingest yourself). Record it to the cloud ledger: `ingest_entries(dg=<draft_group_id>, slate_date=<today>, dk_entries_csv=<export>, profile_version="cash@1")`. The `profile_version` stamp is what attributes results back to the exact config you ran. The cloud never contacts DK — your export is the bridge.

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

### Late swaps after upload — overlay, never delete + re-enter

Near lock, re-run `build_for_dg` for the same draft group to get fresh confirmed lineups. If players changed, `export_edit_entries(dg=<draft_group_id>, new_lineup_csv=<fresh dk_upload_csv>)` returns a DK Edit-Entries CSV of **only the changed entries**, overlaid onto your **existing entry IDs**. Save it under `swaps/` and upload via DK's **Edit Entries** page.

**Never delete and re-enter to change a lineup — that forfeits the slot.** Late-swap edits the entry in place. Run `late_swap_check` to flag late-swap exposure across entries before lock.

### After settle — reconcile

Once contests settle, run the **`reconcile-contests`** skill: it fetches each entered contest's standings with your DK cookie on your machine, pushes the full contest field (usernames kept) to the global lake via `upload_contest_field` (cash lines + ownership corpus), and records your own entries + results attributed to the `profile_version` you stamped at `ingest_entries`.

### Predicted starters belong in the build pool

The `eligibility` profile knob defaults to `predicted` — predicted-BO players belong in the build and ship to RESERVE. The upload gate blocks players whose status is `Starting = False` or `Unknown`. Do not propose waiting for confirmations before building; build on predicted starters and validate near lock.

## DK icon and scratch semantics

- DK's ❌ icon means "not in the announced starting batting order" — it conflates rest day, platoon, late sub, and actual scratch. Verify via the MLB Stats API box score before calling a player scratched.
- A score of 0 means the player started and produced poorly — not that they were scratched.
