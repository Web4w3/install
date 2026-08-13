#!/usr/bin/env node
'use strict';

/**
 * Smoke-test a built bundle by speaking MCP to it over stdio.
 *
 * A successful esbuild run says nothing about whether the bundle can be
 * imported, let alone serve requests. Three separate defects shipped past a
 * green build: a duplicate shebang (SyntaxError on line 2), a CJS `require` of
 * a Node built-in rejected by the ESM require shim, and a stale entry path that
 * silently produced no bundle at all. This asserts the bundle starts and
 * returns a non-empty tool list.
 *
 * Usage: node scripts/smoke.js <mcp-name>
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Deliberately depends on mcps.js, not build.js: build.js requires esbuild,
// and publish.yml runs this without ever running `npm ci` (it only publishes,
// it doesn't build) — the smoke test only needs the metadata, not the bundler.
const { MCPS } = require('./mcps.js');

// Servers that refuse to start without real credentials cannot be smoke-tested
// here; a failure would mean "no secret in CI", not "broken bundle".
const REQUIRES_CREDENTIALS = new Set(['gmail', 'msteams', 'outlook', 'psql', 'brotherhood']);

/**
 * Why an MCP cannot complete a full handshake here, or null if it can.
 *
 * Bundles with externals deliberately leave dependencies out, so importing them
 * fails until those are installed separately — that is by design, not a defect.
 */
function skipReason(name) {
  if (REQUIRES_CREDENTIALS.has(name)) {
    return 'needs credentials';
  }
  const external = (MCPS[name] && MCPS[name].external) || [];
  if (external.length > 0) {
    return `depends on external packages (${external.join(', ')})`;
  }
  return null;
}

// Per-MCP environment needed just to reach a serving state.
const SMOKE_ENV = {
  // Avoid colliding with anything already bound on the default 9229.
  'chrome-bridge': { CHROME_BRIDGE_PORT: '39229' },
};

const name = process.argv[2];
if (!name) {
  console.error('usage: node scripts/smoke.js <mcp-name>');
  process.exit(2);
}

const bundle = path.resolve(__dirname, '..', 'dist', `${name}.mjs`);

if (!fs.existsSync(bundle)) {
  console.error(`  ✗  ${name}: bundle not found — ${bundle}`);
  process.exit(1);
}

// A shebang anywhere but line 1 is a SyntaxError, so check before spawning.
const head = fs.readFileSync(bundle, 'utf8').split('\n', 3);
if (head[1] && head[1].startsWith('#!')) {
  console.error(`  ✗  ${name}: duplicate shebang on line 2`);
  process.exit(1);
}

const skip = skipReason(name);
if (skip) {
  console.log(`  ~  ${name}: skipped MCP handshake (${skip}); shebang and bundle checks passed`);
  process.exit(0);
}

const child = spawn(process.execPath, [bundle], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, ...(SMOKE_ENV[name] || {}) },
});

let stdoutBuf = '';
let stderrBuf = '';
const pending = new Map();

child.stderr.on('data', (d) => (stderrBuf += d.toString()));

child.stdout.on('data', (chunk) => {
  stdoutBuf += chunk.toString();
  let idx;
  while ((idx = stdoutBuf.indexOf('\n')) !== -1) {
    const line = stdoutBuf.slice(0, idx).trim();
    stdoutBuf = stdoutBuf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  }
});

let nextId = 1;
function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timed out waiting for ${method}`));
      }
    }, 20000);
  });
}

function fail(message) {
  console.error(`  ✗  ${name}: ${message}`);
  if (stderrBuf.trim()) {
    console.error('     --- server stderr ---');
    for (const line of stderrBuf.trim().split('\n').slice(0, 20)) {
      console.error(`     ${line}`);
    }
  }
  child.kill();
  process.exit(1);
}

child.on('exit', (code) => {
  if (code !== 0 && code !== null && pending.size > 0) {
    fail(`server exited early with code ${code}`);
  }
});

(async () => {
  try {
    const init = await request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'smoke', version: '1.0.0' },
    });

    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

    const list = await request('tools/list');
    const tools = list.tools || [];
    if (tools.length === 0) {
      fail('server returned an empty tool list');
    }

    const server = init.serverInfo || {};
    console.log(
      `  ✓  ${name.padEnd(20)} ${server.name || '?'}@${server.version || '?'} — ${tools.length} tools`
    );
    child.kill();
    process.exit(0);
  } catch (err) {
    fail(err.message);
  }
})();
