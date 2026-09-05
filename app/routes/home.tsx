import { Link } from "react-router";
import {
	ArrowRight,
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
import { DiaGradient } from "~/components/dia-gradient";

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
			{/* Hero */}
			<section id="product">
				<Hero31
					logoText="grayoffice"
					navItems={["Product", "Workflows", "How it works", "Pricing", "Contact"]}
					signUpText="Get started"
					title="The agent that runs your finance back office."
					subtitle="grayoffice takes over closing the books, reconciling accounts, processing invoices, and preparing cash reports — exceptions and human review included."
					ctaText="See the workflows"
					trustedByText="BUILT FOR FINANCE & TREASURY TEAMS"
				/>
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

			{/* Dia Browser-style glow rising from the floor, below the footer */}
			<div className="h-56 w-full overflow-hidden bg-black sm:h-72">
				<DiaGradient />
			</div>
		</div>
	);
}
