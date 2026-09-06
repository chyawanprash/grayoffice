/**
 * Knowledge-base ingest queue consumer. One job per uploaded PDF. The bytes
 * live in R2 (queue messages max out at 128 KB); the message carries the key.
 */
import { ingestPdf } from "~/lib/kb.server";
import { extractPdf, readStaged } from "~/lib/docs.server";

export type KbJob = {
	/** "kb" (default) = chunk + embed into Pinecone; "extract" = PDF -> JSON */
	kind?: "kb" | "extract";
	orgId: string;
	docId: string;
	name: string;
	r2Key: string;
};

type Env = {
	AI: Ai;
	DB: D1Database;
	DOCS_BUCKET: R2Bucket;
	PINECONE_API_KEY?: string;
	PINECONE_HOST?: string;
};

export async function kbQueueConsumer(
	batch: MessageBatch<KbJob>,
	env: Env,
): Promise<void> {
	for (const msg of batch.messages) {
		const { kind, orgId, docId, name, r2Key } = msg.body;
		try {
			const bytes = await readStaged(env.DOCS_BUCKET, r2Key);
			if (!bytes) throw new Error(`upload ${r2Key} not found in R2`);
			if (kind === "extract") await extractPdf(env, docId, name, bytes);
			else await ingestPdf(env, orgId, docId, name, bytes);
			// keep the original file in R2 so it can be downloaded later; it's
			// removed when the document row is deleted.
			msg.ack();
		} catch (err) {
			console.error(`KB queue job failed (${r2Key}): ${err}`);
			msg.retry();
		}
	}
}
