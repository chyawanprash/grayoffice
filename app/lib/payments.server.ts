/**
 * Payment gateway integrations: config CRUD, a map of every list/read API each
 * gateway exposes, live data fetch, and webhook signature verification for
 * Stripe, Razorpay, Cashfree, Polar and Dodo Payments.
 *
 * The user connects a gateway on /dashboard/integrations/<provider>, picks which
 * resources to pull (see `PROVIDER_APIS[provider].resources`), and the app
 * fetches them live. Webhooks land at /api/payments/webhook/<provider>/<userId>.
 */

export type Provider =
	| "stripe"
	| "razorpay"
	| "cashfree"
	| "polar"
	| "dodopayments";

export const PROVIDER_IDS: Provider[] = [
	"stripe",
	"razorpay",
	"cashfree",
	"polar",
	"dodopayments",
];

type Mode = "test" | "live";

type Field = {
	key: "api_key" | "api_secret" | "organization_id";
	label: string;
	placeholder?: string;
	/** stored in the `extra` JSON blob rather than a column */
	extra?: boolean;
};

/** One list/read endpoint of a gateway that a user can choose to pull. */
export type ResourceDef = {
	key: string;
	label: string;
	/** relative to the provider base URL */
	path: string;
	method?: "GET" | "POST";
	/** query params merged onto the request (values may reference the integration) */
	query?: Record<string, string>;
	/** JSON body for POST resources */
	body?: unknown;
	/** default pulls `data` then `items`; override for odd envelopes */
	list?: string;
};

export type ProviderMeta = {
	id: Provider;
	name: string;
	blurb: string;
	docs: string;
	webhookDocs: string;
	fields: Field[];
	webhookSecretLabel: string;
	webhookScheme: "stripe" | "razorpay" | "cashfree" | "standard-webhooks";
	modes: Mode[];
	/** base API URL by mode */
	base: (mode: Mode) => string;
	/** minor-unit divisor for amount fields (Stripe/Razorpay/Polar/Dodo = 100) */
	amountDivisor: number;
	resources: ResourceDef[];
};

// ── The API map ────────────────────────────────────────────────────────────

const LIMIT = "25";

