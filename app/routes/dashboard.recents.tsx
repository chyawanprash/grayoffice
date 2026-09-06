import { Link } from "react-router";
import type { Route } from "./+types/dashboard.recents";
import { requireOrg } from "~/lib/org.server";
import { listInvoices } from "~/lib/ledger.server";
import { listInventory } from "~/lib/inventory.server";
import { getOrgBank, getBankSummary } from "~/lib/bank.server";
import { formatMoney } from "~/lib/money";
import { Tag, type TagColor } from "~/components/ui/tag";

export function meta() {
	return [{ title: "Recents | Gray Office" }];
}

type Filter = "all" | "sales" | "purchases" | "inventory" | "bank";
const FILTERS: { key: Filter; label: string }[] = [
	{ key: "all", label: "Everything" },
	{ key: "sales", label: "Sales" },
	{ key: "purchases", label: "Purchases" },
	{ key: "inventory", label: "Inventory" },
	{ key: "bank", label: "Bank" },
];

type Row = {
	date: string;
	kind: string;
	group: "sale" | "purchase" | "inventory" | "bank";
	desc: string;
	inflow: number;
	outflow: number;
	balance: number | null;
	status: string | null;
};

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId, org } = await requireOrg(request, env);
	const filter = (new URL(request.url).searchParams.get("type") ?? "all") as Filter;

	const [invoices, inventory, bankRow] = await Promise.all([
		listInvoices(env.DB, orgId, { limit: 500 }),
		listInventory(env.DB, orgId),
		getOrgBank(env.DB, orgId),
	]);
	const bank = bankRow ? await getBankSummary(bankRow).catch(() => null) : null;

	const rows: Row[] = [];
	for (const i of invoices) {
		const sale = i.direction === "receivable";
		rows.push({
			date: i.issue_date,
			kind: sale ? "Sales invoice" : "Purchase invoice",
			group: sale ? "sale" : "purchase",
			desc: `${i.number} · ${i.company}`,
			inflow: sale ? i.total : 0,
			outflow: sale ? 0 : i.total,
			balance: null,
			status: i.status,
		});
	}
	for (const it of inventory) {
		const cost = (it.amount_cents / 100) * (it.quantity || 1);
		rows.push({
			date: it.start_date,
			kind: it.kind === "purchase" ? `${it.category} purchase` : `${it.category} subscription`,
			group: "inventory",
			desc: `${it.name}${it.vendor ? ` · ${it.vendor}` : ""}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`,
			inflow: 0,
			outflow: cost,
			balance: null,
			status: it.kind === "purchase" ? "one-off" : it.cadence,
		});
	}
	for (const t of bank?.transactions ?? []) {
		rows.push({
			date: t.created_at,
			kind: t.type === "credit" ? "Money in" : "Money out",
			group: "bank",
			desc: t.description,
			inflow: t.type === "credit" ? t.amount : 0,
			outflow: t.type === "debit" ? t.amount : 0,
			balance: t.balance_after,
			status: null,
		});
	}
	rows.sort((a, b) => b.date.localeCompare(a.date));

	const shown = rows.filter((r) => filter === "all" || r.group === filter).slice(0, 300);

	const month = new Date().toISOString().slice(0, 7);
	const thisMonth = rows.filter((r) => r.date.slice(0, 7) === month);
	const sum = (rs: Row[], k: "inflow" | "outflow") => rs.reduce((a, r) => a + r[k], 0);

	return {
		currency: org.currency,
		filter: FILTERS.some((f) => f.key === filter) ? filter : "all",
		rows: shown,
		summary: {
			bankBalance: bank?.account.balance ?? null,
			salesMonth: sum(thisMonth.filter((r) => r.group === "sale"), "inflow"),
			spendMonth: sum(thisMonth.filter((r) => r.group === "purchase" || r.group === "inventory"), "outflow"),
			bankInMonth: sum(thisMonth.filter((r) => r.group === "bank"), "inflow"),
			bankOutMonth: sum(thisMonth.filter((r) => r.group === "bank"), "outflow"),
		},
	};
}

const statCard = "rounded-xl bg-card p-4";

