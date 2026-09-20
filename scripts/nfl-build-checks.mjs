#!/usr/bin/env node
// Behavior/structural checks for the canonical `nfl-build` skill and its
// `compare`-mode MCP call-trace fixtures.
//
// The repository has no runtime skill-execution harness, so — per the plan
// (Task 5) — the expected MCP call ordering is encoded as checked golden/negative
// fixtures under tests/nfl-build/ that this validator reads, plus structural
// assertions over the canonical SKILL.md text. `npm run validate` runs these
// via scripts/validate-plugin.mjs; this file is also runnable standalone.
//
// Usage:
//   node scripts/nfl-build-checks.mjs      # run standalone, exit 1 on failure

import { readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const CONTENT_TOOLS = new Set([
  "nfl_list_content",
  "nfl_search_content",
  "nfl_get_content",
]);

/**
 * Validate a single MCP call trace against the design §12 / plan Task 5 rules.
 * Returns { valid: true } or { valid: false, error: "<reason>" }.
 */
export function validateTrace(fixture) {
  const mode = fixture.mode;
  const trace = fixture.trace || [];
  const prior = fixture.prior_etr_retrieval_in_conversation === true;

  // Fresh-session rule: a blind (projections_only) run in a conversation that
  // already received ETR source text must be refused.
  if (mode === "projections_only" && prior) {
    return {
      valid: false,
      error: "blind label after prior ETR retrieval must be refused (fresh session required)",
    };
  }

  const firstContent = trace.findIndex((s) => CONTENT_TOOLS.has(s.call));

  // Blind mode makes zero content calls.
  if (mode === "projections_only" && firstContent !== -1) {
    return {
      valid: false,
      error: `content call in projections_only: ${trace[firstContent].call}`,
    };
  }

  if (mode === "compare") {
    const baselineIdx = trace.findIndex(
      (s) => s.call === "build_lineups" && (s.role === "baseline" || s.mode === "projections_only"),
    );
    if (baselineIdx === -1) {
      return { valid: false, error: "compare requires a projections_only baseline build" };
    }
    // Baseline must be built before the first content call.
    if (firstContent !== -1 && firstContent < baselineIdx) {
      return { valid: false, error: "content call before baseline build in compare" };
    }

    const confirmIdx = trace.findIndex((s) => s.call === "USER_CONFIRMATION");
    const informedIdx = trace.findIndex(
      (s) => s.call === "build_lineups" && (s.role === "informed" || s.mode === "etr_informed"),
    );
    // The informed rebuild — and any lock/exclude change — must follow an
    // explicit user confirmation turn.
    if (informedIdx !== -1 && (confirmIdx === -1 || confirmIdx > informedIdx)) {
      return { valid: false, error: "mutation before user confirmation" };
    }
    for (let i = 0; i < trace.length; i++) {
      const s = trace[i];
      if (Array.isArray(s.user_changes) && s.user_changes.length > 0) {
        if (confirmIdx === -1 || i < confirmIdx) {
          return { valid: false, error: "mutation before user confirmation" };
        }
      }
    }

    // A pool-digest mismatch must invalidate, never be reported as an ETR effect.
    const cmp = trace.find((s) => s.call === "COMPARE_POOL_DIGESTS");
    if (cmp && cmp.digests_equal === false && cmp.outcome !== "invalidate") {
      return { valid: false, error: "digest mismatch reported as ETR effect (must invalidate)" };
    }
  }

  return { valid: true };
}

/**
 * Run every nfl-build structural + fixture check against the tree rooted at ROOT.
 * Returns { errors: string[], oks: string[] }.
 */
export function runNflBuildChecks(ROOT) {
  const errors = [];
  const oks = [];
  const add = (cond, okMsg, errMsg) => (cond ? oks.push(okMsg) : errors.push(errMsg));

  const skillPath = join(ROOT, "plugins", "bettor-help-nfl", "skills", "nfl-build", "SKILL.md");
  if (!existsSync(skillPath)) {
    errors.push(`${relative(ROOT, skillPath)}: nfl-build SKILL.md is missing`);
    return { errors, oks };
  }
  const raw = readFileSync(skillPath, "utf8");
  const norm = raw.replace(/\*\*/g, "").toLowerCase(); // strip bold markers
  const where = relative(ROOT, skillPath);

  // 1. Explicit default projections_only.
  add(
    /`projections_only`\s*\(default\)/.test(raw) && /default is `projections_only`/i.test(raw),
    `${where}: default mode is projections_only`,
    `${where}: must state projections_only is the default mode`,
  );

  // 2. Exact tool names present.
  for (const t of CONTENT_TOOLS) {
    add(raw.includes(t), `${where}: names ${t}`, `${where}: missing exact tool name ${t}`);
  }

  // 3. projections_only prohibits content calls.
  add(
    norm.includes("never call `nfl_list_content`") ||
      norm.includes("never") && norm.includes("nfl_list_content") && norm.includes("zero"),
    `${where}: blind mode prohibits content calls`,
    `${where}: must prohibit content calls in projections_only`,
  );

  // 4. Fresh-session refusal after prior ETR retrieval.
  add(
    /refuse the blind label/i.test(raw) && /fresh session/i.test(raw),
    `${where}: refuses blind label + directs fresh session`,
    `${where}: must refuse the blind label and direct a fresh session after prior ETR retrieval`,
  );

  // 5. compare: baseline before any content call.
  add(
    /before any content call/i.test(raw),
    `${where}: compare persists baseline before any content call`,
    `${where}: compare must build/persist baseline before any content call`,
  );

  // 6. Citation format with immutable coordinates.
  add(
    raw.includes("[<title> · <published-at> · <document-version-id>#chunk-<n> · <timestamp-or-heading>]"),
    `${where}: exact citation format present`,
    `${where}: missing the required citation format`,
  );

  // 7. Explicit user turn before lock/exclude mutation.
  add(
    /ask the user/i.test(raw) &&
      (/explicit user instruction/i.test(raw) || /explicit user turn/i.test(raw)),
    `${where}: requires an explicit user turn before lock/exclude`,
    `${where}: must require an explicit user turn before lock/exclude`,
  );

  // 8. Pool-digest equality gate → invalidate on mismatch.
  add(
    /pool digest/i.test(raw) && /invalid/i.test(raw),
    `${where}: pool-digest mismatch invalidates the comparison`,
    `${where}: must invalidate a comparison on pool-digest mismatch`,
  );

  // 9. No raw source URL / auth / media handling.
  add(
    /raw source url/i.test(raw) && /credential/i.test(raw) && /media/i.test(raw),
    `${where}: states no raw source URL / auth / media handling`,
    `${where}: must state it never handles raw source URLs, credentials, or media`,
  );

  // 10. Orchestrator routes NFL builds to nfl-build.
  const orchPath = join(
    ROOT,
    "plugins",
    "bettor-help",
    "skills",
    "sport-session-orchestrator",
    "SKILL.md",
  );
  if (!existsSync(orchPath)) {
    errors.push(`${relative(ROOT, orchPath)}: sport-session-orchestrator SKILL.md is missing`);
  } else {
    const orch = readFileSync(orchPath, "utf8");
    add(
      /nfl-build/.test(orch) && /nfl/i.test(orch),
      `${relative(ROOT, orchPath)}: routes NFL → nfl-build`,
      `${relative(ROOT, orchPath)}: must route NFL builds to nfl-build`,
    );
  }

  // 11. Golden compare trace validates (positive).
  const goldenPath = join(ROOT, "tests", "nfl-build", "compare-trace.golden.json");
  if (!existsSync(goldenPath)) {
    errors.push(`${relative(ROOT, goldenPath)}: golden compare trace fixture is missing`);
  } else {
    const golden = JSON.parse(readFileSync(goldenPath, "utf8"));
    const res = validateTrace({ mode: "compare", ...golden });
    add(
      res.valid,
      `${relative(ROOT, goldenPath)}: golden compare trace validates`,
      `${relative(ROOT, goldenPath)}: golden trace should be valid but failed: ${res.error}`,
    );
  }

  // 12. Negative traces each rejected with the expected reason.
  const negPath = join(ROOT, "tests", "nfl-build", "negative-traces.json");
  if (!existsSync(negPath)) {
    errors.push(`${relative(ROOT, negPath)}: negative trace fixtures are missing`);
  } else {
    const neg = JSON.parse(readFileSync(negPath, "utf8"));
    for (const c of neg.cases || []) {
      const res = validateTrace(c);
      if (res.valid) {
        errors.push(`${relative(ROOT, negPath)}: case "${c.name}" should be rejected but passed`);
      } else if (!res.error.includes(c.expectedError)) {
        errors.push(
          `${relative(ROOT, negPath)}: case "${c.name}" rejected for wrong reason: got "${res.error}", expected substring "${c.expectedError}"`,
        );
      } else {
        oks.push(`${relative(ROOT, negPath)}: case "${c.name}" correctly rejected`);
      }
    }
  }

  return { errors, oks };
}

// Standalone runner.
if (import.meta.url === `file://${process.argv[1]}`) {
  const ROOT = process.cwd();
  const { errors, oks } = runNflBuildChecks(ROOT);
  for (const o of oks) console.log(`✓ ${o}`);
  if (errors.length) {
    for (const e of errors) console.log(`::error::${e}`);
    console.log(`\n${errors.length} nfl-build check error(s)`);
    process.exit(1);
  }
  console.log(`\nAll nfl-build checks passed.`);
}
