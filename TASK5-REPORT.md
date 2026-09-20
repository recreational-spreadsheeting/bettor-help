# Task 5 report — `nfl-build` skill / `bettor-help-nfl` plugin

Branch: `feat/nfl-build-skill` (worktree `bettor-help/.worktrees/nfl-build-skill`).

## What landed

### New `bettor-help-nfl` plugin (mirrors `bettor-help-mlb`)
- `plugins/bettor-help-nfl/.claude-plugin/plugin.json` — name `bettor-help-nfl`, version
  `1.1.6` (copied from mlb per the family convention), NFL keywords, same `permissions.allow`
  block as mlb.
- `plugins/bettor-help-nfl/.mcp.json` — byte-identical to mlb's (same prod endpoint
  `https://mcp.bettor.help/mcp`, same OAuth client `qkQlzg4rwG6Dy0m4`).
- `plugins/bettor-help-nfl/README.md` — mirrors mlb's README; adds the three-mode summary and
  the marketplace table row for `bettor-help-nfl`.
- `plugins/bettor-help-nfl/skills/.gitkeep`.
- `plugins/bettor-help-nfl/skills/nfl-build/SKILL.md` — **the core deliverable.** Implements
  the three explicit modes per design §12:
  - **`projections_only` (default)** — never calls `nfl_list_content` / `nfl_search_content` /
    `nfl_get_content`; records no consulted docs (empty `document_version_ids`); the *blind
    label* requires a fresh session and is refused if ETR source text was already retrieved,
    with the honest statement that only the MCP call trace is auditable (§12 last paragraph).
  - **`etr_informed`** — list/search/retrieve by `season`/`nfl_week`/`slate_id`/`as_of`;
    synthesize a cited briefing with four separate sections (sourced observations,
    disagreements, uncertainties/unresolved, possible user actions — disagreement not
    flattened); evidence before decisions; ask before any change; record change + consulted
    `source_version_ids` in `intelligence_context`.
  - **`compare`** — ordered state machine: build+persist projections_only baseline **before any
    content call** → read baseline provenance → retrieve+summarize → ask user → rebuild with
    identical profile/slate/policies/count/seed + only user-directed changes → compare pool
    digests → **mismatch = invalid (data changed), never attributed to ETR** → else report
    lineup/decision/scoring differences.
  - Citation format verbatim: `[<title> · <published-at> · <document-version-id>#chunk-<n> ·
    <timestamp-or-heading>]`.
  - `intelligence_context` schema documented per §13; no raw source URL / auth / media handling.

### Generated dev variant (script only — never hand-edited)
- `plugins/bettor-help-nfl-dev/**` — produced by `npm run gen:dev`. Diff vs canonical shows
  only the documented transforms: plugin name/description, MCP endpoint + dev OAuth client, and
  the README dev banner. `SKILL.md` is byte-identical.
- `plugins/bettor-help-dev/skills/sport-session-orchestrator/SKILL.md` — regenerated to carry
  the orchestrator route edit.

### Wiring
- `scripts/gen-dev-plugin.mjs` — added `"bettor-help-nfl"` to `CANONICAL_PLUGINS`.
- `.claude-plugin/marketplace.json` — registered `bettor-help-nfl` and `bettor-help-nfl-dev`
  exactly like the mlb / mlb-dev entries (version `1.1.6`, license, keywords, category).
- `plugins/bettor-help/skills/sport-session-orchestrator/SKILL.md` — "Where to go from here"
  table now routes NFL builds to `nfl-build` (and a dedicated row for consulting private ETR
  content during an NFL build).

### Tests / fixtures (repo has no runtime skill harness)
Per the plan (Task 5), expected MCP call ordering is encoded as checked fixtures the validator
reads, plus structural assertions over the canonical `SKILL.md`:
- `tests/nfl-build/compare-trace.golden.json` — positive golden trace for `compare` ordering.
- `tests/nfl-build/negative-traces.json` — five negative fixtures (retrieval-before-baseline,
  content-call-in-blind-mode, blind-label-after-prior-ETR-retrieval,
  mutation-before-user-confirmation, digest-mismatch-reported-as-ETR-effect), each asserted to
  be rejected for the expected reason.
- `scripts/nfl-build-checks.mjs` — `validateTrace()` (call-ordering rules) + `runNflBuildChecks()`
  (structural assertions: default projections_only, exact tool names, blind-mode prohibition,
  fresh-session refusal, baseline-before-content, citation format, explicit-user-turn gate,
  pool-digest invalidation, no raw URL/auth/media, orchestrator route). Runnable standalone
  (`npm run test:nfl-build`) and invoked from `validate-plugin.mjs` so `npm run validate` covers
  it.
