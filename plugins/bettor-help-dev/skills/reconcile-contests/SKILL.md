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

This does the whole settled-slate capture in one shot: pulls your **entry history straight from DK** via your cookie session (`--fetch` — the ground truth for which contests you actually entered), fetches standings for each entered contest, uploads the field in chunks, reconciles your results, and prints a summary. **Idempotent — safe to re-run.** A single contest's fetch failure never aborts the rest; the exit code is non-zero only when a contest genuinely failed.

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

Start an MLB sport session first — `upload_contest_field` appears once the connector re-lists tools. The tool writes bronze contest standings + contests to the global lake with `source="client_upload"`. **Idempotent** — re-uploading the same contest is a no-op (safe to re-run).

Important notes on the payload:
- `draft_group_id` is the join key for the per-contest cash line — ensure it's present.
- The reducer refuses non-final standings (`TimeRemaining != 0`) unless you pass `--allow-nonfinal`. Re-fetch after the slate fully settles for accurate cash lines.
- Omit `--contest-id` to include every standings file in the local directory.

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
