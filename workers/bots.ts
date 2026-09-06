/**
 * Ingest + account-linking API for the external bots (Slack / Telegram / Discord
 * bot code lives in their own repos). A bot POSTs a normalized event here;
 * grayoffice does the AI routing, PDF->JSON conversion, and audit logging, then
 * returns the result.
 *
 *   POST /api/bots/ingest
 *   Authorization: Bearer <BOT_INGEST_TOKEN>
 *   { "source": "telegram", "externalUser": "12345",
 *     "text": "...", "files": [{ "name": "invoice.pdf", "url": "https://...", "mime": "application/pdf" }] }
 *
 * Responds 200 { id, route, status, detail } once processed. Runs synchronously:
 * a PDF conversion takes a few seconds; give the client a generous timeout.
 *
 * Account linking ("login") — so the backend knows which Gray Office user a
 * platform account belongs to:
 *
 *   POST /api/bots/link/start   { source, externalUser, displayName? }
 *       -> { code, url, expiresInSeconds }   (user types `code` at <url> while signed in)
 *   GET  /api/bots/link/status?source=&externalUser=
 *       -> { linked, email?, name?, linkedAt? }
 *   POST /api/bots/link/revoke  { source, externalUser }  -> { revoked }
 */
import { Hono } from "hono";
import { handleInbound, type Inbound } from "./bot-router";

type Env = {
	AI: Ai;
	DB: D1Database;
	APP_URL?: string;
	BOT_INGEST_TOKEN?: string;
};

const SOURCES = ["telegram", "slack", "discord"] as const;
type Source = (typeof SOURCES)[number];

const isSource = (v: unknown): v is Source =>
	typeof v === "string" && (SOURCES as readonly string[]).includes(v);

/** Codes people type by hand: no 0/O/1/I, grouped as XXX-XXX. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_SECONDS = 15 * 60;

function newLinkCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	const s = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
	return `${s.slice(0, 3)}-${s.slice(3)}`;
}

export const botRoutes = new Hono<{ Bindings: Env }>();

/** Shared bearer-token gate for every bot endpoint. */
botRoutes.use("*", async (c, next) => {
	const token = c.env.BOT_INGEST_TOKEN;
	if (token && c.req.header("authorization") !== `Bearer ${token}`)
		return c.json({ error: "unauthorized" }, 401);
	await next();
});

botRoutes.post("/ingest", async (c) => {
	const b = await c.req.json<Partial<Inbound>>().catch(() => null);
	if (!b || !isSource(b.source))
		return c.json({ error: "source must be telegram | slack | discord" }, 400);
	if (!b.text && !(b.files && b.files.length))
		return c.json({ error: "provide text or files" }, 400);

	const result = await handleInbound(c.env, {
		source: b.source,
		externalUser: b.externalUser ?? null,
		text: b.text ?? "",
		files: (b.files ?? []).map((f) => ({
			name: f.name ?? "file",
			url: f.url,
			mime: f.mime,
		})),
	});

	return c.json(result);
});

botRoutes.post("/link/start", async (c) => {
	const b = await c.req
		.json<{ source?: string; externalUser?: string; displayName?: string }>()
		.catch(() => null);
	if (!b || !isSource(b.source) || !b.externalUser)
		return c.json({ error: "source and externalUser are required" }, 400);

	// One pending code per (source, externalUser): drop any older one first.
	await c.env.DB.prepare(
		"DELETE FROM bot_link_codes WHERE source = ? AND external_user = ?",
	)
		.bind(b.source, b.externalUser)
		.run();

	let code = newLinkCode();
	for (let attempt = 0; attempt < 5; attempt++) {
		try {
			await c.env.DB.prepare(
				`INSERT INTO bot_link_codes (code, source, external_user, display_name, expires_at)
				 VALUES (?, ?, ?, ?, unixepoch() + ?)`,
			)
				.bind(code, b.source, b.externalUser, b.displayName ?? null, CODE_TTL_SECONDS)
				.run();
			break;
		} catch (err) {
			if (attempt === 4) throw err;
			code = newLinkCode(); // primary-key collision, retry
		}
	}

	const base = (c.env.APP_URL ?? "").replace(/\/$/, "");
	return c.json({
		code,
		url: `${base}/link`,
		expiresInSeconds: CODE_TTL_SECONDS,
	});
});

botRoutes.get("/link/status", async (c) => {
	const source = c.req.query("source");
	const externalUser = c.req.query("externalUser");
	if (!isSource(source) || !externalUser)
		return c.json({ error: "source and externalUser are required" }, 400);

	const row = await c.env.DB.prepare(
		`SELECT u.email AS email, u.name AS name, l.created_at AS created_at
		 FROM bot_links l JOIN users u ON u.id = l.user_id
		 WHERE l.source = ? AND l.external_user = ?`,
	)
		.bind(source, externalUser)
		.first<{ email: string; name: string | null; created_at: number }>();

	if (!row) return c.json({ linked: false });
	return c.json({
		linked: true,
		email: row.email,
		name: row.name,
		linkedAt: new Date(row.created_at * 1000).toISOString(),
	});
});

botRoutes.post("/link/revoke", async (c) => {
	const b = await c.req
		.json<{ source?: string; externalUser?: string }>()
		.catch(() => null);
	if (!b || !isSource(b.source) || !b.externalUser)
		return c.json({ error: "source and externalUser are required" }, 400);

	const res = await c.env.DB.prepare(
		"DELETE FROM bot_links WHERE source = ? AND external_user = ?",
	)
		.bind(b.source, b.externalUser)
		.run();
	await c.env.DB.prepare(
		"DELETE FROM bot_link_codes WHERE source = ? AND external_user = ?",
	)
		.bind(b.source, b.externalUser)
		.run();

	return c.json({ revoked: (res.meta.changes ?? 0) > 0 });
});
