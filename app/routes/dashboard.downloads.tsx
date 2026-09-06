import type { Route } from "./+types/dashboard.downloads";
import { requireOrg } from "~/lib/org.server";
import {
	allExtractJson,
	getExtract,
	listExtracts,
	readExtractPdf,
} from "~/lib/docs.server";
import { listDocs, readKbPdf } from "~/lib/kb.server";
import { makeZip } from "~/lib/zip.server";

const pdf = (name: string, bytes: ArrayBuffer) =>
	new Response(bytes, {
		headers: {
			"content-type": "application/pdf",
			"content-disposition": `attachment; filename="${name.replace(/"/g, "")}"`,
		},
	});

const json = (name: string, data: unknown) =>
	new Response(JSON.stringify(data, null, 2), {
		headers: {
			"content-type": "application/json; charset=utf-8",
			"content-disposition": `attachment; filename="${name}"`,
		},
	});

const zip = (name: string, files: { name: string; bytes: ArrayBuffer }[]) =>
	new Response(makeZip(files) as unknown as BodyInit, {
		headers: {
			"content-type": "application/zip",
			"content-disposition": `attachment; filename="${name}"`,
		},
	});

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId } = await requireOrg(request, env);
	const q = new URL(request.url).searchParams;
	const fmt = q.get("fmt") ?? "json";
	const date = new Date().toISOString().slice(0, 10);

	// single document
	if (q.get("doc")) {
		const id = q.get("doc")!;
		if (fmt === "pdf") {
			const f = await readExtractPdf(env, orgId, id);
			if (!f) throw new Response("Original PDF not available", { status: 404 });
			return pdf(f.name, f.bytes);
		}
		const row = await getExtract(env.DB, orgId, id);
		if (!row) throw new Response("Not found", { status: 404 });
		let extracted: unknown = null;
		try {
			extracted = JSON.parse(row.json ?? "null");
		} catch {
			/* ignore */
		}
		return json(`${row.name.replace(/\.pdf$/i, "")}.json`, { name: row.name, doc_type: row.doc_type, extracted });
	}

	if (q.get("kb")) {
		const f = await readKbPdf(env, orgId, q.get("kb")!);
		if (!f) throw new Response("Original file not available", { status: 404 });
		return pdf(f.name, f.bytes);
	}

	// bulk
	if (q.get("docs") === "all") {
		if (fmt === "zip") {
			const { results } = await listExtracts(env.DB, orgId);
			const files: { name: string; bytes: ArrayBuffer }[] = [];
			for (const d of results ?? []) {
				const f = await readExtractPdf(env, orgId, d.id);
				if (f) files.push({ name: f.name.endsWith(".pdf") ? f.name : `${f.name}.pdf`, bytes: f.bytes });
			}
			if (!files.length) throw new Response("No PDFs to export", { status: 404 });
			return zip(`documents-${date}.zip`, files);
		}
		return json(`documents-${date}.json`, await allExtractJson(env.DB, orgId));
	}

	if (q.get("kb") === "all" || q.get("kbdocs") === "all") {
		const { results } = await listDocs(env.DB, orgId);
		const files: { name: string; bytes: ArrayBuffer }[] = [];
		for (const d of results ?? []) {
			const f = await readKbPdf(env, orgId, d.id);
			if (f) files.push({ name: f.name.endsWith(".pdf") ? f.name : `${f.name}.pdf`, bytes: f.bytes });
		}
		if (!files.length) throw new Response("No files to export", { status: 404 });
		return zip(`knowledge-base-${date}.zip`, files);
	}

	throw new Response("Nothing to download", { status: 400 });
}
