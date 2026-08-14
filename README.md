# @web4w3/install

A single `npx` launcher for pre-compiled MCP (Model Context Protocol) servers.
Instead of cloning and building each MCP server separately, run any of them
with one command:

```bash
npx -y @web4w3/install <mcp-name>
```

## Claude Code config

```json
{
  "mcpServers": {
    "chrome-bridge": {
      "command": "npx",
      "args": ["-y", "@web4w3/install", "chrome-bridge"]
    }
  }
}
```

Swap `chrome-bridge` for any name from the table below. Pin an exact version
(`@web4w3/install@1.0.3`) instead of floating on `latest` if you want your
config to be reproducible and auditable.

## Available MCPs

| Name | What it does | Required env vars | Source |
|---|---|---|---|
| `brotherhood` | Bridges two Claude Code sessions across machines (peer messaging) | `BROTHERHOOD_ROOM_ID`, `BROTHERHOOD_SECRET`, `BROTHERHOOD_RELAY_URL` | private |
| `chrome-bridge` | Lets an AI drive your real, already-logged-in Chrome browser (existing sessions & cookies) | none | [Web4w3/chrome-bridge-mcp](https://github.com/Web4w3/chrome-bridge-mcp) |
| `gmail` | Read/manage Gmail via IMAP/POP3 | `GMAIL_USER`, `GMAIL_APP_PASSWORD` | [Web4w3/gmail-mcp-server](https://github.com/Web4w3/gmail-mcp-server) |
| `msteams` | Microsoft Teams via MS Graph API | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` | private |
| `nut-js` | Desktop automation — mouse, keyboard, screen capture | none (see note) | [Web4w3/nut-js-mcp-server](https://github.com/Web4w3/nut-js-mcp-server) |
| `outlook` | Outlook email via MS Graph API | `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` | [Web4w3/outlook-mcp-server](https://github.com/Web4w3/outlook-mcp-server) |
| `psql` | Run `psql` commands against a Postgres database | `DATABASE_URL` | private |

`brotherhood`, `msteams`, and `psql` are private repos — their source isn't
publicly auditable. Weigh that before pointing them at real credentials; the
public ones (`chrome-bridge`, `gmail`, `outlook`, `nut-js`) can be reviewed
directly.

`nut-js` additionally requires `@nut-tree-fork/nut-js` installed separately
and macOS accessibility permissions granted to your terminal.

Only the env vars for the MCP you actually run are required — `chrome-bridge`
and `nut-js` don't need any credentials at all.

```bash
npx @web4w3/install --list   # see what's compiled and available
npx @web4w3/install --help   # usage + Claude Code config snippet
```

## Why this exists / how it's built

This package does not vendor arbitrary third-party code. Each entry in the
table above is my own MCP server, developed in its own repo under the
[Web4w3](https://github.com/Web4w3) org (some public, some private — see the
table above). This repo's only job is to bundle
each one (via `esbuild`, see [`scripts/build.js`](scripts/build.js)) into a
single-file `.mjs` so it can be run with zero install step via `npx`. That's
also why `package.json` declares no runtime `dependencies` — everything a
given MCP needs is already inlined into its `dist/<name>.mjs` bundle.

**Publishing is CI-only.** [`.github/workflows/rebuild.yml`](.github/workflows/rebuild.yml)
clones the relevant source repo, builds it, and pushes a version-bump commit
+ tag; [`.github/workflows/publish.yml`](.github/workflows/publish.yml) runs
`npm publish --provenance` on tag push. Every version on npm carries an
[npm provenance attestation](https://docs.npmjs.com/generating-provenance-statements)
you can verify yourself:

```bash
npm audit signatures
npm view @web4w3/install@<version> dist.attestations
```

which lets you confirm a given tarball was built from a specific commit in
this repo by GitHub's CI, rather than pushed by hand from someone's laptop.

## Building from source

If you'd rather not trust the pre-built bundle, build it yourself:

```bash
git clone https://github.com/Web4w3/install
cd install
npm install
# clone the MCP's source repo as a sibling directory first (see scripts/mcps.js),
# then:
npm run build:chrome-bridge
node index.js chrome-bridge
```

## Security notes

- This is a solo/small-maintainer project, not a large-org package — do your
  own review before pointing it at anything sensitive (email, Teams, a
  production database).
- `gmail`, `msteams`, `outlook`, and `psql` request real credentials via env
  vars. Only set the ones for the server you're actually running; don't
  export credentials for tools you're not using.
- `chrome-bridge` gets control of your logged-in browser, cookies included.
  Only enable it in sessions/agents you trust with that access.
- Source for `chrome-bridge`, `gmail`, `outlook`, and `nut-js` is public in
  the [Web4w3](https://github.com/Web4w3) org — read it before running it,
  especially for anything touching credentials. `brotherhood`, `msteams`,
  and `psql` are private; take that into account before trusting them with
  real credentials.

## License

MIT © Andrey Karasev — see [LICENSE](LICENSE).
