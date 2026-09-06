/**
 * Chat bot integrations. Each org connects its own Slack / Telegram / Discord
 * app from /dashboard/integrations; the platform then delivers messages to
 * /api/bots/<platform>/<orgId>, which this module verifies, normalises into an
 * `Inbound`, and (after `handleInbound` runs the AI pipeline) replies to.
 *
 * No bot code runs anywhere else — the old "each bot lives in its own repo and
 * POSTs to /ingest with a shared token" model is gone.
 */
import type { Inbound, InboundFile } from "../../workers/bot-router";
import type { BotPlatform } from "./bots-catalog";
import { seal, open } from "./secretbox.server";
export { BOT_PLATFORMS, BOT_META, botWebhookUrl as webhookUrl } from "./bots-catalog";
export type { BotPlatform } from "./bots-catalog";

const enc = new TextEncoder();

/* ─────────────────────────────────────────────────────────── storage CRUD */

type Env = { DB: D1Database; APP_URL?: string; SESSION_SECRET: string };

export type BotIntegration = {
	org_id: string;
	platform: BotPlatform;
	status: string;
	bot_token: string | null;
	signing_secret: string | null;
	app_id: string | null;
	workspace_name: string | null;
	extra: Record<string, string>;
	connected_at: number | null;
	updated_at: number;
};

type Row = Omit<BotIntegration, "extra"> & { extra: string | null };

async function hydrate(sessionSecret: string, r: Row): Promise<BotIntegration> {
	let extra: Record<string, string> = {};
	try {
		extra = r.extra ? JSON.parse(r.extra) : {};
	} catch {
		/* ignore */
	}
	return {
		...r,
		extra,
		bot_token: await open(sessionSecret, r.bot_token),
		signing_secret: await open(sessionSecret, r.signing_secret),
	};
}

export async function listBotIntegrations(env: Env, orgId: string): Promise<BotIntegration[]> {
	const { results } = await env.DB
		.prepare("SELECT * FROM bot_integrations WHERE org_id = ?")
		.bind(orgId)
		.all<Row>();
	return Promise.all((results ?? []).map((r) => hydrate(env.SESSION_SECRET, r)));
}

export async function getBotIntegration(
	env: Env,
	orgId: string,
	platform: BotPlatform,
): Promise<BotIntegration | null> {
	const r = await env.DB
		.prepare("SELECT * FROM bot_integrations WHERE org_id = ? AND platform = ?")
		.bind(orgId, platform)
		.first<Row>();
	return r ? hydrate(env.SESSION_SECRET, r) : null;
}

export async function saveBotIntegration(
	env: Env,
	orgId: string,
	platform: BotPlatform,
	input: { bot_token?: string; signing_secret?: string; app_id?: string; workspace_name?: string; extra?: Record<string, string> },
): Promise<void> {
	await env.DB
		.prepare(
			`INSERT INTO bot_integrations (org_id, platform, status, bot_token, signing_secret, app_id, workspace_name, extra, connected_at, updated_at)
			 VALUES (?, ?, 'active', ?, ?, ?, ?, ?, unixepoch(), unixepoch())
			 ON CONFLICT (org_id, platform) DO UPDATE SET
			   status         = 'active',
			   bot_token      = COALESCE(excluded.bot_token, bot_integrations.bot_token),
			   signing_secret = COALESCE(excluded.signing_secret, bot_integrations.signing_secret),
			   app_id         = COALESCE(excluded.app_id, bot_integrations.app_id),
			   workspace_name = COALESCE(excluded.workspace_name, bot_integrations.workspace_name),
			   extra          = excluded.extra,
			   updated_at     = unixepoch()`,
		)
		.bind(
			orgId,
			platform,
			await seal(env.SESSION_SECRET, input.bot_token),
			await seal(env.SESSION_SECRET, input.signing_secret),
			input.app_id || null,
			input.workspace_name || null,
			JSON.stringify(input.extra ?? {}),
		)
		.run();
}

