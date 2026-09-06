/**
 * Knowledge-base ingest queue consumer.
 *
 * - "kb"      : chunk + embed a PDF into Pinecone (+ extract the memory graph)
 * - "extract" : PDF -> structured JSON; if it's an invoice, auto-create a draft
 * - "invoice" : an invoice we raised -> text into the KB + memory graph
 *
 * PDF bytes live in R2 (queue messages max out at 128 KB); the message carries
 * the key. The "invoice" job carries no bytes.
 */
import { ingestPdf, ingestText } from "~/lib/kb.server";
import { extractPdf, getExtract, readStaged } from "~/lib/docs.server";
import { getInvoice, processInvoiceDocument } from "~/lib/ledger.server";

export type KbJob =
	| { kind?: "kb" | "extract"; orgId: string; docId: string; name: string; r2Key: string }
	| { kind: "invoice"; orgId: string; invoiceId: string };

type Env = {
	AI: Ai;
	DB: D1Database;
	DOCS_BUCKET: R2Bucket;
	KB_QUEUE?: Queue;
	PINECONE_API_KEY?: string;
	PINECONE_HOST?: string;
};

const INVOICE_TYPES = new Set([
	"invoice", "gst_invoice", "tax_invoice", "commercial_invoice", "bill",
	"purchase_invoice", "sales_invoice", "credit_note", "debit_note",
]);

function invoiceToText(inv: NonNullable<Awaited<ReturnType<typeof getInvoice>>>): string {
	const lines = (inv.lines as { description: string; taxable: number; cgst: number; sgst: number; igst: number; total: number }[])
		.map((l) => `- ${l.description}: taxable ${l.taxable}, CGST ${l.cgst}, SGST ${l.sgst}, IGST ${l.igst}, total ${l.total}`)
		.join("\n");
	return [
		`Invoice ${inv.number} (${inv.direction === "receivable" ? "sales — we billed" : "purchase — we owe"})`,
		`Counterparty: ${inv.company}${inv.gstin ? ` (GSTIN ${inv.gstin})` : ""}${inv.company_state ? `, ${inv.company_state}` : ""}`,
		`Issued ${inv.issue_date}${inv.due_date ? `, due ${inv.due_date}` : ""} · status ${inv.status} · place of supply ${inv.place_of_supply ?? "—"}`,
		inv.reverse_charge ? "Reverse charge applies." : "",
		`Line items:\n${lines}`,
		`Subtotal ${inv.subtotal}, tax ${inv.tax}, total ${inv.total}.`,
		inv.notes ? `Notes: ${inv.notes}` : "",
	].filter(Boolean).join("\n");
}

export async function kbQueueConsumer(batch: MessageBatch<KbJob>, env: Env): Promise<void> {
	for (const msg of batch.messages) {
		const body = msg.body;
		try {
			if (body.kind === "invoice") {
				const inv = await getInvoice(env.DB, body.orgId, body.invoiceId);
				if (inv) {
					await ingestText(env, body.orgId, {
						name: `Invoice ${inv.number} · ${inv.company}`,
						text: invoiceToText(inv),
						sourceRef: body.invoiceId,
					});
				}
				msg.ack();
				continue;
			}

			const { kind, orgId, docId, name, r2Key } = body;
			const bytes = await readStaged(env.DOCS_BUCKET, r2Key);
			if (!bytes) throw new Error(`upload ${r2Key} not found in R2`);

			if (kind === "extract") {
				await extractPdf(env, docId, name, bytes);
				// If the PDF is an invoice, turn it into a draft invoice automatically.
				const doc = await getExtract(env.DB, orgId, docId);
				const t = (doc?.doc_type ?? "").toLowerCase();
				if (doc?.status === "ready" && [...INVOICE_TYPES].some((x) => t.includes(x.replace("_", "")) || t === x)) {
					await processInvoiceDocument(env, orgId, docId, "auto").catch((e) =>
						console.error(`auto processInvoiceDocument(${docId}) failed: ${e}`),
					);
				}
			} else {
				await ingestPdf(env, orgId, docId, name, bytes);
			}
			msg.ack();
		} catch (err) {
			console.error(`KB queue job failed: ${err}`);
			msg.retry();
		}
	}
}
