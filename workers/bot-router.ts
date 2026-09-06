/**
 * Inbound bot pipeline. Every Slack/Telegram/Discord message or file lands in
 * `handleInbound`, which writes an audit row, lets the AI pick a route, runs it,
 * and updates the row. New routes = one more `case` in `dispatch`.
 */

import { runFinanceAgentText } from "~/lib/agent.server";
import { aiText } from "~/lib/ai.server";

// `Env` is the generated worker binding type (worker-configuration.d.ts).

export type InboundFile = { name: string; url?: string; blob?: Blob; mime?: string };

export type Inbound = {
	source: "telegram" | "slack" | "discord";
	orgId?: string | null;
	/** internal user the platform identity maps to (org owner today) */
	userId?: string | null;
	externalUser: string | null;
	text: string;
	files: InboundFile[];
};

export type InboundResult = {
	id: string;
	route: string;
	status: "done" | "error";
	detail: unknown;
};

const ROUTES = ["pdf-to-json", "ask", "unhandled"] as const;
type RouteName = (typeof ROUTES)[number];

/** Model that answers free-text questions from the bots. */
const CHAT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const CHAT_SYSTEM = `You are the Gray Office finance operations assistant, replying
to a user over a chat bot (Slack / Telegram / Discord). Help with closing the
books, reconciliations, invoices, cash reports and GST / jurisdiction questions.
Be concise and specific - a chat reply, not an essay. Show the numbers and the
working when relevant. Flag anything that needs a human's judgement instead of
guessing.`;

/** Deterministic first: a PDF is always a pdf-to-json job. */
function routeByFiles(files: InboundFile[]): RouteName | null {
	if (files.some((f) => /\.pdf$/i.test(f.name) || f.mime === "application/pdf"))
		return "pdf-to-json";
	return null;
}

/** Text-only messages: any real question goes to the AI assistant ('ask'). */
async function routeByText(_env: Env, text: string): Promise<RouteName> {
	return text.trim() ? "ask" : "unhandled";
}

/** Free-text Q&A backed by Workers AI - the bots' "use the backend's AI" path. */
export async function askAgent(env: Env, msg: Inbound): Promise<{ reply: string }> {
	if (!env.AI || !msg.text.trim())
		return { reply: "Ask me a finance operations question and I'll help." };

	const r = await env.AI.run(CHAT_MODEL, {
		messages: [
			{ role: "system", content: CHAT_SYSTEM },
			{ role: "user", content: msg.text.slice(0, 4000) },
		],
		max_tokens: 512,
	});

	return { reply: aiText(r).trim() || "Sorry, I couldn't produce an answer." };
}

export async function handleInbound(env: Env, msg: Inbound): Promise<InboundResult> {
	const id = crypto.randomUUID();
	const summary = msg.files.length
		? `${msg.files.length} file(s): ${msg.files.map((f) => f.name).join(", ")}`
		: msg.text.slice(0, 140);

	await env.DB.prepare(
		"INSERT INTO bot_events (id, org_id, source, external_user, kind, summary) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind(id, msg.orgId ?? null, msg.source, msg.externalUser, msg.files.length ? "file" : "message", summary)
		.run();

	const route = routeByFiles(msg.files) ?? (await routeByText(env, msg.text));
	await update(env, id, { route, status: "routed" });

	try {
		const detail = await dispatch(env, route, msg);
		await update(env, id, { status: "done", detail: JSON.stringify(detail) });
		return { id, route, status: "done", detail };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await update(env, id, { status: "error", detail: JSON.stringify({ error: message }) });
		return { id, route, status: "error", detail: { error: message } };
	}
}

async function dispatch(env: Env, route: RouteName, msg: Inbound): Promise<unknown> {
	switch (route) {
		case "pdf-to-json": {
			const pdfs = msg.files.filter(
				(f) => /\.pdf$/i.test(f.name) || f.mime === "application/pdf",
			);
			const results = [];
			for (const f of pdfs) results.push({ file: f.name, json: await pdfToJson(env, f) });
			return { results };
		}
		case "ask":
			// Same agent + tools as the web chat when we know the org/user;
			// otherwise the lightweight Workers-AI fallback.
			if (msg.orgId && msg.userId)
				return {
					reply: await runFinanceAgentText(
						env,
						{ userId: msg.userId, orgId: msg.orgId, source: msg.source },
						msg.text,
					),
				};
			return askAgent(env, msg);
		case "unhandled":
			return { note: "No route matched. Add a case in bot-router.ts dispatch()." };
	}
}

/**
 * PDF -> structured JSON. Cloudflare's `AI.toMarkdown` handles the PDF parse
 * natively; a small model turns the markdown into JSON.
 * ponytail: markdown->JSON via one generic prompt. Swap in a per-doc-type schema
 * (invoice / receipt / statement) when the shapes actually matter.
 */
export async function pdfToJson(env: Env, file: InboundFile): Promise<unknown> {
	let blob = file.blob;
	if (!blob) {
		if (!file.url) throw new Error(`no data for ${file.name}`);
		const res = await fetch(file.url);
		if (!res.ok) throw new Error(`fetch ${file.name}: ${res.status}`);
		blob = await res.blob();
	}

	const md = (await env.AI.toMarkdown([
		{ name: file.name, blob },
	])) as unknown;
	const markdown = (Array.isArray(md) ? md : [md])
		.map((d) => (typeof d === "string" ? d : String((d as { data?: unknown })?.data ?? "")))
		.join("\n\n").slice(0, 12_000);

	const r = await env.AI.run(CHAT_MODEL, {
		messages: [
			{
				role: "system",
				content:
					"Extract the document into a single flat JSON object of the key fields and line items. Reply with ONLY valid JSON, no prose, no code fences.",
			},
			{ role: "user", content: markdown },
		],
		max_tokens: 1024,
	});

	const text = aiText(r).replace(/```json\s*|```/gi, "").trim();
	try {
		return JSON.parse(text);
	} catch {
		return { _raw: text, _markdown: markdown.slice(0, 2000) };
	}
}

async function update(
	env: Env,
	id: string,
	fields: { route?: string; status?: string; detail?: string },
): Promise<void> {
	const sets = ["updated_at = unixepoch()"];
	const vals: unknown[] = [];
	for (const [k, v] of Object.entries(fields)) {
		sets.push(`${k} = ?`);
		vals.push(v);
	}
	await env.DB.prepare(`UPDATE bot_events SET ${sets.join(", ")} WHERE id = ?`)
		.bind(...vals, id)
		.run();
}
