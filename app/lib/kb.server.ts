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

type Env = { AI: Ai; DB: D1Database; PINECONE_API_KEY?: string; PINECONE_HOST?: string };

const ns = (orgId: string) => `kb_${orgId}`;
const CHUNK = 1000;

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

export async function deleteDoc(env: Env, orgId: string, docId: string): Promise<void> {
	await deleteByFilter(env, ns(orgId), { doc_id: docId });
	await env.DB.prepare("DELETE FROM kb_documents WHERE id = ? AND org_id = ?")
		.bind(docId, orgId)
		.run();
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
