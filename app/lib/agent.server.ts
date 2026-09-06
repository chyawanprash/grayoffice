import { ToolLoopAgent, tool, type LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { recall, remember } from "./pinecone.server";
import { listMembers } from "./org.server";
import { listIntegrations, recentEvents, fetchResource, createRefund, PROVIDER_IDS, type Provider } from "./payments.server";
import { getOrgBank, getBankSummary, bankAction } from "./bank.server";
import { searchKb } from "./kb.server";
import { getExtract, listDocumentsForAgent, queueExtraction } from "./docs.server";
import {
	computeGst,
	createInvoice,
	listCompanies,
	upsertCompany,
	getInvoice,
	listInvoices,
	setInvoiceStatus,
	postEntry,
	listJournalEntries,
	flagEntry,
	postJournalEntry,
	addAccrual,
	listAccruals,
	reverseAccrual,
	monthEndClose,
	reconcileBank,
	cashReport,
	transactionsByJurisdiction,
	processInvoiceDocument,
	setOrgProfile,
} from "./ledger.server";

/**
 * The Gray Office finance agent. The model is per-organization (chosen on the
 * Organization page); each choice needs its provider key set. Falls back to
 * Workers AI so it still runs with no keys. Pinecone is long-term memory. The
 * agent can read every entity in the caller's org and move money on the bank
 * account after in-chat confirmation.
 */
const WORKERS_AI_MODEL = "@cf/moonshotai/kimi-k2.7-code"; // fallback: tools + 256k ctx

export type AgentModelId = "gpt-5.6-luna" | "gemini-3.8-flash";

export const AGENT_MODELS: {
	id: AgentModelId;
	label: string;
	provider: "openai" | "google";
	keyVar: "OPENAI_API_KEY" | "GOOGLE_AI_API_KEY";
}[] = [
	{ id: "gpt-5.6-luna", label: "GPT-5.6 Luna (OpenAI)", provider: "openai", keyVar: "OPENAI_API_KEY" },
	{ id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (Google)", provider: "google", keyVar: "GOOGLE_AI_API_KEY" },
];

const DEFAULT_MODEL: AgentModelId = "gpt-5.6-luna";

/** Which configured models this deployment can actually run (key present). */
export function availableAgentModels(env: Env): AgentModelId[] {
	return AGENT_MODELS.filter((m) => env[m.keyVar]).map((m) => m.id);
}

function resolveModel(env: Env, preferred?: string | null): LanguageModel {
	const wanted = (AGENT_MODELS.find((m) => m.id === preferred)?.id ?? DEFAULT_MODEL) as AgentModelId;
	const spec = AGENT_MODELS.find((m) => m.id === wanted)!;

	if (spec.provider === "openai" && env.OPENAI_API_KEY) {
		return createOpenAI({ apiKey: env.OPENAI_API_KEY })(spec.id);
	}
	if (spec.provider === "google" && env.GOOGLE_AI_API_KEY) {
		return createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_API_KEY })(spec.id);
	}
	// Requested model's key is missing - try the other provider, then Workers AI.
	if (env.OPENAI_API_KEY) return createOpenAI({ apiKey: env.OPENAI_API_KEY })("gpt-5.6-luna");
	if (env.GOOGLE_AI_API_KEY)
		return createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_API_KEY })("gemini-3.8-flash");
	return createWorkersAI({ binding: env.AI })(WORKERS_AI_MODEL);
}