export const PROVIDER_APIS: Record<Provider, ProviderMeta> = {
	stripe: {
		id: "stripe",
		name: "Stripe",
		blurb: "Cards, wallets and bank debits.",
		docs: "https://docs.stripe.com/api",
		webhookDocs: "https://docs.stripe.com/webhooks",
		fields: [{ key: "api_key", label: "Secret key", placeholder: "sk_test_…" }],
		webhookSecretLabel: "Signing secret (whsec_…)",
		webhookScheme: "stripe",
		modes: ["test", "live"],
		base: () => "https://api.stripe.com/v1",
		amountDivisor: 100,
		resources: [
			{ key: "charges", label: "Charges", path: "/charges", query: { limit: LIMIT } },
			{ key: "payment_intents", label: "Payment intents", path: "/payment_intents", query: { limit: LIMIT } },
			{ key: "checkout_sessions", label: "Checkout sessions", path: "/checkout/sessions", query: { limit: LIMIT } },
			{ key: "refunds", label: "Refunds", path: "/refunds", query: { limit: LIMIT } },
			{ key: "payouts", label: "Payouts", path: "/payouts", query: { limit: LIMIT } },
			{ key: "balance_transactions", label: "Balance transactions", path: "/balance_transactions", query: { limit: LIMIT } },
			{ key: "disputes", label: "Disputes", path: "/disputes", query: { limit: LIMIT } },
			{ key: "invoices", label: "Invoices", path: "/invoices", query: { limit: LIMIT } },
			{ key: "subscriptions", label: "Subscriptions", path: "/subscriptions", query: { limit: LIMIT } },
			{ key: "customers", label: "Customers", path: "/customers", query: { limit: LIMIT } },
			{ key: "products", label: "Products", path: "/products", query: { limit: LIMIT } },
		],
	},
	razorpay: {
		id: "razorpay",
		name: "Razorpay",
		blurb: "India-first payments and payouts.",
		docs: "https://razorpay.com/docs/api/",
		webhookDocs: "https://razorpay.com/docs/webhooks/validate-test/",
		fields: [
			{ key: "api_key", label: "Key ID", placeholder: "rzp_test_…" },
			{ key: "api_secret", label: "Key secret" },
		],
		webhookSecretLabel: "Webhook secret",
		webhookScheme: "razorpay",
		modes: ["test", "live"],
		base: () => "https://api.razorpay.com/v1",
		amountDivisor: 100,
		resources: [
			{ key: "payments", label: "Payments", path: "/payments", query: { count: LIMIT }, list: "items" },
			{ key: "orders", label: "Orders", path: "/orders", query: { count: LIMIT }, list: "items" },
			{ key: "refunds", label: "Refunds", path: "/refunds", query: { count: LIMIT }, list: "items" },
			{ key: "settlements", label: "Settlements", path: "/settlements", query: { count: LIMIT }, list: "items" },
			{ key: "payment_links", label: "Payment links", path: "/payment_links", list: "payment_links" },
			{ key: "invoices", label: "Invoices", path: "/invoices", query: { count: LIMIT }, list: "items" },
			{ key: "subscriptions", label: "Subscriptions", path: "/subscriptions", query: { count: LIMIT }, list: "items" },
			{ key: "customers", label: "Customers", path: "/customers", query: { count: LIMIT }, list: "items" },
			{ key: "disputes", label: "Disputes", path: "/disputes", list: "items" },
			{ key: "transfers", label: "Transfers", path: "/transfers", query: { count: LIMIT }, list: "items" },
		],
	},
	cashfree: {
		id: "cashfree",
		name: "Cashfree Payments",
		blurb: "India payments, settlements and payouts.",
		docs: "https://www.cashfree.com/docs/api-reference/payments/latest/",
		webhookDocs: "https://www.cashfree.com/docs/payments/online/webhooks/overview",
		fields: [
			{ key: "api_key", label: "Client ID (x-client-id)" },
			{ key: "api_secret", label: "Client secret (x-client-secret)" },
		],
		webhookSecretLabel: "Client secret (used to sign webhooks)",
		webhookScheme: "cashfree",
		modes: ["test", "live"],
		base: (m) =>
			m === "live"
				? "https://api.cashfree.com/pg"
				: "https://sandbox.cashfree.com/pg",
		amountDivisor: 1,
		resources: [
			{ key: "settlements", label: "Settlements", path: "/settlements", method: "POST", body: { pagination: { limit: 25 } }, list: "data" },
			{ key: "settlement_recon", label: "Settlement reconciliation", path: "/settlement/recon", method: "POST", body: { pagination: { limit: 25 } }, list: "data" },
			{ key: "disputes", label: "Disputes", path: "/disputes", list: "data" },
		],
	},
	polar: {
		id: "polar",
		name: "Polar",
		blurb: "Merchant of Record for software businesses.",
		docs: "https://docs.polar.sh/api-reference",
		webhookDocs: "https://docs.polar.sh/integrate/webhooks/endpoints",
		fields: [
			{ key: "api_key", label: "Organization access token", placeholder: "polar_oat_…" },
			{ key: "organization_id", label: "Organization ID", placeholder: "optional", extra: true },
		],
		webhookSecretLabel: "Webhook secret",
		webhookScheme: "standard-webhooks",
		modes: ["test", "live"],
		base: (m) =>
			m === "live" ? "https://api.polar.sh/v1" : "https://sandbox-api.polar.sh/v1",
		amountDivisor: 100,
		resources: [
			{ key: "orders", label: "Orders", path: "/orders", query: { limit: LIMIT }, list: "items" },
			{ key: "payments", label: "Payments", path: "/payments", query: { limit: LIMIT }, list: "items" },
			{ key: "refunds", label: "Refunds", path: "/refunds", query: { limit: LIMIT }, list: "items" },
			{ key: "subscriptions", label: "Subscriptions", path: "/subscriptions", query: { limit: LIMIT }, list: "items" },
			{ key: "checkouts", label: "Checkouts", path: "/checkouts", query: { limit: LIMIT }, list: "items" },
			{ key: "customers", label: "Customers", path: "/customers", query: { limit: LIMIT }, list: "items" },
			{ key: "products", label: "Products", path: "/products", query: { limit: LIMIT }, list: "items" },
			{ key: "benefits", label: "Benefits", path: "/benefits", query: { limit: LIMIT }, list: "items" },
			{ key: "discounts", label: "Discounts", path: "/discounts", query: { limit: LIMIT }, list: "items" },
		],
	},
	dodopayments: {
		id: "dodopayments",
		name: "Dodo Payments",
		blurb: "Merchant of Record for global digital sales.",
		docs: "https://docs.dodopayments.com/api-reference/introduction",
		webhookDocs: "https://docs.dodopayments.com/developer-resources/webhooks",
		fields: [{ key: "api_key", label: "API key" }],
		webhookSecretLabel: "Webhook signing key",
		webhookScheme: "standard-webhooks",
		modes: ["test", "live"],
		base: (m) =>
			m === "live"
				? "https://live.dodopayments.com"
				: "https://test.dodopayments.com",
		amountDivisor: 100,
		resources: [
			{ key: "payments", label: "Payments", path: "/payments", query: { page_size: LIMIT }, list: "items" },
			{ key: "subscriptions", label: "Subscriptions", path: "/subscriptions", query: { page_size: LIMIT }, list: "items" },
			{ key: "refunds", label: "Refunds", path: "/refunds", query: { page_size: LIMIT }, list: "items" },
			{ key: "disputes", label: "Disputes", path: "/disputes", query: { page_size: LIMIT }, list: "items" },
			{ key: "payouts", label: "Payouts", path: "/payouts", query: { page_size: LIMIT }, list: "items" },
			{ key: "customers", label: "Customers", path: "/customers", query: { page_size: LIMIT }, list: "items" },
			{ key: "products", label: "Products", path: "/products", query: { page_size: LIMIT }, list: "items" },
			{ key: "licenses", label: "License keys", path: "/license_keys", query: { page_size: LIMIT }, list: "items" },
			{ key: "discounts", label: "Discounts", path: "/discounts", query: { page_size: LIMIT }, list: "items" },
		],
	},
};

