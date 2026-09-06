/**
 * The org's finance data model - companies, invoices, a general ledger, and
 * accruals - plus the analyses the agent runs over it: month-end close,
 * bank reconciliation, cash report, jurisdiction rollup, GST computation.
 *
 * Amounts are integer minor units (paise) throughout. ponytail: single-currency
 * math per invoice, no FX; add a rate table when a second currency shows up.
 */
import { getOrgBank, getBankSummary } from "./bank.server";
import { getExtract } from "./docs.server";

type Env = { DB: D1Database };

const uid = () => crypto.randomUUID();
const inr = (cents: number) => cents / 100;
const r = (n: number) => Math.round(n);
const today = () => new Date().toISOString().slice(0, 10);

/* ─────────────────────────────────────────────────────────── GST */

export type GstLineInput = {
	description: string;
	hsn_sac?: string;
	qty?: number;
	unit_price: number; // major units
	gst_rate?: number; // percent
};

export type GstLine = GstLineInput & {
	taxable_cents: number;
	cgst_cents: number;
	sgst_cents: number;
	igst_cents: number;
	line_total_cents: number;
};

/**
 * Per-line GST split. Intra-state (seller state == buyer state) => CGST+SGST;
 * inter-state / unknown buyer state / export => IGST. Reverse charge => the
 * recipient accounts for tax, so the invoice carries none.
 */
export function computeGst(opts: {
	lines: GstLineInput[];
	sellerState?: string | null;
	buyerState?: string | null;
	reverseCharge?: boolean;
	export_?: boolean;
}): { lines: GstLine[]; subtotal_cents: number; tax_cents: number; total_cents: number; place_of_supply: string } {
	const seller = (opts.sellerState ?? "").trim().toLowerCase();
	const buyer = (opts.buyerState ?? "").trim().toLowerCase();
	const intra = !!seller && !!buyer && seller === buyer && !opts.export_;
	const noTax = !!opts.reverseCharge || !!opts.export_;

	const lines: GstLine[] = opts.lines.map((l) => {
		const taxable_cents = r((l.qty ?? 1) * l.unit_price * 100);
		const rate = noTax ? 0 : l.gst_rate ?? 0;
		let cgst = 0,
			sgst = 0,
			igst = 0;
		if (rate > 0) {
			if (intra) {
				cgst = sgst = r((taxable_cents * rate) / 200);
			} else {
				igst = r((taxable_cents * rate) / 100);
			}
		}
		return {
			...l,
			taxable_cents,
			cgst_cents: cgst,
			sgst_cents: sgst,
			igst_cents: igst,
			line_total_cents: taxable_cents + cgst + sgst + igst,
		};
	});

	const sum = (f: (x: GstLine) => number) => lines.reduce((a, x) => a + f(x), 0);
	const subtotal_cents = sum((x) => x.taxable_cents);
	const tax_cents = sum((x) => x.cgst_cents + x.sgst_cents + x.igst_cents);
	return {
		lines,
		subtotal_cents,
		tax_cents,
		total_cents: subtotal_cents + tax_cents,
		place_of_supply: opts.export_
			? "Export"
			: opts.buyerState || (opts.reverseCharge ? "Reverse charge" : "Unknown"),
	};
}

/* ─────────────────────────────────────────────────────────── companies */

export type Company = {
	id: string;
	name: string;
	role: string;
	gstin: string | null;
	state: string | null;
	country: string | null;
	email: string | null;
};

export async function listCompanies(db: D1Database, orgId: string): Promise<Company[]> {
	const { results } = await db
		.prepare("SELECT id, name, role, gstin, state, country, email FROM companies WHERE org_id = ? ORDER BY name")
		.bind(orgId)
		.all<Company>();
	return results ?? [];
}

export async function getCompany(db: D1Database, orgId: string, id: string): Promise<Company | null> {
	return db
		.prepare("SELECT id, name, role, gstin, state, country, email FROM companies WHERE id = ? AND org_id = ?")
		.bind(id, orgId)
		.first<Company>();
}