const INSTRUCTIONS = `You are the Gray Office finance operations agent. You work
inside one organization's Gray Office workspace, alongside its finance,
accounting and treasury team. You run the repetitive back-office work end to
end — closing the books, reconciling accounts, processing invoices, preparing
cash reports, tagging transactions by jurisdiction, and computing GST — and you
hand back only what genuinely needs a person's judgment.

## What you can see and do

You have real, live access to this organization. Use the tools — do not guess
at data you can look up.

- People — listOrgMembers: who is on the team and their roles.
- Documents (structured) — listDocuments then getDocument: PDFs the team
  uploaded, extracted to JSON. Invoices, purchase orders, GRNs, bank and
  credit-card statements, receipts, tax documents, journal entries. This is
  where header fields, amounts, dates, tax numbers and line items live.
- Knowledge base (prose) — searchKnowledgeBase: passages and policy text from
  the same and other uploaded documents. Use it for "what does our policy say",
  narrative context, anything not a clean field.
- Bank account — getBankAccount: the org's live balance, holder, branch and
  recent transactions (via bank.grayoffice.app). bankCredit / bankDebit /
  bankTransfer move money; bankSubscribe sets up a recurring charge (all
  approval-required).
- Adding documents — when the user attaches a PDF in chat it is saved to
  Documents automatically and you are told its id. saveDocumentFromUrl(url)
  does the same for a link. Then read it with getDocument once ready.
- Payment gateways — listPaymentIntegrations, then getPaymentData(provider,
  resource): connected Stripe / Razorpay / Cashfree / Polar / Dodo accounts
  and their live payments, payouts, refunds, subscriptions, balances.
  refundPayment issues a real refund on one of them (approval required).
- Activity log — listAuditEvents: recent inbound Slack / Telegram / Discord
  messages and files routed through Gray Office.
- Your memory — recallMemory / saveMemory: durable facts about this team's
  setup (legal entities, close cadence, approval thresholds, chart-of-accounts
  quirks, preferences). Call recallMemory before answering anything about
  "our" setup. Call saveMemory the moment the user states such a fact.
- Move money — bankCredit, bankDebit, bankTransfer: change the real bank
  balance. See the approval rule below.
- Companies & invoices — listCompanies / addCompany; createInvoice against a
  company (computes the GST split per line and posts the ledger entry —
  approval-required); listInvoices / getInvoiceDetail / markInvoicePaid.
  processInvoiceDocument turns an already-extracted PDF into a draft invoice
  with duplicate + fraud checks and routes it for approval. computeGst and
  setHomeJurisdiction help work out place of supply.
- General ledger — createJournalEntry (approval-required; unbalanced entries
  save as needs_review), listJournalEntries, flagJournalEntry to send one to a
  human, postJournalEntry. Accruals: addAccrual / listAccruals / reverseAccrual.
- Analyses — monthEndClose(period YYYY-MM), reconcileBank, cashReport,
  transactionsByJurisdiction. Run the matching one before answering "how's the
  close going", "what's unreconciled", "what's our cash position / 13-week
  forecast", "break transactions down by state".

## How to work

1. Orient before you answer. For anything about "our" numbers, first pull the
   relevant tools (documents, bank, payments, memory) and reconcile them
   against each other. Chain tools freely across steps — a real answer often
   needs three or four.
2. Show the numbers and the working, not just a conclusion. Name where each
   figure came from (which document, which gateway, the bank).
3. Be concise. A finance colleague's reply, not an essay. Tables and short
   lists over paragraphs.
4. Currency and dates: match the source document's currency and India-style
   number formatting unless told otherwise. Never invent a figure you could
   not derive from a tool result.
5. If tools disagree or data is missing, say so plainly and say what you would
   need to resolve it. Do not paper over a gap.

## Standard plays

- Close the books: monthEndClose(period). Walk the returned checklist — post
  draft journal entries, resolve flagged ones, confirm or reverse open
  accruals, chase overdue invoices, reconcile the bank. Post what's routine;
  flagJournalEntry anything that needs a human's judgment, and say why.
- Reconciliation: reconcileBank — report matched / partial (with the delta) /
  unmatched. For unmatched lines, look for a matching invoice or propose the
  journal entry that would clear it.
- Invoice processing: for each unprocessed PDF, processInvoiceDocument — it
  matches/creates the company, runs duplicate + fraud checks (round large
  amounts, new payee + big amount, bad GSTIN), and routes it. Summarise what's
  ready to approve vs flagged. For a PO/GRN 3-way match, pull them with
  getDocument and compare ordered vs received vs billed.
- Cash reports: cashReport — today's position + the 13-week forecast from open
  AR/AP. Call out the weeks that go negative and the largest outflows.
- Transactions by country & state: transactionsByJurisdiction — the buckets
  plus the reconciliation line; explain any difference from the control total.
- GST / place of supply: computeGst (or createInvoice, which does it) — intra-
  state → CGST+SGST, inter-state / export → IGST, reverse charge → no tax on
  the invoice. Check the rate and GSTIN format; call out reverse-charge cases.

## Actions that create records or move money — approval required

Money: bankCredit, bankDebit, bankTransfer, bankSubscribe, refundPayment.
Records: createInvoice, createJournalEntry, postJournalEntry, markInvoicePaid,
reverseAccrual. NEVER call any of these with confirmed=true until, in this same
conversation, the user has explicitly approved that exact action. First reply
in plain language with what you would do (the amounts, accounts, company,
dates) and ask them to confirm. If they say yes, call it with confirmed=true.
Read-only tools and processInvoiceDocument (which only creates a *draft*) need
no confirmation. If anything is ambiguous, ask — do not assume.

## When to stop and escalate

Flag to a human, rather than acting or guessing, when: an amount is unusually
large or off-pattern, a match is only partial, a tax treatment is genuinely
uncertain, a document looks altered or inconsistent, or an action would be
hard to reverse. State clearly what you found and what decision you need.`;

