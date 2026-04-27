import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { computeValueBody, toWidgyDataLayer } from "./compute-value";
import chevronDownPng from "./images/chevron-down.png";
import chevronUpPng from "./images/chevron-up.png";
import minusPng from "./images/minus.png";
import { steamValueLog } from "./log";
import { resolveSteamValueQuery, valueQuerySchema } from "./schema";
import { buildWidgyFileBytes } from "./widgy/build-widgy-import-json";
import { recordInventoryValueSnapshot } from "./widgy/value-history";
import { widgySetupPageHtml } from "./widgy-setup-page";

const CACHE_TTL_SEC = 600;

const PNG_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=86400",
} as const;

type AppEnv = {
  Bindings: {
    VALUE_SNAPSHOTS?: KVNamespace;
  };
};

const app = new Hono<AppEnv>();

app.use("*", cors({ origin: "*" }));

app.get("/", (c) =>
  new Response(widgySetupPageHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  }),
);

app.get("/images/chevron-up.png", () => new Response(chevronUpPng, { headers: PNG_HEADERS }));
app.get("/images/chevron-down.png", () => new Response(chevronDownPng, { headers: PNG_HEADERS }));
app.get("/images/minus.png", () => new Response(minusPng, { headers: PNG_HEADERS }));

function widgyImportFileResponse(c: Context) {
  const parsed = valueQuerySchema.safeParse({
    steamid: c.req.query("steamid") ?? undefined,
    country: c.req.query("country"),
  });
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "bad_request", issues: parsed.error.issues }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  const q = resolveSteamValueQuery(parsed.data);
  const origin = new URL(c.req.url).origin;
  const widgyDataUrl = `${origin}/widgy?steamid=${encodeURIComponent(q.steamid)}&country=${encodeURIComponent(q.country)}`;
  const bytes = buildWidgyFileBytes({
    widgetName: "s&box widgy",
    author: "sauce2",
    widgyDataUrl,
    workerOrigin: origin,
  });
  const filename = `steam-${q.steamid}.widgy`;
  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

/** Binary `.widgy` (raw-deflate JSON) for Widgy Import → Files / URL. */
app.get("/widgy-import.widgy", widgyImportFileResponse);

async function cachedJsonResponse(
  c: { req: { url: string } },
  cacheTtlSec: number,
  compute: () => Promise<unknown>,
): Promise<Response> {
  const cacheUrl = new URL(c.req.url);
  const cacheRequest = new Request(cacheUrl.toString(), { method: "GET" });

  const cached = await caches.default.match(cacheRequest);
  if (cached) {
    steamValueLog("response_cache_hit", {
      path: `${cacheUrl.pathname}${cacheUrl.search}`,
    });
    return cached;
  }

  steamValueLog("response_cache_miss", {
    path: `${cacheUrl.pathname}${cacheUrl.search}`,
  });

  const body = await compute();
  const response = new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${cacheTtlSec}`,
    },
  });
  await caches.default.put(cacheRequest, response.clone());
  return response;
}

/** Widgy flat JSON: `title`, `total`, `directionImageUrl`, `change24hPercent`. */
app.get("/widgy", async (c) => {
  const parsed = valueQuerySchema.safeParse({
    steamid: c.req.query("steamid") ?? undefined,
    country: c.req.query("country"),
  });

  if (!parsed.success) {
    return c.json({ error: "bad_request", issues: parsed.error.issues }, 400);
  }

  const q = resolveSteamValueQuery(parsed.data);
  steamValueLog("http_widgy", { country: q.country, currency: q.currency });
  const origin = new URL(c.req.url).origin;

  try {
    return await cachedJsonResponse(c, CACHE_TTL_SEC, async () => {
      const full = await computeValueBody(q);
      const trend = await recordInventoryValueSnapshot(c.env.VALUE_SNAPSHOTS, full);
      return toWidgyDataLayer(full, trend, { workerOrigin: origin });
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown_error";
    steamValueLog("http_widgy_error", { message });
    return c.json({ error: "upstream_or_internal", message }, 502);
  }
});

export default app;