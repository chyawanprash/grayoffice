import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.inventory";
import { requireOrg } from "~/lib/org.server";
import {
	addInventoryItem,
	deleteInventoryItem,
	inventoryGrid,
} from "~/lib/inventory.server";

const CATEGORIES = ["software", "hardware", "consumables", "services", "other"];

export function meta() {
	return [{ title: "Inventory | Gray Office" }];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const inr = (n: number) =>
	n ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—";

export async function loader({ request, context }: Route.LoaderArgs) {
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	const url = new URL(request.url);
	const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
	const grid = await inventoryGrid(context.cloudflare.env.DB, orgId, year);
	return { grid, thisYear: new Date().getFullYear() };
}

export async function action({ request, context }: Route.ActionArgs) {
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	const db = context.cloudflare.env.DB;
	const form = await request.formData();
	const intent = String(form.get("intent"));

	if (intent === "delete") {
		await deleteInventoryItem(db, orgId, String(form.get("id")));
		return { ok: "deleted" as const };
	}

	const name = String(form.get("name") ?? "").trim();
	if (!name) return { error: "Name is required." };
	const kind = form.get("kind") === "purchase" ? "purchase" : "subscription";
	await addInventoryItem(db, orgId, {
		name,
		category: String(form.get("category") ?? "software"),
		vendor: String(form.get("vendor") ?? "") || null,
		kind,
		cadence: kind === "purchase" ? "one_time" : (String(form.get("cadence") ?? "monthly") as "monthly" | "yearly"),
		amount: Number(form.get("amount")) || 0,
		quantity: Number(form.get("quantity")) || 1,
		start_date: String(form.get("start_date") ?? "") || undefined,
		notes: String(form.get("notes") ?? "") || null,
	});
	return { ok: "added" as const };
}

export default function Inventory({ loaderData, actionData }: Route.ComponentProps) {
	const { grid, thisYear } = loaderData;
	const nav = useNavigation();
	const busy = nav.formData != null;
	const years = Array.from({ length: 5 }, (_, i) => thisYear - 3 + i);

	return (
		<div className="mx-auto max-w-6xl p-4 md:p-6">
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-normal text-foreground">Inventory & spend</h1>
					<p className="text-sm text-muted-foreground">
						Software subscriptions, hardware, consumables — what you pay for, by month.
					</p>
				</div>
				<div className="flex gap-1.5">
					{years.map((y) => (
						<a
							key={y}
							href={`?year=${y}`}
							className={`rounded-full px-3 py-1 text-xs font-medium ${
								y === grid.year ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:text-foreground"
							}`}
						>
							{y}
						</a>
					))}
				</div>
			</div>

			<div className="mb-4 grid gap-3 sm:grid-cols-3">
				<Stat label={`Total ${grid.year}`} value={inr(grid.grand_total)} />
				<Stat label="Run-rate / month" value={inr(grid.months[new Date().getMonth()] || grid.months.filter(Boolean).slice(-1)[0] || 0)} />
				<Stat label="Categories" value={String(grid.categories.length)} />
			</div>

			{actionData && "error" in actionData && actionData.error && (
				<p className="mb-4 rounded-lg border border-destructive/30 bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] px-3 py-2 text-sm text-destructive">
					{actionData.error}
				</p>
			)}

			{grid.categories.length === 0 ? (
				<p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
					Nothing tracked yet. Add an item below, or ask Bhondu to add your subscriptions.
				</p>
			) : (
				<div className="space-y-4">
					{grid.categories.map((g) => (
						<section key={g.category} className="overflow-hidden rounded-xl border border-border bg-card">
							<div className="flex items-center justify-between px-4 py-2.5">
								<h2 className="text-sm font-medium capitalize text-foreground">{g.category}</h2>
								<span className="text-sm tabular-nums text-foreground">{inr(g.total)}</span>
							</div>
							<div className="overflow-x-auto">
								<table className="w-full min-w-[52rem] text-xs">
									<thead>
										<tr className="border-y border-border text-muted-foreground">
											<th className="px-4 py-1.5 text-left font-medium">Item</th>
											{MONTHS.map((m) => (
												<th key={m} className="px-1.5 py-1.5 text-right font-medium">{m}</th>
											))}
											<th className="px-3 py-1.5 text-right font-medium">Total</th>
											<th className="px-2 py-1.5" />
										</tr>
									</thead>
									<tbody className="divide-y divide-border/50">
										{g.items.map((it) => (
											<tr key={it.id}>
												<td className="px-4 py-2">
													<div className="text-foreground">{it.name}</div>
													<div className="text-[11px] text-muted-foreground">
														{it.vendor ? `${it.vendor} · ` : ""}
														{it.kind === "purchase"
															? `one-off${it.quantity > 1 ? ` ×${it.quantity}` : ""}`
															: `${it.cadence}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`}
													</div>
												</td>
												{it.months.map((v, i) => (
													<td key={i} className={`px-1.5 py-2 text-right tabular-nums ${v ? "text-foreground" : "text-muted-foreground/40"}`}>
														{v ? inr(v) : "·"}
													</td>
												))}
												<td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">{inr(it.total)}</td>
												<td className="px-2 py-2 text-right">
													<Form method="post">
														<input type="hidden" name="intent" value="delete" />
														<input type="hidden" name="id" value={it.id} />
														<button type="submit" className="text-muted-foreground hover:text-destructive" aria-label="Delete">×</button>
													</Form>
												</td>
											</tr>
										))}
									</tbody>
									<tfoot>
										<tr className="border-t border-border font-medium">
											<td className="px-4 py-1.5 text-muted-foreground">Subtotal</td>
											{g.months.map((v, i) => (
												<td key={i} className="px-1.5 py-1.5 text-right tabular-nums text-foreground">{v ? inr(v) : "·"}</td>
											))}
											<td className="px-3 py-1.5 text-right tabular-nums text-foreground">{inr(g.total)}</td>
											<td />
										</tr>
									</tfoot>
								</table>
							</div>
						</section>
					))}

					<div className="overflow-x-auto rounded-xl border border-border bg-muted/40">
						<table className="w-full min-w-[52rem] text-xs">
							<tbody>
								<tr className="font-semibold">
									<td className="px-4 py-2.5 text-foreground">All categories</td>
									{grid.months.map((v, i) => (
										<td key={i} className="px-1.5 py-2.5 text-right tabular-nums text-foreground">{v ? inr(v) : "·"}</td>
									))}
									<td className="px-3 py-2.5 text-right tabular-nums text-foreground">{inr(grid.grand_total)}</td>
									<td />
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			)}

			<section className="mt-6 rounded-xl border border-border bg-card p-4">
				<h2 className="mb-3 text-sm font-medium text-foreground">Add an item</h2>
				<Form method="post" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<Field label="Name">
						<input name="name" required placeholder="Figma, MacBook Pro 14”…" className={inputCls} />
					</Field>
					<Field label="Category">
						<select name="category" className={inputCls} defaultValue="software">
							{CATEGORIES.map((c) => (
								<option key={c} value={c} className="capitalize">{c}</option>
							))}
						</select>
					</Field>
					<Field label="Vendor">
						<input name="vendor" placeholder="Apple, Adobe…" className={inputCls} />
					</Field>
					<Field label="Type">
						<select name="kind" className={inputCls} defaultValue="subscription">
							<option value="subscription">Subscription</option>
							<option value="purchase">Purchase (one-off)</option>
						</select>
					</Field>
					<Field label="Cadence (subscriptions)">
						<select name="cadence" className={inputCls} defaultValue="monthly">
							<option value="monthly">Monthly</option>
							<option value="yearly">Yearly</option>
						</select>
					</Field>
					<Field label="Amount (₹, per unit)">
						<input name="amount" type="number" min="0" step="0.01" required className={inputCls} />
					</Field>
					<Field label="Quantity">
						<input name="quantity" type="number" min="1" step="1" defaultValue={1} className={inputCls} />
					</Field>
					<Field label="Start / purchase date">
						<input name="start_date" type="date" className={inputCls} />
					</Field>
					<Field label="Notes">
						<input name="notes" className={inputCls} />
					</Field>
					<div className="sm:col-span-2 lg:col-span-3">
						<button
							type="submit"
							disabled={busy}
							className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
						>
							{busy ? "Saving…" : "Add item"}
						</button>
					</div>
				</Form>
			</section>
		</div>
	);
}

const inputCls =
	"h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="flex flex-col gap-1 text-xs text-muted-foreground">
			{label}
			{children}
		</label>
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl bg-card p-4">
			<div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
			<div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
		</div>
	);
}
