---
name: reconcile-contests
description: Reconcile settled DraftKings contests after they close — fetch standings with your local DK cookie, build the field payload, and upload it to the shared lake via the MCP. Every subscriber runs this after contests settle. Use when contests have finished and the user wants to upload standings, feed cash lines and ownership to the cloud, or record their own entries and results.
---

# Reconcile contests — fetch standings, upload the field

The cloud **never** fetches DraftKings. Contest standings are cookie-authed and tied to your DK login, so the fetch runs on your machine. After contests settle, you run this once per session: fetch each entered contest's standings, push the **user-free field** (cash-line source + per-player %Drafted) to the shared lake via `upload_contest_field`, and record your own entries/results.

Two planes, one fetch:
- **Global lake** (user-free, shared): the per-contest field → `upload_contest_field`. Feeds `test_profile` cash lines + ownership priors.
- **Per-user plane** (yours only): your entries + results → `save_entries` / `update_results`.

Note: `upload_contest_field` is **MLB only** today. It rejects non-DK `site` values and non-MLB sports. The per-user `update_results` works for any sport.

## The daily flow

### 1. Check your DK cookie

The standings fetch requires a valid DK session cookie. Symptom of an expired cookie: the fetch redirects to the DK login page. On **CLI 0.1.3+**, `bettor-help cookie` gives you a guided paste (and `bettor-help cookie --check` reports freshness) — it replaces the manual write-to-path step. To get the value:

1. Open a `*.draftkings.com` request in your browser's DevTools (Network tab).
2. Right-click the request → "Copy as cURL."
3. Extract the `Cookie:` header value — that is your session cookie.
4. Run `bettor-help cookie` and paste it when prompted (on older CLIs: `bettor-help config set dk-cookie "<value>"`, or the path shown by `bettor-help config show`).

The cookie **never leaves your machine** — it is used only for local fetch commands.

### 2. Discover the slate's contests (cookieless)

Find each Double-Up's `contest_id` and `draft_group_id` — these drive the cash line. Run:

```
bettor-help reconcile discover --sport mlb --date 2026-06-28
```

This writes a local contest-discovery file with `contest_id`, `draft_group_id`, `entry_fee`, `entries`, and `name` for each contest. For a one-off or a missed discovery, hit the public DK API directly:

```
curl -s "https://api.draftkings.com/contests/v1/contests/<id>?format=json"
```

The response includes `draftGroupId`, `entryFee`, `entries`, and `contestStartTime`.

### 3. Fetch standings (cookie-authed, per-contest loop)

```
bettor-help reconcile fetch --sport mlb --date 2026-06-28 --contest-id <id>
```

Repeat per contest with a delay between fetches — batch fetching silently rate-limits and can drop most contests in a single run. Use `--retry-skipped` to resume a run that was interrupted.

Pull a **large GPP** on the draft group when you want full field/ownership coverage — DK prunes small contests' standings within days, but a large GPP keeps its standings and covers the whole player pool. Reconcile soon after contests settle.

### 4. Build the field payload and upload (global half)

Reduce the fetched standings to the `upload_contest_field` payload and call the MCP tool. Run:

```
bettor-help reconcile build-payload --sport mlb --date 2026-06-28 \
  --contest-id <id> [--contest-id <id> ...] \
  --out /tmp/contest_field_payload.json
```

Then pass the JSON contents to the MCP tool:

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

Reconciles your rank, score, and payout using the DK public payout API (no cookie needed). See the **`dfs-results`** skill for the manual-winnings path when a payout cache is absent.

### 6. Full reconcile shortcut

When you want to run the full flow for a date at once:

```
bettor-help reconcile --sport mlb --date 2026-06-28
```

This discovers contests, fetches standings (with per-contest delays), builds the payload, calls `upload_contest_field` for the global half, and calls `update_results` for the per-user half. Confirm the cookie is fresh before running.

## Cross-references

- **`dfs-results`** — scoring, dollar-ROI, and the standings-fetch techniques this skill builds on.
- **`bettor-help-mcp`** — `upload_contest_field` alongside `save_entries` / `update_results` in the full tool reference.