type AgentEnv = Env;

export function createFinanceAgent(
	env: AgentEnv,
	{ userId, orgId, model }: { userId: string; orgId: string; model?: string | null },
) {
	const bank = () => getOrgBank(env.DB, orgId);

	return new ToolLoopAgent({
		model: resolveModel(env, model),
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

			listOrgMembers: tool({
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
					const txns = summary?.transactions ?? [];
					return {
						connected: true,
						...summary,
						_display: {
							kind: "table",
							caption: `${summary?.account.holder_name ?? "Account"} — balance ₹${summary?.account.balance?.toLocaleString("en-IN") ?? "?"}`,
							columns: [
								{ key: "created_at", label: "Date" },
								{ key: "description", label: "Description" },
								{ key: "amount", label: "Amount", align: "right" },
								{ key: "balance_after", label: "Balance", align: "right" },
							],
							rows: txns.slice(0, 20).map((t) => ({
								created_at: new Date(t.created_at).toLocaleDateString(),
								description: t.description,
								amount: `${t.type === "credit" ? "+" : "−"}₹${t.amount.toLocaleString("en-IN")}`,
								balance_after: `₹${t.balance_after.toLocaleString("en-IN")}`,
							})),
						},
					};
				},
			}),

			listDocuments: tool({
				description:
					"List the org's uploaded PDFs that have been extracted to structured JSON (invoices, POs, GRNs, statements, receipts, tax docs) - id, type and a one-line summary each.",
				inputSchema: z.object({}),
				execute: async () => ({ documents: await listDocumentsForAgent(env.DB, orgId) }),
			}),
			getDocument: tool({
				description:
					"Get the full extracted JSON ({ document_type, summary, data }) for one uploaded document by its id (from listDocuments).",
				inputSchema: z.object({ id: z.string() }),
				execute: async ({ id }) => {
					const row = await getExtract(env.DB, orgId, id);
					if (!row) return { error: "not found" };
					if (row.status !== "ready") return { status: row.status, error: row.error };
					try {
						return { name: row.name, doc_type: row.doc_type, extracted: JSON.parse(row.json ?? "{}") };
					} catch {
						return { name: row.name, doc_type: row.doc_type, extracted: row.json };
					}
				},
			}),

			searchKnowledgeBase: tool({
				description: "Search the organization's uploaded documents for relevant passages.",
				inputSchema: z.object({ query: z.string() }),
				execute: async ({ query }) => {
					const passages = await searchKb(env, orgId, query);
					return {
						passages,
						_display: passages.length
							? {
									kind: "context",
									count: String(passages.length),
									chunks: passages.map((p) => ({
										title: p.name,
										chars: `${p.text.length} characters`,
										body: p.text.slice(0, 240),
										source: p.name,
										badge: "DOC",
										tone: "bg-aic",
									})),
								}
							: undefined,
					};
				},
			}),

			/* ---- companies + invoices ---- */
			listCompanies: tool({
				description: "List the org's customers and vendors (name, role, GSTIN, state).",
				inputSchema: z.object({}),
				execute: async () => ({ companies: await listCompanies(env.DB, orgId) }),
			}),
			addCompany: tool({
				description: "Create (or update) a customer/vendor.",
				inputSchema: z.object({
					name: z.string(),
					role: z.enum(["customer", "vendor", "both"]).optional(),
					gstin: z.string().optional(),
					state: z.string().optional().describe("Indian state for place of supply"),
					country: z.string().optional(),
					email: z.string().optional(),
				}),
				execute: async (c) => ({ company: await upsertCompany(env.DB, orgId, c) }),
			}),
			setHomeJurisdiction: tool({
				description: "Set the org's own state/country - used as the seller side for GST place-of-supply.",
				inputSchema: z.object({ state: z.string(), country: z.string().optional() }),
				execute: async ({ state, country }) => {
					await setOrgProfile(env.DB, orgId, { home_state: state, home_country: country ?? null });
					return { ok: true };
				},
			}),
			computeGst: tool({
				description:
					"Compute the GST split (CGST+SGST intra-state, IGST inter-state) for a set of lines without creating anything.",
				inputSchema: z.object({
					sellerState: z.string().optional(),
					buyerState: z.string().optional(),
					reverseCharge: z.boolean().optional(),
					isExport: z.boolean().optional(),
					lines: z.array(
						z.object({
							description: z.string(),
							qty: z.number().optional(),
							unit_price: z.number(),
							gst_rate: z.number().optional().describe("percent, e.g. 18"),
						}),
					),
				}),
				execute: async ({ sellerState, buyerState, reverseCharge, isExport, lines }) =>
					computeGst({ lines, sellerState, buyerState, reverseCharge, export_: isExport }),
			}),
			createInvoice: tool({
				description:
					"Create an invoice against a company. Computes GST per line and posts the ledger entry. `direction`: receivable = we bill a customer; payable = a bill we owe. Requires user confirmation.",
				inputSchema: z.object({
					confirmed: z.boolean().describe("true ONLY after the user approved this invoice"),
					company_id: z.string().optional(),
					company_name: z.string().optional(),
					direction: z.enum(["receivable", "payable"]),
					number: z.string().optional(),
					issue_date: z.string().optional().describe("YYYY-MM-DD, defaults today"),
					due_date: z.string().optional(),
					reverse_charge: z.boolean().optional(),
					isExport: z.boolean().optional(),
					notes: z.string().optional(),
					lines: z.array(
						z.object({
							description: z.string(),
							hsn_sac: z.string().optional(),
							qty: z.number().optional(),
							unit_price: z.number(),
							gst_rate: z.number().optional(),
						}),
					),
				}),
				execute: async ({ confirmed, isExport, ...input }) => {
					if (!confirmed) return { needsConfirmation: true, proposed: { intent: "createInvoice", ...input } };
					try {
						return await createInvoice(env, orgId, { ...input, export: isExport });
					} catch (err) {
						return { error: err instanceof Error ? err.message : String(err) };
					}
				},
			}),
			listInvoices: tool({
				description: "List invoices, optionally filtered by direction (receivable|payable) or status (draft|open|paid|void).",
				inputSchema: z.object({ direction: z.enum(["receivable", "payable"]).optional(), status: z.string().optional() }),
				execute: async (o) => ({ invoices: await listInvoices(env.DB, orgId, o) }),
			}),
			getInvoiceDetail: tool({
				description: "Full invoice with line items and the GST breakdown.",
				inputSchema: z.object({ id: z.string() }),
				execute: async ({ id }) => (await getInvoice(env.DB, orgId, id)) ?? { error: "not found" },
			}),
			markInvoicePaid: tool({
				description: "Mark an invoice paid (or void). Requires user confirmation.",
				inputSchema: z.object({ confirmed: z.boolean(), id: z.string(), status: z.enum(["paid", "void", "open"]) }),
				execute: async ({ confirmed, id, status }) => {
					if (!confirmed) return { needsConfirmation: true, proposed: { intent: "markInvoice", id, status } };
					await setInvoiceStatus(env.DB, orgId, id, status);
					return { ok: true };
				},
			}),
			processInvoiceDocument: tool({
				description:
					"Turn an already-extracted PDF (from listDocuments) into a draft invoice: matches/creates the company, runs duplicate + fraud checks, and routes it for approval.",
				inputSchema: z.object({ docId: z.string(), direction: z.enum(["receivable", "payable"]).optional() }),
				execute: async ({ docId, direction }) => processInvoiceDocument(env, orgId, docId, direction ?? "payable"),
			}),

			/* ---- general ledger ---- */
			createJournalEntry: tool({
				description:
					"Post a journal entry. Lines each have an account and either debit_cents or credit_cents (integer paise). Unbalanced entries are saved as needs_review. Requires user confirmation.",
				inputSchema: z.object({
					confirmed: z.boolean(),
					date: z.string().describe("YYYY-MM-DD"),
					memo: z.string().optional(),
					lines: z.array(
						z.object({
							account: z.string(),
							debit_cents: z.number().int().optional(),
							credit_cents: z.number().int().optional(),
							memo: z.string().optional(),
						}),
					),
				}),
				execute: async ({ confirmed, ...e }) => {
					if (!confirmed) return { needsConfirmation: true, proposed: { intent: "journalEntry", ...e } };
					return postEntry(env, orgId, { ...e, source: "agent", status: "posted" });
				},
			}),
			listJournalEntries: tool({
				description: "List ledger entries. Filter by status (draft|posted|needs_review) or period (YYYY-MM).",
				inputSchema: z.object({ status: z.string().optional(), period: z.string().optional() }),
				execute: async (o) => ({ entries: await listJournalEntries(env.DB, orgId, o) }),
			}),
			flagJournalEntry: tool({
				description: "Flag a journal entry as needing a human's review, with a reason.",
				inputSchema: z.object({ id: z.string(), reason: z.string() }),
				execute: async ({ id, reason }) => {
					await flagEntry(env.DB, orgId, id, reason);
					return { ok: true };
				},
			}),
			postJournalEntry: tool({
				description: "Move a draft / reviewed journal entry to posted. Requires user confirmation.",
				inputSchema: z.object({ confirmed: z.boolean(), id: z.string() }),
				execute: async ({ confirmed, id }) => {
					if (!confirmed) return { needsConfirmation: true, proposed: { intent: "postEntry", id } };
					await postJournalEntry(env.DB, orgId, id);
					return { ok: true };
				},
			}),

			/* ---- accruals ---- */
			addAccrual: tool({
				description: "Record an accrual for a period (YYYY-MM).",
				inputSchema: z.object({ description: z.string(), amount: z.number(), period: z.string() }),
				execute: async (a) => addAccrual(env.DB, orgId, a),
			}),
			listAccruals: tool({
				description: "List accruals, optionally for one period (YYYY-MM).",
				inputSchema: z.object({ period: z.string().optional() }),
				execute: async ({ period }) => ({ accruals: await listAccruals(env.DB, orgId, period) }),
			}),
			reverseAccrual: tool({
				description: "Mark an accrual reversed. Requires user confirmation.",
				inputSchema: z.object({ confirmed: z.boolean(), id: z.string() }),
				execute: async ({ confirmed, id }) => {
					if (!confirmed) return { needsConfirmation: true, proposed: { intent: "reverseAccrual", id } };
					await reverseAccrual(env.DB, orgId, id);
					return { ok: true };
				},
			}),

			/* ---- analyses ---- */
			monthEndClose: tool({
				description: "Run the month-end close checklist for a period (YYYY-MM): what's still open across the ledger, accruals, invoices and bank.",
				inputSchema: z.object({ period: z.string().describe("YYYY-MM") }),
				execute: async ({ period }) => monthEndClose(env, orgId, period),
			}),
			reconcileBank: tool({
				description: "Match every bank transaction to an invoice or ledger entry; returns matched, partial (with delta) and unmatched.",
				inputSchema: z.object({}),
				execute: async () => reconcileBank(env, orgId),
			}),
			cashReport: tool({
				description: "Current cash position plus a 13-week forecast built from open AR/AP due dates.",
				inputSchema: z.object({}),
				execute: async () => cashReport(env, orgId),
			}),
			transactionsByJurisdiction: tool({
				description: "Every invoice bucketed by country + state (place of supply), with a reconciliation against the control total.",
				inputSchema: z.object({}),
				execute: async () => transactionsByJurisdiction(env, orgId),
			}),

			saveDocumentFromUrl: tool({
				description:
					"Fetch a PDF from a URL and save it into the org's Documents for extraction. Returns the new document id; poll getDocument until status is ready.",
				inputSchema: z.object({
					url: z.url(),
					name: z.string().optional().describe("filename to store it as"),
				}),
				execute: async ({ url, name }) => {
					try {
						const res = await fetch(url);
						if (!res.ok) return { error: `fetch failed: ${res.status}` };
						const ct = res.headers.get("content-type") ?? "";
						if (!/pdf/i.test(ct) && !/\.pdf($|\?)/i.test(url))
							return { error: "that URL does not look like a PDF" };
						const bytes = await res.arrayBuffer();
						if (bytes.byteLength > 8 * 1024 * 1024) return { error: "PDF is larger than 8 MB" };
						const fname = (name || url.split("/").pop() || "document.pdf").slice(0, 200);
						const docId = await queueExtraction(env, orgId, fname, bytes);
						return { saved: true, id: docId, name: fname, status: "processing" };
					} catch (err) {
						return { error: err instanceof Error ? err.message : String(err) };
					}
				},
			}),

			bankCredit: bankWriteTool("credit", "Add money to the org's bank account."),
			bankDebit: bankWriteTool("debit", "Remove money from the org's bank account."),
			bankSubscribe: tool({
				description:
					"Set up a recurring hourly charge on the org's bank account (a dummy-company subscription). Requires user confirmation.",
				inputSchema: z.object({
					confirmed: z.boolean().describe("true ONLY after the user approved this recurring charge"),
					company_name: z.string(),
					charge_amount: z.number().positive().describe("amount charged each hour, in rupees"),
				}),
				execute: async ({ confirmed, ...body }) => {
					if (!confirmed)
						return { needsConfirmation: true, proposed: { intent: "subscribe", ...body } };
					const row = await bank();
					if (!row) return { error: "bank not connected" };
					try {
						return { done: await bankAction(row, "subscribe", body) };
					} catch (err) {
						return { error: err instanceof Error ? err.message : String(err) };
					}
				},
			}),
			refundPayment: tool({
				description:
					"Issue a refund on a connected payment gateway. Requires user confirmation. `id` is the gateway's payment/order id; omit `amount` for a full refund where supported (Cashfree needs an explicit amount).",
				inputSchema: z.object({
					confirmed: z.boolean().describe("true ONLY after the user approved this exact refund"),
					provider: z.enum(PROVIDER_IDS as [Provider, ...Provider[]]),
					id: z.string().describe("payment id (Stripe pi_/ch_, Razorpay pay_) or order id (Polar/Cashfree)"),
					amount: z.number().positive().optional().describe("major currency units; omit for full refund"),
					reason: z.string().optional(),
				}),
				execute: async ({ confirmed, provider, id, amount, reason }) => {
					if (!confirmed)
						return { needsConfirmation: true, proposed: { intent: "refund", provider, id, amount, reason } };
					const conn = await listIntegrations(env.DB, orgId);
					const integ = conn[provider];
					if (!integ?.api_key) return { error: `${provider} is not connected` };
					return createRefund(integ, { id, amount, reason });
				},
			}),
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
