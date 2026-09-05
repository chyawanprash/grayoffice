import {
	ArrowUpRight,
	CheckCircle,
	Circle,
	Play,
	TrendUp,
} from "@phosphor-icons/react";

export function meta() {
	return [{ title: "Overview — Gray Office" }];
}

const KPIS = [
	{ label: "Cash on hand", value: "$4.82M", delta: "+3.1%", up: true },
	{ label: "Open reconciliation items", value: "27", delta: "-12", up: true },
	{ label: "GST payable (this period)", value: "₹8.64L", delta: "+₹1.2L", up: false },
	{ label: "Close progress", value: "142 / 148", delta: "96%", up: true },
];

const JURISDICTIONS = [
	{ place: "India · Maharashtra", count: 3120, pct: 100 },
	{ place: "India · Karnataka", count: 1980, pct: 63 },
	{ place: "India · Delhi", count: 1240, pct: 40 },
	{ place: "United States · California", count: 860, pct: 28 },
	{ place: "United States · New York", count: 540, pct: 17 },
	{ place: "Singapore", count: 310, pct: 10 },
];

const GST = [
	{ label: "CGST", amount: "₹3.24L", note: "9% · intra-state" },
	{ label: "SGST", amount: "₹3.24L", note: "9% · intra-state" },
	{ label: "IGST", amount: "₹2.16L", note: "18% · inter-state" },
];

const CASH_WEEKS = [62, 58, 71, 66, 74, 69, 80, 77, 72, 85, 81, 88, 92];

const CHECKLIST = [
	{ label: "Connect ERP (NetSuite)", done: true },
	{ label: "Link primary bank accounts", done: true },
	{ label: "Import chart of accounts", done: true },
	{ label: "Set reconciliation thresholds", done: false },
	{ label: "Configure GST registrations by state", done: false },
	{ label: "Invite your controller", done: false },
];

