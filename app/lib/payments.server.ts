/**
 * Payment gateway integrations: config CRUD, transaction fetch, and webhook
 * signature verification for Stripe, Razorpay, Cashfree, Polar and Dodo Payments.
 *
 * Each gateway exposes a REST API keyed by a secret the user pastes in on
 * /dashboard/integrations/<provider>. Transactions are fetched live (nothing is
 * cached); webhooks land at /api/payments/<provider>/webhook.
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

type Field = {
	key: "api_key" | "api_secret" | "organization_id";
	label: string;
	placeholder?: string;
	/** stored in the `extra` JSON blob rather than a column */
	extra?: boolean;
};

export type ProviderMeta = {
	id: Provider;
	name: string;
	blurb: string;
	docs: string;
	webhookDocs: string;
	/** what the "transactions" list actually shows for this gateway */
	txLabel: string;
	fields: Field[];
	webhookSecretLabel: string;
	/** how the webhook signature is checked */
	webhookScheme: "stripe" | "razorpay" | "cashfree" | "standard-webhooks";
	modes: Array<"test" | "live">;
};

export const PROVIDERS: Record<Provider, ProviderMeta> = {
	stripe: {
		id: "stripe",
		name: "Stripe",
		blurb: "Cards, wallets and bank debits. Pulls recent charges.",
		docs: "https://docs.stripe.com/api/charges/list",
		webhookDocs: "https://docs.stripe.com/webhooks",
		txLabel: "Charges",
		fields: [
			{ key: "api_key", label: "Secret key", placeholder: "sk_test_…" },
		],
		webhookSecretLabel: "Signing secret (whsec_…)",
		webhookScheme: "stripe",
		modes: ["test", "live"],
	},
	razorpay: {
		id: "razorpay",
		name: "Razorpay",
		blurb: "India-first payments. Pulls recent payments.",
		docs: "https://razorpay.com/docs/api/payments/fetch-all-payments/",
		webhookDocs: "https://razorpay.com/docs/webhooks/validate-test/",
		txLabel: "Payments",
		fields: [
			{ key: "api_key", label: "Key ID", placeholder: "rzp_test_…" },
			{ key: "api_secret", label: "Key secret" },
		],
		webhookSecretLabel: "Webhook secret",
		webhookScheme: "razorpay",
		modes: ["test", "live"],
	},
	cashfree: {
		id: "cashfree",
		name: "Cashfree Payments",
		blurb: "India payments & payouts. Pulls settlements (money received).",
		docs: "https://www.cashfree.com/docs/api-reference/payments/latest/settlement-reconciliation/get-all-settlements",
		webhookDocs:
			"https://www.cashfree.com/docs/payments/online/webhooks/overview",
		txLabel: "Settlements",
		fields: [
			{ key: "api_key", label: "Client ID (x-client-id)" },
			{ key: "api_secret", label: "Client secret (x-client-secret)" },
		],
		webhookSecretLabel: "Client secret (used to sign webhooks)",
		webhookScheme: "cashfree",
		modes: ["test", "live"],
	},
	polar: {
		id: "polar",
		name: "Polar",
		blurb: "Merchant of Record for software. Pulls recent orders.",
		docs: "https://docs.polar.sh/api-reference/orders/list",
		webhookDocs: "https://docs.polar.sh/integrate/webhooks/endpoints",
		txLabel: "Orders",
		fields: [
			{ key: "api_key", label: "Organization access token", placeholder: "polar_oat_…" },
			{
				key: "organization_id",
				label: "Organization ID",
				placeholder: "optional",
				extra: true,
			},
		],
		webhookSecretLabel: "Webhook secret",
		webhookScheme: "standard-webhooks",
		modes: ["test", "live"],
	},
	dodopayments: {
		id: "dodopayments",
		name: "Dodo Payments",
		blurb: "Merchant of Record for global digital sales. Pulls recent payments.",
		docs: "https://docs.dodopayments.com/api-reference/payments/get-payments",
		webhookDocs: "https://docs.dodopayments.com/developer-resources/webhooks",
		txLabel: "Payments",
		fields: [{ key: "api_key", label: "API key" }],
		webhookSecretLabel: "Webhook signing key",
		webhookScheme: "standard-webhooks",
		modes: ["test", "live"],
	},
};

// ── DB ─────────────────────────────────────────────────────────────────────

export type Integration = {
	provider: Provider;
	mode: "test" | "live";
	api_key: string | null;
	api_secret: string | null;
	webhook_secret: string | null;
	extra: Record<string, string>;
	connected_at: number | null;
};

type Row = Omit<Integration, "extra"> & { extra: string | null };

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
	return { ...r, extra };
}

export async function saveIntegration(
	db: D1Database,
	userId: string,
	provider: Provider,
	input: {
		mode: "test" | "live";
		api_key?: string;
		api_secret?: string;
		webhook_secret?: string;
		extra?: Record<string, string>;
	},
): Promise<void> {
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
			JSON.stringify(input.extra ?? {}),
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

// ── Transaction fetch ──────────────────────────────────────────────────────

export type Transaction = {
	id: string;
	amount: number | null;
	currency: string;
	status: string;
	customer: string | null;
	description: string | null;
	createdAt: number | null; // unix seconds
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v)) || 0;
const secs = (v: unknown) => {
	if (typeof v === "number") return v > 1e12 ? Math.floor(v / 1000) : v;
	const t = Date.parse(String(v));
	return Number.isNaN(t) ? null : Math.floor(t / 1000);
};

