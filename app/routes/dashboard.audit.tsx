import { Form, useSearchParams } from "react-router";
import type { Route } from "./+types/dashboard.audit";
import { requireUserId } from "~/lib/auth.server";

export function meta() {
	return [{ title: "Audit room | Gray Office" }];
}

type Event = {
	id: string;
	source: string;
	external_user: string | null;
	kind: string;
	summary: string | null;
	route: string | null;
	status: string;
	detail: string | null;
	created_at: number;
};

const SOURCES = ["telegram", "slack", "discord"] as const;

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	await requireUserId(request, SESSION_SECRET);

	const source = new URL(request.url).searchParams.get("source");
	const where = source && SOURCES.includes(source as never) ? "WHERE source = ?" : "";
	const stmt = DB.prepare(
		`SELECT id, source, external_user, kind, summary, route, status, detail, created_at
		 FROM bot_events ${where} ORDER BY created_at DESC LIMIT 200`,
	);
	const { results } = await (where ? stmt.bind(source) : stmt).all<Event>();
	return { events: results ?? [] };
}

const STATUS_STYLE: Record<string, string> = {
	received: "bg-muted text-muted-foreground",
	routed: "bg-[color-mix(in_oklch,var(--dashboard-no-show)_16%,transparent)] text-[var(--dashboard-no-show)]",
	done: "bg-[color-mix(in_oklch,var(--dashboard-completed)_16%,transparent)] text-[var(--dashboard-completed)]",
	error: "bg-[color-mix(in_oklch,var(--destructive)_16%,transparent)] text-destructive",
};

export default function AuditRoom({ loaderData }: Route.ComponentProps) {
	const { events } = loaderData;
	const [params] = useSearchParams();
	const active = params.get("source") ?? "";

	return (
		<div className="mx-auto max-w-6xl">
			<div className="mb-4">
				<h1 className="text-2xl font-normal text-foreground">
					Audit room
				</h1>
				<p className="text-sm text-muted-foreground">
					Every message and file the Slack, Telegram and Discord bots received,
					and how it was routed.
				</p>
			</div>

			<Form method="get" className="mb-4 flex gap-1.5">
				{[["", "All"], ...SOURCES.map((s) => [s, s])].map(([val, label]) => (
					<button
						key={val}
						name="source"
						value={val}
						className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
							active === val
								? "bg-brand-tint font-medium text-brand"
								: "text-muted-foreground hover:bg-muted"
						}`}
					>
						{label}
					</button>
				))}
			</Form>

			<div className="overflow-x-auto rounded-xl border border-border bg-card">
				<table className="w-full text-sm">
					<thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
						<tr>
							<th className="px-4 py-2.5 font-medium">When</th>
							<th className="px-4 py-2.5 font-medium">Source</th>
							<th className="px-4 py-2.5 font-medium">From</th>
							<th className="px-4 py-2.5 font-medium">Summary</th>
							<th className="px-4 py-2.5 font-medium">Route</th>
							<th className="px-4 py-2.5 font-medium">Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-neutral-100">
						{events.length === 0 && (
							<tr>
								<td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
									No bot activity yet.
								</td>
							</tr>
						)}
						{events.map((e) => (
							<tr key={e.id} className="align-top">
								<td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
									{new Date(e.created_at * 1000).toLocaleString()}
								</td>
								<td className="px-4 py-3 capitalize text-muted-foreground">{e.source}</td>
								<td className="px-4 py-3 text-muted-foreground">{e.external_user ?? "-"}</td>
								<td className="max-w-md px-4 py-3 text-foreground">
									{e.summary}
									{e.status === "error" && e.detail && (
										<span className="mt-0.5 block text-xs text-destructive">
											{safeError(e.detail)}
										</span>
									)}
								</td>
								<td className="px-4 py-3 text-muted-foreground">{e.route ?? "-"}</td>
								<td className="px-4 py-3">
									<span
										className={`rounded-md px-2 py-0.5 text-xs font-medium ${
											STATUS_STYLE[e.status] ?? "bg-muted text-muted-foreground"
										}`}
									>
										{e.status}
									</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function safeError(detail: string): string {
	try {
		return JSON.parse(detail).error ?? "";
	} catch {
		return "";
	}
}