/** Find a company by (case-insensitive) name, or create it. */
export async function upsertCompany(
	db: D1Database,
	orgId: string,
	c: { name: string; role?: string; gstin?: string; state?: string; country?: string; email?: string },
): Promise<Company> {
	const existing = await db
		.prepare("SELECT id, name, role, gstin, state, country, email FROM companies WHERE org_id = ? AND lower(name) = lower(?)")
		.bind(orgId, c.name)
		.first<Company>();
	if (existing) {
		// fill in any blanks we learned
		await db
			.prepare(
				"UPDATE companies SET gstin = COALESCE(gstin, ?), state = COALESCE(state, ?), email = COALESCE(email, ?) WHERE id = ?",
			)
			.bind(c.gstin ?? null, c.state ?? null, c.email ?? null, existing.id)
			.run();
		return { ...existing, gstin: existing.gstin ?? c.gstin ?? null, state: existing.state ?? c.state ?? null };
	}
	const id = uid();
	await db
		.prepare(
			"INSERT INTO companies (id, org_id, name, role, gstin, state, country, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(id, orgId, c.name.slice(0, 160), c.role ?? "both", c.gstin ?? null, c.state ?? null, c.country ?? "IN", c.email ?? null)
		.run();
	return { id, name: c.name, role: c.role ?? "both", gstin: c.gstin ?? null, state: c.state ?? null, country: c.country ?? "IN", email: c.email ?? null };
}

/* ─────────────────────────────────────────────────────────── invoices */

async function orgHome(db: D1Database, orgId: string): Promise<{ state: string | null; country: string | null }> {
	const row = await db
		.prepare("SELECT home_state, home_country FROM organizations WHERE id = ?")
		.bind(orgId)
		.first<{ home_state: string | null; home_country: string | null }>();
	return { state: row?.home_state ?? null, country: row?.home_country ?? "IN" };
}

async function nextInvoiceNumber(db: D1Database, orgId: string, direction: string): Promise<string> {
	const { c } = (await db
		.prepare("SELECT COUNT(*) AS c FROM invoices WHERE org_id = ? AND direction = ?")
		.bind(orgId, direction)
		.first<{ c: number }>()) ?? { c: 0 };
	const prefix = direction === "receivable" ? "INV" : "BILL";
	return `${prefix}-${new Date().getFullYear()}-${String(c + 1).padStart(4, "0")}`;
}

export type CreateInvoiceInput = {
	company_id?: string;
	company_name?: string;
	direction: "receivable" | "payable";
	number?: string;
	issue_date?: string;
	due_date?: string;
	currency?: string;
	reverse_charge?: boolean;
	export?: boolean;
	notes?: string;
	lines: GstLineInput[];
	source?: string;
	source_ref?: string;
};

export async function createInvoice(env: Env, orgId: string, input: CreateInvoiceInput) {
	const db = env.DB;
	let company = input.company_id ? await getCompany(db, orgId, input.company_id) : null;
	if (!company && input.company_name) company = await upsertCompany(db, orgId, { name: input.company_name });
	if (!company) throw new Error("no company - pass company_id or company_name");

	const home = await orgHome(db, orgId);
	const sellerState = input.direction === "receivable" ? home.state : company.state;
	const buyerState = input.direction === "receivable" ? company.state : home.state;

	const gst = computeGst({
		lines: input.lines,
		sellerState,
		buyerState,
		reverseCharge: input.reverse_charge,
		export_: input.export,
	});

	const id = uid();
	const number = input.number || (await nextInvoiceNumber(db, orgId, input.direction));
	const issue_date = input.issue_date || today();

	// dedupe on (org, company, number) - unique index enforces it too
	const dup = await db
		.prepare("SELECT id FROM invoices WHERE org_id = ? AND company_id = ? AND number = ?")
		.bind(orgId, company.id, number)
		.first<{ id: string }>();
	if (dup) return { duplicate: true, existing_id: dup.id, number };

	await db
		.prepare(
			`INSERT INTO invoices
			 (id, org_id, company_id, direction, number, issue_date, due_date, currency, status,
			  place_of_supply, reverse_charge, subtotal_cents, tax_cents, total_cents, notes, source, source_ref)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id, orgId, company.id, input.direction, number, issue_date, input.due_date ?? null,
			input.currency ?? "INR", gst.place_of_supply, input.reverse_charge ? 1 : 0,
			gst.subtotal_cents, gst.tax_cents, gst.total_cents, input.notes ?? null,
			input.source ?? "agent", input.source_ref ?? null,
		)
		.run();

	for (const l of gst.lines) {
		await db
			.prepare(
				`INSERT INTO invoice_lines
				 (id, invoice_id, description, hsn_sac, qty, unit_price_cents, gst_rate,
				  taxable_cents, cgst_cents, sgst_cents, igst_cents, line_total_cents)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				uid(), id, l.description.slice(0, 300), l.hsn_sac ?? null, l.qty ?? 1,
				r((l.unit_price ?? 0) * 100), l.gst_rate ?? 0, l.taxable_cents,
				l.cgst_cents, l.sgst_cents, l.igst_cents, l.line_total_cents,
			)
			.run();
	}

	// post the ledger entry
	const arAp = input.direction === "receivable" ? "Accounts Receivable" : "Accounts Payable";
	const revExp = input.direction === "receivable" ? "Revenue" : "Expense";
	await postEntry(env, orgId, {
		date: issue_date,
		memo: `${number} · ${company.name}`,
		source: "invoice",
		source_ref: id,
		status: "posted",
		lines:
			input.direction === "receivable"
				? [
						{ account: arAp, debit_cents: gst.total_cents },
						{ account: revExp, credit_cents: gst.subtotal_cents },
						...(gst.tax_cents ? [{ account: "GST Payable", credit_cents: gst.tax_cents }] : []),
					]
				: [
						{ account: revExp, debit_cents: gst.subtotal_cents },
						...(gst.tax_cents ? [{ account: "GST Input Credit", debit_cents: gst.tax_cents }] : []),
						{ account: arAp, credit_cents: gst.total_cents },
					],
	});

	return {
		id,
		number,
		company: company.name,
		direction: input.direction,
		place_of_supply: gst.place_of_supply,
		subtotal: inr(gst.subtotal_cents),
		tax: inr(gst.tax_cents),
		total: inr(gst.total_cents),
		lines: gst.lines.map((l) => ({
			description: l.description,
			taxable: inr(l.taxable_cents),
			cgst: inr(l.cgst_cents),
			sgst: inr(l.sgst_cents),
			igst: inr(l.igst_cents),
			total: inr(l.line_total_cents),
		})),
	};
}