- `scripts/validate-plugin.mjs` — imports and runs the nfl-build checks when
  `plugins/bettor-help-nfl` exists (plan: "modify only if needed for behavior fixture
  validation").
- `package.json` — added `test:nfl-build` script.

## Commands run (fresh, pasted)

### `npm run gen:dev`
```
Generated plugins/bettor-help-dev from plugins/bettor-help
Generated plugins/bettor-help-mlb-dev from plugins/bettor-help-mlb
Generated plugins/bettor-help-nfl-dev from plugins/bettor-help-nfl
```

### `npm run check:dev`
```
✓ bettor-help-dev plugin is in sync with bettor-help
✓ bettor-help-mlb-dev plugin is in sync with bettor-help-mlb
✓ bettor-help-nfl-dev plugin is in sync with bettor-help-nfl
```

### `npm run validate`
```
✓ .claude-plugin/marketplace.json — 6 plugin(s) declared
✓ plugins/bettor-help/.claude-plugin/plugin.json — plugin "bettor-help" manifest ok
✓ plugins/bettor-help/skills/bettor-help-mcp/SKILL.md — frontmatter ok
✓ plugins/bettor-help/skills/dfs-results/SKILL.md — frontmatter ok
✓ plugins/bettor-help/skills/onboarding-connect/SKILL.md — frontmatter ok
✓ plugins/bettor-help/skills/profiles/SKILL.md — frontmatter ok
✓ plugins/bettor-help/skills/reconcile-contests/SKILL.md — frontmatter ok
✓ plugins/bettor-help/skills/sport-session-orchestrator/SKILL.md — frontmatter ok
✓ plugins/bettor-help-dev/.claude-plugin/plugin.json — plugin "bettor-help-dev" manifest ok
  ... (bettor-help-dev skills ok) ...
✓ plugins/bettor-help-mlb/.claude-plugin/plugin.json — plugin "bettor-help-mlb" manifest ok
✓ plugins/bettor-help-mlb/skills/mlb-build/SKILL.md — frontmatter ok
✓ plugins/bettor-help-mlb/skills/slate-day/SKILL.md — frontmatter ok
  ... (bettor-help-mlb-dev skills ok) ...
✓ plugins/bettor-help-nfl/.claude-plugin/plugin.json — plugin "bettor-help-nfl" manifest ok
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md — frontmatter ok
✓ plugins/bettor-help-nfl-dev/.claude-plugin/plugin.json — plugin "bettor-help-nfl-dev" manifest ok
✓ plugins/bettor-help-nfl-dev/skills/nfl-build/SKILL.md — frontmatter ok
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: default mode is projections_only
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: names nfl_list_content
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: names nfl_search_content
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: names nfl_get_content
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: blind mode prohibits content calls
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: refuses blind label + directs fresh session
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: compare persists baseline before any content call
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: exact citation format present
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: requires an explicit user turn before lock/exclude
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: pool-digest mismatch invalidates the comparison
✓ plugins/bettor-help-nfl/skills/nfl-build/SKILL.md: states no raw source URL / auth / media handling
✓ plugins/bettor-help/skills/sport-session-orchestrator/SKILL.md: routes NFL → nfl-build
✓ tests/nfl-build/compare-trace.golden.json: golden compare trace validates
✓ tests/nfl-build/negative-traces.json: case "retrieval-before-baseline" correctly rejected
✓ tests/nfl-build/negative-traces.json: case "content-call-in-blind-mode" correctly rejected
✓ tests/nfl-build/negative-traces.json: case "blind-label-after-prior-etr-retrieval" correctly rejected
✓ tests/nfl-build/negative-traces.json: case "mutation-before-user-confirmation" correctly rejected
✓ tests/nfl-build/negative-traces.json: case "digest-mismatch-reported-as-etr-effect" correctly rejected

All checks passed.
```

### Generated dev diff inspection (`bettor-help-nfl` vs `bettor-help-nfl-dev`)
- `plugin.json`: only `name` (`…-dev`) and `description` (`[DEV CHANNEL — …]` prefix) differ.
- `.mcp.json`: only `url` (`mcp.dev.bettor.help`) + `oauth.clientId` (`R9MjZwVsjidtBPJW`) differ
  (plus the pretty-print that the generator emits for all dev `.mcp.json`, same as mlb).
- `README.md`: only the prepended dev-channel banner.
- `SKILL.md`: **byte-identical.**

## Deviations from the design / plan

1. **Skill location.** Design §12 literally says "Add
   `plugins/bettor-help/skills/nfl-build/SKILL.md`" (core plugin). The Task 5 **brief** instead
   directs mirroring `bettor-help-mlb` — i.e. the NFL build skill lives in a dedicated
   `bettor-help-nfl` plugin — which matches the repo's current sport-plugin convention
   (`mlb-build` lives in `bettor-help-mlb`, not core). I followed the brief + repo convention
   and placed `nfl-build` in `bettor-help-nfl`. The orchestrator (core) still routes to it. No
   behavior from §12 was dropped; only the host plugin differs. The generated dev copy that §12
   references is `bettor-help-nfl-dev`.
2. **No runtime skill harness exists**, so per the plan's stated fallback ("call-trace fixtures
   and validator script if the repository has no skill behavior harness") the MCP call ordering
   is encoded as JSON fixtures a validator reads, rather than as executable skill-behavior tests.

## Honesty boundary (kept intact)
The skill states plainly that only the MCP call trace is mechanically auditable; text pasted or
attached outside the three MCP tools cannot be detected, so a standalone blind run also requires
an explicit fresh-session protocol. The blind-mode guarantee was not weakened.
