import { z } from "zod";
import {
  STEAM_INVENTORY_APPID,
  STEAM_INVENTORY_CONTEXTID,
  currencyIdFromCountry,
} from "./steam/currency-from-country";

export const valueQuerySchema = z.object({
  steamid: z
    .string()
    .regex(/^\d{17}$/, "steamid must be a 17-digit SteamID64"),
  country: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "country must be ISO 3166-1 alpha-2")
    .default("US")
    .transform((s) => s.toUpperCase()),
});

export type ParsedValueQuery = z.infer<typeof valueQuerySchema>;

export type ResolvedSteamValueQuery = {
  steamid: string;
  country: string;
  appid: typeof STEAM_INVENTORY_APPID;
  contextid: typeof STEAM_INVENTORY_CONTEXTID;
  currency: number;
};

export function resolveSteamValueQuery(q: ParsedValueQuery): ResolvedSteamValueQuery {
  return {
    steamid: q.steamid,
    country: q.country,
    appid: STEAM_INVENTORY_APPID,
    contextid: STEAM_INVENTORY_CONTEXTID,
    currency: currencyIdFromCountry(q.country),
  };
}
