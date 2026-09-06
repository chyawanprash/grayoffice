import { Link, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/site.$slug";
import { SiteNav, SiteFooter, CTAButton } from "~/components/brand";
import { FooterGradient } from "~/components/footer-gradient";

/**
 * One route for every marketing / legal page linked from the navbar and footer,
 * so none of those links 404 or bounce to the home page.
 */
type Section = { heading: string; body?: string; bullets?: string[] };
type Page = { title: string; intro: string; sections: Section[] };

const UPDATED = "7 September 2026";

const PAGES: Record<string, Page> = {
	/* ─────────────────────────────── Product */
	"close-the-books": {
		title: "Close the books",
		intro:
			"Gray Office runs your month-end checklist from start to finish. It posts the routine journal entries, confirms or reverses accruals, chases what's outstanding, and hands you a short list of the things that actually need judgment.",
		sections: [
			{
				heading: "The checklist it runs every period",
				bullets: [
					"Post the draft journal entries that are ready and balanced.",
					"Surface entries flagged for review, with the reason attached.",
					"Confirm or reverse every open accrual for the period.",
					"Chase invoices that are past their due date.",
					"Reconcile bank transactions against the ledger and sub-ledgers.",
				],
			},
			{
				heading: "What comes back to a person",
				body:
					"Entries where debits don't equal credits, amounts that fall outside the thresholds you set, accruals with no supporting document, and anything the assistant is less than confident about. Everything else is closed without you touching it.",
			},
			{
				heading: "Every step is auditable",
				body:
					"Each action the assistant takes is written to the audit room with its inputs, the rule or model that drove it, and a timestamp. A reviewer can replay the whole close.",
			},
		],
	},
	reconciliation: {
		title: "Reconciliation",
		intro:
			"Match bank, ledger, and sub-ledger lines automatically and only look at the exceptions. Gray Office ties transactions together by amount and date, scores each match, and keeps the evidence.",
		sections: [
			{
				heading: "How matching works",
				bullets: [
					"Exact matches — same amount, within a sensible date window — are reconciled automatically at full confidence.",
					"Near matches are held as partials with the delta shown, so you can accept or reject in one click.",
					"Everything with no counterpart becomes an exception with its description, date, and type.",
				],
			},
			{
				heading: "Sub-ledgers, not just the bank",
				body:
					"The same engine reconciles AR and AP sub-ledgers against the general ledger, and invoice totals against what was actually received.",
			},
			{
				heading: "Audit trail",
				body:
					"Every match records its confidence score and the source of each side, so a reviewer can see exactly why two lines were tied together — and untie them if they disagree.",
			},
		],
	},
	invoices: {
		title: "Invoice processing",
		intro:
			"Drop in a PDF and Gray Office extracts it, codes it, checks it, and routes it for approval. Duplicate and fraud checks are built in — you approve, you don't retype.",
		sections: [
			{
				heading: "Extraction",
				body:
					"The vendor, invoice number, dates, line items, totals, GSTIN, and place of supply are pulled from the document. The invoice and its ledger entry are created automatically, with the tax split already computed.",
			},
			{
				heading: "Checks that run on every invoice",
				bullets: [
					"Duplicate detection on the vendor and invoice number.",
					"GSTIN format validation.",
					"Suspiciously round large amounts.",
					"Large payments to a payee that was created moments ago.",
				],
			},
			{
				heading: "Routing",
				body:
					"Clean invoices go straight to the approver you've configured. Anything that trips a check is flagged with the specific reason and waits for a human decision.",
			},
		],
	},
	"cash-reports": {
		title: "Cash reports",
		intro:
			"The daily cash position and a rolling 13-week forecast, assembled straight from your bank feed and open invoices — no spreadsheet to maintain.",
		sections: [
			{
				heading: "Today's position",
				body:
					"Live bank balance, open receivables, and open payables as of today, with the movement since the last report.",
			},
			{
				heading: "13-week forecast",
				body:
					"Thirteen weekly buckets built from invoice due dates, showing expected inflows, outflows, and a running projected closing balance. Weeks that go negative are highlighted.",
			},
			{
				heading: "Delivered on a schedule",
				body:
					"Have the report waiting in your inbox every morning, or ask the assistant for it any time.",
			},
		],
	},
	transactions: {
		title: "Transactions by country & state",
		intro:
			"Count and bucket every transaction by jurisdiction, then reconcile the buckets back to the invoice control total so nothing is missed or double-counted.",
		sections: [
			{
				heading: "Buckets",
				body:
					"Transactions are grouped by country, state or place of supply, and direction (receivable vs payable), with a count and value for each bucket.",
			},
			{
				heading: "Reconciliation",
				body:
					"The sum of the buckets is checked against the total of all non-void invoices. Any difference is shown explicitly rather than hidden.",
			},
			{
				heading: "Why it matters",
				body:
					"Jurisdiction totals drive your GST returns and any state-level filings. Getting the split right at transaction time means the return is a report, not a rebuild.",
			},
		],
	},
	gst: {
		title: "GST tax + state detection",
		intro:
			"Gray Office computes GST on every line, infers the place of supply from the parties, and splits CGST / SGST / IGST the way the return expects.",
		sections: [
			{
				heading: "Place of supply",
				bullets: [
					"Intra-state — seller state equals buyer state — splits into CGST + SGST.",
					"Inter-state, or an unknown buyer state, is charged as IGST.",
					"Exports are zero-rated; the place of supply is recorded as “Export”.",
				],
			},
			{
				heading: "Reverse charge",
				body:
					"When reverse charge applies, the invoice carries no tax and the liability sits with the recipient — the assistant tags the invoice so the return picks it up correctly.",
			},
			{
				heading: "Per-line, not per-invoice",
				body:
					"Each line can carry its own HSN/SAC code and rate, so mixed-rate invoices are handled without a manual override.",
			},
		],
	},

	/* ─────────────────────────────── Resources */
	docs: {
		title: "Documentation",
		intro: "Everything you need to connect your systems, set your guardrails, and work with the assistant.",
		sections: [
			{
				heading: "Getting started",
				bullets: [
					"Create your organization and invite your team.",
					"Connect your bank so balances and transactions flow in.",
					"Add your registered address and tax ID for the seller side of GST.",
					"Upload reference documents to the knowledge base.",
					"Ask Bhondu to run your first reconciliation or close.",
				],
			},
			{
				heading: "Knowledge base & memories",
				body:
					"PDFs you upload are converted, chunked, and made searchable for the assistant. The people, organizations, and accounts they mention are also pulled out and shown as a connection graph on the Memories page.",
			},
			{
				heading: "Guardrails",
				body:
					"Set approval thresholds, define which exceptions always return to a person, and choose which workflows the assistant may run unattended.",
			},
		],
	},
	changelog: {
		title: "Changelog",
		intro: "What's new in Gray Office.",
		sections: [
			{
				heading: "September 2026",
				bullets: [
					"Memories: a connection graph of the entities pulled from your knowledge base.",
					"A full finance analytics dashboard — invoice volume, status, GST split, and jurisdiction rollup.",
					"Command palette (⌘K) for jumping straight to an invoice, document, or page.",
					"Drag-and-drop uploads on the knowledge base.",
				],
			},
			{
				heading: "August 2026",
				bullets: [
					"Organization model: memberships, invites, and per-org scoping across payments, banking, and the knowledge base.",
					"Cloudflare R2 storage for uploaded documents.",
				],
			},
		],
	},
	status: {
		title: "Status",
		intro: "The current operational status of Gray Office services.",
		sections: [
			{
				heading: "All systems operational",
				bullets: [
					"Web app — operational",
					"API — operational",
					"Document ingestion queue — operational",
					"Bank & payment integrations — operational",
				],
			},
			{
				heading: "Incident history",
				body: "No incidents reported in the last 90 days. Active incidents and maintenance windows are posted here first.",
			},
		],
	},
	support: {
		title: "Support",
		intro: "Get help from the team behind Gray Office.",
		sections: [
			{
				heading: "Email us",
				body:
					"Write to support@grayoffice.app with your organization name and a description of what you're seeing. Include a screenshot where it helps. We usually reply within one business day.",
			},
			{
				heading: "Before you write",
				bullets: [
					"Check the Status page for any active incident.",
					"Note the invoice number, document name, or page where the issue happens.",
					"Tell us what you expected and what happened instead.",
				],
			},
		],
	},

	/* ─────────────────────────────── Company */
	about: {
		title: "About",
		intro: "Gray Office is the agent that runs your finance back office.",
		sections: [
			{
				heading: "The problem",
				body:
					"Finance teams spend most of their time on repetitive reconciliation, invoice entry, and close work. It's exacting, it's high-volume, and almost none of it needs a person — until the one line that does.",
			},
			{
				heading: "What we build",
				body:
					"An assistant that does that work end to end and brings back only the exceptions, with a full audit trail behind every action so you can trust what it did.",
			},
			{
				heading: "How we work",
				body:
					"Small team, close to the product. If something is wrong, the people who can fix it will read your message.",
			},
		],
	},
	careers: {
		title: "Careers",
		intro: "We're a small team building the finance operations agent, and we hire deliberately.",
		sections: [
			{
				heading: "Open roles",
				body:
					"Nothing open right now. If you've built accounting, payments, or agent infrastructure and think you should be an exception, we want to hear from you.",
			},
			{
				heading: "Get in touch",
				body: "Send a short note and a link to something you've built to careers@grayoffice.app.",
			},
		],
	},
	security: {
		title: "Security",
		intro: "How Gray Office protects your data.",
		sections: [
			{
				heading: "Tenant isolation",
				body:
					"Every organization's data — invoices, ledger, documents, knowledge base, and integration credentials — is scoped by organization ID at the query layer and is never shared across tenants.",
			},
			{
				heading: "Access control",
				bullets: [
					"Email and password authentication with optional TOTP multi-factor.",
					"Signed, HTTP-only session cookies.",
					"Role-based membership — every user's access is granted per organization.",
				],
			},
			{
				heading: "Infrastructure",
				body:
					"Gray Office runs on Cloudflare's network. Documents are stored in object storage and removed when you delete the record. Integration secrets are held as encrypted environment configuration, never in the database.",
			},
			{
				heading: "Reporting a vulnerability",
				body: "Email security@grayoffice.app. We'll acknowledge within two business days.",
			},
		],
	},
	contact: {
		title: "Contact",
		intro: "Talk to us.",
		sections: [
			{
				heading: "Email",
				bullets: [
					"hello@grayoffice.app — general and sales enquiries",
					"support@grayoffice.app — help with your account",
					"security@grayoffice.app — vulnerability reports",
				],
			},
			{
				heading: "Something else",
				body: "For press or partnership enquiries, use hello@grayoffice.app and we'll route it to the right person.",
			},
		],
	},

	/* ─────────────────────────────── Legal */
	privacy: {
		title: "Privacy Policy",
		intro: `Last updated ${UPDATED}. This policy explains what Gray Office collects, why, and what you can do about it. It is a starting template — have it reviewed by counsel before you rely on it.`,
		sections: [
			{
				heading: "Information we collect",
				bullets: [
					"Account information — your name, email address, and password hash.",
					"Organization data — membership, roles, and invitations.",
					"Finance data you connect or upload — invoices, ledger entries, bank transactions, and documents.",
					"Usage data — basic logs needed to operate and secure the service.",
				],
			},
			{
				heading: "How we use it",
				body:
					"Solely to provide the service to your organization: running the workflows you ask for, showing you your data, and keeping the account secure. We do not sell personal data or use it for advertising.",
			},
			{
				heading: "Sharing",
				body:
					"We share data with infrastructure providers that host the service and with integrations you explicitly connect. We disclose data if required by law.",
			},
			{
				heading: "Retention",
				body:
					"We keep your data for as long as your organization has an account. Delete a record and the underlying file is removed from storage. Close your account and we delete or anonymize your data within 30 days, except where law requires otherwise.",
			},
			{
				heading: "Your rights",
				body:
					"You can access, correct, export, or delete your data from within the app, or by writing to privacy@grayoffice.app.",
			},
		],
	},
	terms: {
		title: "Terms of Service",
		intro: `Last updated ${UPDATED}. These terms govern your use of Gray Office. This is a starting template — have it reviewed by counsel before you rely on it.`,
		sections: [
			{
				heading: "The service",
				body:
					"Gray Office provides software that automates finance operations tasks. Features may change over time. We aim for high availability but do not guarantee uninterrupted service.",
			},
			{
				heading: "Your responsibilities",
				bullets: [
					"Keep your credentials secure and your team's access current.",
					"Ensure you have the right to connect and upload the data you provide.",
					"Review the exceptions and outputs the assistant returns before acting on them.",
				],
			},
			{
				heading: "Acceptable use",
				body:
					"Don't use the service to break the law, infringe others' rights, or attempt to disrupt or reverse-engineer the platform.",
			},
			{
				heading: "Liability",
				body:
					"The service is provided “as is”. To the extent permitted by law, Gray Office is not liable for indirect or consequential losses, and our total liability is limited to the fees you paid in the preceding 12 months.",
			},
			{
				heading: "Termination",
				body:
					"You may stop using the service at any time. We may suspend access for a material breach of these terms.",
			},
		],
	},
	cookies: {
		title: "Cookie Policy",
		intro: `Last updated ${UPDATED}. How Gray Office uses cookies and local storage.`,
		sections: [
			{
				heading: "What we use",
				bullets: [
					"A signed session cookie that keeps you logged in. Strictly necessary.",
					"Local storage for your theme preference (light / dark / system).",
				],
			},
			{
				heading: "What we don't use",
				body:
					"No advertising cookies, no cross-site tracking, no third-party analytics that identify you. Because the only cookie we set is strictly necessary, there is no consent banner to click through.",
			},
			{
				heading: "Managing cookies",
				body:
					"You can clear cookies and local storage in your browser settings. Clearing the session cookie signs you out.",
			},
		],
	},
};

export const SITE_LINKS: Record<string, { label: string; slug: string }[]> = {
	Product: [
		{ label: "Close the books", slug: "close-the-books" },
		{ label: "Reconciliation", slug: "reconciliation" },
		{ label: "Invoices", slug: "invoices" },
		{ label: "Cash reports", slug: "cash-reports" },
		{ label: "Transactions by jurisdiction", slug: "transactions" },
		{ label: "GST tax + state detection", slug: "gst" },
	],
	Resources: [
		{ label: "Documentation", slug: "docs" },
		{ label: "Changelog", slug: "changelog" },
		{ label: "Status", slug: "status" },
		{ label: "Support", slug: "support" },
	],
	Company: [
		{ label: "About", slug: "about" },
		{ label: "Careers", slug: "careers" },
		{ label: "Security", slug: "security" },
		{ label: "Contact", slug: "contact" },
	],
	Legal: [
		{ label: "Privacy Policy", slug: "privacy" },
		{ label: "Terms of Service", slug: "terms" },
		{ label: "Cookies", slug: "cookies" },
	],
};

export function meta({ data }: Route.MetaArgs) {
	return [
		{ title: `${data?.page.title ?? "Not found"} | Gray Office` },
		{ name: "description", content: data?.page.intro ?? "Page not found" },
	];
}

export async function loader({ params }: Route.LoaderArgs) {
	const page = PAGES[params.slug ?? ""];
	if (!page) throw new Response("Not found", { status: 404 });
	return { page };
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-canvas">
			<SiteNav />
			<main className="mx-auto max-w-3xl px-6 py-16 md:py-24">{children}</main>
			<FooterGradient>
				<SiteFooter />
			</FooterGradient>
		</div>
	);
}

