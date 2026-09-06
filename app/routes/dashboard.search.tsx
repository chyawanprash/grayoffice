import type { Route } from "./+types/dashboard.search";
import { requireOrg } from "~/lib/org.server";

/** Resource route backing the ⌘K palette. Returns a flat list of hits. */
export async function loader({ request, context }: Route.LoaderArgs) {
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
	if (q.length < 2) return { hits: [] };
	const db = context.cloudflare.env.DB;
	const like = `%${q.replace(/[%_]/g, "")}%`;

	const [inv, docs, kb, companies] = await Promise.all([
		db.prepare(
			`SELECT i.id, i.number, c.name AS company FROM invoices i JOIN companies c ON c.id = i.company_id
			 WHERE i.org_id = ? AND (i.number LIKE ? OR c.name LIKE ?) ORDER BY i.issue_date DESC LIMIT 6`,
		).bind(orgId, like, like).all<{ id: string; number: string; company: string }>(),
		db.prepare("SELECT id, name FROM doc_extracts WHERE org_id = ? AND name LIKE ? LIMIT 5").bind(orgId, like).all<{ id: string; name: string }>(),
		db.prepare("SELECT id, name FROM kb_documents WHERE org_id = ? AND name LIKE ? LIMIT 5").bind(orgId, like).all<{ id: string; name: string }>(),
		db.prepare("SELECT id, name FROM companies WHERE org_id = ? AND name LIKE ? LIMIT 5").bind(orgId, like).all<{ id: string; name: string }>(),
	]);

	const hits = [
		...(inv.results ?? []).map((r) => ({ label: `${r.number} · ${r.company}`, group: "Invoices", to: `/dashboard/invoices?id=${r.id}` })),
		...(companies.results ?? []).map((r) => ({ label: r.name, group: "Companies", to: `/dashboard/invoices` })),
		...(docs.results ?? []).map((r) => ({ label: r.name, group: "Documents", to: `/dashboard/documents` })),
		...(kb.results ?? []).map((r) => ({ label: r.name, group: "Knowledge base", to: `/dashboard/knowledge` })),
	];
	return { hits };
}
