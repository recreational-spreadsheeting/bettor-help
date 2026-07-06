#!/usr/bin/env node
/**
 * CI guard: if a canonical plugin's content changed relative to the base ref,
 * its plugin.json version must change too. The marketplace serves main HEAD,
 * but clients key update detection on the version field — content changes
 * without a bump ship silently.
 *
 * Usage: node scripts/check-version-bump.mjs <base-ref>   (e.g. origin/main)
 * -dev variants are generated copies (gen-dev-plugin --check enforces sync),
 * so only canonical plugins are guarded.
 */
import { execSync } from "node:child_process";

const CANONICAL_PLUGINS = ["bettor-help", "bettor-help-mlb"];

const baseRef = process.argv[2];
if (!baseRef) {
  console.error("usage: check-version-bump.mjs <base-ref>");
  process.exit(2);
}

function sh(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function versionAt(ref, plugin) {
  const raw = sh(`git show ${ref}:plugins/${plugin}/.claude-plugin/plugin.json`);
  return JSON.parse(raw).version;
}

let failed = false;
for (const plugin of CANONICAL_PLUGINS) {
  const changed = sh(
    `git diff --name-only ${baseRef}...HEAD -- plugins/${plugin}/`,
  );
  if (!changed) {
    console.log(`✓ ${plugin} — unchanged`);
    continue;
  }
  const before = versionAt(baseRef, plugin);
  const after = versionAt("HEAD", plugin);
  if (before === after) {
    console.error(
      `✗ ${plugin} — content changed but version is still ${after}; bump plugins/${plugin}/.claude-plugin/plugin.json (+ marketplace.json) and re-run gen:dev`,
    );
    failed = true;
  } else {
    console.log(`✓ ${plugin} — content changed, version ${before} → ${after}`);
  }
}
process.exit(failed ? 1 : 0);
