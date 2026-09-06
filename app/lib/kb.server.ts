/**
 * Org knowledge base. PDFs are converted with `AI.toMarkdown`, split into
 * chunks, embedded and upserted into Pinecone under namespace `kb_<orgId>`.
 * `kb_documents` (D1) tracks one row per file. The finance agent searches it
 * via `searchKb`.
 *
 * ponytail: fixed-size char chunking, no overlap - swap for a token splitter
 * if recall quality matters.
 */
import {
	deleteByFilter,
	queryNamespace,
	upsertChunks,
} from "./pinecone.server";
import { stageUpload, readStaged, discardStaged } from "./docs.server";

type Env = { AI: Ai; DB: D1Database; PINECONE_API_KEY?: string; PINECONE_HOST?: string };
type QueueEnv = Env & { KB_QUEUE: Queue; DOCS_BUCKET: R2Bucket };

const ns = (orgId: string) => `kb_${orgId}`;
const CHUNK = 1000;
const ENTITY_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export type KbDoc = {
	id: string;
	name: string;
	size: number | null;
	status: "processing" | "ready" | "error";
	chunks: number;
	error: string | null;
	created_at: number;
};

export function listDocs(db: D1Database, orgId: string): Promise<{ results: KbDoc[] }> {
	return db
		.prepare(
			"SELECT id, name, size, status, chunks, error, created_at FROM kb_documents WHERE org_id = ? ORDER BY created_at DESC",
		)
		.bind(orgId)
		.all<KbDoc>() as Promise<{ results: KbDoc[] }>;
}

function chunkText(text: string): string[] {
	const out: string[] = [];
	let i = 0;
	while (i < text.length) {
		let end = Math.min(i + CHUNK, text.length);
		if (end < text.length) {
			const ws = text.lastIndexOf(" ", end);
			if (ws > i + CHUNK / 2) end = ws;
		}
		const piece = text.slice(i, end).trim();
		if (piece) out.push(piece);
		i = end;
	}
	return out;
}

/** Convert + embed + upsert one PDF. Updates its kb_documents row. */
export async function ingestPdf(
	env: Env,
	orgId: string,
	docId: string,
	name: string,
	bytes: ArrayBuffer,
): Promise<void> {
	try {
		const md = (await env.AI.toMarkdown([
			{ name, blob: new Blob([bytes], { type: "application/pdf" }) },
		])) as Array<{ data: string }>;
		const text = md.map((d) => d.data).join("\n\n");
		const chunks = chunkText(text).map((t, idx) => ({
			id: `${docId}:${idx}`,
			text: t,
			metadata: { doc_id: docId, name },
		}));
		const n = await upsertChunks(env, ns(orgId), chunks);
		await extractGraph(env, orgId, docId, name, text).catch((e) =>
			console.error(`kb graph extract failed for ${docId}: ${e}`),
		);
		await env.DB.prepare(
			"UPDATE kb_documents SET status = 'ready', chunks = ?, error = NULL WHERE id = ?",
		)
			.bind(n || chunks.length, docId)
			.run();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await env.DB.prepare(
			"UPDATE kb_documents SET status = 'error', error = ? WHERE id = ?",
		)
			.bind(message.slice(0, 500), docId)
			.run();
		throw err;
	}
}

/* ───────────────────────────────────────────────── memory graph */

const GRAPH_SYSTEM = `You build a knowledge graph from a finance/accounting document.
Return ONLY JSON, no prose, shaped exactly:
{"entities":[{"name":"<short name>","kind":"<person|org|account|location|date|amount|other>"}],
 "relations":[{"from":"<entity name>","to":"<entity name>","label":"<short verb phrase>"}]}
Keep names canonical and deduplicated. At most 20 entities and 25 relations.`;

/** Pull entities + relations out of a document and store them. Best effort. */
async function extractGraph(
	env: Env,
	orgId: string,
	docId: string,
	name: string,
	text: string,
): Promise<void> {
	const r = (await env.AI.run(ENTITY_MODEL, {
		messages: [
			{ role: "system", content: GRAPH_SYSTEM },
			{ role: "user", content: text.slice(0, 12_000) },
		],
		max_tokens: 1200,
	})) as { response?: string };
	let parsed: { entities?: { name: string; kind?: string }[]; relations?: { from: string; to: string; label?: string }[] };
	try {
		parsed = JSON.parse((r.response ?? "").replace(/```json\s*|```/gi, "").trim());
	} catch {
		return;
	}
	const clean = (s: unknown) => String(s ?? "").trim().slice(0, 120);
	const kinds = new Set(["person", "org", "account", "location", "date", "amount", "other"]);

	await env.DB.batch([
		env.DB.prepare("DELETE FROM kb_entities WHERE doc_id = ?").bind(docId),
		env.DB.prepare("DELETE FROM kb_relations WHERE doc_id = ?").bind(docId),
		...(parsed.entities ?? []).slice(0, 20).filter((e) => clean(e.name)).map((e) =>
			env.DB.prepare(
				"INSERT INTO kb_entities (id, org_id, doc_id, name, kind) VALUES (?, ?, ?, ?, ?)",
			).bind(crypto.randomUUID(), orgId, docId, clean(e.name), kinds.has(String(e.kind)) ? String(e.kind) : "other"),
		),
		...(parsed.relations ?? []).slice(0, 25).filter((rel) => clean(rel.from) && clean(rel.to)).map((rel) =>
			env.DB.prepare(
				"INSERT INTO kb_relations (id, org_id, doc_id, source_name, target_name, label) VALUES (?, ?, ?, ?, ?, ?)",
			).bind(crypto.randomUUID(), orgId, docId, clean(rel.from), clean(rel.to), clean(rel.label) || null),
		),
	]);
}

