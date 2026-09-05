import { createAgentUIStreamResponse } from "ai";
import type { Route } from "./+types/api.agent";
import { createFinanceAgent } from "~/lib/agent.server";
import { remember } from "~/lib/pinecone.server";
import { requireUserId } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const userId = await requireUserId(request, env.SESSION_SECRET);

	const { messages } = (await request.json()) as { messages: unknown[] };

	// fire-and-forget: keep a copy of the user's latest turn in long-term memory
	const last = messages.at(-1) as
		| { role?: string; parts?: { type?: string; text?: string }[] }
		| undefined;
	if (last?.role === "user") {
		const text = (last.parts ?? [])
			.filter((p) => p.type === "text")
			.map((p) => p.text)
			.join(" ")
			.trim();
		if (text) context.cloudflare.ctx.waitUntil(remember(env, userId, text));
	}

	return createAgentUIStreamResponse({
		agent: createFinanceAgent(env, userId),
		uiMessages: messages,
	});
}