export async function deleteBotIntegration(env: Env, orgId: string, platform: BotPlatform): Promise<void> {
	await env.DB.prepare("DELETE FROM bot_integrations WHERE org_id = ? AND platform = ?").bind(orgId, platform).run();
}

/** True (and records it) the first time; true-with-no-effect isn't possible — retries return false-ish via the caller. */
export async function markEventProcessed(
	db: D1Database,
	platform: BotPlatform,
	eventId: string,
	orgId: string,
): Promise<boolean> {
	try {
		const res = await db
			.prepare("INSERT OR IGNORE INTO bot_processed_events (platform, external_event_id, org_id) VALUES (?, ?, ?)")
			.bind(platform, eventId, orgId)
			.run();
		return (res.meta.changes ?? 0) > 0; // false = already processed
	} catch {
		return true; // don't drop the message on a logging failure
	}
}

/* ───────────────────────────────────────────────────── signature verification */

const hex = (buf: ArrayBuffer) =>
	[...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

const fromHex = (s: string) => {
	const out = new Uint8Array(s.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
	return out;
};

/** True if the request is a genuine delivery from the platform. */
export async function verifyInbound(
	platform: BotPlatform,
	raw: string,
	headers: Headers,
	integ: BotIntegration,
): Promise<boolean> {
	if (platform === "telegram") {
		return (
			!!integ.signing_secret &&
			headers.get("x-telegram-bot-api-secret-token") === integ.signing_secret
		);
	}

	if (platform === "slack") {
		const sig = headers.get("x-slack-signature");
		const ts = headers.get("x-slack-request-timestamp");
		if (!sig || !ts || !integ.signing_secret) return false;
		if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
		const expected = `v0=${await hmacSha256Hex(integ.signing_secret, `v0:${ts}:${raw}`)}`;
		return timingEqual(sig, expected);
	}

	// discord: Ed25519 over (timestamp + body) against the app public key
	const sig = headers.get("x-signature-ed25519");
	const ts = headers.get("x-signature-timestamp");
	if (!sig || !ts || !integ.signing_secret) return false;
	try {
		const key = await crypto.subtle.importKey(
			"raw",
			fromHex(integ.signing_secret),
			{ name: "Ed25519" },
			false,
			["verify"],
		);
		return crypto.subtle.verify("Ed25519", key, fromHex(sig), enc.encode(ts + raw));
	} catch {
		return false;
	}
}

function timingEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/* ─────────────────────────────────────────────── inbound parsing per platform */

export type ReplyTarget =
	| { platform: "slack"; channel: string; thread_ts?: string }
	| { platform: "telegram"; chat_id: number | string }
	| { platform: "discord"; app_id: string; interaction_token: string };

export type ParsedInbound = {
	event: Omit<Inbound, "source">;
	reply: ReplyTarget | null;
	/** platform-native id used for idempotency */
	externalEventId: string;
	/** stable conversation key: platform:workspace:channel[:thread] */
	conversationId: string;
};

/** Normalise a raw webhook body. Returns null for events we ignore. */
export async function parseInbound(
	platform: BotPlatform,
	body: any,
	integ: BotIntegration,
): Promise<ParsedInbound | null> {
	if (platform === "slack") {
		const e = body.event;
		if (!e || e.bot_id || e.subtype === "bot_message") return null;
		if (!["app_mention", "message"].includes(e.type)) return null;
		const text = String(e.text ?? "").replace(/<@[A-Z0-9]+>/g, "").trim();
		const files: InboundFile[] = [];
		for (const f of e.files ?? []) {
			if (!/pdf/i.test(f.mimetype ?? "") && !/\.pdf$/i.test(f.name ?? "")) continue;
			const blob = await fetchAuthed(f.url_private_download ?? f.url_private, {
				Authorization: `Bearer ${integ.bot_token}`,
			});
			files.push({ name: f.name ?? "file.pdf", mime: "application/pdf", blob });
		}
		if (!text && files.length === 0) return null;
		const thread = e.thread_ts ?? e.ts;
		return {
			event: { externalUser: e.user ?? null, text, files },
			reply: { platform: "slack", channel: e.channel, thread_ts: thread },
			externalEventId: String(body.event_id ?? `${e.channel}:${e.ts}`),
			conversationId: `slack:${body.team_id ?? "?"}:${e.channel}:${thread}`,
		};
	}

	if (platform === "telegram") {
		const m = body.message ?? body.edited_message;
		if (!m) return null;
		const text = String(m.text ?? m.caption ?? "").trim();
		const files: InboundFile[] = [];
		const doc = m.document;
		if (doc && (/pdf/i.test(doc.mime_type ?? "") || /\.pdf$/i.test(doc.file_name ?? ""))) {
			const blob = await telegramFile(integ.bot_token, doc.file_id);
			if (blob) files.push({ name: doc.file_name ?? "file.pdf", mime: "application/pdf", blob });
		}
		if (!text && files.length === 0) return null;
		const from = m.from?.username ? `@${m.from.username}` : String(m.from?.id ?? "");
		return {
			event: { externalUser: from, text, files },
			reply: { platform: "telegram", chat_id: m.chat.id },
			externalEventId: String(body.update_id ?? `${m.chat.id}:${m.message_id}`),
			conversationId: `telegram:${m.chat.id}`,
		};
	}

	// discord interaction (slash command). PING is handled before this.
	if (body.type !== 2) return null;
	const opts: { name: string; value: string }[] = body.data?.options ?? [];
	const text = String(opts.find((o) => o.name === "question")?.value ?? "").trim();
	const files: InboundFile[] = [];
	const atts = body.data?.resolved?.attachments ?? {};
	for (const a of Object.values<any>(atts)) {
		if (!/pdf/i.test(a.content_type ?? "") && !/\.pdf$/i.test(a.filename ?? "")) continue;
		files.push({ name: a.filename ?? "file.pdf", mime: "application/pdf", url: a.url });
	}
	if (!text && files.length === 0) return null;
	const user = body.member?.user?.username ?? body.user?.username ?? null;
	return {
		event: { externalUser: user, text, files },
		reply: { platform: "discord", app_id: body.application_id, interaction_token: body.token },
		externalEventId: String(body.id),
		conversationId: `discord:${body.guild_id ?? "dm"}:${body.channel_id ?? "?"}`,
	};
}

async function fetchAuthed(url: string | undefined, headers: Record<string, string>): Promise<Blob | undefined> {
	if (!url) return undefined;
	const res = await fetch(url, { headers });
	return res.ok ? res.blob() : undefined;
}

async function telegramFile(token: string | null, fileId: string): Promise<Blob | undefined> {
	if (!token) return undefined;
	const info = (await (await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`)).json()) as {
		ok: boolean;
		result?: { file_path?: string };
	};
	if (!info.ok || !info.result?.file_path) return undefined;
	const res = await fetch(`https://api.telegram.org/file/bot${token}/${info.result.file_path}`);
	return res.ok ? res.blob() : undefined;
}

/* ───────────────────────────────────────────────────────────── outbound reply */

export async function sendReply(integ: BotIntegration, target: ReplyTarget, text: string): Promise<void> {
	const body = text.slice(0, 3800) || "(no answer)";

	if (target.platform === "slack") {
		await fetch("https://slack.com/api/chat.postMessage", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				Authorization: `Bearer ${integ.bot_token}`,
			},
			body: JSON.stringify({ channel: target.channel, thread_ts: target.thread_ts, text: body }),
		});
		return;
	}

	if (target.platform === "telegram") {
		await fetch(`https://api.telegram.org/bot${integ.bot_token}/sendMessage`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ chat_id: target.chat_id, text: body }),
		});
		return;
	}

	// discord: edit the deferred interaction response
	await fetch(
		`https://discord.com/api/v10/webhooks/${target.app_id}/${target.interaction_token}/messages/@original`,
		{
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ content: body }),
		},
	);
}

