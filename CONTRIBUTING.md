# Contributing

Thanks for your interest in improving bunpro-mcp.

## Heads up

This project wraps Bunpro's **private, undocumented** frontend API. It is not
affiliated with Bunpro, and the API can change or break at any time. Please keep
contributions respectful of Bunpro's [Terms of Service](https://bunpro.jp/terms),
and do not include any Bunpro content (grammar/vocabulary data, example sentences,
audio) in the repository or in tests.

## Development

```bash
npm install      # installs deps and builds (via the prepare script)
npm run dev      # run the server from TypeScript with tsx
npm run build    # compile to dist/
npm run typecheck
npm test         # unit tests (pure functions; no network)
```

Node.js 18+ is required.

## Before opening a PR

- `npm run typecheck` and `npm test` pass.
- New behavior in the client or tools is covered by a unit test where it can be
  tested without hitting the live API (see `test/`).
- Keep commits focused; describe the *why* in the body.

## Token for manual testing

Set `BUNPRO_API_TOKEN` (the `frontend_api_token` cookie from bunpro.jp) in your
environment, or point `BUNPRO_TOKEN_FILE` at a JSON file containing that field.
Never commit a real token.
