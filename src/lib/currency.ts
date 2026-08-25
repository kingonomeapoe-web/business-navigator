export type CurrencyCode = "USD" | "GBP" | "NGN" | "EUR";

export const CURRENCIES: CurrencyCode[] = ["USD", "GBP", "NGN", "EUR"];

const SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  GBP: "£",
  NGN: "₦",
  EUR: "€",
};

const GBP_COUNTRIES = ["united kingdom", "uk", "england", "scotland", "wales", "northern ireland", "gb"];
const NGN_COUNTRIES = ["nigeria", "ng"];
const EUR_COUNTRIES = [
  "ireland",
  "germany",
  "france",
  "spain",
  "italy",
  "portugal",
  "netherlands",
  "belgium",
  "austria",
  "finland",
  "greece",
];

/** Choose the market currency from the country the visitor typed. */
export function currencyForCountry(country: string | null | undefined): CurrencyCode {
  const value = (country ?? "").trim().toLowerCase();
  if (!value) return "USD";
  if (GBP_COUNTRIES.some((c) => value === c || value.includes(c))) return "GBP";
  if (NGN_COUNTRIES.some((c) => value === c || value.includes(c))) return "NGN";
  if (EUR_COUNTRIES.some((c) => value.includes(c))) return "EUR";
  return "USD";
}

export function isCurrency(value: string): value is CurrencyCode {
  return (CURRENCIES as string[]).includes(value);
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const rounded = Math.round(amount);
  return `${SYMBOLS[currency]}${rounded.toLocaleString("en-US")}`;
}
