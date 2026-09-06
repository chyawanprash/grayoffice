/**
 * Banking via bank.grayoffice.app (the "Bank of Apna Nagar" synthetic bank).
 * Each org connects once: we mint a bearer API key for the org, open an
 * account, and store both in `org_bank`. Every later operation proxies through
 * that key.
 */

export type OrgBank = {
	org_id: string;
	bank_url: string;
	api_key: string;
	account_id: string | null;
	branch_code: string | null;
	connected_at: number | null;
};

type Env = { BANK_URL?: string; DB: D1Database };

const DEFAULT_BANK = "https://bank.grayoffice.app";

export async function getOrgBank(db: D1Database, orgId: string): Promise<OrgBank | null> {
	return db.prepare("SELECT * FROM org_bank WHERE org_id = ?").bind(orgId).first<OrgBank>();
}

async function bankJson(url: string, init?: RequestInit): Promise<any> {
	const res = await fetch(url, init);
	const body = await res.json().catch(() => ({}));
	if (!res.ok) {
		const msg =
			(body && (body.error || body.message)) ||
			(body?.details ? JSON.stringify(body.details) : `bank ${res.status}`);
		throw new Error(String(msg));
	}
	return body;
}

/** Authenticated call against a connected org's bank account. */
export function bankFetch(
	row: OrgBank,
	path: string,
	init: { method?: string; body?: unknown } = {},
): Promise<any> {
	return bankJson(`${row.bank_url}${path}`, {
		method: init.method ?? "GET",
		headers: {
			authorization: `Bearer ${row.api_key}`,
			...(init.body !== undefined ? { "content-type": "application/json" } : {}),
		},
		body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
	});
}

export async function listBranches(env: Env): Promise<
	{ code: string; name: string; ifsc: string; address: string }[]
> {
	const base = env.BANK_URL || DEFAULT_BANK;
	const data = await bankJson(`${base}/bank/branches`);
	return data.branches ?? [];
}

/** One-time connect: mint key, open account, persist. */
export async function connectBank(
	env: Env,
	orgId: string,
	email: string,
	name: string,
	branchCode: string,
	openingBalance: number,
): Promise<void> {
	const base = env.BANK_URL || DEFAULT_BANK;
	const minted = await bankJson(`${base}/bank/keys`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ email, name, label: `grayoffice:${orgId}` }),
	});
	const key: string = minted.key;

	const acct = await bankJson(`${base}/bank/account`, {
		method: "POST",
		headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
		body: JSON.stringify({ branch_code: branchCode, opening_balance: openingBalance }),
	});

	await env.DB.prepare(
		`INSERT INTO org_bank (org_id, bank_url, api_key, account_id, branch_code, connected_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())
		 ON CONFLICT (org_id) DO UPDATE SET
		   bank_url = excluded.bank_url, api_key = excluded.api_key,
		   account_id = excluded.account_id, branch_code = excluded.branch_code,
		   connected_at = unixepoch(), updated_at = unixepoch()`,
	)
		.bind(orgId, base, key, acct.account_id, branchCode)
		.run();
}

export async function disconnectBank(db: D1Database, orgId: string): Promise<void> {
	await db.prepare("DELETE FROM org_bank WHERE org_id = ?").bind(orgId).run();
}

export type BankSummary = {
	account: { account_id: string; holder_name: string; balance: number; branch: any };
	transactions: {
		id: string;
		type: "credit" | "debit";
		amount: number;
		balance_after: number;
		description: string;
		created_at: string;
	}[];
};

export async function getBankSummary(row: OrgBank): Promise<BankSummary | null> {
	if (!row.account_id) return null;
	const [account, txns] = await Promise.all([
		bankFetch(row, `/bank/account/${row.account_id}`),
		bankFetch(row, `/bank/account/${row.account_id}/transactions`),
	]);
	return { account, transactions: txns.transactions ?? [] };
}

export type BankIntent = "credit" | "debit" | "transfer" | "subscribe" | "tick";

/** Run a mutating operation on the org's account. `body` is passed through to
 * the bank, which does the real validation. */
export async function bankAction(
	row: OrgBank,
	intent: BankIntent,
	body: Record<string, unknown>,
): Promise<any> {
	if (!row.account_id) throw new Error("bank not connected");
	const path = `/bank/account/${row.account_id}/${intent}`;
	return bankFetch(row, path, {
		method: "POST",
		body: intent === "tick" ? {} : body,
	});
}
