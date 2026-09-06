import { Fragment, useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.invoices";
import { Button } from "~/components/ui/button";
import { requireOrg } from "~/lib/org.server";
import { getInvoice, listInvoices, setInvoiceStatus } from "~/lib/ledger.server";
import { formatMoney } from "~/lib/money";

export function meta() {
	return [{ title: "Invoices | Gray Office" }];
}

type ViewKey = "all" | "sales" | "purchases" | "created" | "documents";

const VIEWS: { key: ViewKey; label: string; blurb: string }[] = [
	{ key: "all", label: "All invoices", blurb: "Everything, receivable and payable" },
	{ key: "sales", label: "Sales invoices", blurb: "Receivables — what customers owe us" },
	{ key: "purchases", label: "Purchase invoices", blurb: "Payables — what we owe suppliers" },
	{ key: "created", label: "Created here", blurb: "Raised by the assistant or by hand" },
	{ key: "documents", label: "From documents", blurb: "Parsed from an uploaded or shared PDF" },
];

type Inv = Awaited<ReturnType<typeof listInvoices>>[number];

function inView(i: Inv, view: ViewKey) {
	if (view === "sales") return i.direction === "receivable";
	if (view === "purchases") return i.direction === "payable";
	if (view === "created") return i.source === "agent" || i.source === "manual";
	if (view === "documents") return i.source === "document";
	return true;
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { orgId, org } = await requireOrg(request, context.cloudflare.env);
	const url = new URL(request.url);
	const view = (url.searchParams.get("view") ?? "all") as ViewKey;
	const openId = url.searchParams.get("id");
	const [all, detail] = await Promise.all([
		listInvoices(context.cloudflare.env.DB, orgId, { limit: 500 }),
		openId ? getInvoice(context.cloudflare.env.DB, orgId, openId) : Promise.resolve(null),
	]);

	const counts = VIEWS.map((v) => {
		const rows = all.filter((i) => inView(i, v.key));
		return {
			...v,
			count: rows.length,
			total: rows.reduce((a, i) => a + i.total, 0),
		};
	});

	return {
		currency: org.currency,
		view: VIEWS.some((v) => v.key === view) ? view : "all",
		rows: all.filter((i) => inView(i, view)),
		counts,
		detail,
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	const form = await request.formData();
	await setInvoiceStatus(
		context.cloudflare.env.DB,
		orgId,
		String(form.get("id")),
		String(form.get("status")),
	);
	return { ok: true };
}

const badge: Record<string, string> = {
	open: "bg-[color-mix(in_oklch,var(--dashboard-no-show)_16%,transparent)] text-[var(--dashboard-no-show)]",
	paid: "bg-[color-mix(in_oklch,var(--dashboard-completed)_16%,transparent)] text-[var(--dashboard-completed)]",
	draft: "bg-muted text-muted-foreground",
	void: "bg-[color-mix(in_oklch,var(--destructive)_16%,transparent)] text-destructive",
};

export default function Invoices({ loaderData }: Route.ComponentProps) {
	const { currency, view, rows, counts, detail } = loaderData;
	const fmt = (n: number) => formatMoney(n, currency);
	const nav = useNavigation();
	const busy = nav.formData != null;
	const [openId, setOpenId] = useState<string | null>((detail?.id as string) ?? null);
	const total = rows.reduce((a, i) => a + i.total, 0);

	return (
		<div className="mx-auto max-w-5xl p-4 md:p-6">
			<div className="mb-5 flex items-start justify-between gap-3">
				<div>
					<h1 className="text-2xl font-normal text-foreground">Invoices</h1>
					<p className="text-sm text-muted-foreground">
						Pick a set to open its spreadsheet. Ask Bhondu to raise a new invoice
						or process one from a PDF.
					</p>
				</div>
				<Button render={<Link to="/dashboard/assistant" />} size="sm" variant="outline">
					New invoice →
				</Button>
			</div>

			{/* ── cards ── */}
			<div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{counts.map((c) => (
					<Link
						key={c.key}
						to={c.key === "all" ? "?" : `?view=${c.key}`}
						className={`rounded-xl border bg-card p-4 transition-colors ${
							c.key === view ? "border-brand ring-1 ring-brand/30" : "border-border hover:bg-muted/40"
						}`}
					>
						<div className="flex items-baseline justify-between">
							<span className="text-sm font-medium text-foreground">{c.label}</span>
							<span className="text-xs text-muted-foreground">{c.count}</span>
						</div>
						<div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{fmt(c.total)}</div>
						<div className="mt-0.5 text-xs text-muted-foreground">{c.blurb}</div>
					</Link>
				))}
			</div>

			{/* ── spreadsheet ── */}
			<section className="overflow-hidden rounded-xl border border-border bg-card">
				<div className="border-b border-border px-4 py-2.5">
					<h2 className="text-sm font-medium text-foreground">
						{VIEWS.find((v) => v.key === view)!.label}
					</h2>
				</div>
				<div className="overflow-x-auto">
					<table className="w-full min-w-[52rem] border-separate border-spacing-0 text-sm">
						<thead>
							<tr className="[&>th]:border-b [&>th]:border-border [&>th]:bg-muted/40 [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground">
								<th className="w-10 text-center">#</th>
								<th className="sticky left-0 z-10 bg-muted/40">Number</th>
								<th>Company</th>
								<th>Issued</th>
								<th>Place of supply</th>
								<th className="text-right">Tax</th>
								<th className="text-right">Total</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((i, idx) => {
								const isOpen = openId === i.id;
								return (
									<Fragment key={i.id}>
										<tr
											onClick={() => setOpenId(isOpen ? null : i.id)}
											className="group cursor-pointer [&>td]:border-b [&>td]:border-border/60 [&>td]:px-3 [&>td]:py-2.5 hover:[&>td]:bg-muted/30"
										>
											<td className="text-center text-xs tabular-nums text-muted-foreground">{idx + 1}</td>
											<td className="sticky left-0 z-10 bg-card font-medium text-foreground group-hover:bg-muted/30">
												{i.number}
												<span className="ml-2 text-[10px] uppercase text-muted-foreground">{i.direction === "receivable" ? "sale" : "purchase"}</span>
											</td>
											<td className="text-foreground">{i.company}</td>
											<td className="text-muted-foreground">{i.issue_date}</td>
											<td className="text-muted-foreground">{i.place_of_supply ?? "—"}</td>
											<td className="text-right tabular-nums text-muted-foreground">{fmt(i.tax)}</td>
											<td className="text-right font-medium tabular-nums text-foreground">{fmt(i.total)}</td>
											<td>
												<span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge[i.status] ?? ""}`}>{i.status}</span>
											</td>
										</tr>
										{isOpen && (
											<tr>
												<td colSpan={8} className="border-b border-border/60 bg-muted/20 px-4 py-3">
													{detail?.id === i.id ? (
														<InvoiceDetail detail={detail} status={i.status} busy={busy} fmt={fmt} />
													) : (
														<a href={`?id=${i.id}${view !== "all" ? `&view=${view}` : ""}`} className="text-xs text-brand hover:underline">
															Load line items →
														</a>
													)}
												</td>
											</tr>
										)}
									</Fragment>
								);
							})}
							{rows.length === 0 && (
								<tr>
									<td colSpan={8} className="border-b border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
										Nothing here yet.
									</td>
								</tr>
							)}
						</tbody>
						<tfoot>
							<tr className="[&>td]:bg-muted/40 [&>td]:px-3 [&>td]:py-2.5 [&>td]:font-medium">
								<td />
								<td className="sticky left-0 z-10 bg-muted/40 text-muted-foreground">{rows.length} invoices</td>
								<td /><td /><td /><td />
								<td className="text-right tabular-nums text-foreground">{fmt(total)}</td>
								<td />
							</tr>
						</tfoot>
					</table>
				</div>
			</section>
		</div>
	);
}

function InvoiceDetail({
	detail,
	status,
	busy,
	fmt,
}: {
	detail: NonNullable<Route.ComponentProps["loaderData"]["detail"]>;
	status: string;
	busy: boolean;
	fmt: (n: number) => string;
}) {
	return (
		<div>
			<table className="w-full text-xs">
				<tbody className="divide-y divide-border/60">
					{(detail.lines as { description: string; taxable: number; cgst: number; sgst: number; igst: number; total: number }[]).map((l, j) => (
						<tr key={j}>
							<td className="py-1 pr-2 text-foreground">{l.description}</td>
							<td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">{fmt(l.taxable)}</td>
							<td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">
								{l.igst ? `IGST ${fmt(l.igst)}` : `C/S ${fmt(l.cgst)}+${fmt(l.sgst)}`}
							</td>
							<td className="py-1 text-right tabular-nums text-foreground">{fmt(l.total)}</td>
						</tr>
					))}
				</tbody>
			</table>
			<div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
				<span className="text-muted-foreground">
					Subtotal {fmt(detail.subtotal as number)} · Tax {fmt(detail.tax as number)}
				</span>
				<span className="font-medium text-foreground">Total {fmt(detail.total as number)}</span>
			</div>
			{status !== "paid" && status !== "void" && (
				<Form method="post" className="mt-2 flex gap-2">
					<input type="hidden" name="id" value={detail.id as string} />
					<Button type="submit" name="status" value="paid" size="sm" variant="outline" disabled={busy}>Mark paid</Button>
					<Button type="submit" name="status" value="void" size="sm" variant="outline" className="text-destructive" disabled={busy}>Void</Button>
				</Form>
			)}
		</div>
	);
}
