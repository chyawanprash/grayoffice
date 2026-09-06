import { useEffect, useRef, useState } from "react";
import { Form, useNavigation, useRevalidator, useSubmit } from "react-router";
import type { Route } from "./+types/dashboard.knowledge";
import { requireOrg } from "~/lib/org.server";
import { deleteDoc, listDocs, queueKbIngest } from "~/lib/kb.server";
import { pineconeConfigured } from "~/lib/pinecone.server";

export function meta() {
	return [{ title: "Knowledge base | Gray Office" }];
}

const MAX_FILES = 100;
const MAX_BYTES = 4 * 1024 * 1024;

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId } = await requireOrg(request, env);
	const { results } = await listDocs(env.DB, orgId);
	return { docs: results ?? [], pinecone: pineconeConfigured(env) };
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { orgId } = await requireOrg(request, env);
	const form = await request.formData();
	const intent = String(form.get("intent") ?? "upload");

	if (intent === "delete") {
		await deleteDoc(env, orgId, String(form.get("docId") ?? ""));
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
		await queueKbIngest(env, orgId, file.name, await file.arrayBuffer());
		queued++;
	}

	return { ok: "queued" as const, queued, skipped };
}

const badge: Record<string, string> = {
	processing: "bg-[color-mix(in_oklch,var(--dashboard-no-show)_16%,transparent)] text-[var(--dashboard-no-show)]",
	ready: "bg-[color-mix(in_oklch,var(--dashboard-completed)_16%,transparent)] text-[var(--dashboard-completed)]",
	error: "bg-[color-mix(in_oklch,var(--destructive)_16%,transparent)] text-destructive",
};

function DropZone({ busy }: { busy: boolean }) {
	const formRef = useRef<HTMLFormElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const submit = useSubmit();
	const [over, setOver] = useState(false);
	const [names, setNames] = useState<string[]>([]);

	function send(files: FileList | null) {
		if (!files || files.length === 0) return;
		const dt = new DataTransfer();
		for (const f of Array.from(files)) dt.items.add(f);
		if (inputRef.current) inputRef.current.files = dt.files;
		setNames(Array.from(files).map((f) => f.name));
		if (formRef.current) submit(formRef.current, { method: "post", encType: "multipart/form-data" });
	}

	return (
		<Form ref={formRef} method="post" encType="multipart/form-data">
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				onDragOver={(e) => { e.preventDefault(); setOver(true); }}
				onDragLeave={() => setOver(false)}
				onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }}
				className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
					over ? "border-brand bg-brand/5" : "border-border bg-card hover:border-brand/50"
				}`}
			>
				<span className="text-sm font-medium text-foreground">
					{busy ? "Uploading…" : "Drop PDFs here or click to choose"}
				</span>
				<span className="text-xs text-muted-foreground">
					{names.length > 0 && !busy ? names.join(", ") : `Up to ${MAX_FILES} files · 4 MB each`}
				</span>
			</button>
			<input
				ref={inputRef}
				type="file"
				name="files"
				accept="application/pdf"
				multiple
				className="hidden"
				onChange={(e) => send(e.target.files)}
			/>
		</Form>
	);
}

export default function KnowledgeBase({ loaderData, actionData }: Route.ComponentProps) {
	const { docs, pinecone } = loaderData;
	const nav = useNavigation();
	const busy = nav.formData != null; // a form submit is in flight (not a plain link nav)
	const revalidator = useRevalidator();
	const anyProcessing = docs.some((d) => d.status === "processing");

	useEffect(() => {
		if (!anyProcessing) return;
		const t = setInterval(() => revalidator.revalidate(), 4000);
		return () => clearInterval(t);
	}, [anyProcessing, revalidator]);

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-6">
			<div className="mb-6">
				<h1 className="text-2xl font-normal text-foreground">Knowledge base</h1>
				<p className="text-sm text-muted-foreground">
					Upload up to {MAX_FILES} PDFs. Each is converted, chunked, embedded and
					indexed so the finance assistant can search it.
				</p>
			</div>

			{!pinecone && (
				<p className="mb-4 rounded-lg border border-[var(--dashboard-no-show)]/30 bg-[color-mix(in_oklch,var(--dashboard-no-show)_10%,transparent)] px-3 py-2 text-sm text-[var(--dashboard-no-show)]">
					Pinecone isn't configured (PINECONE_API_KEY / PINECONE_HOST). Documents
					will convert but won't be searchable until it's set.
				</p>
			)}
			{actionData && "error" in actionData && actionData.error && (
				<p className="mb-4 rounded-lg border border-destructive/30 bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] px-3 py-2 text-sm text-destructive">{actionData.error}</p>
			)}
			{actionData && "ok" in actionData && actionData.ok === "queued" && (
				<p className="mb-4 rounded-lg border border-[var(--dashboard-completed)]/30 bg-[color-mix(in_oklch,var(--dashboard-completed)_10%,transparent)] px-3 py-2 text-sm text-[var(--dashboard-completed)]">
					{actionData.queued} file(s) queued.
					{actionData.skipped.length > 0 && ` Skipped (not a PDF / too large): ${actionData.skipped.join(", ")}`}
				</p>
			)}

			<DropZone busy={busy} />
			{docs.some((d) => d.status === "ready") && (
				<div className="mt-3 text-right">
					<a
						href="/dashboard/downloads?kbdocs=all"
						className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
					>
						Download all files (.zip)
					</a>
				</div>
			)}

			<section className="mt-4 dash-card p-4">
				<h2 className="mb-3 text-sm font-medium text-foreground">
					Documents ({docs.length})
				</h2>
				<ul className="divide-y divide-border/60 text-sm">
					{docs.map((d) => (
						<li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
							<div className="min-w-0">
								<div className="truncate text-foreground">{d.name}</div>
								<div className="text-xs text-muted-foreground">
									{d.status === "ready" ? `${d.chunks} chunks` : d.status === "error" ? d.error : "Processing…"}
								</div>
							</div>
							<div className="flex shrink-0 items-center gap-2.5 text-xs">
								<span className={`rounded-md px-2 py-0.5 font-medium ${badge[d.status] ?? ""}`}>
									{d.status}
								</span>
								<a href={`/dashboard/downloads?kb=${d.id}`} className="font-medium text-brand hover:underline">
									PDF
								</a>
								<Form method="post">
									<input type="hidden" name="intent" value="delete" />
									<input type="hidden" name="docId" value={d.id} />
									<button type="submit" className="text-muted-foreground hover:text-destructive">
										Delete
									</button>
								</Form>
							</div>
						</li>
					))}
					{docs.length === 0 && (
						<li className="py-3 text-muted-foreground">No documents yet.</li>
					)}
				</ul>
			</section>
		</div>
	);
}
