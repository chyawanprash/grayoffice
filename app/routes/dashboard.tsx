import { Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireOrg } from "~/lib/org.server";
import { cashReport, listInvoices, monthEndClose } from "~/lib/ledger.server";

export function meta() {
	return [{ title: "Dashboard | Gray Office" }];
}

const inr = (n: number) =>
	`₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId, org } = await requireOrg(request, env);
	const period = new Date().toISOString().slice(0, 7);

	const [cash, recent, close] = await Promise.all([
		cashReport(env, orgId).catch(() => null),
		listInvoices(env.DB, orgId, { limit: 6 }),
		monthEndClose(env, orgId, period).catch(() => null),
	]);

	return { orgName: org.name, period, cash, recent, close };
}

const card = "rounded-xl bg-card p-4 text-card-foreground";

export default function Dashboard({ loaderData }: Route.ComponentProps) {
	const { orgName, period, cash, recent, close } = loaderData;
	const openCloseItems = close?.items.filter((i) => i.count > 0) ?? [];

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div>
				<h1 className="text-2xl font-normal text-foreground">{orgName}</h1>
				<p className="text-sm text-muted-foreground">
					Finance operations overview · {period}
				</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Stat label="Cash position" value={cash ? inr(cash.cash_position) : "—"} sub="bank balance" />
				<Stat label="Receivables open" value={cash ? inr(cash.receivables_open) : "—"} sub="AR" tone="up" />
				<Stat label="Payables open" value={cash ? inr(cash.payables_open) : "—"} sub="AP" tone="down" />
				<Stat
					label="Close items open"
					value={close ? String(openCloseItems.reduce((a, i) => a + i.count, 0)) : "—"}
					sub={close?.clean ? "books are clean" : "need attention"}
					tone={close?.clean ? "up" : "down"}
				/>
			</div>

			<div className="grid gap-3 lg:grid-cols-2">
				<section className={card}>
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-medium">Month-end close</h2>
						<Link to="/dashboard/assistant" className="text-xs font-medium text-brand hover:underline">
							Ask Bhondu →
						</Link>
					</div>
					{!close ? (
						<p className="mt-3 text-sm text-muted-foreground">No ledger activity yet.</p>
					) : close.clean ? (
						<p className="mt-3 text-sm text-[var(--dashboard-completed)]">
							Nothing outstanding for {period}.
						</p>
					) : (
						<ul className="mt-3 divide-y divide-border/60 text-sm">
							{openCloseItems.map((i) => (
								<li key={i.step} className="flex items-center justify-between py-2">
									<span className="text-foreground">{i.step}</span>
									<span className="rounded-md bg-[color-mix(in_oklch,var(--dashboard-no-show)_16%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--dashboard-no-show)]">
										{i.count}
									</span>
								</li>
							))}
						</ul>
					)}
				</section>

				<section className={card}>
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-medium">Recent invoices</h2>
						<Link to="/dashboard/invoices" className="text-xs font-medium text-brand hover:underline">
							All invoices →
						</Link>
					</div>
					{recent.length === 0 ? (
						<p className="mt-3 text-sm text-muted-foreground">
							No invoices yet — ask Bhondu to raise one.
						</p>
					) : (
						<ul className="mt-3 divide-y divide-border/60 text-sm">
							{recent.map((i) => (
								<li key={i.id as string} className="flex items-center justify-between gap-3 py-2">
									<span className="min-w-0">
										<span className="block truncate text-foreground">{i.company as string}</span>
										<span className="text-xs text-muted-foreground">
											{i.number as string} · {i.direction as string} · {i.status as string}
										</span>
									</span>
									<span className="shrink-0 tabular-nums text-foreground">{inr(i.total as number)}</span>
								</li>
							))}
						</ul>
					)}
				</section>
			</div>

			{cash && cash.forecast_13w.some((w) => w.inflow || w.outflow) && (
				<section className={card}>
					<h2 className="text-lg font-medium">13-week cash forecast</h2>
					<div className="mt-3 overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border text-xs text-muted-foreground">
									<th className="py-2 pr-3 text-left">Week of</th>
									<th className="py-2 pr-3 text-right">In</th>
									<th className="py-2 pr-3 text-right">Out</th>
									<th className="py-2 text-right">Projected close</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{cash.forecast_13w.map((w) => (
									<tr key={w.week}>
										<td className="py-1.5 pr-3 text-muted-foreground">{w.week}</td>
										<td className="py-1.5 pr-3 text-right tabular-nums text-[var(--dashboard-completed)]">{w.inflow ? inr(w.inflow) : "—"}</td>
										<td className="py-1.5 pr-3 text-right tabular-nums text-destructive">{w.outflow ? inr(w.outflow) : "—"}</td>
										<td className={`py-1.5 text-right tabular-nums ${w.projected_close < 0 ? "text-destructive" : "text-foreground"}`}>
											{inr(w.projected_close)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			)}
		</div>
	);
}

function Stat({
	label,
	value,
	sub,
	tone,
}: {
	label: string;
	value: string;
	sub: string;
	tone?: "up" | "down";
}) {
	return (
		<div className={card}>
			<div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
			<div className="mt-1 text-2xl font-semibold text-foreground tabular-nums">{value}</div>
			<div
				className={`mt-0.5 text-xs ${
					tone === "up"
						? "text-[var(--dashboard-completed)]"
						: tone === "down"
							? "text-destructive"
							: "text-muted-foreground"
				}`}
			>
				{sub}
			</div>
		</div>
	);
}
