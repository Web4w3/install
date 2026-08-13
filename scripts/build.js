'use strict';

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(__dirname, '../dist');

/**
 * Single source of truth for where each MCP's source lives.
 *
 * `repo` is the GitHub slug to clone; `src` is the path to the entry point
 * *within* that clone. The checkout directory is always the repo name, so the
 * two can no longer drift.
 *
 * They previously did: rebuild.yml cloned into ../<mcp-name> while the entry
 * paths here expected ../<repo-name>. Those disagreed for most MCPs, so CI
 * rebuilds of gmail, outlook, msteams, nut-js and psql always failed with
 * "entry not found" and only ever worked when someone built them by hand
 * locally.
 */
const MCPS = {
  'brotherhood': {
    repo: 'Web4w3/brotherhood',
    src: 'src/mcp.ts',
    external: [],
  },
  'chrome-bridge': {
    repo: 'Web4w3/chrome-bridge-mcp',
    src: 'mcp-server/src/index.ts',
    external: [],
  },
  'gmail': {
    repo: 'Web4w3/gmail-mcp-server',
    src: 'src/index.ts',
    external: [],
  },
  'msteams': {
    repo: 'Web4w3/MSTeams',
    src: 'src/index.ts',
    external: [],
  },
  'nut-js': {
    repo: 'Web4w3/nut-js-mcp-server',
    src: 'src/index.ts',
    // Native bindings must remain external — install separately
    external: ['@nut-tree-fork/nut-js', 'js-yaml'],
  },
  'outlook': {
    repo: 'Web4w3/outlook-mcp-server',
    src: 'src/index.ts',
    external: [],
  },
  'psql': {
    repo: 'Web4w3/psql-mcp-server',
    src: 'src/index.ts',
    external: [],
  },
};

/** Directory name a source repo is cloned into, as a sibling of this repo. */
function sourceDir(name) {
  return MCPS[name].repo.split('/')[1];
}

/** Absolute path to an MCP's entry point. */
function entryPath(name) {
  return path.join(ROOT, sourceDir(name), MCPS[name].src);
}

/**
 * Remove duplicate shebangs from a bundle.
 *
 * We always prepend `#!/usr/bin/env node` via esbuild's banner. When the entry
 * source has its own shebang, esbuild preserves it, so the bundle ends up with
 * two — and a `#!` on line 2 is a hard SyntaxError in Node, not a warning.
 * Only consecutive leading shebangs are stripped, so a `#!` inside a string
 * literal further down is untouched.
 */
function dedupeShebang(outfile) {
  const lines = fs.readFileSync(outfile, 'utf8').split('\n');
  let removed = 0;
  while (lines.length > 1 && lines[1].startsWith('#!')) {
    lines.splice(1, 1);
    removed++;
  }
  if (removed > 0) {
    fs.writeFileSync(outfile, lines.join('\n'));
  }
  return removed;
}

async function buildOne(name, config) {
  const outfile = path.join(OUT, `${name}.mjs`);
  const entry = entryPath(name);

  if (!fs.existsSync(entry)) {
    console.error(`  ✗  ${name}: entry not found — ${entry}`);
    console.error(`     expected ${config.repo} checked out at ${path.join(ROOT, sourceDir(name))}`);
    return false;
  }

  try {
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile,
      external: config.external,
      // Keep source directory as the module root so relative imports resolve
      absWorkingDir: path.dirname(entry),
      // CJS dependencies (ws, and most IMAP/Graph clients) call require() for
      // Node built-ins. In ESM output esbuild routes those through a __require
      // shim that throws — but that shim defers to a real `require` if one is
      // in scope, so we provide one. Without this the bundle dies at import
      // time with 'Dynamic require of "events" is not supported'.
      banner: {
        js: [
          '#!/usr/bin/env node',
          "import { createRequire as __lpCreateRequire } from 'node:module';",
          'const require = __lpCreateRequire(import.meta.url);',
        ].join('\n'),
      },
      logLevel: 'error',
    });
    dedupeShebang(outfile);
    const size = (fs.statSync(outfile).size / 1024).toFixed(1);
    console.log(`  ✓  ${name.padEnd(20)} → dist/${name}.mjs  (${size} KB)`);
    return true;
  } catch (err) {
    console.error(`  ✗  ${name}: ${err.message}`);
    return false;
  }
}

async function main() {
  const target = process.argv[2]; // optional: build a single MCP

  // `--meta <name>` emits the repo slug and checkout directory as KEY=value so
  // CI can consume it with >> "$GITHUB_OUTPUT". Keeping this here means the
  // workflow no longer carries its own copy of the mapping.
  if (target === '--meta') {
    const name = process.argv[3];
    if (!name || !MCPS[name]) {
      console.error(`Unknown MCP: "${name || ''}"`);
      console.error(`Available: ${Object.keys(MCPS).join(', ')}`);
      process.exit(1);
    }
    console.log(`mcp=${name}`);
    console.log(`repo=${MCPS[name].repo}`);
    console.log(`dir=${sourceDir(name)}`);
    return;
  }

  const targets = target ? { [target]: MCPS[target] } : MCPS;

  if (target && !MCPS[target]) {
    console.error(`Unknown MCP: "${target}"`);
    console.error(`Available: ${Object.keys(MCPS).join(', ')}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });

  console.log('\n  @web4w3/install — build\n');

  let ok = 0;
  let fail = 0;
  for (const [name, config] of Object.entries(targets)) {
    const success = await buildOne(name, config);
    success ? ok++ : fail++;
  }

  console.log(`\n  ${ok} built, ${fail} failed\n`);
  if (fail > 0) process.exit(1);
}

// Exported so scripts/smoke.js can read the same metadata instead of keeping a
// second copy of it — the duplication between this file and rebuild.yml is what
// broke CI rebuilds for six of eight MCPs.
module.exports = { MCPS, sourceDir, entryPath };

if (require.main === module) {
  main();
}
