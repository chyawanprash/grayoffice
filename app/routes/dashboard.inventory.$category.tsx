import { redirect } from "react-router";
import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.inventory.$category";
import { requireOrg } from "~/lib/org.server";
import { addInventoryItem, deleteInventoryItem, inventoryGrid } from "~/lib/inventory.server";

const CATEGORIES = ["software", "hardware", "consumables", "services", "other"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const inr = (n: number) => (n ? `₹${Math.round(n).toLocaleString("en-IN")}` : "·");

export function meta({ params }: Route.MetaArgs) {
	return [{ title: `${params.category} inventory | Gray Office` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	const category = String(params.category);
	if (!CATEGORIES.includes(category)) throw redirect("/dashboard/inventory");
	const year = Number(new URL(request.url).searchParams.get("year")) || new Date().getFullYear();
	const grid = await inventoryGrid(context.cloudflare.env.DB, orgId, year, category);
	const group = grid.categories[0] ?? { category, items: [], months: new Array(12).fill(0), total: 0 };
	return { category, year, thisYear: new Date().getFullYear(), group };
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

export default function InventoryCategory({ loaderData, actionData }: Route.ComponentProps) {
	const { category, year, thisYear, group } = loaderData;
	const nav = useNavigation();
	const busy = nav.formData != null;
	const years = Array.from({ length: 5 }, (_, i) => thisYear - 3 + i);

	return (
		<div className="mx-auto max-w-5xl p-4 md:p-6">
			<nav className="mb-3 text-sm text-muted-foreground">
				<Link to="/dashboard/inventory" className="hover:text-foreground">Inventory</Link>
				<span className="mx-2">/</span>
				<span className="capitalize text-foreground">{category}</span>
			</nav>

			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-normal capitalize text-foreground">{category}</h1>
					<p className="text-sm text-muted-foreground">
						{group.items.length} item{group.items.length === 1 ? "" : "s"} · {inr(group.total)} in {year}
					</p>
				</div>
				<div className="flex gap-1.5">
					{years.map((y) => (
						<a
							key={y}
							href={`?year=${y}`}
							className={`rounded-full px-3 py-1 text-xs font-medium ${
								y === year ? "bg-brand text-white" : "bg-muted text-muted-foreground hover:text-foreground"
							}`}
						>
							{y}
						</a>
					))}
				</div>
			</div>

			{actionData && "error" in actionData && actionData.error && (
				<p className="mb-4 rounded-lg border border-destructive/30 bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] px-3 py-2 text-sm text-destructive">
					{actionData.error}
				</p>
			)}

			<div className="overflow-x-auto rounded-xl border border-border bg-card">
				<table className="w-full min-w-[56rem] border-collapse text-xs">
					<thead>
						<tr className="border-b border-border text-muted-foreground">
							<th className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-medium">Item</th>
							{MONTHS.map((m) => (
								<th key={m} className="px-2 py-2 text-right font-medium">{m}</th>
							))}
							<th className="px-3 py-2 text-right font-medium">Total</th>
							<th className="px-2 py-2" />
						</tr>
					</thead>
					<tbody className="divide-y divide-border/50">
						{group.items.map((it) => (
							<tr key={it.id} className="hover:bg-muted/40">
								<td className="sticky left-0 z-10 bg-card px-4 py-2">
									<div className="text-foreground">{it.name}</div>
									<div className="text-[11px] text-muted-foreground">
										{it.vendor ? `${it.vendor} · ` : ""}
										{it.kind === "purchase"
											? `one-off${it.quantity > 1 ? ` ×${it.quantity}` : ""}`
											: `${it.cadence}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`}
									</div>
								</td>
								{it.months.map((v, i) => (
									<td key={i} className={`px-2 py-2 text-right tabular-nums ${v ? "text-foreground" : "text-muted-foreground/40"}`}>
										{inr(v)}
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
						{group.items.length === 0 && (
							<tr>
								<td colSpan={15} className="px-4 py-6 text-center text-muted-foreground">
									No {category} tracked for {year}. Add the first item below.
								</td>
							</tr>
						)}
					</tbody>
					{group.items.length > 0 && (
						<tfoot>
							<tr className="border-t border-border font-medium">
								<td className="sticky left-0 z-10 bg-card px-4 py-2 text-muted-foreground">Subtotal</td>
								{group.months.map((v, i) => (
									<td key={i} className="px-2 py-2 text-right tabular-nums text-foreground">{inr(v)}</td>
								))}
								<td className="px-3 py-2 text-right tabular-nums text-foreground">{inr(group.total)}</td>
								<td />
							</tr>
						</tfoot>
					)}
				</table>
			</div>

			<section className="mt-6 rounded-xl border border-border bg-card p-4">
				<h2 className="mb-3 text-sm font-medium text-foreground">Add a {category} item</h2>
				<Form method="post" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<Field label="Name"><input name="name" required placeholder="Figma, MacBook Pro 14”…" className={inputCls} /></Field>
					<Field label="Vendor"><input name="vendor" placeholder="Apple, Adobe…" className={inputCls} /></Field>
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
					<Field label="Start / purchase date"><input name="start_date" type="date" className={inputCls} /></Field>
					<Field label="Notes"><input name="notes" className={inputCls} /></Field>
					<div className="flex items-end">
						<button
							type="submit"
							disabled={busy}
							className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-white disabled:opacity-60"
						>
							{busy ? "Saving…" : "Add item"}
						</button>
					</div>
				</Form>
			</section>
		</div>
	);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label className="flex flex-col gap-1 text-xs text-muted-foreground">
			{label}
			{children}
		</label>
	);
}