/** Back-compat alias — some pages import PROVIDERS. */
export const PROVIDERS = PROVIDER_APIS;

export function resourceDef(provider: Provider, key: string): ResourceDef | undefined {
	return PROVIDER_APIS[provider].resources.find((r) => r.key === key);
}

// ── DB ─────────────────────────────────────────────────────────────────────

export type Integration = {
	provider: Provider;
	mode: Mode;
	api_key: string | null;
	api_secret: string | null;
	webhook_secret: string | null;
	extra: Record<string, string>;
	/** resource keys the user chose to pull */
	resources: string[];
	connected_at: number | null;
};

type Row = {
	provider: Provider;
	mode: Mode;
	api_key: string | null;
	api_secret: string | null;
	webhook_secret: string | null;
	extra: string | null;
	connected_at: number | null;
};

export async function listIntegrations(
	db: D1Database,
	userId: string,
): Promise<Record<string, Integration>> {
	const { results } = await db
		.prepare("SELECT * FROM payment_integrations WHERE user_id = ?")
		.bind(userId)
		.all<Row>();
	const out: Record<string, Integration> = {};
	for (const r of results ?? []) out[r.provider] = hydrate(r);
	return out;
}

export async function getIntegration(
	db: D1Database,
	userId: string,
	provider: Provider,
): Promise<Integration | null> {
	const r = await db
		.prepare(
			"SELECT * FROM payment_integrations WHERE user_id = ? AND provider = ?",
		)
		.bind(userId, provider)
		.first<Row>();
	return r ? hydrate(r) : null;
}

