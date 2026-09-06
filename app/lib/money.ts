/** Currency formatting — client-safe (no server imports). */
export const CURRENCIES = [
	"INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD", "JPY", "CHF",
] as const;
export type Currency = (typeof CURRENCIES)[number];

const LOCALE: Record<string, string> = { INR: "en-IN", GBP: "en-GB", EUR: "de-DE", JPY: "ja-JP" };

/** e.g. formatMoney(15000, "USD") -> "$15,000". */
export function formatMoney(amount: number, currency = "INR", maximumFractionDigits = 0): string {
	try {
		return new Intl.NumberFormat(LOCALE[currency] ?? "en-US", {
			style: "currency",
			currency,
			maximumFractionDigits,
			minimumFractionDigits: 0,
		}).format(amount || 0);
	} catch {
		return `${Math.round(amount || 0).toLocaleString()} ${currency}`;
	}
}
