/**
 * Inbound bot pipeline. Every Slack/Telegram/Discord message or file lands in
 * `handleInbound`, which writes an audit row, lets the AI pick a route, runs it,
 * and updates the row. New routes = one more `case` in `dispatch`.
 */

type Env = {
	AI: Ai;
	DB: D1Database;
};

export type InboundFile = { name: string; url?: string; blob?: Blob; mime?: string };

export type Inbound = {
	source: "telegram" | "slack" | "discord";
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

const ROUTES = ["pdf-to-json", "unhandled"] as const;
type RouteName = (typeof ROUTES)[number];

/** Deterministic first: a PDF is always a pdf-to-json job. */
function routeByFiles(files: InboundFile[]): RouteName | null {
	if (files.some((f) => /\.pdf$/i.test(f.name) || f.mime === "application/pdf"))
		return "pdf-to-json";
	return null;
}

/** Text-only messages: ask the model to classify. Defaults to 'unhandled'. */
async function routeByText(env: Env, text: string): Promise<RouteName> {
	if (!env.AI || !text.trim()) return "unhandled";
	try {
		const r = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
			messages: [
				{
					role: "system",
					content: `Classify the user request into exactly one label from this list: ${ROUTES.join(", ")}. Reply with only the label.`,
				},
				{ role: "user", content: text.slice(0, 2000) },
			],
			max_tokens: 12,
		})) as { response?: string };
		const guess = (r.response ?? "").trim().toLowerCase();
		return (ROUTES.find((x) => guess.includes(x)) ?? "unhandled") as RouteName;
	} catch {
		return "unhandled";
	}
}

export async function handleInbound(env: Env, msg: Inbound): Promise<InboundResult> {
	const id = crypto.randomUUID();
	const summary = msg.files.length
		? `${msg.files.length} file(s): ${msg.files.map((f) => f.name).join(", ")}`
		: msg.text.slice(0, 140);

	await env.DB.prepare(
		"INSERT INTO bot_events (id, source, external_user, kind, summary) VALUES (?, ?, ?, ?, ?)",
	)
		.bind(id, msg.source, msg.externalUser, msg.files.length ? "file" : "message", summary)
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
	])) as Array<{ data: string }>;
	const markdown = md.map((d) => d.data).join("\n\n").slice(0, 12_000);

	const r = (await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
		messages: [
			{
				role: "system",
				content:
					"Extract the document into a single flat JSON object of the key fields and line items. Reply with ONLY valid JSON, no prose, no code fences.",
			},
			{ role: "user", content: markdown },
		],
		max_tokens: 1024,
	})) as { response?: string };

	const text = (r.response ?? "").replace(/```json\s*|```/gi, "").trim();
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
