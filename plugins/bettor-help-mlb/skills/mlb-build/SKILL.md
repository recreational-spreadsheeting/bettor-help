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

## Build sequence — run every time, immediately before lock

1. **Check freshness** — `mlb_get_freshness` and `mlb_pipeline_status` before any build. If data is stale, wait for the refresh plane to catch up.

2. **List slates** — `mlb_list_slates` to confirm which draft groups are live. Note the game count (used by `recommend_profile`).

3. **Get the contest's draft group** — confirm the contest you're entering. Double-Ups often live on sub-slates (3-game, afternoon, turbo) with their own `draftGroupId` distinct from the headline slate. A lineup is only coherent on the slate it was built for. Pull the contest's own draft group, not the headline.

4. **Choose a profile** — `recommend_profile(games=N)` picks among your saved profiles by slate size. Or specify one directly.

5. **Build** — `build_lineups(profile="my-profile", count=1)` (or `build_for_dg` for a specific draft group, or `build_all_today` for all slates at once).

6. **Review the returned lineup(s)** — check: 10 slots filled, 10 unique players, total salary ≤ $50,000, no PPD or IL players.

7. **Validate starters** — every rostered SP must be a confirmed or predicted starter. Verify each SP against MLB official probables before uploading. A `predicted_starting` status is not proof the player is pitching — cross-check the MLB Stats API. A 0-point SP score means the player started and did poorly; it does not mean a scratch.

8. **Save entries** — `save_entries(dkentries_csv=..., dg=<draft_group_id>, profile_version=...)`. Capture entry IDs at reserve; player-only upload CSVs carry no contest IDs and can't be reconciled later.

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
