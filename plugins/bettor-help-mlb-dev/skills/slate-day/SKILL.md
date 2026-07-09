---
name: slate-day
description: Drive one MLB slate day end-to-end — build, enter, STAMP, then next-day capture + score — so no step (especially the profile stamp) is skipped. Use when the user wants to run a full MLB slate day, is starting an evening build session, or is doing next-morning capture/reconcile/scoring.
---

# Slate-day driver

Run the day as one ordered sequence. Do not advance past a gate until its check passes. Each
step delegates to an existing skill or command — this skill only sequences them and enforces
the gates.

## Evening (per slate: early / main / night)

1. **Build** — use the **`mlb-build`** skill for each slate/draft group you're playing (respect
   the pool-maturity note there: a slate can be infeasible on an immature pool; rebuild later
   if so).
2. **Enter** — upload `dk_upload_csv` on DK via bulk **Upload Lineups**, then export
   **DKEntries.csv** from the contest's Edit Entries page (one per draft group).
3. **STAMP (gate).** For each draft group entered:

       bettor-help entries --profile <name@ver> --dg <draft_group_id>

   ✅ **Gate: the command reports an ingested count > 0.** Do not consider the slate "entered"
   until this passes. If you skip this, tonight's results are unattributable — there is no
   morning recovery except re-stamping (see **`reconcile-contests`**'s "Recovering unattributed
   entries").
4. **Near lock** — rebuild on confirmed lineups and cut Edit-Entries overlays
   (`export_edit_entries`) for anything moved. A re-stamp is **not** needed for an overlay of
   already-stamped entries — the entry IDs are unchanged, only the lineup inside them moved.

## Morning (after settlement)

5. **Capture + reconcile** — run:

       bettor-help daily-capture --date <date> --sport mlb --fetch

   This is the one-command path from **`reconcile-contests`**: it pulls your entry history from
   DK, fetches standings for each entered contest, uploads the field, and reconciles results.

   ✅ **Gate: the summary reports `0 UNATTRIBUTED`.** If it doesn't, some entries missed their
   evening stamp — run the recovery flow in **`reconcile-contests`**'s "Recovering unattributed
   entries" section before trusting any per-profile numbers from this slate day.
6. **Score** — pull `get_results_report` and read the `dfs-results` skill for how to interpret
   it: dollar-ROI as the headline metric, DK's payout API as ground truth. Read the `per_profile`
   bucket specifically to compare profiles on real ROI, not just the aggregate.

## Why the gate is here, not buried in the build skill

The stamp (step 3) is the single point of failure for attribution: skip it and a slate's
results can never be traced back to the profile that built it, no matter what's done the next
morning. Putting it as an explicit numbered gate in the day's sequence — rather than a line
inside a longer build doc — is what makes it hard to skip.