export async function fetchTransactions(
	i: Integration,
): Promise<{ transactions: Transaction[] } | { error: string }> {
	try {
		switch (i.provider) {
			case "stripe":
				return { transactions: await stripeTx(i) };
			case "razorpay":
				return { transactions: await razorpayTx(i) };
			case "cashfree":
				return { transactions: await cashfreeTx(i) };
			case "polar":
				return { transactions: await polarTx(i) };
			case "dodopayments":
				return { transactions: await dodoTx(i) };
		}
	} catch (err) {
		return { error: err instanceof Error ? err.message : String(err) };
	}
}

async function json(res: Response): Promise<any> {
	const body = await res.text();
	let parsed: any;
	try {
		parsed = JSON.parse(body);
	} catch {
		parsed = null;
	}
	if (!res.ok) {
		const msg =
			parsed?.error?.message ||
			parsed?.message ||
			parsed?.error ||
			body.slice(0, 200);
		throw new Error(`${res.status}: ${msg}`);
	}
	return parsed;
}

async function stripeTx(i: Integration): Promise<Transaction[]> {
	const j = await json(
		await fetch("https://api.stripe.com/v1/charges?limit=25", {
			headers: { authorization: `Bearer ${i.api_key}` },
		}),
	);
	return (j.data ?? []).map((c: any) => ({
		id: c.id,
		amount: num(c.amount) / 100,
		currency: String(c.currency ?? "usd").toUpperCase(),
		status: c.status,
		customer: c.billing_details?.email ?? c.receipt_email ?? c.customer ?? null,
		description: c.description ?? null,
		createdAt: secs(c.created),
	}));
}

async function razorpayTx(i: Integration): Promise<Transaction[]> {
	const auth = btoa(`${i.api_key}:${i.api_secret}`);
	const j = await json(
		await fetch("https://api.razorpay.com/v1/payments?count=25", {
			headers: { authorization: `Basic ${auth}` },
		}),
	);
	return (j.items ?? []).map((p: any) => ({
		id: p.id,
		amount: num(p.amount) / 100,
		currency: p.currency ?? "INR",
		status: p.status,
		customer: p.email ?? p.contact ?? null,
		description: p.description ?? p.method ?? null,
		createdAt: secs(p.created_at),
	}));
}

async function cashfreeTx(i: Integration): Promise<Transaction[]> {
	const base =
		i.mode === "live"
			? "https://api.cashfree.com/pg"
			: "https://sandbox.cashfree.com/pg";
	const j = await json(
		await fetch(`${base}/settlements`, {
			method: "POST",
			headers: {
				"x-client-id": i.api_key ?? "",
				"x-client-secret": i.api_secret ?? "",
				"x-api-version": "2025-01-01",
				"content-type": "application/json",
			},
			body: JSON.stringify({ pagination: { limit: 25 } }),
		}),
	);
	const items = j.data ?? j.settlements ?? [];
	return items.map((s: any) => ({
		id: String(s.cf_settlement_id ?? s.settlement_id ?? s.transfer_id ?? ""),
		amount: num(s.amount_settled ?? s.settlement_amount ?? s.transfer_amount),
		currency: "INR",
		status: s.status ?? s.settlement_status ?? s.transfer_status ?? "unknown",
		customer: s.settlement_utr ?? s.utr ?? null,
		description: "Settlement",
		createdAt: secs(s.settlement_date ?? s.transfer_time ?? s.created_at),
	}));
}

async function polarTx(i: Integration): Promise<Transaction[]> {
	const base =
		i.mode === "live" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";
	const url = new URL(`${base}/v1/orders`);
	url.searchParams.set("limit", "25");
	if (i.extra.organization_id)
		url.searchParams.set("organization_id", i.extra.organization_id);
	const j = await json(
		await fetch(url, { headers: { authorization: `Bearer ${i.api_key}` } }),
	);
	return (j.items ?? []).map((o: any) => ({
		id: o.id,
		amount: num(o.amount ?? o.total_amount ?? o.net_amount) / 100,
		currency: String(o.currency ?? "usd").toUpperCase(),
		status: o.status ?? (o.paid ? "paid" : "pending"),
		customer: o.customer?.email ?? o.user?.email ?? null,
		description: o.product?.name ?? o.product_id ?? null,
		createdAt: secs(o.created_at),
	}));
}

async function dodoTx(i: Integration): Promise<Transaction[]> {
	const base =
		i.mode === "live"
			? "https://live.dodopayments.com"
			: "https://test.dodopayments.com";
	const j = await json(
		await fetch(`${base}/payments?page_size=25`, {
			headers: { authorization: `Bearer ${i.api_key}` },
		}),
	);
	const items = j.items ?? j.data ?? [];
	return items.map((p: any) => ({
		id: p.payment_id ?? p.id,
		amount: num(p.total_amount ?? p.amount ?? p.settlement_amount) / 100,
		currency: p.currency ?? p.settlement_currency ?? "USD",
		status: p.status,
		customer: p.customer?.email ?? p.customer?.customer_id ?? null,
		description:
			p.product_cart?.[0]?.product_id ?? p.payment_method ?? null,
		createdAt: secs(p.created_at),
	}));
}

// ── Webhook verification ───────────────────────────────────────────────────

const enc = new TextEncoder();

async function hmac(
	keyData: BufferSource,
	msg: string,
): Promise<ArrayBuffer> {
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

/**
 * Verify a webhook and return its event type + a one-line summary, or null if
 * the signature does not check out.
 */
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
	const type: string =
		body.type || body.event || body.event_type || "event";
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
	const scheme = PROVIDERS[provider].webhookScheme;
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
