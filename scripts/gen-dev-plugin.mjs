#!/usr/bin/env node
// Generate `-dev` plugins from their canonical counterparts.
//
// The prod plugins (plugins/bettor-help, plugins/bettor-help-mlb) are the
// single sources of truth. Each dev plugin (plugins/<name>-dev) is
// byte-identical EXCEPT:
//   - .mcp.json            → points the MCP server at the dev env + dev OAuth client
//   - .claude-plugin/plugin.json → name "<name>-dev" + a dev note in the description
//   - README.md            → a one-line dev-channel banner prepended
//
// Why a separate plugin and not env-var templating: Claude Code expands
// ${VAR} in a server's `url` but NOT inside the `oauth` object, so the dev
// client_id (a different Clerk tenant) can't be injected at runtime — it has to
// be baked into a distinct plugin. Generating it keeps the skills from drifting.
//
// Usage:
//   node scripts/gen-dev-plugin.mjs           # write all -dev plugins
//   node scripts/gen-dev-plugin.mjs --check   # exit 1 if any committed dev
//                                             # plugin is out of sync (CI)
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { join, dirname, relative } from "node:path";

const ROOT = process.cwd();

// Canonical plugins to generate dev variants for.
const CANONICAL_PLUGINS = ["bettor-help", "bettor-help-mlb"];

// Dev-environment overrides — the only thing that differs from prod.
const DEV = {
  mcpUrl: "https://mcp.dev.bettor.help/mcp",
  oauthClientId: "R9MjZwVsjidtBPJW", // dev Clerk tenant
};

const checkOnly = process.argv.includes("--check");

/** Recursively list files under dir, relative to it. */
function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, base));
    else out.push(relative(base, full));
  }
  return out;
}

/** Transform a source file's contents for the dev plugin. Returns the dev
 *  contents (string). Non-transformed files pass through unchanged. */
function transform(canonicalName, relPath, raw) {
  const devName = `${canonicalName}-dev`;

  if (relPath === ".mcp.json") {
    const j = JSON.parse(raw);
    const server = j.mcpServers?.["bettor-help"];
    if (!server) throw new Error(`.mcp.json: expected mcpServers["bettor-help"]`);
    server.url = DEV.mcpUrl;
    if (!server.oauth) throw new Error(`.mcp.json: expected mcpServers["bettor-help"].oauth`);
    server.oauth.clientId = DEV.oauthClientId; // callbackPort etc. inherited
    return JSON.stringify(j, null, 2) + "\n";
  }
  if (relPath === join(".claude-plugin", "plugin.json")) {
    const j = JSON.parse(raw);
    j.name = devName;
    j.description =
      `[DEV CHANNEL — points at the dev environment, for testing] ` +
      j.description;
    return JSON.stringify(j, null, 2) + "\n";
  }
  if (relPath === "README.md") {
    return (
      `> **Dev channel.** Generated from the \`${canonicalName}\` plugin by ` +
      `\`scripts/gen-dev-plugin.mjs\`; points at \`mcp.dev.bettor.help\`. ` +
      `Do not edit by hand — edit the \`${canonicalName}\` plugin and regenerate.\n\n` +
      raw
    );
  }
  return raw;
}

let overallDrift = [];

for (const canonicalName of CANONICAL_PLUGINS) {
  const SRC = join(ROOT, "plugins", canonicalName);
  const OUT = join(ROOT, "plugins", `${canonicalName}-dev`);

  if (!existsSync(SRC)) {
    console.error(`Error: source plugin not found: ${SRC}`);
    process.exit(1);
  }

  // Build the desired dev tree in memory.
  const desired = new Map(); // relPath -> contents
  for (const rel of listFiles(SRC)) {
    desired.set(rel, transform(canonicalName, rel, readFileSync(join(SRC, rel), "utf8")));
  }

  if (checkOnly) {
    const existing = existsSync(OUT) ? listFiles(OUT) : [];
    const drift = [];
    // Files that should exist / changed.
    for (const [rel, want] of desired) {
      const p = join(OUT, rel);
      if (!existsSync(p) || readFileSync(p, "utf8") !== want) drift.push(rel);
    }
    // Stale files that shouldn't exist.
    for (const rel of existing) if (!desired.has(rel)) drift.push(`(stale) ${rel}`);
    if (drift.length) {
      overallDrift.push({ name: canonicalName, drift });
    } else {
      console.log(`✓ ${canonicalName}-dev plugin is in sync with ${canonicalName}`);
    }
  } else {
    // Write mode: nuke + rewrite so removed source files don't linger.
    if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
    for (const [rel, contents] of desired) {
      const p = join(OUT, rel);
      mkdirSync(dirname(p), { recursive: true });
      writeFileSync(p, contents);
    }
    console.log(`Generated ${relative(ROOT, OUT)} from ${relative(ROOT, SRC)}`);
  }
}

if (checkOnly) {
  if (overallDrift.length > 0) {
    console.log(
      `::error::Some -dev plugins are out of sync. Run \`node scripts/gen-dev-plugin.mjs\` and commit.`,
    );
    for (const { name, drift } of overallDrift) {
      console.log(`  ${name}-dev:`);
      for (const d of drift) console.log(`    drift: ${d}`);
    }
    process.exit(1);
  }
  process.exit(0);
}
