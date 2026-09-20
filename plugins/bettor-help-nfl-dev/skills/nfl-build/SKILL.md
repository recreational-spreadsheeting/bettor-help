---
name: nfl-build
description: Build DraftKings NFL lineups with a Bettor Help profile in one of three explicit modes — projections_only (a real blind build with zero content calls), etr_informed (retrieve and cite approved ETR source passages, then ask before any change), and compare (persist a blind baseline before any content call, then measure the effect of user-directed informed changes under identical settings). Use when the user wants to build NFL DraftKings lineups, consult private ETR content during a build, or compare a blind build against an informed one.
---

# NFL lineup build

The profile-driven process for building DraftKings NFL lineups and, optionally, consulting the
private ETR content corpus during the build. All builds run against a saved **profile** — see
the **`profiles`** skill to create, tune, and save one before building.

Hard data stays quantitative. **Content is informational and read-only.** It never changes a
projection, locks a player, excludes a player, or mutates a lineup on its own. Only the user may
request a lock, an exclusion, or any other existing build option, through an ordinary explicit
instruction.

## Pick a mode first — always

Every session starts by choosing exactly one mode. **The default is `projections_only`.** If the
user did not ask to consult ETR content, build in `projections_only` and make no content calls.

| Mode | What it does | Content calls |
|------|--------------|---------------|
| **`projections_only`** (default) | Blind build through the existing unified build tools. | **None.** |
| **`etr_informed`** | Retrieve + cite approved ETR passages, present evidence, ask before any change. | list/search/get |
| **`compare`** | Persist a blind baseline *before* any content call, then rebuild with user-directed informed changes and compare. | list/search/get (baseline built first) |

The three content tools — and the **only** content tools this skill ever calls — are:

- `nfl_list_content`
- `nfl_search_content`
- `nfl_get_content`

They are read-only, authenticated, and scoped to the active NFL session. This skill never touches
a raw source URL, ETR credentials, the private RSS bearer URL, or source audio/video/HTML — that
material never reaches the plugin. Retrieval happens exclusively through the three MCP tools above.

## `projections_only` (default)

A real blind build.

1. **Never** call `nfl_list_content`, `nfl_search_content`, or `nfl_get_content`. Not once.
2. Build through the existing unified build tools (`build_lineups` / `build_for_dg`) exactly as a
   normal NFL build, following the standard pre-build refresh + validation sequence.
3. Record **no** consulted documents. If you attach `intelligence_context`, set
   `mode: "projections_only"` with an **empty** `document_version_ids` list and no
   source-derived `user_changes`.

### The blind label requires a fresh session

A build is only honestly *blind* when it runs in a **fresh Claude conversation that has not
already received ETR source text**. The no-content-call property is mechanically auditable through
the MCP call trace — but Claude cannot prove that text pasted or attached *outside* these MCP tools
is uncontaminated. State that boundary honestly; do not claim stronger detection.

Therefore: **if ETR source text was already retrieved, pasted, or summarized earlier in this
conversation, refuse the blind label.** Do not build-and-call-it-blind. Tell the user the current
conversation is contaminated and direct them to start a **fresh session** for a trustworthy blind
run. `compare` avoids this ambiguity by building its baseline before its first retrieval in the
same controlled call trace.

## `etr_informed`

Present cited evidence, then let the user decide.

1. **List** applicable content — `nfl_list_content` filtered by `season`, `nfl_week`, `slate_id`,
   and `as_of` (the pre-lock observation cutoff). Add `show_family` / `content_kind` /
   `faithfulness` as needed.
2. **Search / retrieve** — `nfl_search_content(query=..., limit=...)` for topical passages and
   `nfl_get_content(document_version_id=..., cursor=...)` to page through a specific version.
3. **Synthesize a concise, cited briefing** with these **separate** sections — do **not** flatten
   disagreement into one consensus statement:
   - **Sourced observations** — what the sources actually say.
   - **Disagreements** — where sources conflict; keep both sides.
   - **Uncertainties / unresolved** — open questions and unresolved entities.
   - **Possible user actions** — options the user *could* take (e.g. lock/exclude), framed as
     choices, never applied.
