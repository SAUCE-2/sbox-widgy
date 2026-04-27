# Contributing

Thanks for helping improve this project. This is a Cloudflare Worker that serves a small frontend and a Widgy JSON endpoint for estimating s&box Steam inventory value.

## Local Setup

Prerequisites:

- Node.js 20+
- npm
- A Cloudflare account if you need to test deployment or KV behavior

Install dependencies:

```bash
npm install
```

Start the Worker locally:

```bash
npm run dev
```

The main Worker entry point is `src/index.ts`. The frontend setup page is in `src/widgy-setup-page.ts`.

## Configuration

The Worker uses a Cloudflare KV binding named `VALUE_SNAPSHOTS` for 24-hour value snapshots. For your own deployment, create a KV namespace and update the `kv_namespaces` entry in `wrangler.jsonc` with your namespace ID.

Do not commit Cloudflare credentials, tokens, `.env` files, or other local secrets.

## Validation

Before opening a pull request, run:

```bash
npm run check
```

There is not currently a real automated test suite. The `npm test` script is a placeholder and exits with an error.

If your change affects runtime behavior, also smoke-test with:

```bash
npm run dev
```

Useful routes to check:

- `/` renders the setup page and allows downloading a `.widgy` file.
- `/widgy?steamid=...&country=...` returns the JSON payload used by Widgy.

## Updating Item Market IDs

Item market IDs live in `src/data/sbox-item-nameids.json`. Keys must exactly match Steam `market_hash_name` values, and values should be numeric market IDs.

When adding or correcting IDs:

1. Keep the JSON valid.
2. Preserve existing entries unless they are known to be wrong.
3. Run `npm run check`.
4. Mention the source of the market ID in your pull request.

## Pull Requests

Keep pull requests focused and include:

- What changed and why.
- Any manual testing performed.
- Any deployment or KV configuration notes.

For user-facing changes, include screenshots or example responses when they help reviewers verify the behavior quickly.