function hydrate(r: Row): Integration {
	let extra: Record<string, string> = {};
	try {
		extra = r.extra ? JSON.parse(r.extra) : {};
	} catch {
		/* ignore */
	}
	const resources = (extra.resources ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return {
		provider: r.provider,
		mode: r.mode,
		api_key: r.api_key,
		api_secret: r.api_secret,
		webhook_secret: r.webhook_secret,
		extra,
		resources,
		connected_at: r.connected_at,
	};
}

export async function saveIntegration(
	db: D1Database,
	userId: string,
	provider: Provider,
	input: {
		mode: Mode;
		api_key?: string;
		api_secret?: string;
		webhook_secret?: string;
		extra?: Record<string, string>;
		resources?: string[];
	},
): Promise<void> {
	const extra = { ...(input.extra ?? {}) };
	if (input.resources) extra.resources = input.resources.join(",");

	await db
		.prepare(
			`INSERT INTO payment_integrations
			   (user_id, provider, mode, api_key, api_secret, webhook_secret, extra, connected_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
			 ON CONFLICT(user_id, provider) DO UPDATE SET
			   mode = excluded.mode,
			   api_key = COALESCE(excluded.api_key, payment_integrations.api_key),
			   api_secret = COALESCE(excluded.api_secret, payment_integrations.api_secret),
			   webhook_secret = COALESCE(excluded.webhook_secret, payment_integrations.webhook_secret),
			   extra = excluded.extra,
			   updated_at = unixepoch()`,
		)
		.bind(
			userId,
			provider,
			input.mode,
			input.api_key || null,
			input.api_secret || null,
			input.webhook_secret || null,
			JSON.stringify(extra),
		)
		.run();
}

export async function deleteIntegration(
	db: D1Database,
	userId: string,
	provider: Provider,
): Promise<void> {
	await db
		.prepare(
			"DELETE FROM payment_integrations WHERE user_id = ? AND provider = ?",
		)
		.bind(userId, provider)
		.run();
}

export async function recentEvents(
	db: D1Database,
	userId: string,
	provider: Provider,
	limit = 10,
): Promise<
	Array<{ id: string; type: string | null; summary: string | null; created_at: number }>
> {
	const { results } = await db
		.prepare(
			"SELECT id, type, summary, created_at FROM payment_events WHERE user_id = ? AND provider = ? ORDER BY created_at DESC LIMIT ?",
		)
		.bind(userId, provider, limit)
		.all<{ id: string; type: string | null; summary: string | null; created_at: number }>();
	return results ?? [];
}

// ── Data fetch ─────────────────────────────────────────────────────────────

export type Record_ = {
	id: string;
	detail: string;
	status: string | null;
	when: number | null; // unix seconds
};

function authHeaders(i: Integration): globalThis.Record<string, string> {
	switch (i.provider) {
		case "stripe":
			return { authorization: `Bearer ${i.api_key}` };
		case "razorpay":
			return {
				authorization: `Basic ${btoa(`${i.api_key}:${i.api_secret}`)}`,
			};
		case "cashfree":
			return {
				"x-client-id": i.api_key ?? "",
				"x-client-secret": i.api_secret ?? "",
				"x-api-version": "2025-01-01",
				accept: "application/json",
			};
		case "polar":
		case "dodopayments":
			return { authorization: `Bearer ${i.api_key}` };
	}
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v)) || 0;
const secs = (v: unknown): number | null => {
	if (v == null) return null;
	if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : v;
	const t = Date.parse(String(v));
	return Number.isNaN(t) ? null : Math.floor(t / 1000);
};

const AMOUNT_KEYS = [
	"amount",
	"total_amount",
	"amount_paid",
	"amount_due",
	"amount_settled",
	"settlement_amount",
	"net_amount",
	"transfer_amount",
	"order_amount",
];
const WHEN_KEYS = ["created", "created_at", "created_time", "date", "settlement_date", "start_at"];
const WHO_KEYS = ["email", "customer_email", "contact", "name", "title", "description", "settlement_utr", "utr"];

function normalizeRecord(rec: any, divisor: number): Record_ {
	const id = String(
		rec.id ??
			rec.payment_id ??
			rec.order_id ??
			rec.subscription_id ??
			rec.refund_id ??
			rec.cf_settlement_id ??
			rec.settlement_id ??
			rec.dispute_id ??
			rec.short_url ??
			"",
	);

	let money: string | null = null;
	for (const k of AMOUNT_KEYS) {
		if (typeof rec[k] === "number" || (rec[k] && !Number.isNaN(Number(rec[k])))) {
			const cur = String(
				rec.currency ?? rec.settlement_currency ?? rec.order_currency ?? "",
			).toUpperCase();
			const val = num(rec[k]) / divisor;
			money = cur ? `${val} ${cur}` : String(val);
			break;
		}
	}

	let who: string | null = null;
	const c = rec.customer ?? rec.user ?? {};
	who =
		(typeof c === "object" ? c.email ?? c.name ?? c.customer_id : c) ?? null;
	if (!who) for (const k of WHO_KEYS) if (rec[k]) { who = String(rec[k]); break; }

	let when: number | null = null;
	for (const k of WHEN_KEYS) if (rec[k] != null) { when = secs(rec[k]); if (when) break; }

	const detail = [money, who].filter(Boolean).join(" · ") || id || "record";
	return {
		id,
		detail,
		status: rec.status ?? rec.state ?? rec.settlement_status ?? null,
		when,
	};
}