function typeColor(r: { group: string; inflow: number }): TagColor {
	if (r.group === "sale") return "green";
	if (r.group === "purchase") return "amber";
	if (r.group === "inventory") return "purple";
	return r.inflow ? "blue" : "red"; // bank
}

export default function Recents({ loaderData }: Route.ComponentProps) {
	const { currency, filter, rows, summary } = loaderData;
	const fmt = (n: number) => formatMoney(n, currency);

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-6">
			<div className="mb-5">
				<h1 className="text-2xl font-normal text-foreground">Recents</h1>
				<p className="text-sm text-muted-foreground">
					Every sale, purchase and bank movement in one ledger.
				</p>
			</div>

			<div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<div className={statCard}>
					<div className="text-xs uppercase tracking-wide text-muted-foreground">Bank balance</div>
					<div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
						{summary.bankBalance == null ? "—" : fmt(summary.bankBalance)}
					</div>
					<div className="mt-0.5 text-xs text-muted-foreground">
						{summary.bankBalance == null ? "bank not connected" : "current"}
					</div>
				</div>
				<Stat label="Sales this month" value={fmt(summary.salesMonth)} tone="up" />
				<Stat label="Spend this month" value={fmt(summary.spendMonth)} tone="down" />
				<Stat
					label="Net bank flow (mo)"
					value={fmt(summary.bankInMonth - summary.bankOutMonth)}
					tone={summary.bankInMonth - summary.bankOutMonth >= 0 ? "up" : "down"}
				/>
			</div>

			<div className="mb-3 flex gap-1.5">
				{FILTERS.map((f) => (
					<Link
						key={f.key}
						to={f.key === "all" ? "?" : `?type=${f.key}`}
						className={`rounded-full px-3 py-1 text-xs font-medium ${
							f.key === filter ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:text-foreground"
						}`}
					>
						{f.label}
					</Link>
				))}
			</div>

			<section className="overflow-hidden rounded-xl border border-border bg-card">
				<div className="overflow-x-auto">
					<table className="w-full min-w-[56rem] border-separate border-spacing-0 text-sm">
						<thead>
							<tr className="[&>th]:border-b [&>th]:border-border [&>th]:bg-muted/40 [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground">
								<th className="w-10 text-center">#</th>
								<th className="w-28">Date</th>
								<th className="sticky left-0 z-10 bg-muted/40">Type</th>
								<th>Description</th>
								<th className="text-right">In</th>
								<th className="text-right">Out</th>
								<th className="text-right">Bank balance</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r, idx) => (
								<tr key={idx} className="group [&>td]:border-b [&>td]:border-border/60 [&>td]:px-3 [&>td]:py-2.5 hover:[&>td]:bg-muted/30">
									<td className="text-center text-xs tabular-nums text-muted-foreground">{idx + 1}</td>
									<td className="tabular-nums text-muted-foreground">{r.date.slice(0, 10)}</td>
									<td className="sticky left-0 z-10 bg-card group-hover:bg-muted/30">
										<Tag color={typeColor(r)}>{r.kind}</Tag>
									</td>
									<td className="text-muted-foreground">{r.desc}</td>
									<td className="text-right tabular-nums text-[var(--dashboard-completed)]">
										{r.inflow ? fmt(r.inflow) : "—"}
									</td>
									<td className="text-right tabular-nums text-destructive">
										{r.outflow ? fmt(r.outflow) : "—"}
									</td>
									<td className="text-right tabular-nums text-muted-foreground">
										{r.balance == null ? "—" : fmt(r.balance)}
									</td>
									<td>
										{r.status && (
											<span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
												{r.status}
											</span>
										)}
									</td>
								</tr>
							))}
							{rows.length === 0 && (
								<tr>
									<td colSpan={8} className="border-b border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
										Nothing yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "up" | "down" }) {
	return (
		<div className={statCard}>
			<div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
			<div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
			<div className={`mt-0.5 text-xs ${tone === "up" ? "text-[var(--dashboard-completed)]" : "text-destructive"}`}>
				{tone === "up" ? "inflow" : "outflow"}
			</div>
		</div>
	);
}
