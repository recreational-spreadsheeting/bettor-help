---
name: profiles
description: Create, save, tune, and manage Bettor Help build profiles from scratch — profiles are the declarative build configuration every lineup build runs against. Use when the user wants to create a profile, understand build knobs, tune a profile for a slate size or objective, save or copy a profile, or get a profile recommended for a slate.
---

# Profiles — your build configuration

A **profile** is the declarative configuration that controls how `build_lineups` constructs lineups: which objective to optimize, which ownership source to use, how many lineups to build, and what constraints to apply. **There are no shipped profiles** — you create your own, tuned to your strategy and slate.

Profiles live in the server under your user account, scoped to the active sport. They are versioned: each `save_profile` mints a new immutable version, never overwriting history.

## Creating a profile from scratch

A minimal valid profile:

```json
{
  "meta": { "name": "my-profile", "sport": "mlb" },
  "defaults": { "objective": "cash_field_match" }
}
```

Save it:
```
save_profile(name="my-profile", profile={...})
```

The server validates the profile against the sport's option catalog before writing. If validation fails, the error names the offending field and what was expected — fix and re-save.

**Faster path:** copy the built-in starter template, then edit it:
```
copy_profile(from="starter-cash", to="my-profile")
```
`starter-cash` seeds a valid floor-oriented profile you can edit and re-save.

## MLB knobs reference

All knobs live in `defaults` (apply every build) or `rules.resolution` (apply conditionally by slate size).

| Knob | What it controls | Default |
|------|-----------------|---------|
| `objective` | Scoring objective the optimizer maximizes | `cash_field_match` |
| `min_salary` | Floor on total lineup salary (cap is $50,000) | `49000` |
| `max_hitters_per_team` | Max hitters stacked from one team | `3` |
| `max_sp_salary` | SP salary cap (0 = no cap) | `0` |
| `max_exposure` | Max fraction of portfolio any one player may appear in | `0.60` |
| `min_hitter_salary` | Hitters below this price are dropped | `3000` |
| `min_hitter_floor` | Hitters below this projected floor are dropped | `0.0` |
| `floor_own_exempt` | Ownership fraction above which the floor rule is waived | `0.15` |
| `floor_salary_exempt` | Salary above which the floor rule is waived | `5000` |
| `min_cash_ownership` | Hitters below this projected cash ownership are dropped | `0.0` |
| `min_sp_ownership` | SPs below this projected ownership are dropped | `1.0` |
| `min_vendor_own_coverage` | Fraction of the pool that must carry a vendor ownership number to build | `0.95` |
| `allow_zero_ownership_build` | Build even when the whole pool resolves to zero ownership | `false` |
| `sp_rank_top` | Restrict SP pool to top-N by rank (0 = no limit) | `5` |
| `cash_floor_percentile` | Percentile of simulated score used for cash floor objectives | `25.0` |
| `cash_mc_draws` | Monte-Carlo draws for cash percentile objectives | `1000` |
| `ownership_source` | Where ownership numbers come from | `auto` |
| `count` | How many lineups to build (per-request, not in `defaults`) | `1` |
| `eligibility` | Which players are eligible: `predicted` or `confirmed` | `predicted` |

### Objectives

- `cash_field_match` — optimizes for matching the projected field distribution (floor-oriented; the general-purpose cash objective).
- `cash_p60_floor` — optimizes the 60th-percentile simulated score floor (more aggressive floor than `cash_field_match`).
- `cash_p25_floor` — optimizes the 25th-percentile floor (conservative floor).
- `floor` — pure simulated floor (most conservative).
- `mean` — expected mean score (projection-only, no floor/ceiling weighting).
- `ceiling` — expected ceiling score (upside-oriented; for tournament coverage).
- `leverage_ceiling` — ceiling weighted by low ownership (contrarian upside).

### Ownership sources

These are the only values `ownership_source` accepts (anything else fails
validation):

- `auto` — size-gated default: picks the appropriate source based on the slate's game count. Recommended as the default.
- `stokastic` — raw vendor ownership percentage.
- `ours` — our calibrated cash-model ownership.
- `stokastic_cash_calibrated` — the vendor number passed through the learned cash calibration (needs vendor coverage — see `min_vendor_own_coverage` below).
- `rank_vendor` — the vendor's ownership ranking (stronger signal on large slates).
- `field_rank_pctile` — percentile rank against the field corpus.
- `ours_field` — our model's field-ownership estimate.
- `vendor_rank_our_level` — vendor rank ordering at our model's levels.

