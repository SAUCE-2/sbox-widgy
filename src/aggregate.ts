import type { SteamAsset, SteamDescription } from "./steam/types";

export type AggregatedRow = {
  market_hash_name: string;
  qty: number;
  marketable: boolean;
};

export function aggregateByMarketHashName(
  assets: SteamAsset[],
  descriptionsByKey: Map<string, SteamDescription>,
): {
  rows: AggregatedRow[];
  skippedAssets: number;
  itemCount: number;
} {
  const byName = new Map<string, { qty: number; marketable: boolean }>();
  let skippedAssets = 0;
  let itemCount = 0;

  for (const a of assets) {
    const key = `${a.classid}_${a.instanceid}`;
    const desc = descriptionsByKey.get(key);
    if (!desc) {
      skippedAssets += 1;
      continue;
    }
    const name = desc.market_hash_name ?? desc.market_name;
    if (!name) {
      skippedAssets += 1;
      continue;
    }
    const qty = Math.max(0, Number.parseInt(a.amount, 10)) || 0;
    if (qty <= 0) {
      skippedAssets += 1;
      continue;
    }
    itemCount += qty;
    const marketable = desc.marketable === 1;
    const cur = byName.get(name);
    if (!cur) {
      byName.set(name, { qty, marketable });
    } else {
      cur.qty += qty;
      cur.marketable = cur.marketable || marketable;
    }
  }

  const rows: AggregatedRow[] = [...byName.entries()].map(([market_hash_name, v]) => ({
    market_hash_name,
    qty: v.qty,
    marketable: v.marketable,
  }));
  rows.sort((a, b) => a.market_hash_name.localeCompare(b.market_hash_name));
  return { rows, skippedAssets, itemCount };
}
