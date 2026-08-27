import { formatMoney, isCurrency } from "./currency";

/** Format an amount whose currency code arrives as a plain string. */
export function formatMoneyRaw(amount: number, currency: string): string {
  return isCurrency(currency) ? formatMoney(amount, currency) : `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
}
