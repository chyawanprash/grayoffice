import { useEffect } from "react";
import { Form, useNavigation, useRevalidator } from "react-router";
import type { Route } from "./+types/dashboard.documents";
import { Button } from "~/components/ui/button";
import { requireOrg } from "~/lib/org.server";
import { deleteExtract, listExtracts, queueExtraction } from "~/lib/docs.server";
import { getOrgProfile } from "~/lib/ledger.server";

export function meta() {
	return [{ title: "Documents | Gray Office" }];
}

const MAX_FILES = 100;
const MAX_BYTES = 4 * 1024 * 1024;

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId } = await requireOrg(request, env);
	const { results } = await listExtracts(env.DB, orgId);
	return { docs: results ?? [] };
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { orgId, org } = await requireOrg(request, env);
	const form = await request.formData();
	const intent = String(form.get("intent") ?? "upload");

	if (intent === "delete") {
		await deleteExtract(env, orgId, String(form.get("docId") ?? ""));
		return { ok: "deleted" as const };
	}

	// Dev helper: ask the synthetic-data worker for a test GST invoice with our
	// own company on one side, then run it through the extraction pipeline.
	if (intent === "test-invoice") {
		const weAre = form.get("role") === "buyer" ? "buyer" : "seller";
		const profile = await getOrgProfile(env.DB, orgId);
		const base = (env.BANK_URL ?? "https://bank.grayoffice.app").replace(/\/$/, "");
		try {
			const res = await fetch(`${base}/generate`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					jurisdiction: "IN",
					document_type: "gst_invoice",
					format: "pdf",
					self: {
						role: weAre === "seller" ? "supplier" : "customer",
						legal_name: org.name,
						gstin: profile.tax_id || undefined,
						state: profile.home_state || undefined,
					},
				}),
			});
			if (!res.ok) return { error: `Generator returned ${res.status}` };
			const bytes = await res.arrayBuffer();
			const name = `test-${weAre === "seller" ? "sale" : "purchase"}-${Date.now()}.pdf`;
			await queueExtraction(env, orgId, name, bytes);
			return { ok: "queued" as const, queued: 1, skipped: [] as string[] };
		} catch (err) {
			return { error: err instanceof Error ? err.message : String(err) };
		}
	}

	const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
	if (files.length === 0) return { error: "Choose at least one PDF." };
	if (files.length > MAX_FILES) return { error: `Up to ${MAX_FILES} files at a time.` };

	let queued = 0;
	const skipped: string[] = [];
	for (const file of files.slice(0, MAX_FILES)) {
		const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
		if (!isPdf || file.size > MAX_BYTES) {
			skipped.push(file.name);
			continue;
		}
		await queueExtraction(env, orgId, file.name, await file.arrayBuffer());
		queued++;
	}
	return { ok: "queued" as const, queued, skipped };
}

const badge: Record<string, string> = {
	processing: "bg-[color-mix(in_oklch,var(--dashboard-no-show)_16%,transparent)] text-[var(--dashboard-no-show)]",
	ready: "bg-[color-mix(in_oklch,var(--dashboard-completed)_16%,transparent)] text-[var(--dashboard-completed)]",
	error: "bg-[color-mix(in_oklch,var(--destructive)_16%,transparent)] text-destructive",
};

const fmtDate = (s: number) => new Date(s * 1000).toLocaleDateString();
const fmtSize = (b: number | null) =>
	b == null ? "—" : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

