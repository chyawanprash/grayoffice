/**
 * Ingest API for the external bots (Slack / Telegram / Discord bot code lives in
 * their own repos). A bot POSTs a normalized event here; grayoffice does the AI
 * routing, PDF->JSON conversion, and audit logging, then returns the result.
 *
 *   POST /api/bots/ingest
 *   Authorization: Bearer <BOT_INGEST_TOKEN>
 *   { "source": "telegram", "externalUser": "@ada",
 *     "text": "...", "files": [{ "name": "invoice.pdf", "url": "https://...", "mime": "application/pdf" }] }
 *
 * Responds 200 { id, route, status, detail } once processed. Runs synchronously:
 * a PDF conversion takes a few seconds; give the client a generous timeout.
 */
import { Hono } from "hono";
import { handleInbound, type Inbound } from "./bot-router";

type Env = {
	AI: Ai;
	DB: D1Database;
	BOT_INGEST_TOKEN?: string;
};

export const botRoutes = new Hono<{ Bindings: Env }>();

botRoutes.post("/ingest", async (c) => {
	const token = c.env.BOT_INGEST_TOKEN;
	if (token && c.req.header("authorization") !== `Bearer ${token}`)
		return c.json({ error: "unauthorized" }, 401);

	const b = await c.req.json<Partial<Inbound>>().catch(() => null);
	if (!b || !b.source || !["telegram", "slack", "discord"].includes(b.source))
		return c.json({ error: "source must be telegram | slack | discord" }, 400);
	if (!b.text && !(b.files && b.files.length))
		return c.json({ error: "provide text or files" }, 400);

	const result = await handleInbound(c.env, {
		source: b.source,
		externalUser: b.externalUser ?? null,
		text: b.text ?? "",
		files: (b.files ?? []).map((f) => {
			// A file may arrive as a platform URL or as inline base64 bytes
			// (Slack / Telegram file URLs need auth, so bytes are more reliable).
			const raw = (f as { dataB64?: string }).dataB64;
			let blob: Blob | undefined;
			if (raw) {
				const bin = atob(raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw);
				const bytes = new Uint8Array(bin.length);
				for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
				blob = new Blob([bytes], { type: f.mime ?? "application/pdf" });
			}
			return { name: f.name ?? "file", url: f.url, mime: f.mime, blob };
		}),
	});

	return c.json(result);
});
