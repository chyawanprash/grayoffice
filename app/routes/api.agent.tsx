import { createAgentUIStreamResponse } from "ai";
import type { Route } from "./+types/api.agent";
import { createFinanceAgent } from "~/lib/agent.server";
import { remember } from "~/lib/pinecone.server";
import { requireUserId } from "~/lib/auth.server";
import { requireOrg } from "~/lib/org.server";
import { queueExtraction } from "~/lib/docs.server";

type Part = { type?: string; text?: string; mediaType?: string; url?: string; filename?: string };
type Msg = { role?: string; parts?: Part[] };

const MAX_PDF = 8 * 1024 * 1024;

function dataUrlToBytes(url: string): ArrayBuffer | null {
	const comma = url.indexOf(",");
	if (!url.startsWith("data:") || comma < 0) return null;
	const bin = atob(url.slice(comma + 1));
	const u8 = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
	return u8.buffer;
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const userId = await requireUserId(request, env.SESSION_SECRET);
	const { orgId } = await requireOrg(request, env);

	const body = (await request.json()) as { messages: Msg[] };
	const messages = body.messages ?? [];
	const last = messages.at(-1);

	// A PDF attached to the message is saved into Documents (and its base64
	// stripped before the model sees it), then the agent is told the doc id.
	if (last?.role === "user" && Array.isArray(last.parts)) {
		const pdfs = last.parts.filter(
			(p) => p.type === "file" && /pdf/i.test(p.mediaType ?? "") && p.url?.startsWith("data:"),
		);
		if (pdfs.length) {
			const notes: string[] = [];
			for (const p of pdfs) {
				const bytes = p.url ? dataUrlToBytes(p.url) : null;
				if (!bytes || bytes.byteLength > MAX_PDF) {
					notes.push(`(could not save ${p.filename ?? "attachment"})`);
					continue;
				}
				const name = (p.filename ?? "attachment.pdf").slice(0, 200);
				const id = await queueExtraction(env, orgId, name, bytes);
				notes.push(`"${name}" saved to Documents (id: ${id}), extracting now`);
			}
			last.parts = last.parts.filter((p) => !pdfs.includes(p));
			const noteText = `[Attached and ${notes.join("; ")}. Use getDocument once ready.]`;
			const textPart = last.parts.find((p) => p.type === "text");
			if (textPart) textPart.text = `${textPart.text ?? ""}\n\n${noteText}`.trim();
			else last.parts.push({ type: "text", text: noteText });
		}
	}

	// fire-and-forget: keep a copy of the user's latest turn in long-term memory
	if (last?.role === "user") {
		const text = (last.parts ?? [])
			.filter((p) => p.type === "text")
			.map((p) => p.text)
			.join(" ")
			.trim();
		if (text) context.cloudflare.ctx.waitUntil(remember(env, userId, text));
	}

	return createAgentUIStreamResponse({
		agent: createFinanceAgent(env, { userId, orgId }),
		uiMessages: messages,
	});
}