4. **Present the evidence before any lineup decision.** Evidence first, decisions second.
5. **Ask the user whether to change anything.** Never lock, exclude, or otherwise mutate the build
   on your own initiative.
6. **Only after an explicit user instruction**, convert that confirmation into the existing
   builder's lock/exclude/build inputs, then build. Record the change and the consulted source
   version IDs in `intelligence_context` (`mode: "etr_informed"`, populated `document_version_ids`,
   and a `user_changes` entry per action with `source_version_ids`).

### Citation format

Every claim drawn from a source must carry immutable coordinates:

```text
[<title> · <published-at> · <document-version-id>#chunk-<n> · <timestamp-or-heading>]
```

A citation without the `<document-version-id>#chunk-<n>` coordinates is not acceptable — those are
what make the claim auditable against the immutable corpus.

## `compare`

Measure whether ETR commentary improved the decision, under identical inputs. Run the steps in
this exact order:

1. **Build and persist the blind baseline BEFORE any content call.**
   `build_lineups(profile, slate, count, seed, ...)` with
   `intelligence_context.mode = "projections_only"`, `comparison_role: "baseline"`, and a shared
   `comparison_id`. This must happen before `nfl_list_content` / `nfl_search_content` /
   `nfl_get_content` is called even once.
2. **Read the baseline's build provenance** — `get_build_provenance(baseline)` — to capture its
   pool digest and settings.
3. **Retrieve and summarize applicable content** — `nfl_list_content`, then
   `nfl_search_content` / `nfl_get_content`, cited per the format above.
4. **Ask the user for any informed changes.** Wait for an explicit user turn.
5. **Rebuild** — `build_lineups` with **identical profile, slate, policies, count, and seed**,
   plus **only** the user-directed changes. Tag `intelligence_context.mode = "etr_informed"`,
   `comparison_role: "informed"`, the same `comparison_id`, and `user_changes` with their
   `source_version_ids`.
6. **Read both provenance records and compare pool digests.** If the pool digests **differ**, the
   underlying data changed between builds: **label the pair invalid** and explain that data
   changed. **Never attribute the lineup difference to ETR** when the digests do not match.
7. If the digests match, **report the lineup, decision, and eventual scoring differences** between
   the blind baseline and the informed build.

The pool-digest equality check supplies the same-input guarantee without a parallel optimizer or
snapshot-replay path.

## Build provenance — `intelligence_context`

Builds may carry an optional, platform-owned `intelligence_context` on the existing
`build_lineups` / `build_for_dg` input. It is provenance only: `build_ops` validates and ignores it
for optimizer construction, and it never reaches sport-package build options.

```json
{
  "schema_version": 1,
  "mode": "projections_only | etr_informed",
  "comparison_id": "optional UUID",
  "comparison_role": "baseline | informed | null",
  "as_of": "UTC timestamp",
  "document_version_ids": ["sha256..."],
  "user_changes": [
    {
      "action": "lock | exclude",
      "target": "canonical player id or team",
      "reason": "user-authored summary",
      "source_version_ids": ["sha256..."]
    }
  ]
}
```

- `projections_only` requires an **empty** `document_version_ids` list and no source-derived
  `user_changes`.
- Every `user_changes` entry originates from an **explicit user turn**, never from the skill's own
  synthesis.
- IDs and list/string sizes are bounded; the field is optional so old callers stay valid.

## Non-negotiables

- **Default to `projections_only`.** Only leave it when the user asks to consult ETR content.
- **No autonomous mutation.** Content may summarize and ask; only the user may lock, exclude, or
  change the build, through the existing controls.
- **Evidence before decisions**, and **ask before you change** anything.
- **Baseline before retrieval** in `compare` — the baseline is built and persisted before the first
  content call.
- **Cite immutable coordinates** on every sourced claim.
- **Digest mismatch invalidates** a comparison; it is never reported as an ETR effect.
- **No raw source URLs, credentials, RSS bearer URLs, or media** — this skill only ever reaches
  content through `nfl_list_content` / `nfl_search_content` / `nfl_get_content`.
