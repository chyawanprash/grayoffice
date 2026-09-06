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
import { streamSSE } from "hono/streaming";
import { askAgent, handleInbound, type InboundFile } from "./bot-router";
import { createFinanceAgent } from "~/lib/agent.server";
import { queueKbIngest } from "~/lib/kb.server";
import { queueExtraction } from "~/lib/docs.server";

/** kb.server / docs.server need the R2 + queue bindings; they exist at runtime
 * (wrangler.jsonc) but the checked-in worker-configuration.d.ts lags. */
type PipelineEnv = Env & { KB_QUEUE: Queue; DOCS_BUCKET: R2Bucket };

const isPdf = (f: { name?: string; mime?: string }) =>
	/\.pdf$/i.test(f.name ?? "") || f.mime === "application/pdf";

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

	// Documents from a linked user: fetch the bytes once, and in the background
	// push them to R2 + the KB pipeline (chunk → embeddings → Pinecone memories,
	// and PDF → structured JSON → draft invoice, each writing its own D1 rows).
	// We reuse the fetched bytes for the synchronous pdf-to-json reply below.
	const kbQueued: string[] = [];
	if (link?.org_id && files.some(isPdf)) {
		const env = c.env as PipelineEnv;
		for (const f of files) {
			if (!isPdf(f) || !f.url) continue;
			try {
				const res = await fetch(f.url);
				if (!res.ok) continue;
				const bytes = await res.arrayBuffer();
				f.blob = new Blob([bytes], { type: "application/pdf" }); // reuse for the sync reply
				f.url = undefined;
				kbQueued.push(f.name);
				c.executionCtx.waitUntil(
					Promise.allSettled([
						queueKbIngest(env, link.org_id, f.name, bytes),
						queueExtraction(env, link.org_id, f.name, bytes),
					]).then((r) => {
						for (const x of r)
							if (x.status === "rejected")
								console.error(`bot ingest pipeline (${f.name}): ${x.reason}`);
					}),
				);
			} catch (err) {
				console.error(`bot ingest fetch (${f.name}): ${err}`);
			}
		}
	}

	const result = await handleInbound(c.env, {
		source: b.source,
		orgId: link?.org_id ?? null,
		userId: link?.user_id ?? null,
		externalUser: b.externalUser ?? null,
		text: b.text ?? "",
		files,
	});

	return c.json(kbQueued.length ? { ...result, kb: { queued: kbQueued } } : result);
});

/* ─────────────────────────────────────────────── streaming ask (live steps) */

type LinkRow = { user_id: string; org_id: string };

async function resolveLink(
	db: D1Database,
	source: Source,
	externalUser: string | null | undefined,
): Promise<LinkRow | null> {
	if (!externalUser) return null;
	return db
		.prepare("SELECT user_id, org_id FROM bot_links WHERE source = ? AND external_user = ?")
		.bind(source, externalUser)
		.first<LinkRow>();
}

/**
 * Like /ingest but text-only and Server-Sent-Events: emits `step` events as the
 * agent calls tools, then a final `done` event with the answer. Bots edit their
 * message on each event so the user watches the work happen.
 */
botCompatRoutes.post("/ingest/stream", tokenGate, async (c) => {
	const b = await c.req.json<IngestBody>().catch(() => null);
	if (!b || !isSource(b.source) || !b.text?.trim())
		return c.json({ error: "source and text are required" }, 400);
	const source = b.source;
	const text = b.text.trim();
	const link = await resolveLink(c.env.DB, source, b.externalUser);

	const eventId = crypto.randomUUID();
	await c.env.DB.prepare(
		`INSERT INTO bot_events (id, org_id, source, external_user, kind, summary, route, status)
		 VALUES (?, ?, ?, ?, 'message', ?, 'ask', 'routed')`,
	)
		.bind(eventId, link?.org_id ?? null, source, b.externalUser ?? null, text.slice(0, 140))
		.run();

	const settle = (status: "done" | "error", detail: unknown) =>
		c.env.DB.prepare(
			"UPDATE bot_events SET status = ?, detail = ?, updated_at = unixepoch() WHERE id = ?",
		)
			.bind(status, JSON.stringify(detail), eventId)
			.run();

	return streamSSE(c, async (stream) => {
		const send = (event: string, data: unknown) =>
			stream.writeSSE({ event, data: JSON.stringify(data) });

		// Not linked → no org/user context, so just the lightweight fallback.
		if (!link?.org_id || !link.user_id) {
			const { reply } = await askAgent(c.env, {
				source,
				externalUser: b.externalUser ?? null,
				text,
				files: [],
			});
			await send("done", { text: reply, linked: false });
			await settle("done", { reply });
			return;
		}

		try {
			await send("step", { kind: "start" });
			const agent = createFinanceAgent(c.env, {
				userId: link.user_id,
				orgId: link.org_id,
			});
			const res = await agent.stream({
				prompt: `[Message from ${source}] ${text}`.slice(0, 8000),
			});

			let wroteWriting = false;
			for await (const part of res.fullStream) {
				if (part.type === "tool-call") {
					await send("step", { kind: "tool", name: part.toolName });
				} else if (part.type === "text-delta" && !wroteWriting) {
					wroteWriting = true;
					await send("step", { kind: "writing" });
				} else if (part.type === "error") {
					await send("step", { kind: "error", message: String(part.error) });
				}
			}

			const answer =
				(await res.text).trim() || "I couldn't produce an answer to that.";
			await send("done", { text: answer, linked: true });
			await settle("done", { reply: answer });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await send("done", { text: `Sorry, that failed: ${message}`, linked: true });
			await settle("error", { error: message });
		}
	});
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