export async function listInvoices(
	db: D1Database,
	orgId: string,
	opts: { direction?: string; status?: string; limit?: number } = {},
) {
	const where = ["i.org_id = ?"];
	const bind: unknown[] = [orgId];
	if (opts.direction) {
		where.push("i.direction = ?");
		bind.push(opts.direction);
	}
	if (opts.status) {
		where.push("i.status = ?");
		bind.push(opts.status);
	}
	const { results } = await db
		.prepare(
			`SELECT i.id, i.number, i.direction, i.status, i.issue_date, i.due_date,
			        i.total_cents, i.place_of_supply, c.name AS company
			 FROM invoices i JOIN companies c ON c.id = i.company_id
			 WHERE ${where.join(" AND ")} ORDER BY i.issue_date DESC LIMIT ?`,
		)
		.bind(...bind, opts.limit ?? 50)
		.all<{
			id: string;
			number: string;
			direction: string;
			status: string;
			issue_date: string;
			due_date: string | null;
			total_cents: number;
			place_of_supply: string | null;
			company: string;
		}>();
	return (results ?? []).map((x) => ({ ...x, total: inr(x.total_cents) }));
}

export async function getInvoice(db: D1Database, orgId: string, id: string) {
	const inv = await db
		.prepare(
			`SELECT i.*, c.name AS company, c.gstin, c.state AS company_state
			 FROM invoices i JOIN companies c ON c.id = i.company_id
			 WHERE i.id = ? AND i.org_id = ?`,
		)
		.bind(id, orgId)
		.first<{
			id: string;
			number: string;
			direction: string;
			status: string;
			issue_date: string;
			due_date: string | null;
			place_of_supply: string | null;
			reverse_charge: number;
			company: string;
			gstin: string | null;
			company_state: string | null;
			subtotal_cents: number;
			tax_cents: number;
			total_cents: number;
			notes: string | null;
		}>();
	if (!inv) return null;
	const { results: lines } = await db
		.prepare("SELECT description, hsn_sac, qty, unit_price_cents, gst_rate, taxable_cents, cgst_cents, sgst_cents, igst_cents, line_total_cents FROM invoice_lines WHERE invoice_id = ?")
		.bind(id)
		.all<Record<string, number | string>>();
	return {
		...inv,
		subtotal: inr(inv.subtotal_cents as number),
		tax: inr(inv.tax_cents as number),
		total: inr(inv.total_cents as number),
		lines: (lines ?? []).map((l) => ({
			description: l.description,
			hsn_sac: l.hsn_sac,
			qty: l.qty,
			unit_price: inr(l.unit_price_cents as number),
			gst_rate: l.gst_rate,
			taxable: inr(l.taxable_cents as number),
			cgst: inr(l.cgst_cents as number),
			sgst: inr(l.sgst_cents as number),
			igst: inr(l.igst_cents as number),
			total: inr(l.line_total_cents as number),
		})),
	};
}

