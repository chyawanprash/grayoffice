import { Link } from "react-router";
import type { Route } from "./+types/dashboard";
import { requireOrg } from "~/lib/org.server";
import {
	cashReport,
	invoiceAnalytics,
	listInvoices,
	monthEndClose,
	transactionsByJurisdiction,
} from "~/lib/ledger.server";

export function meta() {
	return [{ title: "Dashboard | Gray Office" }];
}

const inr = (n: number) =>
	`₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId, org } = await requireOrg(request, env);
	const period = new Date().toISOString().slice(0, 7);

	const [cash, recent, close, analytics, jurisdiction] = await Promise.all([
		cashReport(env, orgId).catch(() => null),
		listInvoices(env.DB, orgId, { limit: 6 }),
		monthEndClose(env, orgId, period).catch(() => null),
		invoiceAnalytics(env.DB, orgId).catch(() => null),
		transactionsByJurisdiction(env, orgId).catch(() => null),
	]);

	return { orgName: org.name, period, cash, recent, close, analytics, jurisdiction };
}

const card = "rounded-xl bg-card p-4 text-card-foreground";

export default function Dashboard({ loaderData }: Route.ComponentProps) {
	const { orgName, period, cash, recent, close, analytics, jurisdiction, recon } = loaderData;
	const openCloseItems = close?.items.filter((i) => i.count > 0) ?? [];
	const reconExceptions = recon && !("error" in recon)
		? (recon.partial_count ?? 0) + (recon.unmatched_count ?? 0)
		: null;

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
				<Stat label="Invoices" value={analytics ? String(analytics.total_count) : "—"} sub={analytics ? `${inr(analytics.total_value)} lifetime` : "none yet"} />
				<Stat label="Receivables open" value={cash ? inr(cash.receivables_open) : "—"} sub="AR" tone="up" />
				<Stat label="Payables open" value={cash ? inr(cash.payables_open) : "—"} sub="AP" tone="down" />
			</div>

			{/* ── Invoice processing analytics ── */}
			<div className="grid gap-3 lg:grid-cols-2">
				<section className={card}>
					<h2 className="text-lg font-medium">Invoices created</h2>
					<p className="text-xs text-muted-foreground">Receivable vs payable, last 12 months</p>
					{analytics && analytics.months.length > 0 ? (
						<MonthBars months={analytics.months} />
					) : (
						<p className="mt-3 text-sm text-muted-foreground">No invoices yet.</p>
					)}
				</section>

				<section className={card}>
					<h2 className="text-lg font-medium">Status & GST</h2>
					<div className="mt-3 flex flex-wrap gap-2 text-xs">
						{(analytics?.status ?? []).map((s) => (
							<span key={s.status} className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
								{s.status}: <span className="text-foreground">{s.count}</span>
							</span>
						))}
					</div>
					{analytics && (
						<div className="mt-4 space-y-1.5">
							<GstBar label="CGST" value={analytics.gst.cgst} max={maxGst(analytics.gst)} />
							<GstBar label="SGST" value={analytics.gst.sgst} max={maxGst(analytics.gst)} />
							<GstBar label="IGST" value={analytics.gst.igst} max={maxGst(analytics.gst)} />
						</div>
					)}
				</section>
			</div>

			{/* ── Close + reconciliation ── */}
			<div className="grid gap-3 lg:grid-cols-2">
				<section className={card}>
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-medium">Close the books</h2>
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
					<h2 className="text-lg font-medium">Reconciliation</h2>
					{recon == null || "error" in recon ? (
						<p className="mt-3 text-sm text-muted-foreground">
							Connect banking to match bank lines against the ledger.
						</p>
					) : (
						<div className="mt-3 grid grid-cols-3 gap-2 text-center">
							<ReconCell n={recon.matched_count} label="matched" tone="up" />
							<ReconCell n={recon.partial_count} label="partial" tone="warn" />
							<ReconCell n={recon.unmatched_count} label="exceptions" tone="down" />
						</div>
					)}
					{reconExceptions ? (
						<p className="mt-3 text-xs text-muted-foreground">
							{reconExceptions} line(s) need a human — see the audit room.
						</p>
					) : null}
				</section>
			</div>

			{/* ── Transactions by country & state ── */}
			{jurisdiction && jurisdiction.buckets.length > 0 && (
				<section className={card}>
					<h2 className="text-lg font-medium">Transactions by country & state</h2>
					<div className="mt-3 overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b border-border text-xs text-muted-foreground">
									<th className="py-2 pr-3 text-left">Country</th>
									<th className="py-2 pr-3 text-left">State / place of supply</th>
									<th className="py-2 pr-3 text-left">Direction</th>
									<th className="py-2 pr-3 text-right">Count</th>
									<th className="py-2 text-right">Value</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border/60">
								{jurisdiction.buckets.map((b, i) => (
									<tr key={i}>
										<td className="py-1.5 pr-3 text-muted-foreground">{b.country}</td>
										<td className="py-1.5 pr-3 text-foreground">{b.state}</td>
										<td className="py-1.5 pr-3 capitalize text-muted-foreground">{b.direction}</td>
										<td className="py-1.5 pr-3 text-right tabular-nums">{b.count}</td>
										<td className="py-1.5 text-right tabular-nums text-foreground">{inr(b.total)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">
						Bucketed {inr(jurisdiction.reconciliation.bucketed_total)} vs control{" "}
						{inr(jurisdiction.reconciliation.invoice_control_total)} · diff{" "}
						{inr(jurisdiction.reconciliation.difference)}
					</p>
				</section>
			)}

			{/* ── Cash reports ── */}
			<section className={card}>
				<h2 className="text-lg font-medium">Recent invoices</h2>
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

function maxGst(g: { cgst: number; sgst: number; igst: number }) {
	return Math.max(1, g.cgst, g.sgst, g.igst);
}

function GstBar({ label, value, max }: { label: string; value: number; max: number }) {
	return (
		<div className="flex items-center gap-2 text-xs">
			<span className="w-10 shrink-0 text-muted-foreground">{label}</span>
			<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
				<div className="h-full rounded-full bg-brand" style={{ width: `${(value / max) * 100}%` }} />
			</div>
			<span className="w-20 shrink-0 text-right tabular-nums text-foreground">{inr(value)}</span>
		</div>
	);
}

function MonthBars({ months }: { months: { month: string; receivable: number; payable: number }[] }) {
	const max = Math.max(1, ...months.map((m) => m.receivable + m.payable));
	return (
		<div className="mt-4 flex items-end gap-1.5" style={{ height: 120 }}>
			{months.map((m) => (
				<div key={m.month} className="flex flex-1 flex-col items-center gap-1">
					<div className="flex w-full flex-col justify-end" style={{ height: 100 }}>
						<div className="w-full bg-[var(--dashboard-completed)]" style={{ height: `${(m.receivable / max) * 100}%` }} title={`${m.month} receivable: ${m.receivable}`} />
						<div className="w-full bg-[var(--dashboard-no-show)]" style={{ height: `${(m.payable / max) * 100}%` }} title={`${m.month} payable: ${m.payable}`} />
					</div>
					<span className="text-[10px] text-muted-foreground">{m.month.slice(5)}</span>
				</div>
			))}
		</div>
	);
}

function ReconCell({ n, label, tone }: { n: number; label: string; tone: "up" | "warn" | "down" }) {
	const color =
		tone === "up" ? "text-[var(--dashboard-completed)]"
		: tone === "warn" ? "text-[var(--dashboard-no-show)]"
		: "text-destructive";
	return (
		<div className="rounded-lg bg-muted/60 p-2">
			<div className={`text-xl font-semibold tabular-nums ${color}`}>{n}</div>
			<div className="text-xs text-muted-foreground">{label}</div>
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
