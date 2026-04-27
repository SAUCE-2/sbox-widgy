import type { ValueResponseBody } from "../compute-value";
import type { ResolvedSteamValueQuery } from "../schema";
import { widgyLocaleFromCountry } from "./locale-money";

const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const HISTORY_RETENTION_MS = 72 * 60 * 60 * 1000;
const HISTORY_TTL_SEC = Math.ceil(HISTORY_RETENTION_MS / 1000);

type ValueSnapshot = {
  totalValue: number;
  fetchedAt: string;
};

type ValueHistory = {
  samples: ValueSnapshot[];
};

type TrendBody = Pick<ValueResponseBody, "totalValue" | "country" | "currency" | "fetchedAt">;

export type InventoryValueTrend = {
  direction: "up" | "down" | "flat" | "new";
  changePercentFormatted: string;
};

function historyKey(body: Pick<ValueResponseBody, "steamid" | "country" | "currency">) {
  return `inventory-value:v1:${body.steamid}:${body.country}:${body.currency}`;
}

function historyKeyFromQuery(q: ResolvedSteamValueQuery) {
  return `inventory-value:v1:${q.steamid}:${q.country}:${q.currency}`;
}

function parseHistory(raw: string | null): ValueHistory {
  if (!raw) return { samples: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<ValueHistory>;
    if (!Array.isArray(parsed.samples)) return { samples: [] };
    return {
      samples: parsed.samples.filter(
        (s): s is ValueSnapshot =>
          typeof s?.totalValue === "number" &&
          Number.isFinite(s.totalValue) &&
          typeof s.fetchedAt === "string" &&
          Number.isFinite(Date.parse(s.fetchedAt)),
      ),
    };
  } catch {
    return { samples: [] };
  }
}

function nearestBaseline(samples: ValueSnapshot[], targetMs: number) {
  return samples.reduce<ValueSnapshot | null>((best, sample) => {
    const sampleMs = Date.parse(sample.fetchedAt);
    if (!Number.isFinite(sampleMs) || sampleMs > targetMs) return best;
    if (!best) return sample;
    const bestDistance = Math.abs(Date.parse(best.fetchedAt) - targetMs);
    const sampleDistance = Math.abs(sampleMs - targetMs);
    return sampleDistance < bestDistance ? sample : best;
  }, null);
}

function trendFromBaseline(body: TrendBody, baseline: ValueSnapshot | null): InventoryValueTrend {
  if (!baseline || baseline.totalValue <= 0) {
    return {
      direction: "new",
      changePercentFormatted: "n/a",
    };
  }

  const changeValue = body.totalValue - baseline.totalValue;
  const changePercent = (changeValue / baseline.totalValue) * 100;
  const direction =
    Math.abs(changeValue) < 0.005 ? "flat" : changeValue > 0 ? "up" : "down";
  const sign = changeValue > 0 ? "+" : "";
  const changePercentFormatted = `${sign}${changePercent.toLocaleString(
    widgyLocaleFromCountry(body.country),
    {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    },
  )}%`;

  return {
    direction,
    changePercentFormatted,
  };
}

function nextHistorySamples(samples: ValueSnapshot[], body: ValueResponseBody) {
  const nowMs = Date.parse(body.fetchedAt);
  const cutoffMs = nowMs - HISTORY_RETENTION_MS;
  const current = {
    totalValue: body.totalValue,
    fetchedAt: body.fetchedAt,
  };

  return [...samples, current]
    .filter((sample) => Date.parse(sample.fetchedAt) >= cutoffMs)
    .sort((a, b) => Date.parse(a.fetchedAt) - Date.parse(b.fetchedAt))
    .slice(-96);
}

export async function recordInventoryValueSnapshot(
  kv: KVNamespace | undefined,
  body: ValueResponseBody,
): Promise<InventoryValueTrend> {
  if (!kv) {
    return trendFromBaseline(body, null);
  }

  const key = historyKey(body);
  const history = parseHistory(await kv.get(key));
  const nowMs = Date.parse(body.fetchedAt);
  const baseline = nearestBaseline(history.samples, nowMs - HISTORY_WINDOW_MS);
  const trend = trendFromBaseline(body, baseline);

  await kv.put(
    key,
    JSON.stringify({ samples: nextHistorySamples(history.samples, body) } satisfies ValueHistory),
    { expirationTtl: HISTORY_TTL_SEC },
  );

  return trend;
}
