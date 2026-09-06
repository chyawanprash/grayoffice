import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/dashboard.audit";
import { requireOrg } from "~/lib/org.server";
import { orgActivity, type AuditCategory } from "~/lib/audit.server";
import { Tag, type TagColor } from "~/components/ui/tag";

export function meta() {
	return [{ title: "Audit room | Gray Office" }];
}

const CATEGORIES: { key: AuditCategory | "all"; label: string }[] = [
	{ key: "all", label: "Everything" },
	{ key: "invoice", label: "Invoices" },
	{ key: "ledger", label: "Ledger" },
	{ key: "bank", label: "Bank" },
	{ key: "payment", label: "Payments" },
	{ key: "bot", label: "Bots" },
];

const CAT_COLOR: Record<string, TagColor> = {
	invoice: "green",
	ledger: "indigo",
	bank: "blue",
	payment: "amber",
	bot: "purple",
};

const STATUS_COLOR: Record<string, TagColor> = {
	done: "green",
	posted: "green",
	paid: "green",
	open: "amber",
	draft: "gray",
	routed: "amber",
	needs_review: "amber",
	received: "gray",
	error: "red",
	void: "red",
};

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId, org } = await requireOrg(request, env);
	const raw = new URL(request.url).searchParams.get("category") ?? "all";
	const category = CATEGORIES.some((c) => c.key === raw) && raw !== "all" ? (raw as AuditCategory) : undefined;
	const events = await orgActivity(env, orgId, { category, currency: org.currency });
	return { events, category: category ?? "all", orgName: org.name };
}

export default function AuditRoom({ loaderData }: Route.ComponentProps) {
	const { events, category, orgName } = loaderData;
	const [, setParams] = useSearchParams();

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-6">
			<div className="mb-4">
				<h1 className="text-2xl font-normal text-foreground">Audit room</h1>
				<p className="text-sm text-muted-foreground">
					Every action taken in {orgName} — invoices raised, ledger entries posted,
					bank movements, payment webhooks and bot messages — newest first.
				</p>
			</div>

			<div className="mb-3 flex flex-wrap gap-1.5">
				{CATEGORIES.map((c) => (
					<button
						key={c.key}
						onClick={() => setParams(c.key === "all" ? {} : { category: c.key })}
						className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
							category === c.key ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:text-foreground"
						}`}
					>
						{c.label}
					</button>
				))}
			</div>

			<section className="dash-card overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full min-w-[52rem] border-separate border-spacing-0 text-sm">
						<thead>
							<tr className="[&>th]:border-b [&>th]:border-border [&>th]:bg-muted/40 [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground">
								<th className="w-40">When</th>
								<th>Type</th>
								<th>Actor</th>
								<th>Action</th>
								<th>Detail</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{events.length === 0 && (
								<tr>
									<td colSpan={6} className="border-b border-border/60 px-4 py-10 text-center text-muted-foreground">
										No activity yet.
									</td>
								</tr>
							)}
							{events.map((e, i) => (
								<tr key={i} className="[&>td]:border-b [&>td]:border-border/60 [&>td]:px-3 [&>td]:py-2.5 hover:[&>td]:bg-muted/30">
									<td className="whitespace-nowrap tabular-nums text-muted-foreground">
										{new Date(e.ts * 1000).toLocaleString()}
									</td>
									<td><Tag color={CAT_COLOR[e.category] ?? "gray"}>{e.category}</Tag></td>
									<td className="capitalize text-muted-foreground">{e.actor}</td>
									<td className="text-foreground">
										{e.ref ? (
											<Link to={e.ref} className="hover:text-brand hover:underline">{e.action}</Link>
										) : (
											e.action
										)}
									</td>
									<td className="max-w-md truncate text-muted-foreground" title={e.detail}>{e.detail}</td>
									<td>{e.status && <Tag color={STATUS_COLOR[e.status] ?? "gray"}>{e.status.replace(/_/g, " ")}</Tag>}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