export default function Dashboard() {
	const doneCount = CHECKLIST.filter((c) => c.done).length;

	return (
		<div className="mx-auto max-w-6xl">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-xl font-semibold tracking-tight text-neutral-900">
						Overview
					</h1>
					<p className="text-sm text-neutral-500">
						September 2026 close · updated 4 minutes ago
					</p>
				</div>
				<div className="flex items-center gap-2">
					<span className="rounded-lg border border-neutral-200 bg-surface px-3 py-1.5 text-sm text-neutral-600">
						This period
					</span>
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-brand transition-colors hover:bg-brand-hover"
					>
						<Play size={14} weight="fill" /> Run close
					</button>
				</div>
			</div>

			{/* KPIs */}
			<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{KPIS.map((k) => (
					<div
						key={k.label}
						className="rounded-xl border border-neutral-200 bg-surface p-4 shadow-xs"
					>
						<div className="text-sm text-neutral-500">{k.label}</div>
						<div className="mt-2 text-2xl font-semibold text-neutral-900">
							{k.value}
						</div>
						<div
							className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
								k.up ? "text-success" : "text-danger"
							}`}
						>
							<ArrowUpRight size={12} weight="bold" />
							{k.delta}
						</div>
					</div>
				))}
			</div>

			<div className="mt-4 grid gap-4 lg:grid-cols-3">
				{/* Transactions by jurisdiction */}
				<Card
					className="lg:col-span-2"
					title="Transactions by country & state"
					subtitle="8,260 transactions this period"
				>
					<ul className="space-y-3">
						{JURISDICTIONS.map((j) => (
							<li key={j.place}>
								<div className="flex items-center justify-between text-sm">
									<span className="text-neutral-700">{j.place}</span>
									<span className="tabular-nums font-medium text-neutral-900">
										{j.count.toLocaleString()}
									</span>
								</div>
								<div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-tint">
									<div
										className="h-full rounded-full bg-brand"
										style={{ width: `${j.pct}%` }}
									/>
								</div>
							</li>
						))}
					</ul>
				</Card>

				{/* GST cards */}
				<Card
					title="GST tax breakdown"
					subtitle="Place of supply auto-detected"
				>
					<div className="space-y-2.5">
						{GST.map((g) => (
							<div
								key={g.label}
								className="flex items-center justify-between rounded-lg border border-neutral-200 bg-canvas px-3 py-2.5"
							>
								<div>
									<div className="text-sm font-medium text-neutral-900">
										{g.label}
									</div>
									<div className="text-xs text-neutral-500">{g.note}</div>
								</div>
								<div className="tabular-nums text-sm font-semibold text-neutral-900">
									{g.amount}
								</div>
							</div>
						))}
					</div>
					<div className="mt-3 rounded-lg bg-brand-tint px-3 py-2 text-xs text-brand">
						12 transactions flagged for manual state review.
					</div>
				</Card>

				{/* Cash report */}
				<Card
					className="lg:col-span-2"
					title="Cash report — 13-week forecast"
					subtitle="Projected closing balance, $000s"
				>
					<div className="flex h-32 items-end gap-1.5">
						{CASH_WEEKS.map((v, i) => (
							<div
								key={i}
								className="flex-1 rounded-t bg-brand/80"
								style={{ height: `${v}%` }}
								title={`Week ${i + 1}`}
							/>
						))}
					</div>
					<div className="mt-2 flex items-center gap-1 text-xs text-success">
						<TrendUp size={13} weight="bold" /> Trending +14% over the quarter
					</div>
				</Card>

				{/* Budget + credit usage */}
				<div className="grid gap-4">
					<Card title="Department budget" subtitle="Finance ops · monthly">
						<div className="flex items-baseline justify-between">
							<span className="text-2xl font-semibold text-neutral-900">
								$18.4k
							</span>
							<span className="text-sm text-neutral-500">of $25k</span>
						</div>
						<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-tint">
							<div
								className="h-full rounded-full bg-brand"
								style={{ width: "74%" }}
							/>
						</div>
						<div className="mt-1.5 text-xs text-neutral-500">
							74% used · 8 days left
						</div>
					</Card>
					<Card title="Agent credit usage" subtitle="Resets Oct 1">
						<div className="flex items-baseline justify-between">
							<span className="text-2xl font-semibold text-neutral-900">
								6,120
							</span>
							<span className="text-sm text-neutral-500">/ 10,000 runs</span>
						</div>
						<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-tint">
							<div
								className="h-full rounded-full bg-success"
								style={{ width: "61%" }}
							/>
						</div>
						<div className="mt-1.5 text-xs text-neutral-500">
							61% used this cycle
						</div>
					</Card>
				</div>
			</div>

			{/* Onboarding checklist */}
			<Card
				className="mt-4"
				title="Finish setting up"
				subtitle={`${doneCount} of ${CHECKLIST.length} steps complete`}
			>
				<div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-tint">
					<div
						className="h-full rounded-full bg-brand"
						style={{ width: `${(doneCount / CHECKLIST.length) * 100}%` }}
					/>
				</div>
				<ul className="grid gap-1 sm:grid-cols-2">
					{CHECKLIST.map((c) => (
						<li
							key={c.label}
							className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm"
						>
							{c.done ? (
								<CheckCircle
									size={18}
									weight="fill"
									className="shrink-0 text-success"
								/>
							) : (
								<Circle size={18} className="shrink-0 text-neutral-300" />
							)}
							<span
								className={
									c.done ? "text-neutral-400 line-through" : "text-neutral-700"
								}
							>
								{c.label}
							</span>
						</li>
					))}
				</ul>
			</Card>
		</div>
	);
}

function Card({
	title,
	subtitle,
	children,
	className = "",
}: {
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<section
			className={`rounded-xl border border-neutral-200 bg-surface p-5 shadow-xs ${className}`}
		>
			<div className="mb-4">
				<h2 className="font-medium text-neutral-900">{title}</h2>
				{subtitle && (
					<p className="text-xs text-neutral-500">{subtitle}</p>
				)}
			</div>
			{children}
		</section>
	);
}
