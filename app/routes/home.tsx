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
import { AiLightsCard } from "~/components/ai-lights/AiLightsCard";
import { FooterGradient } from "~/components/footer-gradient";
import { Button } from "~/components/ui/button";

export function meta() {
	return [
		{ title: "Gray Office | the finance ops agent" },
		{
			name: "description",
			content:
				"Gray Office automates internal finance workflows end to end: closing the books, reconciliation, invoice processing, cash reports, and GST tax calculation with state detection.",
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
		body: "Link your ERP, banks, and billing tools. Gray Office reads the same data your team does.",
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

			{/* Hero */}
			<section
				id="product"
				className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_1.1fr] lg:py-24"
			>
				<div>
					<span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-surface px-3 py-1 text-xs font-medium text-neutral-600">
						Internal finance operations, automated
					</span>
					<h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-neutral-900 sm:text-5xl">
						The agent that runs your finance back office.
					</h1>
					<p className="mt-5 max-w-lg text-lg leading-relaxed text-neutral-600">
						Gray Office takes over the repetitive work of closing the books,
						reconciling accounts, processing invoices, and preparing cash
						reports, exceptions and human review included.
					</p>
					<div className="mt-8 flex flex-wrap items-center gap-3">
						<Button render={<Link to="/sign-up" />} size="lg">
							Get started <ArrowRight size={16} weight="bold" />
						</Button>
						<Button render={<a href="#workflows" />} variant="outline" size="lg">
							See the workflows
						</Button>
					</div>
				</div>

				<div className="relative">
					<AiLightsCard />
					<div className="pointer-events-none absolute -bottom-5 -left-5 hidden rounded-lg border border-neutral-200 bg-surface px-4 py-3 shadow-sm sm:block">
						<div className="text-[11px] uppercase tracking-wide text-neutral-400">
							This close
						</div>
						<div className="mt-0.5 text-sm font-semibold text-neutral-900">
							142 / 148 tasks done
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
					Gray Office owns each workflow end to end, not just a step of it, and
					hands back only the cases that genuinely need judgment.
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

					<div className="mt-12 overflow-hidden rounded-xl border border-neutral-200">
						<RippleGridCard />
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
						<Button render={<Link to="/sign-up" />} size="lg">
							Get started <ArrowRight size={16} weight="bold" />
						</Button>
					</div>
				</div>
			</section>

			{/* Pull past the bottom to stretch the footer and bloom the Dia glow */}
			<FooterGradient>
				<SiteFooter />
			</FooterGradient>
		</div>
	);
}
