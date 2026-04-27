/**
 * Widgy `.widgy` files are **raw-deflate–compressed JSON** (zlib windowBits -15).
 * Layout is sourced from [`widgy-import-template.json`](./widgy-import-template.json).
 */

import { deflateRaw } from "pako";
import widgyImportTemplate from "./widgy-import-template.json";

export type BuildWidgyImportOpts = {
  /** Shown as the widget title in Widgy (`"3"`). */
  widgetName: string;
  /** Author / designer label (`"5"`). */
  author: string;
  /** GET URL returning flat JSON (`/widgy?steamid=…&country=…`). */
  widgyDataUrl: string;
  /** Worker origin, e.g. `https://steam-inventory-value.example.workers.dev` (no trailing slash). */
  workerOrigin: string;
};

function applyPlaceholders(
  value: unknown,
  widgyDataUrl: string,
  minusPngUrl: string,
): unknown {
  if (typeof value === "string") {
    if (value === "__WIDGY_DATA_URL__") return widgyDataUrl;
    if (value === "__MINUS_PNG_URL__") return minusPngUrl;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => applyPlaceholders(v, widgyDataUrl, minusPngUrl));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = applyPlaceholders(v, widgyDataUrl, minusPngUrl);
    }
    return out;
  }
  return value;
}

function buildWidgyObject(opts: BuildWidgyImportOpts): Record<string, unknown> {
  const origin = opts.workerOrigin.replace(/\/$/, "");
  const minusPngUrl = `${origin}/images/minus.png`;
  const base = applyPlaceholders(widgyImportTemplate, opts.widgyDataUrl, minusPngUrl) as Record<
    string,
    unknown
  >;
  base["3"] = opts.widgetName;
  base["5"] = opts.author;
  return base;
}

/** Binary `.widgy` payload for `Response` body. */
export function buildWidgyFileBytes(opts: BuildWidgyImportOpts): Uint8Array {
  const json = JSON.stringify(buildWidgyObject(opts));
  return deflateRaw(json, { level: 9 });
}