## Ownership gates — `min_vendor_own_coverage` and `allow_zero_ownership_build`

Two knobs guard a build against thin or missing ownership. Both live in `defaults`.

### `min_vendor_own_coverage` (default `0.95`)

Applies only when `ownership_source` needs the vendor (`stokastic`, `stokastic_cash_calibrated`). It sets the fraction of the pool that must carry a vendor ownership number. The behavior is **drop-vs-refuse**:

- **At or above the floor** — the players missing a vendor number are dropped and the build proceeds on the covered players. The drop is recorded in the build's filter ledger as a `vendor_own_coverage` entry (with the `min_vendor_own_coverage` and `ownership_source` it ran under, and how many pitchers/hitters it removed). Check the ledger to see how much of the pool was cut.
- **Below the floor** — the build refuses instead of running on a mostly-uncovered pool. The refusal reads `build refused: ...` and names the coverage number it saw.

**Lower the floor for early-day builds.** The vendor fills in ownership over the course of the day; a morning build can sit below `0.95` simply because coverage has not accumulated yet. If a build refuses with a coverage number that's close to full, lower `min_vendor_own_coverage` (e.g. to `0.60`) to build on what's covered — or wait for coverage to fill and build later. Restore the default once coverage is complete.

### `allow_zero_ownership_build` (default `false`)

When the entire resolved pool comes back at `0.0` ownership **and** ownership knobs are active (`min_cash_ownership`, `min_sp_ownership`, and the ownership caps), the build refuses rather than optimizing with no ownership signal. The refusal reads:

```
build refused: zero-ownership gate: all <N> pool players resolved to 0.0 ownership (ownership_source='<source>') while ownership knobs are active (<knob=value list>). Refusing to build blind — fix the ownership feed, or set allow_zero_ownership_build=true to override.
```

**Operator response:** treat this as a stop sign — fix the ownership feed (re-check freshness, confirm the vendor source is live) and rebuild. Set `allow_zero_ownership_build: true` only when you deliberately want a build with no ownership input.

## Tuning heuristics

**Floor-oriented profile (cashing contests):**
- Use `cash_field_match` or `cash_p60_floor` as the objective.
- Use `ownership_source: auto` (or wire it via a `rules.resolution` override for ≥8-game slates).
- Set `min_cash_ownership` to a positive value to anchor on field chalk.
- Keep `count: 1` — one lineup entered into many Double-Ups.

**Tournament-oriented profile (large-field upside):**
- Use `ceiling` or `leverage_ceiling` as the objective.
- Raise `count` (10–50 or more) for portfolio coverage across distinct lineups.
- Keep `max_exposure` lower to enforce lineup diversity.
- Use `max_hitters_per_team: 4` or `5` to allow deeper stacks.

## Size-conditional rules

Use `rules.resolution` to apply different settings by slate size:

```json
{
  "meta": { "name": "size-gated", "sport": "mlb" },
  "defaults": {
    "objective": "cash_field_match",
    "ownership_source": "auto"
  },
  "rules": {
    "resolution": [
      { "when": { "games": { "gte": 8 } }, "set": { "ownership_source": "rank_vendor" } }
    ]
  }
}
```

This applies `rank_vendor` on ≥8-game slates and falls back to `auto` on smaller ones.

## Profile `meta.recommend` — slate-size recommendations

To let `recommend_profile` pick among your profiles by slate size, add a `recommend` block to `meta`:

```json
"meta": {
  "name": "large-slate",
  "sport": "mlb",
  "recommend": { "min_games": 8 }
}
```

Then call `recommend_profile(games=N)` before building — it reads your registered profiles' bands, picks the tightest match, and returns the name + rationale. No hardcoded mapping; it extends automatically as you add profiles.

## Profile operations

- **`list_profiles`** — see all your saved profiles for the active sport (name, version, created_at).
- **`show_profile(name=..., version=...)`** — view the full document (omit `version` for latest).
- **`save_profile(name=..., profile={...})`** — save (or update) a profile. Validates first; rejects invalid ones with field-named errors.
- **`copy_profile(from=..., to=...)`** — duplicate a profile under a new name, or seed from `starter-cash`.
- **`check_profile(profile={...})`** — validate a profile without saving it.
- **`recommend_profile(games=N)`** — get a recommendation from your profiles for a given slate size.
- **`show_settings`** — view the current session/build settings.
- **`test_profile`** — dry-run a profile against real data.
