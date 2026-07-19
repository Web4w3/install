'use strict';

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(__dirname, '../dist');

function startsWithShebang(filePath) {
  const firstLine = fs.readFileSync(filePath, 'utf8').split('\n', 1)[0] || '';
  return firstLine.startsWith('#!');
}

const MCPS = {
  'android-bridge': {
    entry: path.join(ROOT, 'android-desktop-bridge/packages/mcp-server/src/index.ts'),
    external: [],
  },
  'brotherhood': {
    entry: path.join(ROOT, 'brotherhood/src/mcp.ts'),
    external: [],
  },
  'chrome-bridge': {
    entry: path.join(ROOT, 'chrome-bridge/mcp-server/index.mjs'),
    // Keep ws external so Node resolves it natively and avoids ESM dynamic-require traps.
    external: ['ws'],
  },
  'gmail': {
    entry: path.join(ROOT, 'gmail-mcp-server/src/index.ts'),
    external: [],
  },
  'msteams': {
    entry: path.join(ROOT, 'MSTeams/src/index.ts'),
    external: [],
  },
  'nut-js': {
    entry: path.join(ROOT, 'nut-js-mcp-server/src/index.ts'),
    // Native bindings must remain external — install separately
    external: ['@nut-tree-fork/nut-js', 'js-yaml'],
  },
  'outlook': {
    entry: path.join(ROOT, 'outlook-mcp-server/src/index.ts'),
    external: [],
  },
};

async function buildOne(name, config) {
  const outfile = path.join(OUT, `${name}.mjs`);

  if (!fs.existsSync(config.entry)) {
    console.error(`  ✗  ${name}: entry not found — ${config.entry}`);
    return false;
  }

  try {
    const addShebangBanner = !startsWithShebang(config.entry);

    await esbuild.build({
      entryPoints: [config.entry],
      bundle: true,
      platform: 'node',
      target: 'node18',
      format: 'esm',
      outfile,
      external: config.external,
      // Keep source directory as the module root so relative imports resolve
      absWorkingDir: path.dirname(config.entry),
      banner: addShebangBanner ? { js: '#!/usr/bin/env node' } : undefined,
      logLevel: 'error',
    });
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

main();
