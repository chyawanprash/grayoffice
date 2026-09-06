/**
 * Document extraction. Uploaded PDFs -> markdown (`AI.toMarkdown`) -> a single
 * structured JSON object `{ document_type, summary, data }`, stored in
 * `doc_extracts`. The finance agent reads these via `listDocuments` /
 * `getDocument` and uses the fields as context.
 *
 * ponytail: one generic extraction prompt, not a per-doc-type schema - add
 * typed schemas (invoice / statement / PO) if the shapes start to matter.
 */

type Env = { AI: Ai; DB: D1Database };
type QueueEnv = Env & { KB_QUEUE: Queue; DOCS_BUCKET: R2Bucket };

/* --------------------------------------------------- R2 staging for uploads */

/** Put uploaded bytes in R2; the queue message carries only the returned key
 * (a queue message maxes out at 128 KB, so PDF bytes cannot go inline). */
export async function stageUpload(bucket: R2Bucket, bytes: ArrayBuffer): Promise<string> {
	const key = `uploads/${crypto.randomUUID()}.pdf`;
	await bucket.put(key, bytes);
	return key;
}

export async function readStaged(bucket: R2Bucket, key: string): Promise<ArrayBuffer | null> {
	const obj = await bucket.get(key);
	return obj ? obj.arrayBuffer() : null;
}

export async function discardStaged(bucket: R2Bucket, key: string): Promise<void> {
	await bucket.delete(key).catch(() => {});
}

const MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const SYSTEM = `You extract structured data from finance / accounting documents.
Return ONLY a JSON object, no prose and no code fences, shaped exactly:
{"document_type":"<invoice|purchase_order|grn|bank_statement|credit_card_statement|expense_receipt|tax_document|journal_entry|other>",
 "summary":"<one concise sentence>",
 "data":{ <the key header fields and any line items; keep it flat where possible> }}`;

export type DocExtract = {
	id: string;
	name: string;
	size: number | null;
	status: "processing" | "ready" | "error";
	doc_type: string | null;
	json: string | null;
	error: string | null;
	created_at: number;
};

export function listExtracts(db: D1Database, orgId: string): Promise<{ results: DocExtract[] }> {
	return db
		.prepare(
			"SELECT id, name, size, status, doc_type, json, error, created_at FROM doc_extracts WHERE org_id = ? ORDER BY created_at DESC",
		)
		.bind(orgId)
		.all<DocExtract>() as Promise<{ results: DocExtract[] }>;
}

export function getExtract(db: D1Database, orgId: string, id: string): Promise<DocExtract | null> {
	return db
		.prepare("SELECT id, name, size, status, doc_type, json, error, created_at FROM doc_extracts WHERE id = ? AND org_id = ?")
		.bind(id, orgId)
		.first<DocExtract>();
}

export async function deleteExtract(db: D1Database, orgId: string, id: string): Promise<void> {
	await db.prepare("DELETE FROM doc_extracts WHERE id = ? AND org_id = ?").bind(id, orgId).run();
}

/**
 * Create a `doc_extracts` row and queue the PDF for extraction. Shared by the
 * Documents page and the agent's saveDocumentFromUrl / chat-attachment paths.
 * Returns the new doc id.
 */
export async function queueExtraction(
	env: QueueEnv,
	orgId: string,
	name: string,
	bytes: ArrayBuffer,
): Promise<string> {
	const docId = crypto.randomUUID();
	const safeName = name.slice(0, 200);
	const r2Key = await stageUpload(env.DOCS_BUCKET, bytes);
	await env.DB.prepare(
		"INSERT INTO doc_extracts (id, org_id, name, size, status) VALUES (?, ?, ?, ?, 'processing')",
	)
		.bind(docId, orgId, safeName, bytes.byteLength)
		.run();
	await env.KB_QUEUE.send({ kind: "extract", orgId, docId, name: safeName, r2Key });
	return docId;
}

/** Convert one PDF, write the JSON back onto its row. */
export async function extractPdf(
	env: Env,
	docId: string,
	name: string,
	bytes: ArrayBuffer,
): Promise<void> {
	try {
		const md = (await env.AI.toMarkdown([
			{ name, blob: new Blob([bytes], { type: "application/pdf" }) },
		])) as Array<{ data: string }>;
		const markdown = md.map((d) => d.data).join("\n\n").slice(0, 16_000);
		if (!markdown.trim()) throw new Error("no text extracted from PDF");

		const r = (await env.AI.run(MODEL, {
			messages: [
				{ role: "system", content: SYSTEM },
				{ role: "user", content: markdown },
			],
			max_tokens: 1600,
		})) as { response?: string };

		const text = (r.response ?? "").replace(/```json\s*|```/gi, "").trim();
		let parsed: { document_type?: string; summary?: string; data?: unknown };
		try {
			parsed = JSON.parse(text);
		} catch {
			parsed = { document_type: "other", summary: "", data: { _raw: text.slice(0, 4000) } };
		}
		const docType = String(parsed.document_type ?? "other").slice(0, 40);

		await env.DB.prepare(
			"UPDATE doc_extracts SET status = 'ready', doc_type = ?, json = ?, error = NULL WHERE id = ?",
		)
			.bind(docType, JSON.stringify(parsed), docId)
			.run();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await env.DB.prepare("UPDATE doc_extracts SET status = 'error', error = ? WHERE id = ?")
			.bind(message.slice(0, 500), docId)
			.run();
		throw err;
	}
}

/** Compact list for the agent - id, type, summary. */
export async function listDocumentsForAgent(
	db: D1Database,
	orgId: string,
): Promise<{ id: string; name: string; doc_type: string | null; summary: string }[]> {
	const { results } = await db
		.prepare(
			"SELECT id, name, doc_type, json FROM doc_extracts WHERE org_id = ? AND status = 'ready' ORDER BY created_at DESC LIMIT 100",
		)
		.bind(orgId)
		.all<{ id: string; name: string; doc_type: string | null; json: string | null }>();
	return (results ?? []).map((r) => {
		let summary = "";
		try {
			summary = String(JSON.parse(r.json ?? "{}").summary ?? "");
		} catch {
			/* ignore */
		}
		return { id: r.id, name: r.name, doc_type: r.doc_type, summary };
	});
}
