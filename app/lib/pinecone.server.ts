/**
 * Thin Pinecone client over the REST API — no SDK, works in Workers.
 * Used as long-term memory for the finance agent. Every call is a no-op that
 * returns empty when PINECONE_API_KEY / PINECONE_HOST are unset, so the agent
 * still runs locally without a Pinecone project.
 *
 * PINECONE_HOST is the index host, e.g. https://my-index-abc123.svc.aped-4627-b74a.pinecone.io
 */

const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5"; // 768-dim

type Env = { AI: Ai; PINECONE_API_KEY?: string; PINECONE_HOST?: string };

type Match = { id: string; score: number; metadata?: { text?: string } };

function configured(env: Env): env is Env & { PINECONE_API_KEY: string; PINECONE_HOST: string } {
	return Boolean(env.PINECONE_API_KEY && env.PINECONE_HOST);
}

async function embed(env: Env, text: string): Promise<number[]> {
	const res = (await env.AI.run(EMBED_MODEL, { text: [text] })) as {
		data: number[][];
	};
	return res.data[0];
}

async function pc(
	env: Env & { PINECONE_API_KEY: string; PINECONE_HOST: string },
	path: string,
	body: unknown,
) {
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

/** Store a fact/snippet in the user's namespace. */
export async function remember(
	env: Env,
	userId: string,
	text: string,
): Promise<void> {
	if (!configured(env) || !text.trim()) return;
	const values = await embed(env, text);
	await pc(env, "/vectors/upsert", {
		namespace: userId,
		vectors: [
			{
				id: crypto.randomUUID(),
				values,
				metadata: { text, at: Date.now() },
			},
		],
	});
}

/** Return the text of the most relevant remembered snippets. */
export async function recall(
	env: Env,
	userId: string,
	query: string,
	topK = 4,
): Promise<string[]> {
	if (!configured(env) || !query.trim()) return [];
	const vector = await embed(env, query);
	const res = (await pc(env, "/query", {
		namespace: userId,
		vector,
		topK,
		includeMetadata: true,
	})) as { matches?: Match[] };
	return (res.matches ?? [])
		.filter((m) => m.score > 0.3 && m.metadata?.text)
		.map((m) => m.metadata!.text as string);
}