/* ──────────────────────────────────────────────── platform-side registration */

/** Register the /ask slash command for a Discord app. Returns an error string or null. */
export async function registerDiscordCommands(integ: BotIntegration): Promise<string | null> {
	if (!integ.app_id || !integ.bot_token) return "missing Application ID or bot token";
	const res = await fetch(`https://discord.com/api/v10/applications/${integ.app_id}/commands`, {
		method: "PUT",
		headers: { "content-type": "application/json", Authorization: `Bot ${integ.bot_token}` },
		body: JSON.stringify([
			{
				name: "ask",
				description: "Ask the Gray Office finance assistant",
				options: [
					{ type: 3, name: "question", description: "Your question", required: false },
					{ type: 11, name: "file", description: "A PDF to convert to JSON", required: false },
				],
			},
		]),
	});
	return res.ok ? null : `Discord command registration failed: ${res.status} ${await res.text()}`;
}

export async function setTelegramWebhook(integ: BotIntegration, url: string, secret: string): Promise<string | null> {
	if (!integ.bot_token) return "missing bot token";
	const res = await fetch(`https://api.telegram.org/bot${integ.bot_token}/setWebhook`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message", "edited_message"] }),
	});
	const j = (await res.json()) as { ok: boolean; description?: string };
	return j.ok ? null : `Telegram setWebhook failed: ${j.description ?? res.status}`;
}

