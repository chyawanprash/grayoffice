import { useMemo, useState } from "react";
import type { Route } from "./+types/dashboard.memories";
import { requireOrg } from "~/lib/org.server";
import { kbGraph } from "~/lib/kb.server";

export function meta() {
	return [{ title: "Memories | Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	return kbGraph(context.cloudflare.env.DB, orgId);
}

const KIND_COLOR: Record<string, string> = {
	person: "var(--dashboard-scheduled)",
	org: "var(--dashboard-secondary)",
	account: "var(--dashboard-completed)",
	location: "var(--dashboard-no-show)",
	date: "var(--muted-foreground)",
	amount: "var(--brand)",
	other: "var(--muted-foreground)",
};

const W = 900;
const H = 620;

/** Tiny deterministic force layout — no dependency. */
function layout(nodes: { name: string }[], edges: { source: string; target: string }[]) {
	const idx = new Map(nodes.map((n, i) => [n.name.toLowerCase(), i]));
	const pos = nodes.map((_, i) => {
		const a = (i / Math.max(1, nodes.length)) * Math.PI * 2;
		return { x: W / 2 + Math.cos(a) * 220, y: H / 2 + Math.sin(a) * 220 };
	});
	const links = edges
		.map((e) => [idx.get(e.source.toLowerCase()), idx.get(e.target.toLowerCase())])
		.filter((l): l is [number, number] => l[0] != null && l[1] != null && l[0] !== l[1]);

	for (let iter = 0; iter < 400; iter++) {
		const fx = new Array(nodes.length).fill(0);
		const fy = new Array(nodes.length).fill(0);
		for (let i = 0; i < nodes.length; i++) {
			for (let j = i + 1; j < nodes.length; j++) {
				let dx = pos[i].x - pos[j].x;
				let dy = pos[i].y - pos[j].y;
				let d2 = dx * dx + dy * dy || 0.01;
				const f = 9000 / d2;
				dx /= Math.sqrt(d2);
				dy /= Math.sqrt(d2);
				fx[i] += dx * f; fy[i] += dy * f;
				fx[j] -= dx * f; fy[j] -= dy * f;
			}
		}
		for (const [a, b] of links) {
			const dx = pos[b].x - pos[a].x;
			const dy = pos[b].y - pos[a].y;
			const d = Math.hypot(dx, dy) || 0.01;
			const f = (d - 120) * 0.02;
			fx[a] += (dx / d) * f; fy[a] += (dy / d) * f;
			fx[b] -= (dx / d) * f; fy[b] -= (dy / d) * f;
		}
		for (let i = 0; i < nodes.length; i++) {
			fx[i] += (W / 2 - pos[i].x) * 0.005;
			fy[i] += (H / 2 - pos[i].y) * 0.005;
			pos[i].x = Math.max(30, Math.min(W - 30, pos[i].x + Math.max(-15, Math.min(15, fx[i]))));
			pos[i].y = Math.max(30, Math.min(H - 30, pos[i].y + Math.max(-15, Math.min(15, fy[i]))));
		}
	}
	return { pos, idx };
}

export default function Memories({ loaderData }: Route.ComponentProps) {
	const { nodes, edges } = loaderData;
	const [active, setActive] = useState<string | null>(null);
	const { pos, idx } = useMemo(() => layout(nodes, edges), [nodes, edges]);

	const neighbours = useMemo(() => {
		if (!active) return null;
		const set = new Set([active.toLowerCase()]);
		for (const e of edges) {
			if (e.source.toLowerCase() === active.toLowerCase()) set.add(e.target.toLowerCase());
			if (e.target.toLowerCase() === active.toLowerCase()) set.add(e.source.toLowerCase());
		}
		return set;
	}, [active, edges]);

	const dim = (name: string) => neighbours != null && !neighbours.has(name.toLowerCase());

	return (
		<div className="mx-auto max-w-5xl p-4 md:p-6">
			<div className="mb-4">
				<h1 className="text-2xl font-normal text-foreground">Memories</h1>
				<p className="text-sm text-muted-foreground">
					Entities and connections the assistant pulled out of your knowledge base
					documents. Click a node to trace its links.
				</p>
			</div>

			{nodes.length === 0 ? (
				<p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
					Nothing here yet. Upload documents in the{" "}
					<a href="/dashboard/knowledge" className="text-brand hover:underline">knowledge base</a>{" "}
					and their people, organisations and accounts will appear as a graph.
				</p>
			) : (
				<div className="dash-card p-2">
					<svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Memory graph">
						{edges.map((e, i) => {
							const a = pos[idx.get(e.source.toLowerCase())!];
							const b = pos[idx.get(e.target.toLowerCase())!];
							if (!a || !b) return null;
							const faded = neighbours != null && !(neighbours.has(e.source.toLowerCase()) && neighbours.has(e.target.toLowerCase()));
							return (
								<line
									key={i}
									x1={a.x} y1={a.y} x2={b.x} y2={b.y}
									stroke="var(--border)"
									strokeWidth={1.2}
									opacity={faded ? 0.15 : 0.7}
								>
									{e.label && <title>{`${e.source} → ${e.label} → ${e.target}`}</title>}
								</line>
							);
						})}
						{nodes.map((n, i) => {
							const p = pos[i];
							const r = 5 + Math.min(10, n.docs * 2);
							return (
								<g
									key={n.name}
									transform={`translate(${p.x} ${p.y})`}
									className="cursor-pointer"
									opacity={dim(n.name) ? 0.25 : 1}
									onClick={() => setActive(active === n.name ? null : n.name)}
								>
									<circle r={r} fill={KIND_COLOR[n.kind] ?? KIND_COLOR.other} />
									<text
										x={r + 3}
										y={3}
										className="fill-foreground"
										style={{ fontSize: 10 }}
									>
										{n.name}
									</text>
									<title>{`${n.name} · ${n.kind} · ${n.docs} doc(s)`}</title>
								</g>
							);
						})}
					</svg>
					<div className="flex flex-wrap gap-3 px-3 pb-2 pt-1 text-xs text-muted-foreground">
						{Object.entries(KIND_COLOR).filter(([k]) => k !== "other").map(([k, c]) => (
							<span key={k} className="inline-flex items-center gap-1.5">
								<span className="size-2 rounded-full" style={{ background: c }} />
								{k}
							</span>
						))}
						<span>· {nodes.length} entities · {edges.length} links</span>
					</div>
				</div>
			)}
		</div>
	);
}
