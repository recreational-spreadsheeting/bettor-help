---
name: reconcile-contests
description: Reconcile settled DraftKings contests after they close — fetch standings with your local DK cookie, build the field payload, and upload it to the shared lake via the MCP. Every subscriber runs this after contests settle. Use when contests have finished and the user wants to upload standings, feed cash lines and ownership to the cloud, or record their own entries and results.
---

# Reconcile contests — fetch standings, upload the field

The cloud **never** fetches DraftKings. Contest standings are cookie-authed and tied to your DK login, so the fetch runs on your machine. After contests settle, you run this once per session: fetch each entered contest's standings, push the **full contest field** (every entry row, usernames kept — the cash-line source + per-player %Drafted) to the shared lake via `upload_contest_field`, and record your own entries/results.

Two planes, one fetch:
- **Global lake** (shared): the full per-contest field → `upload_contest_field`. Entry rows keep their `EntryName` verbatim — these are public DK usernames and the grouping key for multi-entry users. Feeds `test_profile` cash lines + ownership priors.
- **Per-user plane** (yours only): your entries + results → `save_entries` / `update_results`.

Note: `upload_contest_field` is **MLB only** today. It rejects non-DK `site` values and non-MLB sports. The per-user `update_results` works for any sport.

## The one-command flow (recommended)

```
bettor-help daily-capture --date 2026-06-28 --sport mlb --fetch
```

This does the whole settled-slate capture in one shot: pulls your **entry history straight from DK** via your cookie session (`--fetch` — the ground truth for which contests you actually entered), fetches standings for each entered contest, uploads the field in chunks, reconciles your results, and prints a summary. **Idempotent — safe to re-run.** A single contest's fetch failure never aborts the rest.

> ⚠️ **The exit code does not mean the capture worked.** `daily-capture` exits **0** even when it captured nothing and even when every upload failed. A run that fetched 105 contests and then failed 105/105 uploads still exited 0 (observed 2026-07-26). Never treat exit 0 — or a clean-looking log — as evidence. Always run the verification in **Did the capture actually land?** below.

Without `--fetch` it falls back to DK's "Download Entry History" CSV export (newest `draftkings-contest-entry-history*.csv` in `~/Downloads`, or `--entry-history-file <path>`). Prefer `--fetch` — the live pull is always current, whereas a downloaded export covers everything only through the most recent settlement at download time.

