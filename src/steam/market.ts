import pLimit from "p-limit";
import parsePrice from "parse-price";
import { elapsed, nowMs, steamValueLog } from "../log";
import sboxItemNameIds from "../data/sbox-item-nameids.json";

/**
 * Steam overview GET — same query shape as offish/steam_community_market:
 * `GET .../market/priceoverview` with `appid`, `market_hash_name`, `currency`
 * (see market.py get_overview + request.py). We also pass `country` for
 * regional market behaviour (Steam docs).
 *
 * When `item_nameid` is known (from bundled s&box export), we call
 * `itemordershistogram` first with a listing-page Referer (often fewer 429s).
 *
 * @see https://github.com/offish/steam_community_market/blob/master/steam_community_market/market.py
 */

const MARKET_UA =
  "Mozilla/5.0 (compatible; SteamInventoryValueWorker/1.0; +https://github.com/)";

const PRICEOVERVIEW_PATH = "https://steamcommunity.com/market/priceoverview/";
const ITEM_HISTOGRAM_PATH = "https://steamcommunity.com/market/itemordershistogram";

const SBOX_ITEM_NAMEIDS = sboxItemNameIds as Record<string, number>;

/** ECurrency ids whose strings Steam formats oddly; offish returns str for these. */
const CURRENCIES_STEAM_PRICE_STRING_WEIRD = new Set<number>([
  5, 15, 16, 25, 26, 27, 40,
]); // RUB VND KRW CLP PEN COP CRC

/** Steam rejects some names unless `/` is replaced (offish `fix_name`). */
export function normalizeMarketHashNameForSteam(name: string): string {
  return name.includes("/") ? name.replace(/\//g, "-") : name;
}

function marketListingReferer(appid: number, marketHashName: string): string {
  return `https://steamcommunity.com/market/listings/${appid}/${encodeURIComponent(marketHashName)}`;
}

/** Mirrors offish `price_to_float` for “normal” currencies (digits + dot). */
function steamPriceDigitsToNumber(raw: string): number {
  let price = "";
  for (const char of raw.replace(/,/g, ".")) {
    if ((char >= "0" && char <= "9") || char === ".") price += char;
  }
  const n = parseFloat(price);
  return Number.isFinite(n) ? n : Number.NaN;
}

function steamOverviewRawToUnit(raw: string, currencyId: number): number {
  if (CURRENCIES_STEAM_PRICE_STRING_WEIRD.has(currencyId)) {
    const stripped = steamPriceDigitsToNumber(raw);
    if (Number.isFinite(stripped)) return stripped;
  }
  const parsed = parsePrice(raw);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  const fallback = steamPriceDigitsToNumber(raw);
  return Number.isFinite(fallback) ? fallback : Number.NaN;
}

function histogramLowestSellUnit(data: Record<string, unknown>): number | null {
  const sg = data.sell_order_graph;
  if (Array.isArray(sg) && sg.length > 0) {
    const first = sg[0];
    if (Array.isArray(first) && typeof first[0] === "number" && Number.isFinite(first[0])) {
      return first[0];
    }
  }
  const ls = data.lowest_sell_order;
  if (typeof ls === "number" && Number.isFinite(ls) && ls > 0) return ls;
  if (typeof ls === "string" && ls.length > 0) {
    const n = steamPriceDigitsToNumber(ls);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * `itemordershistogram` — uses `item_nameid` from your export CSV `market_id` column.
 * @see https://github.com/Revadike/InternalSteamWebAPI/wiki/Get-Market-Item-Orders-Histogram
 */
async function fetchItemOrdersHistogramLowestSell(opts: {
  appid: number;
  market_hash_name: string;
  itemNameId: number;
  currency: number;
  country: string;
}): Promise<number | null> {
  const params = new URLSearchParams({
    norender: "1",
    country: opts.country,
    language: "english",
    currency: String(opts.currency),
    item_nameid: String(opts.itemNameId),
    two_factor: "0",
  });
  const url = `${ITEM_HISTOGRAM_PATH}?${params.toString()}`;
  const referer = marketListingReferer(opts.appid, opts.market_hash_name);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": MARKET_UA,
        Referer: referer,
      },
    });

    if (res.status === 429) {
      steamValueLog("market_429_backoff", {
        endpoint: "histogram",
        attempt: attempt + 1,
        waitMs: 800 * (attempt + 1),
        market_hash_name: opts.market_hash_name.slice(0, 48),
      });
      await sleep(800 * (attempt + 1));
      continue;
    }

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as Record<string, unknown>;
    if (data.success !== 1) {
      return null;
    }
    return histogramLowestSellUnit(data);
  }

  return null;
}

