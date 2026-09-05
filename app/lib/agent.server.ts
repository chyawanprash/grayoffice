import { ToolLoopAgent, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { recall, remember } from "./pinecone.server";

/**
 * The Gray Office finance agent. Runs on Workers AI (no keys) with Pinecone as
 * long-term memory. To use a hosted model instead (e.g. GPT via AI Gateway),
 * swap `workersai(MODEL)` for a `"<provider>/<model>"` slug and pass the
 * matching plugin to `createWorkersAI({ providers: [...] })`.
 */
const MODEL = "@cf/moonshotai/kimi-k2.7-code"; // tools + 256k ctx

const INSTRUCTIONS = `You are the Gray Office finance operations agent. You help
finance, accounting and treasury teams close the books, reconcile accounts,
process invoices, prepare cash reports, and handle GST / jurisdiction questions.

- Be concise and specific. Show the numbers and the working.
- When the user tells you something durable about their setup, entities, close
  cadence, thresholds, or preferences, call saveMemory to persist it.
- Before answering questions about the user's own setup, call recallMemory.
- Flag anything that needs a human's judgment instead of guessing.`;

type AgentEnv = {
	AI: Ai;
	PINECONE_API_KEY?: string;
	PINECONE_HOST?: string;
};

export function createFinanceAgent(env: AgentEnv, userId: string) {
	const workersai = createWorkersAI({ binding: env.AI });

	return new ToolLoopAgent({
		model: workersai(MODEL),
		instructions: INSTRUCTIONS,
		tools: {
			recallMemory: tool({
				description:
					"Recall previously saved facts about this user's finance setup.",
				inputSchema: z.object({
					query: z.string().describe("what to look up"),
				}),
				execute: async ({ query }) => {
					const hits = await recall(env, userId, query);
					return hits.length ? { memories: hits } : { memories: [] };
				},
			}),
			saveMemory: tool({
				description:
					"Persist a durable fact about this user's finance setup or preferences.",
				inputSchema: z.object({
					fact: z.string().describe("the fact to remember, one sentence"),
				}),
				execute: async ({ fact }) => {
					await remember(env, userId, fact);
					return { saved: true };
				},
			}),
		},
	});
}