The step-by-step flow below is for when you need finer control (a single contest, a re-fetch, an un-entered slate's GPP).

## The step-by-step flow

### 1. Your DK cookie — assume it works; refresh only on evidence

Do **not** check, refresh, or re-login preemptively. Cookie **age means nothing** — DK authenticates on a long-lived session (~2 weeks); a days-old cookie is normally fine. The CLI treats a saved cookie as valid until DK itself rejects it (a redirect to a login page or a 401 — the only honest staleness signals), then silently re-harvests **once** from the saved browser profile, and only persists a new cookie after it has proven itself on a live request.

So: just run the fetch. Only when the CLI itself says the session is expired, run `bettor-help cookie --login` (opens Chrome, you sign in, the CLI verifies the captured session before saving it). To probe explicitly while debugging, `bettor-help cookie --check --live` runs a real authenticated request per saved cookie store.

Manual fallback (no Chrome):

1. Open a `*.draftkings.com` request in your browser's DevTools (Network tab).
2. Right-click the request → "Copy as cURL."
3. Extract the `Cookie:` header value — that is your session cookie.
4. Run `bettor-help cookie` and paste it when prompted.

The cookie **never leaves your machine** — it is used only for local fetch commands.

### 2. Know which contests to reconcile

Your **entered** contests come from DK's entry history — that is what `daily-capture --fetch` uses, and it is the ground truth for what you actually entered. For contest metadata lookups (`draft_group_id`, `entry_fee`, entries), the cookieless per-contest API still works:

```
curl -s "https://api.draftkings.com/contests/v1/contests/<id>?format=json"
```

`bettor-help discover --sport mlb` lists the **live lobby** (upcoming contests) — useful pre-lock or for finding a large GPP on a draft group, but settled contests are no longer in the lobby, so it cannot enumerate yesterday's entries.

### 3. Fetch standings (cookie-authed, per-contest loop)

```
bettor-help fetch-standings --contest-id <id> --date 2026-06-28
```

Standings land in `~/bettor-help/<date>/results/` by default (`--out <file>` to override). Repeat per contest — the CLI applies a jittered delay per request (`--delay <s>` to widen it); batch fetching without delays silently rate-limits and can drop most contests in a single run.

Pull a **large GPP** on the draft group when you want full field/ownership coverage — DK prunes small contests' standings within days, but a large GPP keeps its standings and covers the whole player pool. Reconcile soon after contests settle.

### 4. Build the field payload and upload (global half)

```
bettor-help reduce --slate-date 2026-06-28 --sport mlb \
  --contest-id <id> [--contest-id <id> ...] \
  --out /tmp/contest_field_payload.json
bettor-help upload --payload /tmp/contest_field_payload.json
```

Or pass the payload JSON to the MCP tool yourself:

```
upload_contest_field({
  slate_date: "2026-06-28",
  site: "draftkings",
  contests: [/* contents of the payload */]
})
```

The tool writes bronze contest standings + contests to the global lake with `source="client_upload"`. **Idempotent** — re-uploading the same contest is a no-op (safe to re-run).

#### `reduce` drops the metadata — always pass `--meta-json`

`reduce` emits each contest with **only** `contest_id`. The lake finalizes a contest on its **first** upload and every later upload is a no-op, so metadata that isn't in the first payload **can never be added**. Build a meta file and pass it:

```
bettor-help reduce --slate-date 2026-06-28 --sport mlb \
  --standings-dir ~/bettor-help/2026-06-28/results \
  --meta-json ./meta.json --out ./payload.json
```

`meta.json` is a map keyed by contest-id string. The **only** accepted fields are `draft_group_id`, `entry_fee`, and `places_paid` — `contest_name` and friends are silently dropped:

```json
{ "192707595": { "draft_group_id": 151056, "entry_fee": 1, "places_paid": 10 } }
```

All three come from the cookieless detail API; `places_paid` is `max(payoutSummary[].maxPosition)`:

```
curl -s "https://api.draftkings.com/contests/v1/contests/<id>?format=json"
```

`draft_group_id` is the join key for the per-contest cash line. **Verify it is present in the payload before uploading** — a contest finalized without it is unrepairable.

#### `upload --payload` cannot handle large contests — use `daily-capture`

`bettor-help upload --payload` sends what you give it in one shot. It has two ceilings:

- **Whole payload** — over ~18MB the request dies with `http 413: Request Too Long`.
- **Single contest** — any one contest with **≥~3,700 standings rows** fails with a bare `upstream_error` (≤3,248 succeeds). Reproducible across days; retrying never helps.

The second ceiling bites exactly the contests you most want, since large-field GPPs are the ownership source.

**`daily-capture` does not have this problem.** It chunks internally, and handles contests far beyond the `upload --payload` ceiling — a single **47,562-entry** contest and a 129-contest / 199,857-row slate both uploaded cleanly (2026-07-27). The ceiling is a property of the un-chunked `upload --payload` path, **not** of `upload_contest_field` itself.

So if you hit `http 413` or `upstream_error`, do **not** conclude the contest is uncapturable and do **not** try to split one contest's rows across independent `upload` calls — that risks finalizing it with a partial field, which is unrepairable. Instead, re-run it through `daily-capture` with a targets file naming just the affected contests:

```
bettor-help daily-capture --zero-entry --targets-file ./retry.json \
  --date <slate-date> --sport mlb
```

This recovered 12 large-field GPPs (103,195 rows) that `upload --payload` had rejected 12/12 — and it moved that slate's ownership source from a 2,972-entry field to a 17,835-entry one, shifting top-of-slate ownership by 5-6pp. Treat `upload --payload` as the small-contest / debugging path only.

Other payload notes:
- The reducer refuses non-final standings (`TimeRemaining != 0`) unless you pass `--allow-nonfinal`. Re-fetch after the slate fully settles for accurate cash lines.
- Omit `--contest-id` to include every standings file in the local directory.
- `reduce` needs `--standings-dir ~/bettor-help/<date>/results`; its default points elsewhere.

### 5. Record your own entries and results (per-user half)

```
save_entries(dkentries_csv=<csv-text>, dg=<draft-group-id>, profile_version=<optional>)
```

Records the lineups you uploaded (at reserve time; idempotent — call it at upload, not just post-contest).

```
update_results(date="2026-06-28", standings_map={"<contest_id>": "<standings-csv-text>"})
```

Reconciles your rank, score, and payout using the DK public payout API (no cookie needed). A contest whose payout tiers can't be fetched is skipped and left pending — re-run later; nothing is ever recorded as $0 winnings by default.

### 6. Full reconcile shortcut

```
bettor-help reconcile --sport mlb --date 2026-06-28 --contest-id <id> [--contest-id <id> ...]
```

Fetches standings for the given contests (with per-contest delays), builds the payload, and uploads the global half. Without `--contest-id` it falls back to discovering the live lobby — fine pre-lock, but for a settled slate pass explicit IDs or use `daily-capture`, which resolves them from your DK entry history.

## "Which sport should I use?" — the lapsed sport lock

If an upload fails with:

```
upload_contest_field returned an error: Which sport should I use — GOLF, MLB, NASCAR, NFL?
```

nothing is wrong with your payload, your cookie, or your data. The **server-side sport lock has lapsed**. Fix it in one call and retry the upload:

```
start_sport_session(sport="mlb")
```

What makes this trap dangerous:

- **The lock is per-user persistent server-side state — not per-MCP-session**, despite `start_sport_session`'s description saying "this MCP session". Setting it from any client unblocks a *different* process (calling it in Claude fixes a failing `bettor-help` CLI run), and it survives MCP session expiry.
- **The CLI never sets it itself**, and `--sport mlb` does **not** propagate to `upload_contest_field` — not on the `daily-capture` path, not on the `reconcile` path, and `bettor-help upload` has no sport flag at all. So a lapsed lock breaks *every* upload route until someone calls `start_sport_session` out of band.
- **It fails silently.** Combined with exit 0, a lapsed lock can drop days of capture with nothing in the log that looks like an error.

Recovery is cheap because a failed upload **does not** poison the ledger (`~/.bettor-help/capture-ledger.json`) and fetched standings persist in `~/bettor-help/<date>/results/`. Re-upload never requires a re-fetch.

## Did the capture actually land?

Exit codes and logs lie here. Verify against the data, every time:

**1. The local ledger** — how many contests were recorded per slate date:

```
python3 -c "import json,collections; d=json.load(open('$HOME/.bettor-help/capture-ledger.json')); \
c=collections.Counter(v['slate_date'] for v in d.values()); [print(k,c[k]) for k in sorted(c)]"
```

A slate date that's missing or far below its neighbours means the capture didn't happen.

**2. The lake's own coverage view** — the authoritative check:

```
get_ownership_history({date_range: {start: "<date>", end: "<date>"}})
```

Read the `coverage` block: every `(slate_date, draft_group_id)` pair should be `covered: true` with a plausible `n_contests`. Then read `ref_field_size` on the rows — that is the field size ownership was actually derived from. If it's a few thousand where the slate had a 15K+ mini-MAX, the large GPPs failed to upload and **the slate's ownership is thin even though it reads as covered**. Covered ≠ complete.

This is not a cosmetic distinction. On 2026-07-25, recovering the large GPPs moved the ownership source from a 2,972-entry field to a 17,835-entry one and shifted top-of-slate ownership by 5-6pp (one pitcher 51.7% → 58.1%, another 52.8% → 47.7%). A slate that reads `covered: true` off a small field is quietly wrong, not merely incomplete — so check `ref_field_size` against the biggest contest the slate actually ran, and re-run through `daily-capture` if it's short.

Also note `in_pool` may be `false` with empty `player` names for a slate captured the same day; the pool build catches up overnight and it flips to `true`. Re-check the next day before treating it as a problem.

**3. The upload summary line** — `Field upload: N finalized, ..., M failed`. Any non-zero `failed` is a real failure regardless of exit code.

## Capturing a slate you didn't enter (zero-entry capture)

With no entries there's no entry history to resolve, but the field data — cash lines and %Drafted — is still valuable and still capturable:

```
bettor-help daily-capture --zero-entry --targets-file <targets.json> \
  --date <date> --sport mlb
```

`targets.json` maps a label to a list of contest-id strings:

```json
{ "main-dg151056": ["192707531", "..."], "early-dg151321": ["..."], "slate_date": "2026-07-25" }
```

> ⚠️ **A targets file is only valid for the slate date it was built for.** If it goes stale, the run re-probes the *previous* day's contest IDs, finds them all already-captured or cancelled, logs `Targets: N | kept: 0 | skipped: N`, and exits **0**. That is what a dead capture looks like — it is not distinguishable from success by exit code. **`kept: 0` is always a failure.**
>
> A stale targets file also *masks* other faults: with nothing kept, the run never attempts an upload, so a lapsed sport lock stays invisible until someone fixes the targets.

Building the target list for a locked slate: see **`dfs-results`** → "Score an un-entered slate". Two rules that matter most — read the lake's `raw/dk_lobby` snapshots before probing the contest-ID space, and make sure the list includes the **large-field GPPs**, which sit thousands of IDs away from the Double-Up block and are the ownership source.

## Recovering unattributed entries

If `daily-capture` reports `⚠️ N UNATTRIBUTED`, the evening stamp was missed for those
entries. Recover it (both commands are idempotent — safe to re-run):

1. Locate the DKEntries export for that slate (`~/bettor-help/<date>/entries/DKEntries-dg<dg>.csv`,
   or the original in Downloads).
2. Stamp it: `bettor-help entries --profile <name@ver> --dg <draft_group_id>`
3. Re-run: `bettor-help daily-capture --date <date> --sport mlb` — the reconcile now inherits
   the profile from the freshly stamped seed.

Confirm with `get_results_report` — the `per_profile` bucket should no longer show the entries
under `unattributed`.

## Cross-references

- **`dfs-results`** — scoring, dollar-ROI, and the standings-fetch techniques this skill builds on.
- **`bettor-help-mcp`** — `upload_contest_field` alongside `save_entries` / `update_results` in the full tool reference.