async function fetchPriceOverviewOnly(opts: {
  appid: number;
  market_hash_name: string;
  currency: number;
  country: string;
}): Promise<PriceOverviewResult> {
  const name = opts.market_hash_name;
  const params = new URLSearchParams({
    appid: String(opts.appid),
    market_hash_name: name,
    currency: String(opts.currency),
    country: opts.country,
  });
  const url = `${PRICEOVERVIEW_PATH}?${params.toString()}`;
  const referer = marketListingReferer(opts.appid, name);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": MARKET_UA,
        Referer: referer,
      },
    });

    if (res.status === 429) {
      steamValueLog("market_429_backoff", {
        endpoint: "priceoverview",
        attempt: attempt + 1,
        waitMs: 800 * (attempt + 1),
        market_hash_name: name.slice(0, 48),
      });
      await sleep(800 * (attempt + 1));
      continue;
    }

    if (!res.ok) {
      return { success: false };
    }

    const data = (await res.json()) as SteamPriceOverviewJson;
    if (!data.success) {
      return { success: false };
    }

    const rawMedian = data.median_price;
    const rawLowest = data.lowest_price;
    const raw =
      rawMedian && rawMedian.length > 0
        ? rawMedian
        : rawLowest && rawLowest.length > 0
          ? rawLowest
          : undefined;
    if (!raw) {
      return { success: false };
    }

    const unit = steamOverviewRawToUnit(raw, opts.currency);
    if (!Number.isFinite(unit) || unit < 0) {
      return { success: false };
    }

    return {
      success: true,
      unit,
      rawMedian,
      rawLowest,
      basis: rawMedian && rawMedian.length > 0 ? "median" : "lowest",
      source: "priceoverview",
    };
  }

  return { success: false };
}

export type PriceOverviewSuccess = {
  success: true;
  unit: number;
  rawMedian?: string;
  rawLowest?: string;
  basis: "median" | "lowest";
  /** Present when priced via bundled `export.csv` nameids + histogram. */
  source?: "histogram" | "priceoverview";
};

export type PriceOverviewFail = {
  success: false;
};

export type PriceOverviewResult = PriceOverviewSuccess | PriceOverviewFail;

type SteamPriceOverviewJson = {
  success?: boolean;
  lowest_price?: string;
  median_price?: string;
};

export async function fetchPriceOverview(opts: {
  appid: number;
  market_hash_name: string;
  currency: number;
  country: string;
}): Promise<PriceOverviewResult> {
  const name = normalizeMarketHashNameForSteam(opts.market_hash_name);
  const itemNameId = SBOX_ITEM_NAMEIDS[name];
  if (typeof itemNameId === "number") {
    const fromHist = await fetchItemOrdersHistogramLowestSell({
      appid: opts.appid,
      market_hash_name: name,
      itemNameId,
      currency: opts.currency,
      country: opts.country,
    });
    if (fromHist !== null && fromHist > 0) {
      return {
        success: true,
        unit: fromHist,
        basis: "lowest",
        rawLowest: String(fromHist),
        source: "histogram",
      };
    }
  }

  return fetchPriceOverviewOnly({ ...opts, market_hash_name: name });
}

export type ValuedLine = {
  market_hash_name: string;
  qty: number;
  unitPrice: number;
  lineValue: number;
  priced: boolean;
  marketable: boolean;
  pricingBasis?: "median" | "lowest";
  pricingSource?: "histogram" | "priceoverview";
  rawMedian?: string;
  rawLowest?: string;
};

const MARKET_CONCURRENCY = 2;

export async function valueAggregatedRows(
  rows: { market_hash_name: string; qty: number; marketable: boolean }[],
  opts: { appid: number; currency: number; country: string },
): Promise<{
  lines: ValuedLine[];
  totalValue: number;
  pricedLineCount: number;
}> {
  const t0 = nowMs();
  const n = rows.length;
  steamValueLog("market_pricing_start", {
    uniqueMarketNames: n,
    currency: opts.currency,
    country: opts.country,
    concurrency: MARKET_CONCURRENCY,
    sboxNameIdCatalog: Object.keys(SBOX_ITEM_NAMEIDS).length,
  });

  const limit = pLimit(MARKET_CONCURRENCY);
  let completed = 0;
  const logEvery = Math.max(1, Math.ceil(n / 20));

  const lines = await Promise.all(
    rows.map((row) =>
      limit(async () => {
        const p = await fetchPriceOverview({
          appid: opts.appid,
          market_hash_name: row.market_hash_name,
          currency: opts.currency,
          country: opts.country,
        });

        if (!p.success) {
          completed += 1;
          if (completed % logEvery === 0 || completed === n) {
            steamValueLog("market_pricing_progress", {
              done: completed,
              total: n,
              ms: elapsed(t0),
            });
          }
          return {
            market_hash_name: row.market_hash_name,
            qty: row.qty,
            unitPrice: 0,
            lineValue: 0,
            priced: false,
            marketable: row.marketable,
          } satisfies ValuedLine;
        }

        const unit = p.unit;
        const priced = unit > 0;
        completed += 1;
        if (completed % logEvery === 0 || completed === n) {
          steamValueLog("market_pricing_progress", {
            done: completed,
            total: n,
            ms: elapsed(t0),
          });
        }
        return {
          market_hash_name: row.market_hash_name,
          qty: row.qty,
          unitPrice: unit,
          lineValue: unit * row.qty,
          priced,
          marketable: row.marketable,
          pricingBasis: p.basis,
          pricingSource: p.source,
          rawMedian: p.rawMedian,
          rawLowest: p.rawLowest,
        } satisfies ValuedLine;
      }),
    ),
  );

  const totalValue = lines.reduce((s, l) => s + l.lineValue, 0);
  const pricedLineCount = lines.filter((l) => l.priced).length;
  steamValueLog("market_pricing_done", {
    ms: elapsed(t0),
    pricedLineCount,
    totalValue,
  });
  return { lines, totalValue, pricedLineCount };
}
