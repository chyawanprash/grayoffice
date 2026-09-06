/**
 * Inventory / spend tracking. Items are the catalog; the monthly grid is
 * derived — a monthly subscription costs `amount * quantity` every month it's
 * active, a yearly one bills in its anniversary month, a one-time purchase
 * lands in the month it was acquired.
 *
 * ponytail: derived grid, no per-month override table. Add one only if
 * usage-based bills (AWS, etc.) need actuals that differ from the sticker price.
 */
type Env = { DB: D1Database };

const uid = () => crypto.randomUUID();
const inr = (cents: number) => cents / 100;
const r = (n: number) => Math.round(n);

export const INVENTORY_CATEGORIES = [
	"software",
	"hardware",
	"consumables",
	"services",
	"other",
] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export type InventoryItem = {
	id: string;
	org_id: string;
	category: string;
	name: string;
	vendor: string | null;
	kind: "subscription" | "purchase";
	cadence: "monthly" | "yearly" | "one_time";
	amount_cents: number;
	quantity: number;
	currency: string;
	start_date: string;
	end_date: string | null;
	notes: string | null;
	source: string;
	created_at: number;
};

export type InventoryItemInput = {
	category?: string;
	name: string;
	vendor?: string | null;
	kind?: "subscription" | "purchase";
	cadence?: "monthly" | "yearly" | "one_time";
	amount: number; // major units, per cadence per unit
	quantity?: number;
	currency?: string;
	start_date?: string;
	end_date?: string | null;
	notes?: string | null;
	source?: string;
};

export async function listInventory(db: D1Database, orgId: string): Promise<InventoryItem[]> {
	const { results } = await db
		.prepare(
			"SELECT * FROM inventory_items WHERE org_id = ? ORDER BY category, name",
		)
		.bind(orgId)
		.all<InventoryItem>();
	return results ?? [];
}

export async function addInventoryItem(
	db: D1Database,
	orgId: string,
	input: InventoryItemInput,
): Promise<{ id: string }> {
	const id = uid();
	const category = (INVENTORY_CATEGORIES as readonly string[]).includes(input.category ?? "")
		? input.category!
		: "other";
	const kind = input.kind === "purchase" ? "purchase" : "subscription";
	const cadence = kind === "purchase" ? "one_time" : input.cadence === "yearly" ? "yearly" : "monthly";
	await db
		.prepare(
			`INSERT INTO inventory_items
			 (id, org_id, category, name, vendor, kind, cadence, amount_cents, quantity, currency, start_date, end_date, notes, source)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			id, orgId, category, input.name.slice(0, 200), input.vendor?.slice(0, 160) ?? null,
			kind, cadence, r((input.amount ?? 0) * 100), input.quantity ?? 1,
			input.currency ?? "INR", input.start_date || new Date().toISOString().slice(0, 10),
			input.end_date ?? null, input.notes?.slice(0, 500) ?? null, input.source ?? "manual",
		)
		.run();
	return { id };
}

export async function updateInventoryItem(
	db: D1Database,
	orgId: string,
	id: string,
	patch: Partial<InventoryItemInput>,
): Promise<void> {
	const sets: string[] = [];
	const bind: unknown[] = [];
	const map: Record<string, unknown> = {
		category: patch.category,
		name: patch.name,
		vendor: patch.vendor,
		kind: patch.kind,
		cadence: patch.cadence,
		quantity: patch.quantity,
		currency: patch.currency,
		start_date: patch.start_date,
		end_date: patch.end_date,
		notes: patch.notes,
	};
	for (const [col, val] of Object.entries(map)) {
		if (val !== undefined) {
			sets.push(`${col} = ?`);
			bind.push(val);
		}
	}
	if (patch.amount !== undefined) {
		sets.push("amount_cents = ?");
		bind.push(r(patch.amount * 100));
	}
	if (sets.length === 0) return;
	await db
		.prepare(`UPDATE inventory_items SET ${sets.join(", ")} WHERE id = ? AND org_id = ?`)
		.bind(...bind, id, orgId)
		.run();
}

export async function deleteInventoryItem(db: D1Database, orgId: string, id: string): Promise<void> {
	await db.prepare("DELETE FROM inventory_items WHERE id = ? AND org_id = ?").bind(id, orgId).run();
}

const ym = (d: string) => ({ y: +d.slice(0, 4), m: +d.slice(5, 7) });

/** Cost of one item in each of the 12 months of `year`, in major units. */
export function monthlySpend(item: InventoryItem, year: number): number[] {
	const months = new Array(12).fill(0);
	const line = inr(item.amount_cents) * (item.quantity || 1);
	const start = ym(item.start_date);
	const end = item.end_date ? ym(item.end_date) : null;
	const active = (mIdx: number) => {
		const afterStart = year > start.y || (year === start.y && mIdx + 1 >= start.m);
		const beforeEnd = !end || year < end.y || (year === end.y && mIdx + 1 <= end.m);
		return afterStart && beforeEnd;
	};
	for (let i = 0; i < 12; i++) {
		if (item.cadence === "monthly") {
			if (active(i)) months[i] = line;
		} else if (item.cadence === "yearly") {
			if (active(i) && i + 1 === start.m) months[i] = line;
		} else {
			// one_time
			if (year === start.y && i + 1 === start.m) months[i] = line;
		}
	}
	return months;
}

export type InventoryRow = InventoryItem & { months: number[]; total: number };
export type InventoryCategoryGroup = {
	category: string;
	items: InventoryRow[];
	months: number[];
	total: number;
};

/** The whole grid for one year, grouped by category, with subtotals + totals. */
export async function inventoryGrid(db: D1Database, orgId: string, year: number) {
	const items = await listInventory(db, orgId);
	const groups = new Map<string, InventoryCategoryGroup>();
	const grandMonths = new Array(12).fill(0);

	for (const item of items) {
		const months = monthlySpend(item, year);
		const total = months.reduce((a, b) => a + b, 0);
		const g = groups.get(item.category) ?? {
			category: item.category,
			items: [],
			months: new Array(12).fill(0),
			total: 0,
		};
		g.items.push({ ...item, months, total });
		months.forEach((v, i) => {
			g.months[i] += v;
			grandMonths[i] += v;
		});
		g.total += total;
		groups.set(item.category, g);
	}

	const categories = [...groups.values()].sort((a, b) => a.category.localeCompare(b.category));
	return {
		year,
		categories,
		months: grandMonths,
		grand_total: grandMonths.reduce((a, b) => a + b, 0),
	};
}
