# bunpro-mcp

[![CI](https://github.com/PatVandyke/bunpro-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/PatVandyke/bunpro-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)

An unofficial [Model Context Protocol](https://modelcontextprotocol.io) server for
[Bunpro](https://bunpro.jp), the Japanese grammar/vocabulary SRS. It exposes Bunpro's
review queue, search, statistics, and SRS management as MCP tools, so an LLM agent can
read your study data and add grammar points / vocabulary to your reviews.

> **Disclaimer — please read**
>
> This is an **independent, unofficial** project, **not affiliated with, endorsed by, or
> supported by Bunpro**. It wraps Bunpro's **private, undocumented** frontend API, which can
> change or break at any time. Built for **personal, educational use**.
>
> This tool only works because it relies on **Bunpro's servers, content, and services**.
> Your use of it — and **especially any commercial use** — is subject to
> **[Bunpro's Terms of Service](https://bunpro.jp/terms)** independently of this project's
> license. No Bunpro content (grammar explanations, example sentences, vocabulary data,
> audio) is included in this repository. **Use at your own risk.** If you build something
> commercial on top of Bunpro, support Bunpro directly.

## Features

- Read your review queue, due counts, SRS overview, JLPT progress, forecasts, and session history.
- Search grammar points and vocabulary — compact results, filterable by type, size-capped.
- Add / remove grammar points and vocabulary to / from your SRS reviews.
- Manage bookmarks.
- Per-call token resolution: refresh an expired token without restarting your MCP client (see below).

## Requirements

- Node.js 18+ (uses the built-in `fetch`).
- A Bunpro account and its `frontend_api_token`.

## Getting your token

The frontend API uses the `frontend_api_token` cookie as a bearer token:

1. Log in to [bunpro.jp](https://bunpro.jp).
2. DevTools → Application → Cookies → `https://bunpro.jp` → copy the value of `frontend_api_token`.

The token expires roughly monthly; refresh it the same way when calls start returning
`401 AUTH_USER_DENIED`.

## Install & build

```bash
npm install
npm run build
```

## Configure your MCP client

Add the server to your MCP client config (stdio transport). Build it locally first
(`npm install` builds via the `prepare` script), then point at `dist/index.js` — see
`claude_desktop_config.example.json`:

```json
{
  "mcpServers": {
    "bunpro": {
      "command": "node",
      "args": ["/absolute/path/to/bunpro-mcp/dist/index.js"],
      "env": { "BUNPRO_API_TOKEN": "your_frontend_api_token_here" }
    }
  }
}
```

> Not yet published to npm. Once it is, you'll also be able to run it with no local clone via
> `"command": "npx", "args": ["-y", "@patvandyke/bunpro-mcp"]`.

`BUNPRO_API_KEY` (legacy) is optional and only enables the two `*_legacy` tools.

## Token refresh without restarting

The token is resolved **per request**, not just at startup, so a refreshed token is picked up
without restarting the server:

1. **`BUNPRO_TOKEN_FILE`** — if set (or, by default, `~/.claude-work/.claude.json` when present),
   the live `BUNPRO_API_TOKEN` value is read from that JSON file on each call (30 s cache) and
   re-read on a `401`. Refresh the token in the file and the **next call picks it up — no restart**.
   This is handy under Claude Code, whose config already holds the token.
2. Otherwise it falls back to the `BUNPRO_API_TOKEN` env var supplied at spawn.

A `401` returns a clear "token expired" message instead of dropping the connection.

## Tools

| Tool | Description |
|---|---|
| `get_user` | User profile |
| `get_due_count` | Number of reviews due |
| `get_queue` | Full review queue |
| `get_reviews` | Paginated reviews |
| `get_base_stats`, `get_jlpt_progress`, `get_srs_overview`, `get_srs_level_details`, `get_ghost_details` | Statistics |
| `get_forecast_daily`, `get_forecast_hourly`, `get_review_activity` | Forecasts & activity |
| `get_last_session`, `get_last_24_hours` | History |
| `get_item`, `get_item_notes` | Full detail / notes for one item |
| `search` | Search grammar + vocab (`grammar`, `vocab`, `limit` params; compact output) |
| `add_to_reviews`, `remove_from_reviews` | SRS management (`Vocab` / `GrammarPoint`) |
| `add_bookmark`, `remove_bookmark` | Bookmarks |
| `get_study_queue_legacy`, `get_recent_items_legacy` | Legacy API-key endpoints |

## API notes

- Frontend API base: `https://api.bunpro.jp/api/frontend`. Auth: `Authorization: Bearer <frontend_api_token>`.
- The reviews endpoint uses the type names `Vocab` / `GrammarPoint` (bookmarks use `Vocabulary` / `GrammarPoint`).
- Raw search responses can be very large; this server returns a compact projection and reports truncation.

## Related projects

- [brimalval/bunpro-mcp](https://github.com/brimalval/bunpro-mcp) — an independent Python / FastAPI implementation.

## License

[MIT](LICENSE) © Patrik Kollár. Keep the copyright / credit notice in copies. This license
covers **this client code only** — it grants no rights to Bunpro's services or content, which
remain governed by [Bunpro's Terms of Service](https://bunpro.jp/terms).
