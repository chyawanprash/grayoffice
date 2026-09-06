/**
 * Inbound webhooks for the chat bot integrations, mounted at /api/bots.
 *
 *   POST /api/bots/:platform/:orgId      (platform = slack | telegram | discord)
 *
 * Each org connects its own Slack / Telegram / Discord app on
 * /dashboard/integrations. The platform delivers events here; we verify the
 * signature against that org's stored secret, normalise the payload, run it
 * through the AI pipeline (`handleInbound`), and reply on the same platform.
 */
import { Hono } from "hono";
import { handleInbound } from "./bot-router";
import {
	BOT_PLATFORMS,
	getBotIntegration,
	parseInbound,
	resultToText,
	sendReply,
	verifyInbound,
	type BotPlatform,
} from "~/lib/bots.server";

type Env = { AI: Ai; DB: D1Database };

export const botRoutes = new Hono<{ Bindings: Env }>();

botRoutes.post("/:platform/:orgId", async (c) => {
	const platform = c.req.param("platform") as BotPlatform;
	const orgId = c.req.param("orgId");
	if (!BOT_PLATFORMS.includes(platform)) return c.json({ error: "unknown platform" }, 404);

	const raw = await c.req.text();
	const integ = await getBotIntegration(c.env.DB, orgId, platform);
	if (!integ) return c.json({ error: "not connected" }, 404);

	// Slack URL verification handshake (sent before the signature matters).
	if (platform === "slack") {
		const probe = safeJson(raw);
		if (probe?.type === "url_verification") return c.json({ challenge: probe.challenge });
	}

	if (!(await verifyInbound(platform, raw, c.req.raw.headers, integ)))
		return c.json({ error: "bad signature" }, 401);

	const body = safeJson(raw);
	if (!body) return c.json({ error: "bad body" }, 400);

	// Discord PING → PONG.
	if (platform === "discord" && body.type === 1) return c.json({ type: 1 });

	const parsed = await parseInbound(platform, body, integ).catch(() => null);
	if (!parsed) return platform === "discord" ? c.json({ type: 5 }) : c.json({ ok: true });

	const run = (async () => {
		try {
			const result = await handleInbound(c.env, { source: platform, orgId, ...parsed.event });
			if (parsed.reply) await sendReply(integ, parsed.reply, resultToText(result.detail));
		} catch (err) {
			console.error(`bot ${platform}/${orgId} failed: ${err}`);
			if (parsed.reply) await sendReply(integ, parsed.reply, "Something went wrong handling that.").catch(() => {});
		}
	})();

	// Slack and Discord need an ack within 3s; do the slow work in the background.
	c.executionCtx.waitUntil(run);
	if (platform === "discord") return c.json({ type: 5 }); // deferred channel message
	if (platform === "slack") return c.json({ ok: true });
	await run; // Telegram tolerates a slow response and has no deferral concept
	return c.json({ ok: true });
});

function safeJson(s: string): any | null {
	try {
		return JSON.parse(s);
	} catch {
		return null;
	}
}
