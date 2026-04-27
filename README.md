# Steam inventory value (Cloudflare Worker + Widgy)

Estimates s&box Steam inventory value using the Community Market. Public routes are `/` (frontend) and `/widgy` (JSON response for the widget).

To use the widget on iPhone or iPad, install **[Widgy — Widgets: Home/Lock/Watch](https://apps.apple.com/app/id1524540481)** from the App Store, then import the downloaded `.widgy` file (from the frontend).

## Self-hosting from GitHub

### Prerequisites

- A [Cloudflare](https://dash.cloudflare.com/) account (Workers enabled).
- [Node.js](https://nodejs.org/) 20+ (or use `pnpm` / `yarn` if you prefer).

### 1. Fork or clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/widget.git
cd widget
npm ci
```

### 2. Create a KV namespace (24h snapshots)

The Worker binds KV as `VALUE_SNAPSHOTS` for 24h change data. In the Cloudflare dashboard: **Workers & Pages → KV → Create a namespace**, name it e.g. `steam-inventory-value-snapshots`.

Copy the **namespace ID** into [`wrangler.jsonc`](wrangler.jsonc) under `kv_namespaces[0].id` (replace the placeholder ID if you are not the original author).

### 3. Log in and deploy

```bash
npx wrangler login
npm run deploy
```

Note the Workers URL (e.g. `https://steam-inventory-value.<subdomain>.workers.dev`). Open `/` to download a `.widgy` file and use `/widgy?steamid=…&country=…` as the live JSON endpoint.


## Updating `src/data/sbox-item-nameids.json`

The Worker uses Steam’s `itemordershistogram` when it knows an item’s marketid. The mapping lives in [`src/data/sbox-item-nameids.json`](src/data/sbox-item-nameids.json): keys are Steam **`market_hash_name`** strings (what the inventory / market APIs use), values are numeric IDs.

### Using [SCMM](https://sbox.scmm.app/) (s&box market browser)

1. Open the item page, e.g. [Gold Earrings](https://sbox.scmm.app/item/Gold%20Earrings) (`/item/` + URL-encoded item name).
2. On the item page, find the **M** line in the technical block **M = market id** = the value to store as the JSON number.
3. Add or update a line in `sbox-item-nameids.json`:

   ```json
   "Gold Earrings": 176615651
   ```

   The key must match Steam’s **`market_hash_name`** for that item exactly.

4. Commit and deploy. New or corrected IDs allow pricing via histogram (often fewer 429s than `priceoverview` alone).
