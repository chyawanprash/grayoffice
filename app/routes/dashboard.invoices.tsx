import { useState } from "react";
import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.invoices";
import { Button } from "~/components/ui/button";
import { requireOrg } from "~/lib/org.server";
import { getInvoice, listInvoices, setInvoiceStatus } from "~/lib/ledger.server";

export function meta() {
	return [{ title: "Invoices | Gray Office" }];
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export async function loader({ request, context }: Route.LoaderArgs) {
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	const url = new URL(request.url);
	const direction = url.searchParams.get("direction") ?? undefined;
	const openId = url.searchParams.get("id");
	const [invoices, detail] = await Promise.all([
		listInvoices(context.cloudflare.env.DB, orgId, { direction, limit: 100 }),
		openId ? getInvoice(context.cloudflare.env.DB, orgId, openId) : Promise.resolve(null),
	]);
	return { invoices, detail, direction: direction ?? "all" };
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
	const { invoices, detail, direction } = loaderData;
	const nav = useNavigation();
	const busy = nav.formData != null;
	const [openId, setOpenId] = useState<string | null>((detail?.id as string) ?? null);

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-6">
			<div className="mb-6">
				<h1 className="text-2xl font-normal text-foreground">Invoices</h1>
				<p className="text-sm text-muted-foreground">
					Receivables and payables. Ask Bhondu to raise a new invoice or process
					one from an uploaded PDF.
				</p>
			</div>

			<div className="mb-3 flex gap-1.5">
				{["all", "receivable", "payable"].map((d) => (
					<a
						key={d}
						href={d === "all" ? "?" : `?direction=${d}`}
						className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
							direction === d ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:text-foreground"
						}`}
					>
						{d}
					</a>
				))}
			</div>

			<section className="rounded-xl border border-border bg-card">
				<ul className="divide-y divide-border/60 text-sm">
					{invoices.map((i) => (
						<li key={i.id} className="px-4 py-2.5">
							<button
								type="button"
								onClick={() => setOpenId(openId === i.id ? null : i.id)}
								className="flex w-full items-center justify-between gap-3 text-left"
							>
								<span className="min-w-0">
									<span className="block truncate text-foreground">{i.company}</span>
									<span className="text-xs text-muted-foreground">
										{i.number} · {i.issue_date} · {i.place_of_supply ?? "—"}
									</span>
								</span>
								<span className="flex shrink-0 items-center gap-2">
									<span className="tabular-nums text-foreground">{inr(i.total)}</span>
									<span className={`rounded-md px-2 py-0.5 text-xs font-medium ${badge[i.status] ?? ""}`}>
										{i.status}
									</span>
								</span>
							</button>

							{openId === i.id && detail?.id === i.id && (
								<div className="mt-3 rounded-lg bg-muted/60 p-3">
									<table className="w-full text-xs">
										<tbody className="divide-y divide-border/60">
											{(detail.lines as { description: string; taxable: number; cgst: number; sgst: number; igst: number; total: number }[]).map((l, j) => (
												<tr key={j}>
													<td className="py-1 pr-2 text-foreground">{l.description}</td>
													<td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">{inr(l.taxable)}</td>
													<td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">
														{l.igst ? `IGST ${inr(l.igst)}` : `C/S ${inr(l.cgst)}+${inr(l.sgst)}`}
													</td>
													<td className="py-1 text-right tabular-nums text-foreground">{inr(l.total)}</td>
												</tr>
											))}
										</tbody>
									</table>
									<div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
										<span className="text-muted-foreground">
											Subtotal {inr(detail.subtotal as number)} · Tax {inr(detail.tax as number)}
										</span>
										<span className="font-medium text-foreground">Total {inr(detail.total as number)}</span>
									</div>
									{i.status !== "paid" && i.status !== "void" && (
										<Form method="post" className="mt-2 flex gap-2">
											<input type="hidden" name="id" value={i.id} />
											<Button type="submit" name="status" value="paid" size="sm" variant="outline" disabled={busy}>
												Mark paid
											</Button>
											<Button type="submit" name="status" value="void" size="sm" variant="outline" className="text-destructive" disabled={busy}>
												Void
											</Button>
										</Form>
									)}
								</div>
							)}
							{openId === i.id && detail?.id !== i.id && (
								<a href={`?id=${i.id}${direction !== "all" ? `&direction=${direction}` : ""}`} className="mt-1 block text-xs text-brand hover:underline">
									Load details
								</a>
							)}
						</li>
					))}
					{invoices.length === 0 && <li className="px-4 py-4 text-muted-foreground">No invoices yet.</li>}
				</ul>
			</section>
		</div>
	);
}