export async function setInvoiceStatus(db: D1Database, orgId: string, id: string, status: string) {
	await db.prepare("UPDATE invoices SET status = ? WHERE id = ? AND org_id = ?").bind(status, id, orgId).run();
}

/* ─────────────────────────────────────────────────────── journal / ledger */

export type JournalLineInput = { account: string; debit_cents?: number; credit_cents?: number; memo?: string };

export async function postEntry(
	env: Env,
	orgId: string,
	e: { date: string; memo?: string; status?: string; source?: string; source_ref?: string; review_note?: string; lines: JournalLineInput[] },
): Promise<{ id: string; balanced: boolean }> {
	const db = env.DB;
	const debit = e.lines.reduce((a, l) => a + (l.debit_cents ?? 0), 0);
	const credit = e.lines.reduce((a, l) => a + (l.credit_cents ?? 0), 0);
	const balanced = debit === credit;
	const id = uid();
	await db
		.prepare(
			"INSERT INTO journal_entries (id, org_id, date, memo, status, review_note, source, source_ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		)
		.bind(id, orgId, e.date, e.memo ?? null, balanced ? e.status ?? "draft" : "needs_review", e.review_note ?? (balanced ? null : "debits != credits"), e.source ?? "manual", e.source_ref ?? null)
		.run();
	for (const l of e.lines) {
		await db
			.prepare("INSERT INTO journal_lines (id, entry_id, account, debit_cents, credit_cents, memo) VALUES (?, ?, ?, ?, ?, ?)")
			.bind(uid(), id, l.account, l.debit_cents ?? 0, l.credit_cents ?? 0, l.memo ?? null)
			.run();
	}
	return { id, balanced };
}

export async function listJournalEntries(db: D1Database, orgId: string, opts: { status?: string; period?: string; limit?: number } = {}) {
	const where = ["org_id = ?"];
	const bind: unknown[] = [orgId];
	if (opts.status) {
		where.push("status = ?");
		bind.push(opts.status);
	}
	if (opts.period) {
		where.push("date LIKE ?");
		bind.push(`${opts.period}%`);
	}
	const { results } = await db
		.prepare(`SELECT id, date, memo, status, review_note, source FROM journal_entries WHERE ${where.join(" AND ")} ORDER BY date DESC LIMIT ?`)
		.bind(...bind, opts.limit ?? 50)
		.all();
	return results ?? [];
}

export async function flagEntry(db: D1Database, orgId: string, id: string, note: string) {
	await db.prepare("UPDATE journal_entries SET status = 'needs_review', review_note = ? WHERE id = ? AND org_id = ?").bind(note, id, orgId).run();
}
export async function postJournalEntry(db: D1Database, orgId: string, id: string) {
	await db.prepare("UPDATE journal_entries SET status = 'posted', review_note = NULL WHERE id = ? AND org_id = ?").bind(id, orgId).run();
}

/* ─────────────────────────────────────────────────────────── accruals */

export async function addAccrual(db: D1Database, orgId: string, a: { description: string; amount: number; period: string }) {
	const id = uid();
	await db.prepare("INSERT INTO accruals (id, org_id, description, amount_cents, period) VALUES (?, ?, ?, ?, ?)").bind(id, orgId, a.description, r(a.amount * 100), a.period).run();
	return { id };
}
export async function listAccruals(db: D1Database, orgId: string, period?: string) {
	const { results } = await db
		.prepare(`SELECT id, description, amount_cents, period, status FROM accruals WHERE org_id = ?${period ? " AND period = ?" : ""} ORDER BY period DESC`)
		.bind(...(period ? [orgId, period] : [orgId]))
		.all<{ id: string; description: string; amount_cents: number; period: string; status: string }>();
	return (results ?? []).map((x) => ({ ...x, amount: inr(x.amount_cents) }));
}
export async function reverseAccrual(db: D1Database, orgId: string, id: string) {
	await db.prepare("UPDATE accruals SET status = 'reversed' WHERE id = ? AND org_id = ?").bind(id, orgId).run();
}

/* ─────────────────────────────────────────────────── analyses */

async function bankTxns(env: Env, orgId: string) {
	const row = await getOrgBank(env.DB, orgId);
	if (!row) return null;
	const s = await getBankSummary(row).catch(() => null);
	return s ? { balance: s.account.balance, txns: s.transactions } : null;
}

/** Month-end checklist: what's still open for `period` (YYYY-MM). */
export async function monthEndClose(env: Env, orgId: string, period: string) {
	const db = env.DB;
	const draftEntries = await listJournalEntries(db, orgId, { status: "draft", period, limit: 200 });
	const reviewEntries = await listJournalEntries(db, orgId, { status: "needs_review", period, limit: 200 });
	const openAccruals = (await listAccruals(db, orgId, period)).filter((a) => a.status === "open");
	const overdue = (await listInvoices(db, orgId, { status: "open", limit: 200 })).filter(
		(i) => i.due_date && (i.due_date as string) < today(),
	);
	const bank = await bankTxns(env, orgId);
	const { results: reconciled } = await db.prepare("SELECT bank_txn_id FROM bank_reconciliations WHERE org_id = ?").bind(orgId).all<{ bank_txn_id: string }>();
	const reconciledIds = new Set((reconciled ?? []).map((x) => x.bank_txn_id));
	const unreconciled = (bank?.txns ?? []).filter(
		(t) => t.created_at.slice(0, 7) === period && !reconciledIds.has(t.id),
	);

	const items = [
		{ step: "Post draft journal entries", count: draftEntries.length, detail: draftEntries },
		{ step: "Resolve entries flagged for review", count: reviewEntries.length, detail: reviewEntries },
		{ step: "Confirm or reverse open accruals", count: openAccruals.length, detail: openAccruals },
		{ step: "Chase overdue invoices", count: overdue.length, detail: overdue },
		{ step: "Reconcile bank transactions", count: unreconciled.length, detail: unreconciled.slice(0, 20) },
	];
	return { period, clean: items.every((i) => i.count === 0), items };
}

/** Match each bank line to an invoice or journal entry by amount + date window. */
export async function reconcileBank(env: Env, orgId: string) {
	const db = env.DB;
	const bank = await bankTxns(env, orgId);
	if (!bank) return { error: "bank not connected" };

	const { results: invs } = await db
		.prepare("SELECT id, number, total_cents, issue_date, direction FROM invoices WHERE org_id = ? AND status != 'void'")
		.bind(orgId)
		.all<{ id: string; number: string; total_cents: number; issue_date: string; direction: string }>();
	const { results: already } = await db.prepare("SELECT bank_txn_id, matched_type, matched_id FROM bank_reconciliations WHERE org_id = ?").bind(orgId).all<{ bank_txn_id: string; matched_type: string; matched_id: string }>();
	const done = new Set((already ?? []).map((x) => x.bank_txn_id));

	const matched: unknown[] = [];
	const partial: unknown[] = [];
	const unmatched: unknown[] = [];

	for (const t of bank.txns) {
		if (done.has(t.id)) {
			matched.push({ bank: t.description, amount: t.amount, via: "already reconciled" });
			continue;
		}
		const cents = r(t.amount * 100);
		const day = t.created_at.slice(0, 10);
		const exact = (invs ?? []).find((i) => i.total_cents === cents && Math.abs(+new Date(i.issue_date) - +new Date(day)) < 40 * 864e5);
		const near = (invs ?? []).find((i) => Math.abs(i.total_cents - cents) <= Math.max(200, cents * 0.02));
		if (exact) {
			await db.prepare("INSERT OR REPLACE INTO bank_reconciliations (org_id, bank_txn_id, matched_type, matched_id, confidence) VALUES (?, ?, 'invoice', ?, 1)").bind(orgId, t.id, exact.id).run();
			matched.push({ bank: t.description, amount: t.amount, invoice: exact.number });
		} else if (near) {
			partial.push({ bank: t.description, amount: t.amount, invoice: near.number, delta: t.amount - near.total_cents / 100 });
		} else {
			unmatched.push({ bank: t.description, amount: t.amount, date: day, type: t.type });
		}
	}
	return {
		matched_count: matched.length,
		partial_count: partial.length,
		unmatched_count: unmatched.length,
		matched,
		partial,
		unmatched,
	};
}

/** Current cash + a 13-week forecast from AR / AP due dates. */
export async function cashReport(env: Env, orgId: string) {
	const db = env.DB;
	const bank = await bankTxns(env, orgId);
	const balance = bank?.balance ?? 0;

	const open = await db
		.prepare("SELECT direction, due_date, total_cents FROM invoices WHERE org_id = ? AND status = 'open'")
		.bind(orgId)
		.all<{ direction: string; due_date: string | null; total_cents: number }>();

	const start = new Date();
	const weeks = Array.from({ length: 13 }, (_, i) => {
		const wStart = new Date(start.getTime() + i * 7 * 864e5);
		const wEnd = new Date(wStart.getTime() + 7 * 864e5);
		let inflow = 0,
			outflow = 0;
		for (const inv of open.results ?? []) {
			const d = inv.due_date ? new Date(inv.due_date) : wStart;
			if (d >= wStart && d < wEnd) {
				if (inv.direction === "receivable") inflow += inv.total_cents;
				else outflow += inv.total_cents;
			}
		}
		return { week: wStart.toISOString().slice(0, 10), inflow: inr(inflow), outflow: inr(outflow), net: inr(inflow - outflow) };
	});

	let running = balance;
	const forecast = weeks.map((w) => {
		running += w.net;
		return { ...w, projected_close: r(running * 100) / 100 };
	});

	const arOpen = (open.results ?? []).filter((i) => i.direction === "receivable").reduce((a, i) => a + i.total_cents, 0);
	const apOpen = (open.results ?? []).filter((i) => i.direction === "payable").reduce((a, i) => a + i.total_cents, 0);

	return {
		as_of: today(),
		cash_position: balance,
		receivables_open: inr(arOpen),
		payables_open: inr(apOpen),
		forecast_13w: forecast,
	};
}

/** Every invoice + bank line bucketed by jurisdiction, with a reconciliation. */
export async function transactionsByJurisdiction(env: Env, orgId: string) {
	const db = env.DB;
	const { results: rows } = await db
		.prepare(
			`SELECT c.country AS country, COALESCE(NULLIF(i.place_of_supply,''), c.state, 'Unknown') AS state,
			        COUNT(*) AS count, SUM(i.total_cents) AS total_cents, i.direction
			 FROM invoices i JOIN companies c ON c.id = i.company_id
			 WHERE i.org_id = ? AND i.status != 'void'
			 GROUP BY country, state, i.direction`,
		)
		.bind(orgId)
		.all<{ country: string; state: string; count: number; total_cents: number; direction: string }>();

	const buckets = (rows ?? []).map((x) => ({
		country: x.country ?? "IN",
		state: x.state,
		direction: x.direction,
		count: x.count,
		total: inr(x.total_cents),
	}));
	const controlTotal = (rows ?? []).reduce((a, x) => a + x.total_cents, 0);
	const { grand } = (await db
		.prepare("SELECT COALESCE(SUM(total_cents),0) AS grand FROM invoices WHERE org_id = ? AND status != 'void'")
		.bind(orgId)
		.first<{ grand: number }>()) ?? { grand: 0 };

	return {
		buckets,
		reconciliation: { bucketed_total: inr(controlTotal), invoice_control_total: inr(grand), difference: inr(grand - controlTotal) },
	};
}

/** Headline invoice analytics for the dashboard. */
export async function invoiceAnalytics(db: D1Database, orgId: string) {
	const [monthly, status, gst, totals] = await Promise.all([
		db.prepare(
			`SELECT substr(issue_date,1,7) AS month, direction, COUNT(*) AS count, SUM(total_cents) AS total_cents
			 FROM invoices WHERE org_id = ? AND status != 'void'
			 GROUP BY month, direction ORDER BY month DESC LIMIT 24`,
		).bind(orgId).all<{ month: string; direction: string; count: number; total_cents: number }>(),
		db.prepare(
			"SELECT status, COUNT(*) AS count, SUM(total_cents) AS total_cents FROM invoices WHERE org_id = ? GROUP BY status",
		).bind(orgId).all<{ status: string; count: number; total_cents: number }>(),
		db.prepare(
			`SELECT SUM(l.cgst_cents) AS cgst, SUM(l.sgst_cents) AS sgst, SUM(l.igst_cents) AS igst
			 FROM invoice_lines l JOIN invoices i ON i.id = l.invoice_id
			 WHERE i.org_id = ? AND i.status != 'void'`,
		).bind(orgId).first<{ cgst: number | null; sgst: number | null; igst: number | null }>(),
		db.prepare(
			"SELECT COUNT(*) AS count, COALESCE(SUM(total_cents),0) AS total_cents FROM invoices WHERE org_id = ? AND status != 'void'",
		).bind(orgId).first<{ count: number; total_cents: number }>(),
	]);

	// fold monthly rows into { month, receivable, payable } ascending
	const byMonth = new Map<string, { month: string; receivable: number; payable: number }>();
	for (const r of monthly.results ?? []) {
		const m = byMonth.get(r.month) ?? { month: r.month, receivable: 0, payable: 0 };
		if (r.direction === "receivable") m.receivable = r.count;
		else m.payable = r.count;
		byMonth.set(r.month, m);
	}
	const months = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);

	return {
		months,
		status: (status.results ?? []).map((s) => ({ ...s, total: inr(s.total_cents ?? 0) })),
		gst: { cgst: inr(gst?.cgst ?? 0), sgst: inr(gst?.sgst ?? 0), igst: inr(gst?.igst ?? 0) },
		total_count: totals?.count ?? 0,
		total_value: inr(totals?.total_cents ?? 0),
	};
}

