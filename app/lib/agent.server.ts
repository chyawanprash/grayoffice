import { ToolLoopAgent, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { z } from "zod";
import { recall, remember } from "./pinecone.server";
import { listMembers } from "./org.server";
import { listIntegrations, recentEvents, fetchResource, PROVIDER_IDS, type Provider } from "./payments.server";
import { getOrgBank, getBankSummary, bankAction } from "./bank.server";
import { searchKb } from "./kb.server";

/**
 * The Gray Office finance agent. Runs on Workers AI (no keys) with Pinecone as
 * long-term memory. It can read every entity in the caller's organization -
 * members, payment integrations + live data, the audit log, the connected
 * bank account, and the knowledge base - and can move money on the bank
 * account, but only after the user confirms the exact amount and destination.
 */
const MODEL = "@cf/moonshotai/kimi-k2.7-code"; // tools + 256k ctx

const INSTRUCTIONS = `You are the Gray Office finance operations agent for a
company's finance team. You help close the books, reconcile accounts, process
invoices, prepare cash reports, and handle GST / jurisdiction questions.

You have tools to inspect everything in this organization: teammates, connected
payment gateways and their live data, the bot/audit activity log, the company
bank account and its transactions, and the uploaded knowledge base.

- Be concise and specific. Show the numbers and the working.
- Call recallMemory before answering questions about the user's own setup;
  call saveMemory when they tell you something durable (entities, close
  cadence, thresholds, preferences).
- Search the knowledge base when a question might be answered by an uploaded
  document.
- MOVING MONEY: bankCredit / bankDebit / bankTransfer change real balances.
  NEVER call them with confirmed=true until the user has explicitly approved
  that exact amount and destination in this conversation. First reply with a
  plain-language summary of what you would do and ask them to confirm.
- Flag anything that needs a human's judgment instead of guessing.`;

type AgentEnv = Env;

export function createFinanceAgent(
	env: AgentEnv,
	{ userId, orgId }: { userId: string; orgId: string },
) {
	const workersai = createWorkersAI({ binding: env.AI });
	const bank = () => getOrgBank(env.DB, orgId);

	return new ToolLoopAgent({
		model: workersai(MODEL),
		instructions: INSTRUCTIONS,
		tools: {
			recallMemory: tool({
				description: "Recall previously saved facts about this user's finance setup.",
				inputSchema: z.object({ query: z.string().describe("what to look up") }),
				execute: async ({ query }) => ({ memories: await recall(env, userId, query) }),
			}),
			saveMemory: tool({
				description: "Persist a durable fact about this user's finance setup or preferences.",
				inputSchema: z.object({ fact: z.string().describe("the fact to remember, one sentence") }),
				execute: async ({ fact }) => {
					await remember(env, userId, fact);
					return { saved: true };
				},
			}),

			listОrgMembers: tool({
				description: "List the people in this organization and their roles.",
				inputSchema: z.object({}),
				execute: async () => ({ members: await listMembers(env.DB, orgId) }),
			}),

			listPaymentIntegrations: tool({
				description: "List which payment gateways (Stripe, Razorpay, ...) this org has connected.",
				inputSchema: z.object({}),
				execute: async () => {
					const conn = await listIntegrations(env.DB, orgId);
					return {
						integrations: Object.values(conn).map((i) => ({
							provider: i.provider,
							mode: i.mode,
							connected: Boolean(i.api_key),
							resources: i.resources,
						})),
					};
				},
			}),
			getPaymentData: tool({
				description: "Pull live data (payments, payouts, subscriptions, ...) from a connected gateway.",
				inputSchema: z.object({
					provider: z.enum(PROVIDER_IDS as [Provider, ...Provider[]]),
					resource: z.string().describe("resource key, e.g. 'payments'"),
				}),
				execute: async ({ provider, resource }) => {
					const conn = await listIntegrations(env.DB, orgId);
					const integ = conn[provider];
					if (!integ?.api_key) return { error: `${provider} is not connected` };
					const [data, events] = await Promise.all([
						fetchResource(integ, resource),
						recentEvents(env.DB, orgId, provider, 10),
					]);
					return { data, recentEvents: events };
				},
			}),

			listAuditEvents: tool({
				description: "Recent inbound bot/audit activity (Slack / Telegram / Discord messages and files).",
				inputSchema: z.object({ limit: z.number().min(1).max(50).default(15) }),
				execute: async ({ limit }) => {
					const { results } = await env.DB.prepare(
						"SELECT source, kind, summary, route, status, created_at FROM bot_events ORDER BY created_at DESC LIMIT ?",
					).bind(limit).all();
					return { events: results ?? [] };
				},
			}),

			getBankAccount: tool({
				description: "The organization's bank account: balance, holder, branch, and recent transactions.",
				inputSchema: z.object({}),
				execute: async () => {
					const row = await bank();
					if (!row) return { connected: false };
					const summary = await getBankSummary(row);
					return { connected: true, ...summary };
				},
			}),

			searchKnowledgeBase: tool({
				description: "Search the organization's uploaded documents for relevant passages.",
				inputSchema: z.object({ query: z.string() }),
				execute: async ({ query }) => ({ passages: await searchKb(env, orgId, query) }),
			}),

			bankCredit: bankWriteTool("credit", "Add money to the org's bank account."),
			bankDebit: bankWriteTool("debit", "Remove money from the org's bank account."),
			bankTransfer: tool({
				description: "Send money from the org's bank account via NEFT/IMPS/UPI/wire. Requires user confirmation.",
				inputSchema: z.object({
					confirmed: z.boolean().describe("true ONLY after the user approved this exact transfer"),
					method: z.enum(["neft", "imps", "upi", "wire"]),
					amount: z.number().positive(),
					to_account: z.string().optional(),
					upi_id: z.string().optional(),
					beneficiary_name: z.string().optional(),
					beneficiary_ifsc: z.string().optional(),
					swift: z.string().optional(),
					description: z.string().optional(),
				}),
				execute: async ({ confirmed, ...body }) => {
					if (!confirmed) return { needsConfirmation: true, proposed: { intent: "transfer", ...body } };
					const row = await bank();
					if (!row) return { error: "bank not connected" };
					try {
						return { done: await bankAction(row, "transfer", body) };
					} catch (err) {
						return { error: err instanceof Error ? err.message : String(err) };
					}
				},
			}),
		},
	});

	function bankWriteTool(intent: "credit" | "debit", description: string) {
		return tool({
			description: `${description} Requires user confirmation.`,
			inputSchema: z.object({
				confirmed: z.boolean().describe("true ONLY after the user approved this exact amount"),
				amount: z.number().positive(),
				description: z.string().optional(),
			}),
			execute: async ({ confirmed, amount, description: memo }) => {
				if (!confirmed) return { needsConfirmation: true, proposed: { intent, amount, description: memo } };
				const row = await bank();
				if (!row) return { error: "bank not connected" };
				try {
					return { done: await bankAction(row, intent, { amount, description: memo ?? "" }) };
				} catch (err) {
					return { error: err instanceof Error ? err.message : String(err) };
				}
			},
		});
	}
}
