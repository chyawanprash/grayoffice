/**
 * Thin Pinecone client over the REST API - no SDK, works in Workers.
 * Two consumers: the finance agent's long-term memory (namespace `mem_<userId>`)
 * and the org knowledge base (namespace `kb_<orgId>`, see kb.server.ts).
 *
 * Config: only `PINECONE_API_KEY` is required. The index is resolved (and
 * created on first use) from the control plane; `PINECONE_INDEX` names it
 * (default "grayoffice"), `PINECONE_HOST` can pin the data-plane host to skip
 * the lookup. Every call is a no-op returning empty when the key is unset, so
 * the app still runs locally without Pinecone.
 */

const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5"; // 768-dim
const EMBED_DIM = 768;
const API_VERSION = "2025-10";
const CONTROL_PLANE = "https://api.pinecone.io";
const DEFAULT_INDEX = "grayoffice";

type Env = {
	AI: Ai;
	PINECONE_API_KEY?: string;
	PINECONE_HOST?: string;
	PINECONE_INDEX?: string;
	AEO_KV?: KVNamespace;
};
type ConfiguredEnv = Env & { PINECONE_API_KEY: string };

type Match = { id: string; score: number; metadata?: Record<string, unknown> };

export function pineconeConfigured(env: Env): env is ConfiguredEnv {
	return Boolean(env.PINECONE_API_KEY);
}

const indexName = (env: Env) => env.PINECONE_INDEX || DEFAULT_INDEX;
const pineHeaders = (key: string) => ({
	"Api-Key": key,
	"Content-Type": "application/json",
	"X-Pinecone-Api-Version": API_VERSION,
});

/* -------------------------------------------------- index host resolution */

const hostCache = new Map<string, string>(); // index name -> data-plane host

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function describeIndex(env: ConfiguredEnv): Promise<{ host?: string; ready?: boolean } | null> {
	const r = await fetch(`${CONTROL_PLANE}/indexes/${indexName(env)}`, {
		headers: pineHeaders(env.PINECONE_API_KEY),
	});
	if (r.status === 404) return null;
	if (!r.ok) throw new Error(`Pinecone describe ${r.status}: ${await r.text()}`);
	const j = (await r.json()) as { host?: string; status?: { ready?: boolean } };
	return { host: j.host, ready: j.status?.ready };
}

async function createIndex(env: ConfiguredEnv): Promise<void> {
	const r = await fetch(`${CONTROL_PLANE}/indexes`, {
		method: "POST",
		headers: pineHeaders(env.PINECONE_API_KEY),
		body: JSON.stringify({
			name: indexName(env),
			vector_type: "dense",
			dimension: EMBED_DIM,
			metric: "cosine",
			spec: { serverless: { cloud: "aws", region: "us-east-1" } },
		}),
	});
	// 201 created, or 409 if a parallel request already made it.
	if (!r.ok && r.status !== 409)
		throw new Error(`Pinecone create index ${r.status}: ${await r.text()}`);
}

/** The data-plane host for our index, creating the index if it doesn't exist. */
async function resolveHost(env: ConfiguredEnv): Promise<string> {
	if (env.PINECONE_HOST) return env.PINECONE_HOST;

	const name = indexName(env);
	const cached = hostCache.get(name);
	if (cached) return cached;

	const kvKey = `pinecone:host:${name}`;
	const fromKv = await env.AEO_KV?.get(kvKey);
	if (fromKv) {
		hostCache.set(name, fromKv);
		return fromKv;
	}

	let info = await describeIndex(env);
	if (!info) {
		await createIndex(env);
		info = await describeIndex(env);
	}
	// New serverless indexes are ready in a few seconds - give it a short window.
	for (let i = 0; i < 20 && !(info?.ready && info.host); i++) {
		await sleep(1500);
		info = await describeIndex(env);
	}
	if (!info?.host) throw new Error("Pinecone index has no host yet - retry shortly");

	hostCache.set(name, info.host);
	await env.AEO_KV?.put(kvKey, info.host, { expirationTtl: 86400 });
	return info.host;
}

async function pc(env: ConfiguredEnv, path: string, body: unknown) {
	const host = await resolveHost(env);
	const base = host.startsWith("http") ? host : `https://${host}`;
	const r = await fetch(`${base}${path}`, {
		method: "POST",
		headers: pineHeaders(env.PINECONE_API_KEY),
		body: JSON.stringify(body),
	});
	if (!r.ok) throw new Error(`Pinecone ${path} ${r.status}: ${await r.text()}`);
	return r.json();
}

/* ---------------------------------------------------------------- embeddings */

export async function embed(env: Env, text: string[]): Promise<number[][]> {
	const res = (await env.AI.run(EMBED_MODEL, { text })) as { data: number[][] };
	return res.data;
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