/* ────────────────────────────────────── invoice processing (from a PDF) */

const FRAUD_ROUND = (cents: number) => cents % 100000 === 0 && cents >= 5000000; // exact ₹50k+ multiples

export async function processInvoiceDocument(env: Env, orgId: string, docId: string, direction: "receivable" | "payable" = "payable") {
	const db = env.DB;
	const doc = await getExtract(db, orgId, docId);
	if (!doc || doc.status !== "ready") return { error: "document not extracted yet" };
	let data: any = {};
	try {
		data = JSON.parse(doc.json ?? "{}").data ?? {};
	} catch {
		return { error: "could not read extracted data" };
	}

	const companyName = String(data.vendor || data.supplier || data.seller || data.company || data.bill_from || data.from || "Unknown vendor").slice(0, 160);
	const number = String(data.invoice_number || data.invoice_no || data.number || data.bill_number || `DOC-${docId.slice(0, 8)}`);
	const total = Number(String(data.total || data.grand_total || data.amount_due || data.total_amount || 0).replace(/[^0-9.]/g, "")) || 0;
	const gstin = String(data.gstin || data.gst_number || data.vendor_gstin || "").trim() || undefined;
	const state = String(data.state || data.place_of_supply || data.ship_to_state || "").trim() || undefined;

	const company = await upsertCompany(db, orgId, { name: companyName, role: direction === "payable" ? "vendor" : "customer", gstin, state });

	const flags: string[] = [];
	const dupe = await db
		.prepare("SELECT id, total_cents FROM invoices WHERE org_id = ? AND company_id = ? AND number = ?")
		.bind(orgId, company.id, number)
		.first<{ id: string; total_cents: number }>();
	if (dupe) flags.push(`duplicate of an existing invoice (${number})`);
	if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i.test(gstin)) flags.push("GSTIN format looks invalid");
	if (FRAUD_ROUND(r(total * 100))) flags.push("suspiciously round large amount");
	if (!dupe) {
		const recentNew = await db
			.prepare("SELECT created_at FROM companies WHERE id = ?")
			.bind(company.id)
			.first<{ created_at: number }>();
		if (recentNew && Date.now() / 1000 - recentNew.created_at < 60 && total * 100 > 20000000)
			flags.push("large amount to a brand-new payee");
	}

	if (dupe) return { routed: "rejected", reason: "duplicate", existing_id: dupe.id, flags };

	const inv = await createInvoice(env, orgId, {
		company_id: company.id,
		direction,
		number,
		lines: [{ description: `Per ${doc.name}`, unit_price: total, gst_rate: 0 }],
		source: "document",
		source_ref: docId,
		notes: `Auto-created from ${doc.name}`,
	});
	return {
		routed: flags.length ? "flagged for approval" : "ready for approval",
		flags,
		invoice: "duplicate" in inv ? inv : { id: inv.id, number: inv.number, company: inv.company, total: inv.total },
	};
}

export type OrgProfile = {
	address: string | null;
	tax_id: string | null;
	home_state: string | null;
	home_country: string | null;
};

export async function getOrgProfile(db: D1Database, orgId: string): Promise<OrgProfile> {
	const row = await db
		.prepare("SELECT address, tax_id, home_state, home_country FROM organizations WHERE id = ?")
		.bind(orgId)
		.first<OrgProfile>();
	return row ?? { address: null, tax_id: null, home_state: null, home_country: "IN" };
}

export async function setOrgProfile(
	db: D1Database,
	orgId: string,
	p: { address?: string | null; tax_id?: string | null; home_state?: string | null; home_country?: string | null },
) {
	await db
		.prepare(
			`UPDATE organizations SET
			   address      = COALESCE(?, address),
			   tax_id       = COALESCE(?, tax_id),
			   home_state   = COALESCE(?, home_state),
			   home_country = COALESCE(?, home_country)
			 WHERE id = ?`,
		)
		.bind(
			p.address ?? null,
			p.tax_id ?? null,
			p.home_state ?? null,
			p.home_country ?? null,
			orgId,
		)
		.run();
}
