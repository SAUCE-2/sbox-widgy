/**
 * Steam Community Market `currency` parameter = ECurrency integer (Appendix A).
 * @see https://partner.steamgames.com/doc/store/pricing/currencies
 *
 * Store rule (same page): if Steam has no native currency for a country, customers
 * are charged in USD except in Europe where EUR is used. We mirror that after
 * explicit “has native wallet currency” mappings.
 */

/** Fixed s&box inventory routing (not exposed in URL). */
export const STEAM_INVENTORY_APPID = 590830;
export const STEAM_INVENTORY_CONTEXTID = 2;

const USD = 1;
const GBP = 2;
const EUR = 3;
const CHF = 4;
const RUB = 5;
const PLN = 6;
const BRL = 7;
const JPY = 8;
const NOK = 9;
const IDR = 10;
const MYR = 11;
const PHP = 12;
const SGD = 13;
const THB = 14;
const VND = 15;
const KRW = 16;
const TRY = 17;
const UAH = 18;
const MXN = 19;
const CAD = 20;
const AUD = 21;
const NZD = 22;
const CNY = 23;
const INR = 24;
const CLP = 25;
const PEN = 26;
const COP = 27;
const ZAR = 28;
const HKD = 29;
const TWD = 30;
const SAR = 31;
const AED = 32;
const SEK = 33;
const ARS = 34;
const ILS = 35;
const BYN = 36;
const KZT = 37;
const KWD = 38;
const QAR = 39;
const CRC = 40;
const UYU = 41;
const BGN = 42;
const CZK = 44;
const DKK = 45;
const HUF = 46;
const RON = 47;

/** Countries / territories with a native Steam wallet currency (Appendix A + ISO). */
const PRIMARY: Record<string, number> = {
  US: USD,
  CA: CAD,
  GB: GBP,
  GG: GBP,
  IM: GBP,
  JE: GBP,
  AX: EUR,
  AT: EUR,
  BE: EUR,
  CY: EUR,
  DE: EUR,
  EE: EUR,
  ES: EUR,
  FI: EUR,
  FR: EUR,
  GR: EUR,
  IE: EUR,
  IT: EUR,
  LT: EUR,
  LU: EUR,
  LV: EUR,
  MT: EUR,
  NL: EUR,
  PT: EUR,
  SK: EUR,
  SI: EUR,
  AD: EUR,
  MC: EUR,
  SM: EUR,
  VA: EUR,
  ME: EUR,
  /** Croatia uses EUR on Steam client today; HRK id kept by Steam for legacy APIs. */
  HR: EUR,
  FO: DKK,
  GL: DKK,
  SJ: NOK,
  GI: GBP,
  FK: GBP,
  CH: CHF,
  NO: NOK,
  SE: SEK,
  DK: DKK,
  PL: PLN,
  CZ: CZK,
  HU: HUF,
  RO: RON,
  BG: BGN,
  IS: EUR,
  LI: CHF,
  RU: RUB,
  UA: UAH,
  BY: BYN,
  KZ: KZT,
  TR: TRY,
  JP: JPY,
  KR: KRW,
  CN: CNY,
  TW: TWD,
  HK: HKD,
  MO: HKD,
  SG: SGD,
  MY: MYR,
  TH: THB,
  ID: IDR,
  PH: PHP,
  VN: VND,
  IN: INR,
  AU: AUD,
  NZ: NZD,
  ZA: ZAR,
  BR: BRL,
  MX: MXN,
  AR: ARS,
  CL: CLP,
  CO: COP,
  PE: PEN,
  UY: UYU,
  CR: CRC,
  IL: ILS,
  SA: SAR,
  AE: AED,
  KW: KWD,
  QA: QAR,
  PR: USD,
  VI: USD,
  GU: USD,
  AS: USD,
  MP: USD,
  UM: USD,
};

/** Steam “USD_CIS” discounted-USD region (no separate ECurrency). */
const USD_CIS = new Set([
  "AM",
  "AZ",
  "GE",
  "KG",
  "MD",
  "TJ",
  "TM",
  "UZ",
]);

/** Steam “USD_LATAM” where we do not map a dedicated ECurrency above. */
const USD_LATAM = new Set([
  "BZ",
  "SV",
  "GT",
  "HN",
  "NI",
  "BO",
  "EC",
  "GY",
  "PY",
  "SR",
  "VE",
  "PA",
]);

/** Steam “USD_MENA” (TRY / ILS etc. handled in PRIMARY). */
const USD_MENA = new Set([
  "BH",
  "EG",
  "IQ",
  "JO",
  "LB",
  "OM",
  "PS",
  "YE",
  "DZ",
  "LY",
  "MA",
  "TN",
  "SD",
]);

/** Steam “USD_SASIA”. */
const USD_SASIA = new Set(["BD", "BT", "NP", "PK", "LK"]);

/**
 * European countries without a dedicated ECurrency in Appendix A — Steam bills
 * EUR when no native wallet currency exists in that region.
 */
const EUROPE_EUR_FALLBACK = new Set(["AL", "BA", "MK", "RS", "XK"]);

/** ISO 3166-1 alpha-2 codes referenced by Steam wallet region logic (setup page dropdown). */
export const SETUP_PAGE_COUNTRY_CODES: readonly string[] = [
  ...new Set<string>([
    ...Object.keys(PRIMARY),
    ...USD_CIS,
    ...USD_LATAM,
    ...USD_MENA,
    ...USD_SASIA,
    ...EUROPE_EUR_FALLBACK,
  ]),
].sort((a, b) => a.localeCompare(b));

export function currencyIdFromCountry(countryAlpha2: string): number {
  const c = countryAlpha2.trim().toUpperCase();
  if (c.length !== 2) return USD;

  const p = PRIMARY[c];
  if (p !== undefined) return p;
  if (USD_CIS.has(c)) return USD;
  if (USD_LATAM.has(c)) return USD;
  if (USD_MENA.has(c)) return USD;
  if (USD_SASIA.has(c)) return USD;
  if (EUROPE_EUR_FALLBACK.has(c)) return EUR;
  return USD;
}
