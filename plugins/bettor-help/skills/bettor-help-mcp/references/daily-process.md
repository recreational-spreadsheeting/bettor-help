# The daily process — a full walkthrough

The proven daily DFS loop, validated live **2026-07-02**. This is how one operator
runs a slate end-to-end: what the Bettor Help MCP tools do, what happens on the
DraftKings side, when each step has to happen, and how late-swap works. Read the
`SKILL.md` "The daily loop" section for the short version; this is the detail.

**The division of labor:** the cloud owns projections, ownership, lineup
construction, and the entry/result ledger. **The cloud NEVER contacts DraftKings.**
Anything that needs your DK login — uploading lineups, exporting entries, pulling
final standings — happens on your machine. Your CSV exports are the bridge between
the two. That's privacy by design, not a limitation.

---

## Where your files live

The product's visible home is **`~/bettor-help/`**, one directory per slate day
(on **CLI 0.1.3+**, `bettor-help day` creates/prints today's folder, `--open` opens it):

```
~/bettor-help/<YYYY-MM-DD>/
├── builds/    # upload-ready DK CSVs: <date>-<slate_type>-dg<id>-<profile>.csv
├── entries/   # DKEntries exports, renamed DKEntries-<slate_type>-dg<id>.csv
├── swaps/     # near-lock Edit-Entries CSVs
└── results/   # reconcile artifacts (standings, P&L)
```

- **`builds/`** — the `dk_upload_csv` from each `build_for_dg`, saved as
  `<date>-<slate_type>-dg<id>-<profile>.csv` (e.g. `2026-07-02-early-dg112233-field-match.csv`).
  This is a file **you** grab and upload to DK.
- **`swaps/`** — the near-lock Edit-Entries CSVs from `export_edit_entries`. Also a
  file **you** grab and upload to DK.
- **`entries/`** — the **assistant-maintained archive** of your DKEntries exports. You
  don't file these yourself: export from DK as normal (it lands in `~/Downloads`) and
  hand it to Claude — paste the path or just ask ("grab my entries"). Claude ingests it
  and archives a copy here as `DKEntries-<slate_type>-dg<id>.csv`. On **CLI 0.1.3+**,
  `bettor-help entries` does the same scan-Downloads → archive → ingest yourself
  (`--file`/`--dg`/`--profile` to be explicit). **No new habits; Downloads is fine.**
- **`results/`** — reconcile outputs (standings, computed P&L), also assistant-maintained.

**In short:** `builds/` + `swaps/` are where Claude puts files **you** grab for DK;
`entries/` + `results/` are archives Claude maintains **for** you.

**Config lives separately, out of sight, in `~/.config/bettor-help/`** — `token.json`
(entitlement) and `dk_cookie_header.txt` (your DK cookie — set up once with
`bettor-help cookie --login` on **CLI 0.1.4+**, then auto-refreshed). These are CLI-managed and
**never** leave your machine. The rule: **working files are visible
(`~/bettor-help/`); config is not (`~/.config/bettor-help/`).**

---

## Morning (~9 AM ET) — see the menu, build what you'll play

### 1. Start a session and list today's slates

```
start_sport_session("mlb")
mlb_list_slates            # today's card
```

`mlb_list_slates` returns **one row per draft group** — main, early, night, turbo,
afternoon — each with:
- its **`draft_group_id`** (the id you build against),
- **game count**,
- **lock-relevant game times** (first pitch of the earliest game in the group).

Different DK contest groups on the same day are different draft groups with different
lock times. The early slate locks hours before the night slate.

### 2. Build each slate you intend to play

```
build_for_dg(
    draft_group_id=<dg from list_slates>,
    slate_type=<"main" | "early" | "night" | "turbo" | "afternoon">,
    profile=<your profile>,
    slate_date=<today>,
)
```

> **Pass `slate_type` explicitly.** A known issue makes a draft-group-only build
> default to `main`, which mis-scopes any non-main slate. Always name the slate type.
> The fix is tracked as `build-for-dg-resolves-slate-type`.

The response carries everything you need:
- **The lineup** — each player with projection, **real Stokastic `ownership`**, and a
  per-player **`lineup_confidence`**.
- **`dk_upload_csv`** — paste-ready text for DK's bulk **Upload Lineups**.
- **Diagnostics** — `starting_status` tells you how confirmed the lineup is
  (e.g. *"8/10 predicted — re-run near lock (first pitch 7:05 PM ET)"*), so you know
  whether to re-build later.
- **Honest infeasibility** — a night slate built before probable starting pitchers
  post will report *"0 pitchers"*. That's not an error; it means **build it later**,
  once the probables are out (typically afternoon).

### Profiles

Profiles are **USER-owned** build configs (objective, ownership handling,
constraints). You pick which one to run. `recommend_profile(format, games)` suggests
a best-fit profile by slate size — it matches structure only, never EV/ROI.

**Ownership config is size-gated.** Backtest evidence (2026-07-02, 17 slates of ≤7
games): ownership **`auto`** beat pinned **`rank_vendor`** — **70.6% vs 58.8%** cash
rate on ≤7-game slates. The winning posture: `auto` on ≤7g, `rank_vendor` on ≥8g.

---

## DK side — enter your lineups

1. In DraftKings, open the contest and use **Upload Lineups** (bulk). Paste the
   `dk_upload_csv` from the build, or fill your reserved entries with it.
2. Once entered, open the contest's **Edit Entries** page and **export
   DKEntries.csv** — one export per draft group. This file is what the cloud ledger
   ingests next.

---

## Track — record every entry to the cloud ledger

```
ingest_entries(
    dg=<draft_group_id>,
    slate_date=<today>,
    dk_entries_csv=<the DKEntries.csv export text>,
    profile_version="cash@1",
)
```

This records every entry — contest, entry ID, lineup, and per-player game starts — to
the cloud ledger, **stamped with the `profile_version`** so results later attribute to
the exact config you ran. Verified live: 90/90 and 40/40 players resolved on the
2026-07-02 run.

Again: the cloud reads **your export**. It never logs into DK.

---

## Near lock — re-build and late-swap

As first pitch approaches, lineups firm up (scratches, confirmed lineups, weather).

1. **Re-run `build_for_dg`** for the same draft group to get fresh, confirmed
   lineups. Check `starting_status` — you want fully-confirmed starters.
2. **If players changed**, generate a swap file:

   ```
   export_edit_entries(dg=<draft_group_id>, new_lineup_csv=<fresh dk_upload_csv>)
   ```

   This returns a **DK Edit-Entries CSV containing ONLY the changed entries** — the
   swaps are overlaid onto your **existing entry IDs**.

   > **Never delete and re-enter to change a lineup — that forfeits the slot.**
   > Late-swap edits the entry in place. Upload the Edit-Entries CSV via DK's **Edit
   > Entries** page.

3. **`late_swap_check`** flags late-swap exposure across your entries before lock, so
   you know which entries still have a player yet to lock.

---

## After settle — reconcile

Once contests settle, run the **`reconcile-contests`** skill. It fetches each entered
contest's standings **with your DK cookie on your machine**, then:
- pushes the **full contest field** (per-entry lineup totals = the cash-line
  source, + per-player %Drafted) to the **global lake** via `upload_contest_field` —
  feeding `test_profile` cash lines and the ownership corpus, and
- records **your own** entries + results to your per-user plane, computing P&L
  attributed to the `profile_version` you stamped at `ingest_entries`.

See `../reconcile-contests/SKILL.md` for the fetch/upload mechanics and
`../dfs-results/SKILL.md` for scoring/ROI.

---

## Timings that matter

| Slate | Lock / build window |
|---|---|
| **Early** | Locks ~**12:35 PM ET** — enter first. |
| **Main** | First-pitch window ~**7 PM ET**. |
| **Night** | **Can't build until probable SPs post** (usually afternoon). A pre-probables build honestly reports "0 pitchers" — wait, then build. |

**Slate data self-serves in the cloud** (no manual refresh needed as of the 1.19.0
cycle). If a just-discovered morning slate won't build yet, it's likely mid-refresh —
wait a cycle and retry rather than treating it as an error. `mlb_get_freshness` /
`mlb_pipeline_status` confirm currency.

---

## Worked call sequence (one draft group, end to end)

```
# Morning
start_sport_session("mlb")
mlb_list_slates                                   # → pick a dg + slate_type
build_for_dg(draft_group_id=112233, slate_type="early",
             profile="field-match", slate_date="2026-07-02")
# → lineup + dk_upload_csv + starting_status "9/10 predicted"

# DK: Upload Lineups with dk_upload_csv → export DKEntries.csv

ingest_entries(dg=112233, slate_date="2026-07-02",
               dk_entries_csv="<DKEntries.csv text>",
               profile_version="cash@1")          # → 40/40 players resolved

# Near lock (~12:15 PM ET)
build_for_dg(draft_group_id=112233, slate_type="early",
             profile="field-match", slate_date="2026-07-02")
# → 2 players changed
export_edit_entries(dg=112233, new_lineup_csv="<fresh dk_upload_csv>")
# → Edit-Entries CSV of only the changed entries → upload via DK Edit Entries
late_swap_check                                   # → confirm no stragglers

# After settle → run the reconcile-contests skill → upload_contest_field
```
