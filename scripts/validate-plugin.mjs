#!/usr/bin/env node
// Lightweight validator for the bettor-help marketplace.
// - Confirms .claude-plugin/marketplace.json parses and has the required shape.
// - Walks plugins/*/: validates each .claude-plugin/plugin.json and every
//   skills/*/SKILL.md has YAML frontmatter with `name` and `description`.
// Exits non-zero on first failure; logs are GH-Actions-friendly.

import { readFileSync, statSync, readdirSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const errors = [];

function fail(file, msg) {
  errors.push(`${file}: ${msg}`);
  console.log(`::error file=${file}::${msg}`);
}

function ok(file, msg) {
  console.log(`✓ ${relative(ROOT, file)} — ${msg}`);
}

// ---- 1. marketplace.json ----
const marketplacePath = join(ROOT, ".claude-plugin", "marketplace.json");
if (!existsSync(marketplacePath)) {
  fail(marketplacePath, "marketplace.json is missing");
} else {
  let data;
  try {
    data = JSON.parse(readFileSync(marketplacePath, "utf8"));
  } catch (e) {
    fail(marketplacePath, `invalid JSON: ${e.message}`);
  }
  if (data) {
    if (typeof data.name !== "string" || !data.name)
      fail(marketplacePath, "missing required field: name");
    if (!data.owner || typeof data.owner !== "object")
      fail(marketplacePath, "missing required field: owner");
    if (!Array.isArray(data.plugins) || data.plugins.length === 0)
      fail(marketplacePath, "plugins must be a non-empty array");
    if (Array.isArray(data.plugins)) {
      data.plugins.forEach((p, i) => {
        const where = `plugins[${i}]`;
        if (!p.name) fail(marketplacePath, `${where}: missing name`);
        if (!p.source) fail(marketplacePath, `${where}: missing source`);
        if (!p.version) fail(marketplacePath, `${where}: missing version`);
      });
    }
    if (errors.length === 0)
      ok(marketplacePath, `${data.plugins.length} plugin(s) declared`);
  }
}

// ---- 2. per-plugin manifests + skill frontmatter ----
const pluginsDir = join(ROOT, "plugins");
if (existsSync(pluginsDir) && statSync(pluginsDir).isDirectory()) {
  for (const pluginEntry of readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!pluginEntry.isDirectory()) continue;
    const pluginRoot = join(pluginsDir, pluginEntry.name);

    // plugin.json must exist and parse
    const pluginJsonPath = join(pluginRoot, ".claude-plugin", "plugin.json");
    if (!existsSync(pluginJsonPath)) {
      fail(pluginJsonPath, "plugin.json is missing");
    } else {
      try {
        const p = JSON.parse(readFileSync(pluginJsonPath, "utf8"));
        if (!p.name) fail(pluginJsonPath, "missing required field: name");
        else if (!/^[a-z][a-z0-9-]*$/.test(p.name))
          fail(pluginJsonPath, `plugin name "${p.name}" must match ^[a-z][a-z0-9-]*$`);
        else ok(pluginJsonPath, `plugin "${p.name}" manifest ok`);
      } catch (e) {
        fail(pluginJsonPath, `invalid JSON: ${e.message}`);
      }
    }

    // each skill dir needs a SKILL.md with name + description frontmatter
    const skillsDir = join(pluginRoot, "skills");
    if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) continue;
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillPath = join(skillsDir, entry.name, "SKILL.md");
      if (!existsSync(skillPath)) {
        fail(skillPath, "SKILL.md is missing");
        continue;
      }
      const content = readFileSync(skillPath, "utf8");
      const fm = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fm) {
        fail(skillPath, "missing YAML frontmatter");
        continue;
      }
      const block = fm[1];
      if (!/^name:\s*\S/m.test(block))
        fail(skillPath, "frontmatter missing `name`");
      if (!/^description:\s*\S/m.test(block))
        fail(skillPath, "frontmatter missing `description`");
      if (
        /^name:\s*\S/m.test(block) &&
        /^description:\s*\S/m.test(block)
      )
        ok(skillPath, "frontmatter ok");
    }
  }
} else {
  console.log(`(no plugins/ dir — skipping plugin validation)`);
}

if (errors.length > 0) {
  console.log(`\n${errors.length} validation error(s)`);
  process.exit(1);
}
console.log(`\nAll checks passed.`);
