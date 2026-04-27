import { aggregateByMarketHashName } from "./aggregate";
import { elapsed, nowMs, steamValueLog } from "./log";
import { fetchFullInventory } from "./steam/inventory";
import { valueAggregatedRows, type ValuedLine } from "./steam/market";
import type { ResolvedSteamValueQuery } from "./schema";
import { formatWidgyCurrency } from "./widgy/locale-money";
import type { InventoryValueTrend } from "./widgy/value-history";

export type ValueResponseBody = {
  totalValue: number;
  currency: number;
  country: string;
  steamid: string;
  appid: number;
  contextid: number;
  itemCount: number;
  pricedItemCount: number;
  pricingBasis: "median_else_lowest";
  fetchedAt: string;
  lines: ValuedLine[];
  warnings: string[];
  total_inventory_count_reported: number | undefined;
};

export async function computeValueBody(
  q: ResolvedSteamValueQuery,
): Promise<ValueResponseBody> {
  const t0 = nowMs();
  steamValueLog("compute_start", {
    steamid: `${q.steamid.slice(0, 6)}…${q.steamid.slice(-4)}`,
    country: q.country,
    currency: q.currency,
    appid: q.appid,
    contextid: q.contextid,
  });

  const inv = await fetchFullInventory({
    steamid: q.steamid,
    appid: q.appid,
    contextid: q.contextid,
  });
  const tAgg = nowMs();
  const agg = aggregateByMarketHashName(inv.assets, inv.descriptionsByKey);
  steamValueLog("aggregate_done", {
    ms: elapsed(tAgg),
    uniqueMarketNames: agg.rows.length,
    itemCount: agg.itemCount,
    skippedAssets: agg.skippedAssets,
  });

  const valued = await valueAggregatedRows(agg.rows, {
    appid: q.appid,
    currency: q.currency,
    country: q.country,
  });

  const warnings = [...inv.warnings];
  if (agg.skippedAssets > 0) {
    warnings.push(`skipped_assets_${agg.skippedAssets}`);
  }

  steamValueLog("compute_done", {
    ms: elapsed(t0),
    totalValue: valued.totalValue,
    pricedLines: valued.pricedLineCount,
  });

  return {
    totalValue: valued.totalValue,
    currency: q.currency,
    country: q.country,
    steamid: q.steamid,
    appid: q.appid,
    contextid: q.contextid,
    itemCount: agg.itemCount,
    pricedItemCount: valued.pricedLineCount,
    pricingBasis: "median_else_lowest",
    fetchedAt: new Date().toISOString(),
    lines: valued.lines,
    warnings,
    total_inventory_count_reported: inv.totalReported,
  };
}

/** Minimal flat JSON for Widgy remote text + image URL bindings (`/widgy`). */
export type WidgyDataLayer = {
  title: string;
  total: string;
  directionImageUrl: string;
  change24hPercent: string;
};

function directionPngFile(direction: InventoryValueTrend["direction"]): string {
  if (direction === "up") return "chevron-up.png";
  if (direction === "down") return "chevron-down.png";
  return "minus.png";
}

export function toWidgyDataLayer(
  body: ValueResponseBody,
  trend: InventoryValueTrend | undefined,
  opts: { workerOrigin: string },
): WidgyDataLayer {
  const origin = opts.workerOrigin.replace(/\/$/, "");
  const direction = trend?.direction ?? "new";
  return {
    title: "s&box inventory",
    total: formatWidgyCurrency(body.totalValue, body.country, body.currency),
    directionImageUrl: `${origin}/images/${directionPngFile(direction)}`,
    change24hPercent: trend?.changePercentFormatted ?? "n/a",
  };
}
