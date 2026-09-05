import { Link } from "react-router";
import {
	ArrowRight,
	ArrowUpRight,
	ArrowsClockwise,
	Receipt,
	ChartLineUp,
	Globe,
	Percent,
	ShieldCheck,
	Sparkle,
	Stack,
} from "@phosphor-icons/react";
import { SiteNav, SiteFooter } from "~/components/brand";
import { RippleGridCard } from "~/components/ripple-grid/RippleGridCard";

export function meta() {
	return [
		{ title: "grayoffice — the finance ops agent" },
		{
			name: "description",
			content:
				"grayoffice automates internal finance workflows end to end: closing the books, reconciliation, invoice processing, cash reports, and GST tax calculation with state detection.",
		},
	];
}

const WORKFLOWS = [
	{
		icon: Stack,
		title: "Close the books",
		body: "Run the month-end checklist, chase accruals, and flag the journal entries that need a human.",
	},
	{
		icon: ArrowsClockwise,
		title: "Reconciliation",
		body: "Match bank, ledger, and sub-ledger lines automatically; surface only the exceptions.",
	},
	{
		icon: Receipt,
		title: "Invoice processing",
		body: "Extract, code, and route invoices for approval with duplicate and fraud checks built in.",
	},
	{
		icon: ChartLineUp,
		title: "Cash reports",
		body: "Assemble the daily cash position and 13-week forecast straight from source systems.",
	},
	{
		icon: Globe,
		title: "Transactions by country & state",
		body: "Count and bucket every transaction by jurisdiction, then reconcile the totals.",
	},
	{
		icon: Percent,
		title: "GST tax + state detection",
		body: "Compute GST per line, infer the place of supply, and split CGST / SGST / IGST correctly.",
	},
];

const STEPS = [
	{
		n: "01",
		title: "Connect your systems",
		body: "Link your ERP, banks, and billing tools. grayoffice reads the same data your team does.",
	},
	{
		n: "02",
		title: "Set the guardrails",
		body: "Define thresholds, approval chains, and which exceptions always come back to a person.",
	},
	{
		n: "03",
		title: "Let it run the process",
		body: "The agent works the queue every day, escalates the edge cases, and leaves an audit trail.",
	},
];

export default function Home() {
	return (
		<div className="min-h-screen bg-canvas">
			<SiteNav />

			{/* Hero — shadcnblocks "hero1" split layout (light), ripple-grid on the right */}
			<section id="product" className="py-20 lg:py-28">
				<div className="container mx-auto max-w-6xl px-6">
					<div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
						<div className="flex flex-col items-center gap-5 text-center lg:items-start lg:text-left">
							<span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-surface px-3 py-1 text-xs font-medium text-neutral-600">
								<Sparkle size={13} weight="fill" className="text-brand" />
								Internal finance operations, automated
								<ArrowUpRight size={13} weight="bold" className="text-neutral-400" />
							</span>
							<h1 className="max-w-xl text-pretty text-4xl font-semibold tracking-tight text-neutral-900 md:text-5xl lg:max-w-2xl lg:text-6xl">
								The agent that runs your finance back office.
							</h1>
							<p className="max-w-xl text-balance text-neutral-600 lg:text-xl">
								grayoffice takes over the repetitive work of closing the books,
								reconciling accounts, processing invoices, and preparing cash
								reports — exceptions and human review included.
							</p>
							<div className="flex w-full flex-col justify-center gap-2 sm:flex-row lg:justify-start">
								<Link
									to="/auth"
									className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-medium text-white shadow-xs ring-1 ring-brand transition-colors hover:bg-brand-hover sm:w-auto"
								>
									Get started <ArrowRight size={16} weight="bold" />
								</Link>
								<a
									href="#workflows"
									className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-surface px-5 py-3 text-sm font-medium text-neutral-700 ring-1 ring-neutral-950/10 transition-colors hover:bg-tint sm:w-auto"
								>
									See the workflows
								</a>
							</div>
							<div className="flex items-center gap-2 text-xs text-neutral-500">
								<ShieldCheck size={14} className="text-neutral-400" />
								SOC 2-ready controls · full audit trail · human-in-the-loop by
								default
							</div>
						</div>

						<div className="relative">
							<RippleGridCard />
							<div className="pointer-events-none absolute -bottom-5 -left-5 hidden rounded-lg border border-neutral-200 bg-surface px-4 py-3 shadow-sm sm:block">
								<div className="text-[11px] uppercase tracking-wide text-neutral-400">
									This close
								</div>
								<div className="mt-0.5 text-sm font-semibold text-neutral-900">
									142 / 148 tasks done
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Metrics strip */}
			<section className="border-y border-neutral-200 bg-surface">
				<div className="mx-auto grid max-w-6xl grid-cols-2 divide-x divide-neutral-200 px-6 md:grid-cols-4">
					{[
						["3 days", "faster monthly close"],
						["92%", "of reconciliations auto-matched"],
						["100%", "of transactions jurisdiction-tagged"],
						["24/7", "queue worked by the agent"],
					].map(([stat, label]) => (
						<div key={label} className="px-4 py-8">
							<div className="text-2xl font-semibold text-neutral-900">
								{stat}
							</div>
							<div className="mt-1 text-sm text-neutral-500">{label}</div>
						</div>
					))}
				</div>
			</section>

			{/* Workflows */}
			<section id="workflows" className="mx-auto max-w-6xl px-6 py-20">
				<h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
					One agent, the whole finance process
				</h2>
				<p className="mt-3 max-w-2xl text-neutral-600">
					grayoffice owns each workflow end to end — not just a step of it —
					and hands back only the cases that genuinely need judgment.
				</p>
				<div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{WORKFLOWS.map((w) => (
						<div
							key={w.title}
							className="rounded-xl border border-neutral-200 bg-surface p-5 shadow-xs transition-shadow hover:shadow-sm"
						>
							<div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-tint text-brand">
								<w.icon size={18} weight="duotone" />
							</div>
							<div className="mt-4 font-medium text-neutral-900">{w.title}</div>
							<p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
								{w.body}
							</p>
						</div>
					))}
				</div>
			</section>

			{/* How it works */}
			<section id="how" className="border-t border-neutral-200 bg-surface">
				<div className="mx-auto max-w-6xl px-6 py-20">
					<h2 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
						How it works
					</h2>
					<div className="mt-10 grid gap-8 md:grid-cols-3">
						{STEPS.map((s) => (
							<div key={s.n}>
								<div className="text-sm font-semibold text-brand">{s.n}</div>
								<div className="mt-2 text-lg font-medium text-neutral-900">
									{s.title}
								</div>
								<p className="mt-2 text-sm leading-relaxed text-neutral-600">
									{s.body}
								</p>
							</div>
						))}
					</div>
					<div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-canvas p-6">
						<div>
							<div className="font-medium text-neutral-900">
								Ready to hand off the busywork?
							</div>
							<div className="text-sm text-neutral-500">
								Set up your first workflow in minutes.
							</div>
						</div>
						<Link
							to="/auth"
							className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white ring-1 ring-brand transition-colors hover:bg-brand-hover"
						>
							Get started <ArrowRight size={16} weight="bold" />
						</Link>
					</div>
				</div>
			</section>

			<SiteFooter />
		</div>
	);
}
