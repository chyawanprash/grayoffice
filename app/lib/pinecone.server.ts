/**
 * Thin Pinecone client over the REST API - no SDK, works in Workers.
 * Two consumers: the finance agent's long-term memory (namespace `mem_<userId>`)
 * and the org knowledge base (namespace `kb_<orgId>`, see kb.server.ts).
 * Every call is a no-op returning empty when PINECONE_API_KEY / PINECONE_HOST
 * are unset, so the app still runs locally without a Pinecone project.
 *
 * PINECONE_HOST is the index host, e.g. https://my-index-abc123.svc.aped-4627-b74a.pinecone.io
 */

const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5"; // 768-dim

type Env = { AI: Ai; PINECONE_API_KEY?: string; PINECONE_HOST?: string };
type ConfiguredEnv = Env & { PINECONE_API_KEY: string; PINECONE_HOST: string };

type Match = { id: string; score: number; metadata?: Record<string, unknown> };

export function pineconeConfigured(env: Env): env is ConfiguredEnv {
	return Boolean(env.PINECONE_API_KEY && env.PINECONE_HOST);
}

/** Embed one or more strings. */
export async function embed(env: Env, text: string[]): Promise<number[][]> {
	const res = (await env.AI.run(EMBED_MODEL, { text })) as { data: number[][] };
	return res.data;
}

async function pc(env: ConfiguredEnv, path: string, body: unknown) {
	const r = await fetch(`${env.PINECONE_HOST}${path}`, {
		method: "POST",
		headers: {
			"Api-Key": env.PINECONE_API_KEY,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!r.ok) throw new Error(`Pinecone ${path} ${r.status}: ${await r.text()}`);
	return r.json();
}

/* ---------------------------------------------------------- generic upsert/query */

export type Chunk = { id: string; text: string; metadata?: Record<string, unknown> };

/** Embed + upsert a batch of chunks into a namespace. */
export async function upsertChunks(
	env: Env,
	namespace: string,
	chunks: Chunk[],
): Promise<number> {
	if (!pineconeConfigured(env) || chunks.length === 0) return 0;
	const vectors: { id: string; values: number[]; metadata: Record<string, unknown> }[] = [];
	// bge-base handles a modest batch; keep requests small.
	for (let i = 0; i < chunks.length; i += 50) {
		const batch = chunks.slice(i, i + 50);
		const values = await embed(env, batch.map((c) => c.text));
		batch.forEach((c, j) =>
			vectors.push({ id: c.id, values: values[j], metadata: { text: c.text, ...c.metadata } }),
		);
	}
	for (let i = 0; i < vectors.length; i += 100)
		await pc(env, "/vectors/upsert", { namespace, vectors: vectors.slice(i, i + 100) });
	return vectors.length;
}

/** Nearest chunks to a query in a namespace, with optional metadata filter. */
export async function queryNamespace(
	env: Env,
	namespace: string,
	query: string,
	topK = 5,
	filter?: Record<string, unknown>,
): Promise<{ text: string; metadata: Record<string, unknown>; score: number }[]> {
	if (!pineconeConfigured(env) || !query.trim()) return [];
	const [vector] = await embed(env, [query]);
	const res = (await pc(env, "/query", {
		namespace,
		vector,
		topK,
		includeMetadata: true,
		...(filter ? { filter } : {}),
	})) as { matches?: Match[] };
	return (res.matches ?? [])
		.filter((m) => m.score > 0.3 && m.metadata?.text)
		.map((m) => ({
			text: String(m.metadata!.text),
			metadata: m.metadata ?? {},
			score: m.score,
		}));
}

export async function deleteByFilter(
	env: Env,
	namespace: string,
	filter: Record<string, unknown>,
): Promise<void> {
	if (!pineconeConfigured(env)) return;
	try {
		await pc(env, "/vectors/delete", { namespace, filter });
	} catch {
		// namespace/vectors may not exist - nothing to clean up
	}
}

export async function deleteNamespace(env: Env, namespace: string): Promise<void> {
	if (!pineconeConfigured(env)) return;
	try {
		await pc(env, "/vectors/delete", { namespace, deleteAll: true });
	} catch {
		// namespace may not exist yet
	}
}

/* ------------------------------------------------------------ agent memory */

const mem = (userId: string) => `mem_${userId}`;

/** Store a fact/snippet in the user's memory namespace. */
export async function remember(env: Env, userId: string, text: string): Promise<void> {
	if (!text.trim()) return;
	await upsertChunks(env, mem(userId), [{ id: crypto.randomUUID(), text, metadata: { at: Date.now() } }]);
}

/** Drop everything remembered for a user. Best effort. */
export async function forget(env: Env, userId: string): Promise<void> {
	await deleteNamespace(env, mem(userId));
}

/** The text of the most relevant remembered snippets. */
export async function recall(
	env: Env,
	userId: string,
	query: string,
	topK = 4,
): Promise<string[]> {
	const hits = await queryNamespace(env, mem(userId), query, topK);
	return hits.map((h) => h.text);
}
