/**
 * Knowledge-base ingest queue consumer. One job per uploaded PDF; the file
 * bytes ride along as base64 (typical PDFs are small - ponytail: cap ~4 MB in
 * the upload route, add R2 if bigger docs appear).
 */
import { ingestPdf } from "~/lib/kb.server";

export type KbJob = {
	orgId: string;
	docId: string;
	name: string;
	dataB64: string;
};

function b64ToBytes(b64: string): ArrayBuffer {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes.buffer;
}

export async function kbQueueConsumer(
	batch: MessageBatch<KbJob>,
	env: Env,
): Promise<void> {
	for (const msg of batch.messages) {
		try {
			const { orgId, docId, name, dataB64 } = msg.body;
			await ingestPdf(env, orgId, docId, name, b64ToBytes(dataB64));
			msg.ack();
		} catch (err) {
			console.error(`KB ingest failed: ${err}`);
			msg.retry();
		}
	}
}
