import { useRef } from "react";
import { redirect } from "react-router";
import { Form, Link, useNavigate, useNavigation } from "react-router";
import { Trash } from "@phosphor-icons/react";
import type { Route } from "./+types/dashboard.inventory.$category";
import { Button } from "~/components/ui/button";
import { requireOrg } from "~/lib/org.server";
import { addInventoryItem, deleteInventoryItem, inventoryGrid } from "~/lib/inventory.server";
import { formatMoney } from "~/lib/money";
import { Tag, type TagColor } from "~/components/ui/tag";

const CATEGORIES = ["software", "hardware", "consumables", "services", "other"];
const MONTHS = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function meta({ params }: Route.MetaArgs) {
	return [{ title: `${params.category} inventory | Gray Office` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
	const { orgId, org } = await requireOrg(request, context.cloudflare.env);
	const category = String(params.category);
	if (!CATEGORIES.includes(category)) throw redirect("/dashboard/inventory");
	const now = new Date();
	const url = new URL(request.url);
	const year = Number(url.searchParams.get("year")) || now.getFullYear();
	const monthParam = url.searchParams.get("month");
	const month = monthParam != null ? Math.min(11, Math.max(0, Number(monthParam))) : now.getMonth();

	const grid = await inventoryGrid(context.cloudflare.env.DB, orgId, year, category);
	const group = grid.categories[0] ?? { category, items: [], months: new Array(12).fill(0), total: 0 };
	return { category, year, month, currency: org.currency, thisYear: now.getFullYear(), group };
}

export async function action({ request, context, params }: Route.ActionArgs) {
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	const db = context.cloudflare.env.DB;
	const category = String(params.category);
	const form = await request.formData();

	if (form.get("intent") === "delete") {
		await deleteInventoryItem(db, orgId, String(form.get("id")));
		return { ok: "deleted" as const };
	}

	const name = String(form.get("name") ?? "").trim();
	if (!name) return { error: "Name is required." };
	const kind = form.get("kind") === "purchase" ? "purchase" : "subscription";
	await addInventoryItem(db, orgId, {
		name,
		category,
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

const inputCls =
	"h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-brand";
const selectCls =
	"h-9 rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground outline-none focus:border-brand";

function typeMeta(it: { kind: string; cadence: string }): { label: string; color: TagColor } {
	if (it.kind === "purchase") return { label: "one-off", color: "purple" };
	if (it.cadence === "yearly") return { label: "yearly", color: "indigo" };
	return { label: "monthly", color: "blue" };
}

function priceLabel(it: { amount_cents: number; quantity: number }, currency: string) {
	const unit = formatMoney(it.amount_cents / 100, currency);
	return `${unit}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`;
}

export default function InventoryCategory({ loaderData, actionData }: Route.ComponentProps) {
	const { category, year, month, currency, thisYear, group } = loaderData;
	const inr = (n: number) => formatMoney(n, currency);
	const nav = useNavigation();
	const navigate = useNavigate();
	const busy = nav.formData != null;
	const years = Array.from({ length: 6 }, (_, i) => thisYear - 4 + i);
	const addRef = useRef<HTMLDivElement>(null);

	const go = (y: number, m: number) => navigate(`?year=${y}&month=${m}`);
	const monthTotal = group.months[month];
	const monthItems = group.items.filter((it) => it.months[month] > 0);
	const peak = Math.max(1, ...group.months);

	return (
		<div className="mx-auto max-w-4xl p-4 md:p-6">
			<nav className="mb-3 text-sm text-muted-foreground">
				<Link to="/dashboard/inventory" className="hover:text-foreground">Inventory</Link>
				<span className="mx-2">/</span>
				<span className="capitalize text-foreground">{category}</span>
			</nav>

			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-normal capitalize text-foreground">{category}</h1>
				<div className="flex items-center gap-2">
					<select className={selectCls} value={month} onChange={(e) => go(year, Number(e.target.value))} aria-label="Month">
						{MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
					</select>
					<select className={selectCls} value={year} onChange={(e) => go(Number(e.target.value), month)} aria-label="Year">
						{years.map((y) => <option key={y} value={y}>{y}</option>)}
					</select>
				</div>
			</div>

			{/* year-at-a-glance strip — click a bar to jump to that month */}
			<div className="mb-5 flex items-end gap-1 rounded-xl border border-border bg-card p-3" style={{ height: 68 }}>
				{group.months.map((v, i) => (
					<button
						key={i}
						type="button"
						onClick={() => go(year, i)}
						title={`${MONTHS_SHORT[i]}: ${v ? inr(v) : "—"}`}
						className="group flex flex-1 flex-col items-center gap-1"
					>
						<span className="flex w-full flex-1 items-end">
							<span
								className={`w-full rounded-sm transition-colors ${i === month ? "bg-brand" : "bg-brand/30 group-hover:bg-brand/50"}`}
								style={{ height: `${Math.max(3, (v / peak) * 36)}px` }}
							/>
						</span>
						<span className={`text-[10px] ${i === month ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
							{MONTHS_SHORT[i]}
						</span>
					</button>
				))}
			</div>

			{actionData && "error" in actionData && actionData.error && (
				<p className="mb-4 rounded-lg border border-destructive/30 bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] px-3 py-2 text-sm text-destructive">
					{actionData.error}
				</p>
			)}

			{/* ── Records table: the selected month ── */}
			<section className="overflow-hidden rounded-xl border border-border bg-card">
				<div className="flex items-center justify-between border-b border-border px-4 py-2.5">
					<h2 className="text-sm font-medium text-foreground">
						{MONTHS[month]} {year}
					</h2>
					<button
						type="button"
						onClick={() => addRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
						className="rounded-md px-2 py-1 text-xs font-medium text-brand hover:bg-brand/10"
					>
						+ New record
					</button>
				</div>

				<div className="overflow-x-auto">
					<table className="w-full min-w-[44rem] border-separate border-spacing-0 text-sm">
						<thead>
							<tr className="[&>th]:border-b [&>th]:border-border [&>th]:bg-muted/40 [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground">
								<th className="w-10 text-center">#</th>
								<th className="sticky left-0 z-10 bg-muted/40">Item</th>
								<th>Vendor</th>
								<th>Type</th>
								<th>Billing</th>
								<th>{monthItems.some((it) => it.kind === "purchase") ? "Purchased" : "Since"}</th>
								<th className="text-right">{MONTHS_SHORT[month]} charge</th>
								<th className="text-right">Year total</th>
								<th className="w-12" />
							</tr>
						</thead>
						<tbody>
							{monthItems.map((it, idx) => (
								<tr key={it.id} className="group [&>td]:border-b [&>td]:border-border/60 [&>td]:px-3 [&>td]:py-2.5">
									<td className="text-center text-xs tabular-nums text-muted-foreground">{idx + 1}</td>
									<td className="sticky left-0 z-10 bg-card font-medium text-foreground group-hover:bg-muted/40">
										{it.name}
									</td>
									<td className="text-muted-foreground">{it.vendor || "—"}</td>
									<td>
										{(() => {
											const t = typeMeta(it);
											return <Tag color={t.color}>{t.label}</Tag>;
										})()}
									</td>
									<td className="tabular-nums text-muted-foreground">{priceLabel(it, currency)}</td>
									<td className="tabular-nums text-muted-foreground">{it.start_date}</td>
									<td className="text-right font-medium tabular-nums text-foreground">{inr(it.months[month])}</td>
									<td className="text-right tabular-nums text-muted-foreground">{inr(it.total)}</td>
									<td className="text-right">
										<Form method="post">
											<input type="hidden" name="intent" value="delete" />
											<input type="hidden" name="id" value={it.id} />
											<Button
												type="submit"
												variant="ghost"
												size="icon-sm"
												disabled={busy}
												aria-label={`Delete ${it.name}`}
												className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
											>
												<Trash />
											</Button>
										</Form>
									</td>
								</tr>
							))}
							{monthItems.length === 0 && (
								<tr>
									<td colSpan={9} className="border-b border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
										No {category} spend in {MONTHS[month]} {year}.
									</td>
								</tr>
							)}
						</tbody>
						<tfoot>
							<tr className="[&>td]:bg-muted/40 [&>td]:px-3 [&>td]:py-2.5 [&>td]:font-medium">
								<td />
								<td className="sticky left-0 z-10 bg-muted/40 text-muted-foreground">
									{monthItems.length} record{monthItems.length === 1 ? "" : "s"}
								</td>
								<td /><td /><td /><td />
								<td className="text-right tabular-nums text-foreground">{inr(monthTotal)}</td>
								<td className="text-right tabular-nums text-muted-foreground">{inr(group.total)}</td>
								<td />
							</tr>
						</tfoot>
					</table>
				</div>
			</section>

			{/* ── Add item ── */}
			<section ref={addRef} className="mt-6 dash-card p-4">
				<h2 className="mb-3 text-sm font-medium text-foreground">Add a {category} item</h2>
				<Form method="post" className="grid gap-3 sm:grid-cols-2">
					<Field label="Name" className="sm:col-span-2">
						<input name="name" required placeholder="Figma, MacBook Pro 14”…" className={inputCls} />
					</Field>
					<Field label="Vendor"><input name="vendor" placeholder="Apple, Adobe…" className={inputCls} /></Field>
					<Field label="Start / purchase date"><input name="start_date" type="date" className={inputCls} /></Field>
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
					<Field label="Amount (per unit)">
						<input name="amount" type="number" min="0" step="0.01" required className={inputCls} />
					</Field>
					<Field label="Quantity">
						<input name="quantity" type="number" min="1" step="1" defaultValue={1} className={inputCls} />
					</Field>
					<Field label="Notes" className="sm:col-span-2"><input name="notes" className={inputCls} /></Field>
					<div className="sm:col-span-2">
						<Button type="submit" size="sm" disabled={busy}>
							{busy ? "Saving…" : "Add item"}
						</Button>
					</div>
				</Form>
			</section>
		</div>
	);
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
	return (
		<label className={`flex flex-col gap-1 text-xs text-muted-foreground ${className}`}>
			{label}
			{children}
		</label>
	);
}
