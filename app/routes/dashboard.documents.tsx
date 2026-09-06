import { useEffect, useState } from "react";
import { Form, useNavigation, useRevalidator } from "react-router";
import type { Route } from "./+types/dashboard.documents";
import { Button } from "~/components/ui/button";
import { requireOrg } from "~/lib/org.server";
import { deleteExtract, listExtracts } from "~/lib/docs.server";

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

function bytesToB64(bytes: Uint8Array): string {
	let bin = "";
	for (let i = 0; i < bytes.length; i += 0x8000)
		bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { orgId } = await requireOrg(request, env);
	const form = await request.formData();
	const intent = String(form.get("intent") ?? "upload");

	if (intent === "delete") {
		await deleteExtract(env.DB, orgId, String(form.get("docId") ?? ""));
		return { ok: "deleted" as const };
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
		const docId = crypto.randomUUID();
		await env.DB.prepare(
			"INSERT INTO doc_extracts (id, org_id, name, size, status) VALUES (?, ?, ?, ?, 'processing')",
		)
			.bind(docId, orgId, file.name.slice(0, 200), file.size)
			.run();
		const dataB64 = bytesToB64(new Uint8Array(await file.arrayBuffer()));
		await env.KB_QUEUE.send({ kind: "extract", orgId, docId, name: file.name.slice(0, 200), dataB64 });
		queued++;
	}

	return { ok: "queued" as const, queued, skipped };
}

const badge: Record<string, string> = {
	processing: "bg-amber-100 text-amber-700",
	ready: "bg-emerald-100 text-emerald-700",
	error: "bg-red-100 text-red-700",
};

function pretty(json: string | null): string {
	if (!json) return "";
	try {
		return JSON.stringify(JSON.parse(json), null, 2);
	} catch {
		return json;
	}
}

export default function Documents({ loaderData, actionData }: Route.ComponentProps) {
	const { docs } = loaderData;
	const nav = useNavigation();
	const busy = nav.state !== "idle";
	const revalidator = useRevalidator();
	const [open, setOpen] = useState<string | null>(null);
	const anyProcessing = docs.some((d) => d.status === "processing");

	useEffect(() => {
		if (!anyProcessing) return;
		const t = setInterval(() => revalidator.revalidate(), 4000);
		return () => clearInterval(t);
	}, [anyProcessing, revalidator]);

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-6">
			<div className="mb-6">
				<h1 className="text-xl font-semibold tracking-tight text-foreground">Documents</h1>
				<p className="text-sm text-muted-foreground">
					Upload up to {MAX_FILES} PDFs. Each is converted to structured JSON
					(invoice / PO / statement / receipt fields + line items) that the
					finance assistant reads as context.
				</p>
			</div>

			{actionData && "error" in actionData && actionData.error && (
				<p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionData.error}</p>
			)}
			{actionData && "ok" in actionData && actionData.ok === "queued" && (
				<p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
					{actionData.queued} file(s) queued for extraction.
					{actionData.skipped.length > 0 && ` Skipped (not a PDF / too large): ${actionData.skipped.join(", ")}`}
				</p>
			)}

			<section className="rounded-xl border border-border bg-surface p-4">
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
			</section>

			<section className="mt-4 rounded-xl border border-border bg-surface p-4">
				<h2 className="mb-3 text-sm font-medium text-foreground">Extracted documents ({docs.length})</h2>
				<ul className="divide-y divide-border/60 text-sm">
					{docs.map((d) => (
						<li key={d.id} className="py-2.5">
							<div className="flex items-center justify-between gap-3">
								<button
									type="button"
									onClick={() => setOpen(open === d.id ? null : d.id)}
									className="min-w-0 flex-1 text-left"
								>
									<div className="truncate text-foreground">{d.name}</div>
									<div className="text-xs text-muted-foreground">
										{d.status === "ready"
											? d.doc_type ?? "document"
											: d.status === "error"
												? d.error
												: "Extracting…"}
									</div>
								</button>
								<div className="flex shrink-0 items-center gap-2">
									<span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge[d.status] ?? ""}`}>
										{d.status}
									</span>
									<Form method="post">
										<input type="hidden" name="intent" value="delete" />
										<input type="hidden" name="docId" value={d.id} />
										<button type="submit" className="text-xs text-muted-foreground hover:text-destructive">
											Delete
										</button>
									</Form>
								</div>
							</div>
							{open === d.id && d.status === "ready" && (
								<pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-tint p-3 text-xs text-foreground">
									{pretty(d.json)}
								</pre>
							)}
						</li>
					))}
					{docs.length === 0 && <li className="py-3 text-muted-foreground">No documents yet.</li>}
				</ul>
			</section>
		</div>
	);
}
