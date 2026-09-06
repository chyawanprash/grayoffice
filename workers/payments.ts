/**
 * Inbound webhooks from the payment gateways, mounted at /api/payments.
 *
 *   POST /api/payments/webhook/:provider/:userId
 *
 * The per-user URL is shown on /dashboard/integrations/<provider>. Each event is
 * signature-verified against that user's stored webhook secret, then written to
 * `payment_events` for the dashboard to show.
 */
import { Hono } from "hono";
import {
	PROVIDER_IDS,
	getIntegration,
	verifyWebhook,
	type Provider,
} from "~/lib/payments.server";

type Env = { DB: D1Database };

export const paymentRoutes = new Hono<{ Bindings: Env }>();

paymentRoutes.post("/webhook/:provider/:userId", async (c) => {
	const provider = c.req.param("provider") as Provider;
	const userId = c.req.param("userId");
	if (!PROVIDER_IDS.includes(provider))
		return c.json({ error: "unknown provider" }, 404);

	const raw = await c.req.text();
	const integ = await getIntegration(c.env.DB, userId, provider);
	if (!integ?.webhook_secret)
		return c.json({ error: "webhook not configured" }, 404);

	const result = await verifyWebhook(
		provider,
		raw,
		c.req.raw.headers,
		integ.webhook_secret,
	);
	if (!result) return c.json({ error: "bad signature" }, 401);

	await c.env.DB.prepare(
		"INSERT INTO payment_events (id, user_id, provider, type, summary, payload) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind(
			crypto.randomUUID(),
			userId,
			provider,
			result.type,
			result.summary,
			raw.slice(0, 8000),
		)
		.run();

	return c.json({ received: true });
});
