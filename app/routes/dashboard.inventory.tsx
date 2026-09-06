import { Link } from "react-router";
import type { Route } from "./+types/dashboard.inventory";
import { requireOrg } from "~/lib/org.server";
import { inventoryGrid } from "~/lib/inventory.server";
import { formatMoney } from "~/lib/money";

export function meta() {
	return [{ title: "Inventory | Gray Office" }];
}

const CATEGORIES = ["software", "hardware", "consumables", "services", "other"] as const;
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

export async function loader({ request, context }: Route.LoaderArgs) {
	const { orgId, org } = await requireOrg(request, context.cloudflare.env);
	const url = new URL(request.url);
	const year = Number(url.searchParams.get("year")) || new Date().getFullYear();
	const grid = await inventoryGrid(context.cloudflare.env.DB, orgId, year);
	const byCat = Object.fromEntries(grid.categories.map((g) => [g.category, g]));
	return {
		year,
		currency: org.currency,
		thisYear: new Date().getFullYear(),
		grandTotal: grid.grand_total,
		months: grid.months,
		cards: CATEGORIES.map((c) => ({
			category: c,
			total: byCat[c]?.total ?? 0,
			count: byCat[c]?.items.length ?? 0,
			months: byCat[c]?.months ?? new Array(12).fill(0),
		})),
	};
}

export default function Inventory({ loaderData }: Route.ComponentProps) {
	const { year, currency, thisYear, grandTotal, months, cards } = loaderData;
	const inr = (n: number) => (n ? formatMoney(n, currency) : "—");
	const years = Array.from({ length: 5 }, (_, i) => thisYear - 3 + i);
	const peak = Math.max(1, ...months);

	return (
		<div className="mx-auto max-w-5xl p-4 md:p-6">
			<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-normal text-foreground">Inventory &amp; spend</h1>
					<p className="text-sm text-muted-foreground">
						What you pay for, by category. Open a category for the month-by-month grid.
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

			<section className="mb-5 rounded-xl bg-card p-4">
				<div className="flex items-baseline justify-between">
					<span className="text-xs uppercase tracking-wide text-muted-foreground">Total {year}</span>
					<span className="text-2xl font-semibold tabular-nums text-foreground">{inr(grandTotal)}</span>
				</div>
				<div className="mt-3 flex items-end gap-1" style={{ height: 44 }}>
					{months.map((v, i) => (
						<div key={i} className="flex flex-1 flex-col items-center gap-1">
							<div
								className="w-full rounded-sm bg-brand/70"
								style={{ height: `${Math.max(2, (v / peak) * 36)}px` }}
								title={`${MONTHS[i]}: ${inr(v)}`}
							/>
						</div>
					))}
				</div>
			</section>

			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{cards.map((c) => {
					const cPeak = Math.max(1, ...c.months);
					return (
						<Link
							key={c.category}
							to={`/dashboard/inventory/${c.category}?year=${year}`}
							className="group rounded-xl bg-card p-4 transition-colors hover:bg-muted/50"
						>
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium capitalize text-foreground">{c.category}</span>
								<span className="text-xs text-muted-foreground">{c.count} item{c.count === 1 ? "" : "s"}</span>
							</div>
							<div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{inr(c.total)}</div>
							<div className="mt-3 flex items-end gap-0.5" style={{ height: 28 }}>
								{c.months.map((v, i) => (
									<div
										key={i}
										className="flex-1 rounded-[1px] bg-brand/50 group-hover:bg-brand/70"
										style={{ height: `${Math.max(2, (v / cPeak) * 24)}px` }}
									/>
								))}
							</div>
							<span className="mt-2 inline-block text-xs font-medium text-brand">Open grid →</span>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