export default function SitePage({ loaderData }: Route.ComponentProps) {
	const { page } = loaderData;
	return (
		<Shell>
			<nav className="mb-6 text-sm text-neutral-500">
				<Link to="/" className="hover:text-neutral-900">Home</Link>
				<span className="mx-2">/</span>
				<span className="text-neutral-900">{page.title}</span>
			</nav>
			<h1 className="text-4xl font-semibold tracking-tight text-neutral-900">{page.title}</h1>
			<p className="mt-4 text-lg leading-relaxed text-neutral-600">{page.intro}</p>
			<div className="mt-12 space-y-10">
				{page.sections.map((s) => (
					<section key={s.heading}>
						<h2 className="text-lg font-semibold text-neutral-900">{s.heading}</h2>
						{s.body && <p className="mt-2 leading-relaxed text-neutral-600">{s.body}</p>}
						{s.bullets && (
							<ul className="mt-3 space-y-2">
								{s.bullets.map((b) => (
									<li key={b} className="flex gap-3 leading-relaxed text-neutral-600">
										<span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand" />
										<span>{b}</span>
									</li>
								))}
							</ul>
						)}
					</section>
				))}
			</div>
			<div className="mt-16 flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 bg-surface p-6">
				<div className="text-sm">
					<div className="font-medium text-neutral-900">Ready to hand off the busywork?</div>
					<div className="text-neutral-500">Set up your first workflow in minutes.</div>
				</div>
				<CTAButton to="/sign-up" size="md" className="ml-auto">Get started</CTAButton>
			</div>
		</Shell>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	const is404 = isRouteErrorResponse(error) && error.status === 404;
	return (
		<Shell>
			<h1 className="text-4xl font-semibold tracking-tight text-neutral-900">
				{is404 ? "Page not found" : "Something went wrong"}
			</h1>
			<p className="mt-4 text-lg text-neutral-600">
				{is404
					? "That page doesn't exist. Try one of these:"
					: "Please try again in a moment."}
			</p>
			<div className="mt-10 space-y-6">
				{Object.entries(SITE_LINKS).map(([group, links]) => (
					<div key={group}>
						<h2 className="text-sm font-semibold text-neutral-900">{group}</h2>
						<ul className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-3">
							{links.map((l) => (
								<li key={l.slug}>
									<Link to={`/${l.slug}`} className="text-brand hover:underline">{l.label}</Link>
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</Shell>
	);
}
