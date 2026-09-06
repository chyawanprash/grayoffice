/**
 * Compatibility endpoints for the standalone chat bots that live in their own
 * repos (discord/telegram/slack.grayoffice). They POST normalised events to
 * `/api/bots/ingest` with a shared bearer token and drive account linking with
 * `/api/bots/link/*` + the `/link` page.
 *
 * This is mounted on `/api/bots` *before* the dashboard-connect webhook router
 * (`bots.ts`), so `/ingest` and `/link/...` resolve here and everything else
 * (`/:platform/:orgId`) falls through to that.
 */
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { handleInbound, type InboundFile } from "./bot-router";

const SOURCES = ["telegram", "slack", "discord"] as const;
type Source = (typeof SOURCES)[number];
const isSource = (v: unknown): v is Source =>
	typeof v === "string" && (SOURCES as readonly string[]).includes(v);

/** Codes people type by hand: no 0/O/1/I, grouped XXX-XXX. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_SECONDS = 15 * 60;

function newLinkCode(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(6));
	const s = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
	return `${s.slice(0, 3)}-${s.slice(3)}`;
}

export const botCompatRoutes = new Hono<{ Bindings: Env }>();

/** Shared bearer-token gate — matches the token the bot repos send. */
const tokenGate: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
	const token = c.env.BOT_INGEST_TOKEN;
	if (token && c.req.header("authorization") !== `Bearer ${token}`)
		return c.json({ error: "unauthorized" }, 401);
	await next();
};
botCompatRoutes.use("/ingest", tokenGate);
botCompatRoutes.use("/link/*", tokenGate);

type IngestBody = {
	source?: string;
	externalUser?: string;
	text?: string;
	files?: { name?: string; url?: string; mime?: string }[];
	externalEventId?: string;
};

botCompatRoutes.post("/ingest", async (c) => {
	const b = await c.req.json<IngestBody>().catch(() => null);
	if (!b || !isSource(b.source))
		return c.json({ error: "source must be telegram | slack | discord" }, 400);
	if (!b.text && !(b.files && b.files.length))
		return c.json({ error: "provide text or files" }, 400);

	// Idempotency: platforms retry. Re-use the 0013 ledger.
	if (b.externalEventId) {
		const res = await c.env.DB.prepare(
			"INSERT OR IGNORE INTO bot_processed_events (platform, external_event_id, org_id) VALUES (?, ?, ?)",
		)
			.bind(b.source, b.externalEventId, null)
			.run();
		if ((res.meta.changes ?? 0) === 0)
			return c.json({ id: "", route: "duplicate", status: "done", detail: { deduped: true } });
	}

	// Resolve the linked Gray Office user + org for this platform identity.
	const link = b.externalUser
		? await c.env.DB.prepare(
				"SELECT user_id, org_id FROM bot_links WHERE source = ? AND external_user = ?",
			)
				.bind(b.source, b.externalUser)
				.first<{ user_id: string; org_id: string }>()
		: null;

	const files: InboundFile[] = (b.files ?? []).map((f) => ({
		name: f.name ?? "file",
		url: f.url,
		mime: f.mime,
	}));

	const result = await handleInbound(c.env, {
		source: b.source,
		orgId: link?.org_id ?? null,
		userId: link?.user_id ?? null,
		externalUser: b.externalUser ?? null,
		text: b.text ?? "",
		files,
	});

	return c.json(result);
});

botCompatRoutes.post("/link/start", async (c) => {
	const b = await c.req
		.json<{ source?: string; externalUser?: string; displayName?: string }>()
		.catch(() => null);
	if (!b || !isSource(b.source) || !b.externalUser)
		return c.json({ error: "source and externalUser are required" }, 400);

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
			code = newLinkCode();
		}
	}

	const base = (c.env.APP_URL ?? "").replace(/\/$/, "");
	return c.json({ code, url: `${base}/link`, expiresInSeconds: CODE_TTL_SECONDS });
});

botCompatRoutes.get("/link/status", async (c) => {
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

botCompatRoutes.post("/link/revoke", async (c) => {
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
