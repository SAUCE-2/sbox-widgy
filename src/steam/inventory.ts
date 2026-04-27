import { elapsed, nowMs, steamValueLog } from "../log";
import type { SteamAsset, SteamDescription, SteamInventoryPage } from "./types";

/** Per plan: never exceed 2000 items per Steam inventory request. */
export const INVENTORY_PAGE_COUNT = 2000;

const INVENTORY_UA =
  "Mozilla/5.0 (compatible; SteamInventoryValueWorker/1.0; +https://github.com/)";

export type FetchInventoryResult = {
  assets: SteamAsset[];
  descriptionsByKey: Map<string, SteamDescription>;
  totalReported: number | undefined;
  warnings: string[];
};

function descKey(classid: string, instanceid: string): string {
  return `${classid}_${instanceid}`;
}

export async function fetchFullInventory(opts: {
  steamid: string;
  appid: number;
  contextid: number;
}): Promise<FetchInventoryResult> {
  const tAll = nowMs();
  steamValueLog("inventory_start", {
    steamid: `${opts.steamid.slice(0, 6)}…${opts.steamid.slice(-4)}`,
    appid: opts.appid,
    contextid: opts.contextid,
  });

  const warnings: string[] = [];
  const assets: SteamAsset[] = [];
  const descriptionsByKey = new Map<string, SteamDescription>();
  let startAssetid: string | undefined;
  let totalReported: number | undefined;
  let page = 0;

  for (;;) {
    page += 1;
    const tPage = nowMs();
    const url = new URL(
      `https://steamcommunity.com/inventory/${opts.steamid}/${opts.appid}/${opts.contextid}`,
    );
    url.searchParams.set("l", "english");
    url.searchParams.set("count", String(INVENTORY_PAGE_COUNT));
    if (startAssetid) url.searchParams.set("start_assetid", startAssetid);

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": INVENTORY_UA,
      },
    });

    if (!res.ok) {
      steamValueLog("inventory_http_error", { page, status: res.status, ms: elapsed(tPage) });
      throw new Error(`inventory_http_${res.status}`);
    }

    const json = (await res.json()) as SteamInventoryPage;
    if (json.success !== 1) {
      throw new Error("inventory_steam_unsuccessful");
    }

    if (typeof json.total_inventory_count === "number") {
      totalReported = json.total_inventory_count;
    }

    for (const d of json.descriptions ?? []) {
      descriptionsByKey.set(descKey(d.classid, d.instanceid), d);
    }
    for (const a of json.assets ?? []) {
      assets.push(a);
    }

    steamValueLog("inventory_page", {
      page,
      ms: elapsed(tPage),
      assetsThisPage: json.assets?.length ?? 0,
      assetsTotal: assets.length,
      more: json.more_items === 1,
    });

    if (json.more_items === 1 && json.last_assetid) {
      startAssetid = json.last_assetid;
      warnings.push("inventory_paginated");
    } else {
      break;
    }

    if (page > 500) {
      warnings.push("inventory_page_cap_hit");
      break;
    }
  }

  steamValueLog("inventory_done", {
    pages: page,
    ms: elapsed(tAll),
    assets: assets.length,
    descriptionKeys: descriptionsByKey.size,
    totalReported,
  });

  return { assets, descriptionsByKey, totalReported, warnings };
}