export type GraphNode = { name: string; kind: string; docs: number };
export type GraphEdge = { source: string; target: string; label: string | null };

/** The org's whole memory graph: one node per distinct entity name. */
export async function kbGraph(
	db: D1Database,
	orgId: string,
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
	const [ents, rels] = await Promise.all([
		db.prepare(
			"SELECT name, kind, COUNT(DISTINCT doc_id) AS docs FROM kb_entities WHERE org_id = ? GROUP BY lower(name)",
		).bind(orgId).all<GraphNode>(),
		db.prepare(
			"SELECT DISTINCT source_name AS source, target_name AS target, label FROM kb_relations WHERE org_id = ?",
		).bind(orgId).all<GraphEdge>(),
	]);
	const nodes = ents.results ?? [];
	const known = new Set(nodes.map((n) => n.name.toLowerCase()));
	const edges = (rels.results ?? []).filter(
		(e) => known.has(e.source.toLowerCase()) && known.has(e.target.toLowerCase()),
	);
	return { nodes, edges };
}

/** Most recent KB document activity (unix seconds), or null. */
export async function kbLastSync(db: D1Database, orgId: string): Promise<number | null> {
	const row = await db
		.prepare("SELECT MAX(created_at) AS t FROM kb_documents WHERE org_id = ?")
		.bind(orgId)
		.first<{ t: number | null }>();
	return row?.t ?? null;
}

/** Create a `kb_documents` row, stage the PDF in R2, queue it for indexing. */
export async function queueKbIngest(
	env: QueueEnv,
	orgId: string,
	name: string,
	bytes: ArrayBuffer,
): Promise<string> {
	const docId = crypto.randomUUID();
	const safeName = name.slice(0, 200);
	const r2Key = await stageUpload(env.DOCS_BUCKET, bytes);
	await env.DB.prepare(
		"INSERT INTO kb_documents (id, org_id, name, size, status, r2_key) VALUES (?, ?, ?, ?, 'processing', ?)",
	)
		.bind(docId, orgId, safeName, bytes.byteLength, r2Key)
		.run();
	await env.KB_QUEUE.send({ kind: "kb", orgId, docId, name: safeName, r2Key });
	return docId;
}

export async function deleteDoc(env: QueueEnv, orgId: string, docId: string): Promise<void> {
	await deleteByFilter(env, ns(orgId), { doc_id: docId });
	const row = await env.DB.prepare("SELECT r2_key FROM kb_documents WHERE id = ? AND org_id = ?").bind(docId, orgId).first<{ r2_key: string | null }>();
	if (row?.r2_key) await discardStaged(env.DOCS_BUCKET, row.r2_key);
	await env.DB.batch([
		env.DB.prepare("DELETE FROM kb_entities WHERE doc_id = ? AND org_id = ?").bind(docId, orgId),
		env.DB.prepare("DELETE FROM kb_relations WHERE doc_id = ? AND org_id = ?").bind(docId, orgId),
		env.DB.prepare("DELETE FROM kb_documents WHERE id = ? AND org_id = ?").bind(docId, orgId),
	]);
}

/** The stored original PDF for a KB document. */
export async function readKbPdf(
	env: QueueEnv,
	orgId: string,
	docId: string,
): Promise<{ name: string; bytes: ArrayBuffer } | null> {
	const row = await env.DB.prepare("SELECT name, r2_key FROM kb_documents WHERE id = ? AND org_id = ?").bind(docId, orgId).first<{ name: string; r2_key: string | null }>();
	if (!row?.r2_key) return null;
	const bytes = await readStaged(env.DOCS_BUCKET, row.r2_key);
	return bytes ? { name: row.name, bytes } : null;
}

/** Relevant passages from the org's knowledge base. */
export async function searchKb(
	env: Env,
	orgId: string,
	query: string,
	topK = 5,
): Promise<{ text: string; name: string; score: number }[]> {
	const hits = await queryNamespace(env, ns(orgId), query, topK);
	return hits.map((h) => ({
		text: h.text,
		name: String(h.metadata.name ?? "document"),
		score: h.score,
	}));
}
