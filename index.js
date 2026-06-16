#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');

const MCPS = {
  'android-bridge': {
    desc: 'Control Android device settings over local network',
    dist: 'android-bridge.mjs',
    env: [],
  },
  'brotherhood': {
    desc: 'MCP bridge between two Claude Code sessions across machines',
    dist: 'brotherhood.mjs',
    env: ['BROTHERHOOD_ROOM_ID', 'BROTHERHOOD_SECRET', 'BROTHERHOOD_RELAY_URL'],
  },
  'chrome-bridge': {
    desc: 'AI control of your real Chrome browser (sessions & cookies intact)',
    dist: 'chrome-bridge.mjs',
    env: [],
  },
  'gmail': {
    desc: 'Read, delete, and manage Gmail via IMAP/POP3',
    dist: 'gmail.mjs',
    env: ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
  },
  'msteams': {
    desc: 'Microsoft Teams integration via MS Graph API',
    dist: 'msteams.mjs',
    env: ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET'],
  },
  'nut-js': {
    desc: 'Desktop automation — mouse, keyboard, screen capture',
    dist: 'nut-js.mjs',
    env: [],
    note: 'Requires @nut-tree-fork/nut-js installed separately and macOS accessibility permissions.',
  },
  'outlook': {
    desc: 'Full Outlook email management via Microsoft Graph API',
    dist: 'outlook.mjs',
    env: ['AZURE_CLIENT_ID', 'AZURE_TENANT_ID', 'AZURE_CLIENT_SECRET'],
  },
};

const mcp = process.argv[2];

// ── Help / list ───────────────────────────────────────────────────

if (!mcp || mcp === '--help' || mcp === '-h') {
  console.log('');
  console.log('  @web4w3/install — MCP Server Registry');
  console.log('');
  console.log('  USAGE');
  console.log('    npx @web4w3/install <mcp-name>  Start an MCP server');
  console.log('    npx @web4w3/install --list      List all available MCPs');
  console.log('');
  console.log('  CLAUDE CODE CONFIG');
  console.log('    {');
  console.log('      "mcpServers": {');
  console.log('        "chrome-bridge": {');
  console.log('          "command": "npx",');
  console.log('          "args": ["-y", "@web4w3/install", "chrome-bridge"]');
  console.log('        }');
  console.log('      }');
  console.log('    }');
  console.log('');
  console.log('  Run "npx @web4w3/install --list" for available MCPs.');
  console.log('');
  process.exit(mcp ? 0 : 1);
}

if (mcp === '--list' || mcp === 'list') {
  const maxLen = Math.max(...Object.keys(MCPS).map(k => k.length));
  console.log('');
  console.log('  Available MCPs:');
  console.log('');
  for (const [name, info] of Object.entries(MCPS)) {
    const distPath = path.join(__dirname, 'dist', info.dist);
    const built = fs.existsSync(distPath) ? '✓' : '○';
    console.log(`  ${built}  ${name.padEnd(maxLen + 2)}${info.desc}`);
  }
  console.log('');
  console.log('  ✓ = compiled  ○ = run "npm run build" first');
  console.log('');
  process.exit(0);
}

// ── Validate ──────────────────────────────────────────────────────

if (!MCPS[mcp]) {
  console.error(`\n  Error: Unknown MCP "${mcp}"\n`);
  console.error('  Run "npx @web4w3/install --list" for available MCPs.\n');
  process.exit(1);
}

const info = MCPS[mcp];
const distPath = path.join(__dirname, 'dist', info.dist);

if (!fs.existsSync(distPath)) {
  console.error(`\n  Error: "${mcp}" has not been compiled yet.\n`);
  console.error(`  Build it with:\n`);
  console.error(`    cd ${path.dirname(__filename)}`);
  console.error(`    npm run build:${mcp}\n`);
  process.exit(1);
}

// ── Check required env vars ───────────────────────────────────────

if (info.env && info.env.length > 0) {
  const missing = info.env.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`\n  Error: Missing required environment variables for ${mcp}:\n`);
    missing.forEach(v => console.error(`    ${v}`));
    console.error('');
    process.exit(1);
  }
}

if (info.note) {
  process.stderr.write(`\n  Note: ${info.note}\n\n`);
}

// ── Start the MCP server ──────────────────────────────────────────

import(distPath).catch((err) => {
  console.error(`\n  Error: Failed to start "${mcp}": ${err.message}\n`);
  process.exit(1);
});