export async function deleteTelegramWebhook(integ: BotIntegration): Promise<void> {
	if (!integ.bot_token) return;
	await fetch(`https://api.telegram.org/bot${integ.bot_token}/deleteWebhook`, { method: "POST" });
}

/* ───────────────────────────────────────── backend → platform notifications */

/**
 * Proactively send a message to a connected platform, e.g. a spend alert.
 * `destinationId` is a Discord/Slack channel id or a Telegram chat id.
 */
export async function sendBotNotification(
	env: Env,
	opts: { orgId: string; platform: BotPlatform; destinationId: string; text: string },
): Promise<{ ok: boolean; error?: string }> {
	const integ = await getBotIntegration(env, opts.orgId, opts.platform);
	if (!integ || integ.status !== "active" || !integ.bot_token)
		return { ok: false, error: "not connected" };
	const body = opts.text.slice(0, 3800);

	try {
		if (opts.platform === "slack") {
			await fetch("https://slack.com/api/chat.postMessage", {
				method: "POST",
				headers: { "content-type": "application/json", Authorization: `Bearer ${integ.bot_token}` },
				body: JSON.stringify({ channel: opts.destinationId, text: body }),
			});
		} else if (opts.platform === "telegram") {
			await fetch(`https://api.telegram.org/bot${integ.bot_token}/sendMessage`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ chat_id: opts.destinationId, text: body }),
			});
		} else {
			await fetch(`https://discord.com/api/v10/channels/${opts.destinationId}/messages`, {
				method: "POST",
				headers: { "content-type": "application/json", Authorization: `Bot ${integ.bot_token}` },
				body: JSON.stringify({ content: body }),
			});
		}
		return { ok: true };
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : String(err) };
	}
}

/** A short chat-ready string from a handleInbound result. */
export function resultToText(detail: unknown): string {
	if (detail && typeof detail === "object") {
		if ("reply" in detail) return String((detail as { reply: string }).reply);
		if ("results" in detail) {
			const rs = (detail as { results: { file: string; json: unknown }[] }).results;
			return rs
				.map((r) => `**${r.file}**\n\`\`\`json\n${JSON.stringify(r.json, null, 2).slice(0, 1500)}\n\`\`\``)
				.join("\n\n");
		}
		if ("note" in detail) return String((detail as { note: string }).note);
	}
	return "Done.";
}
