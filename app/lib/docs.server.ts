/**
 * Document extraction. Uploaded PDFs -> markdown (`AI.toMarkdown`) -> a single
 * structured JSON object `{ document_type, summary, data }`, stored in
 * `doc_extracts`. The finance agent reads these via `listDocuments` /
 * `getDocument` and uses the fields as context.
 *
 * ponytail: one generic extraction prompt, not a per-doc-type schema - add
 * typed schemas (invoice / statement / PO) if the shapes start to matter.
 */

import { aiText } from "./ai.server";

type Env = { AI: Ai; DB: D1Database };

/** Best-effort parse of a JSON object out of a model reply (fences, prose, trailing text). */
function parseJsonObject(s: string): { document_type?: string; summary?: string; data?: unknown } | null {
	const cleaned = s.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();
	try {
		return JSON.parse(cleaned);
	} catch {
		/* fall through */
	}
	const start = cleaned.indexOf("{");
	const end = cleaned.lastIndexOf("}");
	if (start >= 0 && end > start) {
		try {
			return JSON.parse(cleaned.slice(start, end + 1));
		} catch {
			/* give up */
		}
	}
	return null;
}
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

export async function deleteExtract(env: QueueEnv, orgId: string, id: string): Promise<void> {
	const row = await env.DB.prepare("SELECT r2_key FROM doc_extracts WHERE id = ? AND org_id = ?").bind(id, orgId).first<{ r2_key: string | null }>();
	if (row?.r2_key) await discardStaged(env.DOCS_BUCKET, row.r2_key);
	await env.DB.prepare("DELETE FROM doc_extracts WHERE id = ? AND org_id = ?").bind(id, orgId).run();
}

/** The stored original PDF for a document, or null. */
export async function readExtractPdf(
	env: QueueEnv,
	orgId: string,
	id: string,
): Promise<{ name: string; bytes: ArrayBuffer } | null> {
	const row = await env.DB.prepare("SELECT name, r2_key FROM doc_extracts WHERE id = ? AND org_id = ?").bind(id, orgId).first<{ name: string; r2_key: string | null }>();
	if (!row?.r2_key) return null;
	const bytes = await readStaged(env.DOCS_BUCKET, row.r2_key);
	return bytes ? { name: row.name, bytes } : null;
}

/** All ready documents' extracted JSON, for a bulk export. */
export async function allExtractJson(db: D1Database, orgId: string) {
	const { results } = await db
		.prepare("SELECT id, name, doc_type, json FROM doc_extracts WHERE org_id = ? AND status = 'ready' ORDER BY created_at DESC")
		.bind(orgId)
		.all<{ id: string; name: string; doc_type: string | null; json: string | null }>();
	return (results ?? []).map((r) => {
		let extracted: unknown = null;
		try {
			extracted = JSON.parse(r.json ?? "null");
		} catch {
			/* ignore */
		}
		return { id: r.id, name: r.name, doc_type: r.doc_type, extracted };
	});
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
		"INSERT INTO doc_extracts (id, org_id, name, size, status, r2_key) VALUES (?, ?, ?, ?, 'processing', ?)",
	)
		.bind(docId, orgId, safeName, bytes.byteLength, r2Key)
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
		])) as unknown;
		const markdown = (Array.isArray(md) ? md : [md])
			.map((d) => (typeof d === "string" ? d : String((d as { data?: unknown })?.data ?? "")))
			.join("\n\n")
			.slice(0, 16_000);
		if (!markdown.trim()) throw new Error("no text extracted from PDF");

		const r = await env.AI.run(MODEL, {
			messages: [
				{ role: "system", content: SYSTEM },
				{ role: "user", content: markdown },
			],
			max_tokens: 1600,
		});

		const raw = aiText(r);
		const parsed = parseJsonObject(raw) ?? { document_type: "other", summary: "", data: { _raw: raw.slice(0, 4000) } };
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