export default function Documents({ loaderData, actionData }: Route.ComponentProps) {
	const { docs } = loaderData;
	const nav = useNavigation();
	const busy = nav.formData != null;
	const revalidator = useRevalidator();
	const anyProcessing = docs.some((d) => d.status === "processing");
	const ready = docs.filter((d) => d.status === "ready");

	useEffect(() => {
		if (!anyProcessing) return;
		const t = setInterval(() => revalidator.revalidate(), 4000);
		return () => clearInterval(t);
	}, [anyProcessing, revalidator]);

	return (
		<div className="mx-auto max-w-5xl p-4 md:p-6">
			<div className="mb-6">
				<h1 className="text-2xl font-normal text-foreground">Documents</h1>
				<p className="text-sm text-muted-foreground">
					Every PDF you've uploaded — invoices, bills, statements, receipts — with
					the structured JSON extracted from it. Download the original PDF or the
					JSON, one at a time or all together.
				</p>
			</div>

			{actionData && "error" in actionData && actionData.error && (
				<p className="mb-4 rounded-lg border border-destructive/30 bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] px-3 py-2 text-sm text-destructive">{actionData.error}</p>
			)}
			{actionData && "ok" in actionData && actionData.ok === "queued" && (
				<p className="mb-4 rounded-lg border border-[var(--dashboard-completed)]/30 bg-[color-mix(in_oklch,var(--dashboard-completed)_10%,transparent)] px-3 py-2 text-sm text-[var(--dashboard-completed)]">
					{actionData.queued} file(s) queued.
					{actionData.skipped.length > 0 && ` Skipped: ${actionData.skipped.join(", ")}`}
				</p>
			)}

			<section className="rounded-xl border border-border bg-card p-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Form method="post" encType="multipart/form-data" className="flex flex-wrap items-center gap-3">
						<input
							type="file"
							name="files"
							accept="application/pdf"
							multiple
							required
							className="text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
						/>
						<Button type="submit" size="sm" disabled={busy}>
							{busy ? "Uploading…" : "Upload & extract"}
						</Button>
					</Form>
					{ready.length > 0 && (
						<div className="flex gap-2">
							<a href="/dashboard/downloads?docs=all&fmt=json" className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted">
								Download all JSON
							</a>
							<a href="/dashboard/downloads?docs=all&fmt=zip" className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted">
								Download all PDF (.zip)
							</a>
						</div>
					)}
				</div>
				<div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
					<span>No PDF handy? Generate a synthetic GST invoice with your company on it:</span>
					<Form method="post">
						<input type="hidden" name="intent" value="test-invoice" />
						<input type="hidden" name="role" value="seller" />
						<button type="submit" disabled={busy} className="rounded-md border border-border px-2 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-50">
							We're the seller (sale)
						</button>
					</Form>
					<Form method="post">
						<input type="hidden" name="intent" value="test-invoice" />
						<input type="hidden" name="role" value="buyer" />
						<button type="submit" disabled={busy} className="rounded-md border border-border px-2 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-50">
							We're the buyer (purchase)
						</button>
					</Form>
				</div>
			</section>

			<section className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-border text-xs text-muted-foreground">
								<th className="px-4 py-2.5 text-left font-medium">Document</th>
								<th className="px-3 py-2.5 text-left font-medium">Type</th>
								<th className="px-3 py-2.5 text-left font-medium">Uploaded</th>
								<th className="px-3 py-2.5 text-right font-medium">Size</th>
								<th className="px-3 py-2.5 text-left font-medium">Status</th>
								<th className="px-4 py-2.5 text-right font-medium">Download</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border/60">
							{docs.map((d) => (
								<tr key={d.id} className="hover:bg-muted/40">
									<td className="max-w-[16rem] truncate px-4 py-2.5 text-foreground">{d.name}</td>
									<td className="px-3 py-2.5 capitalize text-muted-foreground">
										{d.doc_type?.replace(/_/g, " ") ?? "—"}
									</td>
									<td className="px-3 py-2.5 text-muted-foreground">{fmtDate(d.created_at)}</td>
									<td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{fmtSize(d.size)}</td>
									<td className="px-3 py-2.5">
										<span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge[d.status] ?? ""}`}>
											{d.status === "error" ? d.error ?? "error" : d.status}
										</span>
									</td>
									<td className="px-4 py-2.5">
										<div className="flex items-center justify-end gap-2.5 text-xs">
											<a href={`/dashboard/downloads?doc=${d.id}&fmt=pdf`} className="font-medium text-brand hover:underline">PDF</a>
											{d.status === "ready" && (
												<a href={`/dashboard/downloads?doc=${d.id}&fmt=json`} className="font-medium text-brand hover:underline">JSON</a>
											)}
											<Form method="post">
												<input type="hidden" name="intent" value="delete" />
												<input type="hidden" name="docId" value={d.id} />
												<button type="submit" className="text-muted-foreground hover:text-destructive">Delete</button>
											</Form>
										</div>
									</td>
								</tr>
							))}
							{docs.length === 0 && (
								<tr>
									<td colSpan={6} className="px-4 py-6 text-muted-foreground">No documents yet.</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
