'use strict';

const path = require('path');

/**
 * Single source of truth for where each MCP's source lives.
 *
 * `repo` is the GitHub slug to clone; `src` is the path to the entry point
 * *within* that clone. The checkout directory is always the repo name, so the
 * two can no longer drift.
 *
 * They previously did: rebuild.yml cloned into ../<mcp-name> while the entry
 * paths in build.js expected ../<repo-name>. Those disagreed for most MCPs, so
 * CI rebuilds of gmail, outlook, msteams, nut-js and psql always failed with
 * "entry not found" and only ever worked when someone built them by hand
 * locally.
 *
 * This has no dependencies beyond core `path` deliberately: scripts/smoke.js
 * needs this data in publish.yml, which never runs `npm ci` (it only
 * publishes, it doesn't build) — pulling this out of build.js means the smoke
 * test no longer needs esbuild just to read metadata.
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

/** Directory name a source repo is cloned into, as a sibling of the install repo. */
function sourceDir(name) {
  return MCPS[name].repo.split('/')[1];
}

/** Absolute path to an MCP's entry point, given ROOT (the parent of the install repo checkout). */
function entryPath(root, name) {
  return path.join(root, sourceDir(name), MCPS[name].src);
}

module.exports = { MCPS, sourceDir, entryPath };