export async function fetchResource(
	i: Integration,
	resourceKey: string,
): Promise<{ records: Record_[] } | { error: string }> {
	const meta = PROVIDER_APIS[i.provider];
	const def = meta.resources.find((r) => r.key === resourceKey);
	if (!def) return { error: `Unknown resource "${resourceKey}"` };

	try {
		const url = new URL(meta.base(i.mode) + def.path);
		for (const [k, v] of Object.entries(def.query ?? {})) url.searchParams.set(k, v);
		if (i.provider === "polar" && i.extra.organization_id)
			url.searchParams.set("organization_id", i.extra.organization_id);

		const method = def.method ?? "GET";
		const headers = authHeaders(i);
		let body: string | undefined;
		if (method === "POST" && def.body) {
			headers["content-type"] = "application/json";
			body = JSON.stringify(def.body);
		}

		const res = await fetch(url, { method, headers, body });
		const text = await res.text();
		let json: any = null;
		try {
			json = JSON.parse(text);
		} catch {
			/* ignore */
		}
		if (!res.ok) {
			const msg =
				json?.error?.message ||
				json?.message ||
				json?.error?.description ||
				json?.error ||
				text.slice(0, 200);
			throw new Error(`${res.status}: ${msg}`);
		}

		const arr: any[] =
			(def.list && json?.[def.list]) ??
			json?.data ??
			json?.items ??
			(Array.isArray(json) ? json : []);
		return { records: arr.slice(0, 25).map((r) => normalizeRecord(r, meta.amountDivisor)) };
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
}

// ── Webhook verification ───────────────────────────────────────────────────

const enc = new TextEncoder();

async function hmac(keyData: BufferSource, msg: string): Promise<ArrayBuffer> {
	const key = await crypto.subtle.importKey(
		"raw",
		keyData,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return crypto.subtle.sign("HMAC", key, enc.encode(msg));
}
const hex = (b: ArrayBuffer) =>
	[...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const b64 = (b: ArrayBuffer) =>
	btoa(String.fromCharCode(...new Uint8Array(b)));

function safeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let d = 0;
	for (let k = 0; k < a.length; k++) d |= a.charCodeAt(k) ^ b.charCodeAt(k);
	return d === 0;
}

export async function verifyWebhook(
	provider: Provider,
	rawBody: string,
	headers: Headers,
	secret: string,
): Promise<{ type: string; summary: string } | null> {
	const ok = await checkSignature(provider, rawBody, headers, secret);
	if (!ok) return null;

	let body: any = {};
	try {
		body = JSON.parse(rawBody);
	} catch {
		/* keep {} */
	}
	const type: string = body.type || body.event || body.event_type || "event";
	const data = body.data?.object ?? body.data ?? body.payload ?? body;
	const amount = data.amount ?? data.total_amount ?? data.order_amount;
	const summary = amount
		? `${type} · ${amount}${data.currency ? " " + String(data.currency).toUpperCase() : ""}`
		: type;
	return { type, summary };
}

async function checkSignature(
	provider: Provider,
	rawBody: string,
	headers: Headers,
	secret: string,
): Promise<boolean> {
	const scheme = PROVIDER_APIS[provider].webhookScheme;
	try {
		if (scheme === "stripe") {
			const header = headers.get("stripe-signature") ?? "";
			const parts = Object.fromEntries(
				header.split(",").map((p) => p.split("=") as [string, string]),
			);
			if (!parts.t || !parts.v1) return false;
			const expected = hex(await hmac(enc.encode(secret), `${parts.t}.${rawBody}`));
			return safeEqual(expected, parts.v1);
		}

		if (scheme === "razorpay") {
			const sig = headers.get("x-razorpay-signature") ?? "";
			const expected = hex(await hmac(enc.encode(secret), rawBody));
			return safeEqual(expected, sig);
		}

		if (scheme === "cashfree") {
			const sig = headers.get("x-webhook-signature") ?? "";
			const ts = headers.get("x-webhook-timestamp") ?? "";
			const expected = b64(await hmac(enc.encode(secret), `${ts}${rawBody}`));
			return safeEqual(expected, sig);
		}

		// standard-webhooks (Polar, Dodo Payments)
		const id = headers.get("webhook-id") ?? "";
		const ts = headers.get("webhook-timestamp") ?? "";
		const sigHeader = headers.get("webhook-signature") ?? "";
		const signed = `${id}.${ts}.${rawBody}`;
		const expected = b64(await hmac(enc.encode(secret), signed));
		return sigHeader
			.split(" ")
			.map((s) => s.split(",")[1] ?? s)
			.some((s) => safeEqual(s, expected));
	} catch {
		return false;
	}
}
