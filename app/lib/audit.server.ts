/**
 * The audit room's data. One unified, time-ordered activity feed for an org:
 * chat-bot messages, invoices raised, ledger entries posted, payment webhooks,
 * and bank movements. Read-only — everything here is written by other flows.
 */
import { getOrgBank, getBankSummary } from "./bank.server";
import { formatMoney } from "./money";

type Env = { DB: D1Database; BANK_URL?: string };

export type AuditCategory = "bot" | "invoice" | "ledger" | "payment" | "bank";

export type AuditEvent = {
	ts: number; // unix seconds
	category: AuditCategory;
	actor: string; // who/what caused it
	action: string; // short verb phrase
	detail: string; // human summary
	status: string | null; // done | error | needs_review | posted | open | paid …
	ref: string | null; // link target within the app, or null
};

const CAP = 250;

export async function orgActivity(
	env: Env,
	orgId: string,
	opts: { category?: AuditCategory; currency?: string } = {},
): Promise<AuditEvent[]> {
	const db = env.DB;
	const { category, currency = "INR" } = opts;
	const m = (n: number) => formatMoney(n, currency);
	const events: AuditEvent[] = [];
	const want = (c: AuditCategory) => !category || category === c;

	const jobs: Promise<void>[] = [];

	if (want("bot")) {
		jobs.push(
			db.prepare(
				`SELECT source, external_user, kind, summary, route, status, created_at, updated_at
				 FROM bot_events WHERE org_id = ? ORDER BY created_at DESC LIMIT ${CAP}`,
			).bind(orgId).all<{
				source: string; external_user: string | null; kind: string; summary: string | null;
				route: string | null; status: string; created_at: number; updated_at: number;
			}>().then(({ results }) => {
				for (const e of results ?? []) {
					events.push({
						ts: e.updated_at || e.created_at,
						category: "bot",
						actor: `${e.source}${e.external_user ? ` · ${e.external_user}` : ""}`,
						action: e.kind === "file" ? "Sent a file" : "Sent a message",
						detail: `${e.summary ?? ""}${e.route ? ` → ${e.route}` : ""}`,
						status: e.status,
						ref: "/dashboard/integrations",
					});
				}
			}),
		);
	}

	if (want("invoice")) {
		jobs.push(
			db.prepare(
				`SELECT i.id, i.number, i.direction, i.status, i.source, i.total_cents, i.created_at, c.name AS company
				 FROM invoices i JOIN companies c ON c.id = i.company_id
				 WHERE i.org_id = ? ORDER BY i.created_at DESC LIMIT ${CAP}`,
			).bind(orgId).all<{
				id: string; number: string; direction: string; status: string; source: string;
				total_cents: number; created_at: number; company: string;
			}>().then(({ results }) => {
				for (const i of results ?? []) {
					const sale = i.direction === "receivable";
					events.push({
						ts: i.created_at,
						category: "invoice",
						actor: i.source === "agent" ? "Bhondu" : i.source === "document" ? "Document import" : "Manual",
						action: sale ? "Raised a sales invoice" : "Recorded a purchase invoice",
						detail: `${i.number} · ${i.company} · ${m(i.total_cents / 100)}`,
						status: i.status,
						ref: `/dashboard/invoices?id=${i.id}`,
					});
				}
			}),
		);
	}

	if (want("ledger")) {
		jobs.push(
			db.prepare(
				`SELECT id, date, memo, status, review_note, source, created_at
				 FROM journal_entries WHERE org_id = ? ORDER BY created_at DESC LIMIT ${CAP}`,
			).bind(orgId).all<{
				id: string; date: string; memo: string | null; status: string;
				review_note: string | null; source: string; created_at: number;
			}>().then(({ results }) => {
				for (const j of results ?? []) {
					events.push({
						ts: j.created_at,
						category: "ledger",
						actor: j.source === "agent" ? "Bhondu" : j.source,
						action: j.status === "needs_review" ? "Flagged a journal entry" : "Posted a journal entry",
						detail: `${j.memo ?? "(no memo)"}${j.review_note ? ` — ${j.review_note}` : ""}`,
						status: j.status,
						ref: null,
					});
				}
			}),
		);
	}

	if (want("payment")) {
		jobs.push(
			db.prepare(
				`SELECT provider, type, summary, created_at
				 FROM payment_events WHERE org_id = ? ORDER BY created_at DESC LIMIT ${CAP}`,
			).bind(orgId).all<{ provider: string; type: string | null; summary: string | null; created_at: number }>()
				.then(({ results }) => {
					for (const p of results ?? []) {
						events.push({
							ts: p.created_at,
							category: "payment",
							actor: p.provider,
							action: "Received a webhook",
							detail: `${p.type ?? "event"}${p.summary ? ` · ${p.summary}` : ""}`,
							status: null,
							ref: `/dashboard/integrations/${p.provider}`,
						});
					}
				})
				.catch(() => {}),
		);
	}

	if (want("bank")) {
		jobs.push(
			(async () => {
				const row = await getOrgBank(db, orgId);
				if (!row) return;
				const s = await getBankSummary(row).catch(() => null);
				for (const t of s?.transactions ?? []) {
					events.push({
						ts: Math.floor(new Date(t.created_at).getTime() / 1000),
						category: "bank",
						actor: "Bank",
						action: t.type === "credit" ? "Money in" : "Money out",
						detail: `${t.description} · ${m(t.amount)} · bal ${m(t.balance_after)}`,
						status: null,
						ref: "/dashboard/banking",
					});
				}
			})().catch(() => {}),
		);
	}

	await Promise.all(jobs);
	events.sort((a, b) => b.ts - a.ts);
	return events.slice(0, CAP);
}
