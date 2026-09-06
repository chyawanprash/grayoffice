import { Link, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/site.$slug";
import { SiteNav, SiteFooter, CTAButton } from "~/components/brand";
import { FooterGradient } from "~/components/footer-gradient";

/**
 * One route for every marketing / legal page linked from the navbar and footer,
 * so none of those links 404 or bounce to the home page. Copy lives in the map
 * below — swap the placeholder bodies for the real thing when it exists.
 */
type Page = { title: string; intro: string; sections: { heading: string; body: string }[] };

const PAGES: Record<string, Page> = {
	// ── Product ──
	"close-the-books": {
		title: "Close the books",
		intro: "Run the month-end checklist end to end — Gray Office chases accruals, posts the routine journal entries, and flags only what needs a human.",
		sections: [
			{ heading: "What it does", body: "Walks the close checklist every period: draft entries posted, flagged entries surfaced, open accruals confirmed or reversed, overdue invoices chased, bank lines reconciled." },
			{ heading: "What comes back to you", body: "Entries that don't balance, unusual amounts, and anything outside the guardrails you set. Everything else is done." },
		],
	},
	reconciliation: {
		title: "Reconciliation",
		intro: "Match bank, ledger, and sub-ledger lines automatically and surface only the exceptions.",
		sections: [
			{ heading: "How matching works", body: "Exact amount + date-window matches are reconciled automatically. Near matches are shown as partials with the delta. Everything else is an exception." },
			{ heading: "Audit trail", body: "Every match records its confidence and source so a reviewer can see why two lines were tied together." },
		],
	},
	invoices: {
		title: "Invoice processing",
		intro: "Extract, code, and route invoices for approval with duplicate and fraud checks built in.",
		sections: [
			{ heading: "Extraction", body: "Upload a PDF and Gray Office pulls the vendor, number, totals, GSTIN and place of supply, then creates the invoice and posts the ledger entry." },
			{ heading: "Checks", body: "Duplicate detection on (vendor, number), GSTIN format validation, suspiciously round large amounts, and large payments to brand-new payees." },
		],
	},
	"cash-reports": {
		title: "Cash reports",
		intro: "Assemble the daily cash position and a 13-week forecast straight from source systems.",
		sections: [
			{ heading: "Position", body: "Live bank balance plus open receivables and payables, as of today." },
			{ heading: "Forecast", body: "13 weekly buckets projected from invoice due dates, with a running projected close balance." },
		],
	},
	transactions: {
		title: "Transactions by country & state",
		intro: "Count and bucket every transaction by jurisdiction, then reconcile the totals back to the invoice control total.",
		sections: [
			{ heading: "Buckets", body: "Grouped by country, state / place of supply, and direction, with counts and values." },
			{ heading: "Reconciliation", body: "The bucketed total is checked against the invoice control total; any difference is shown." },
		],
	},
	gst: {
		title: "GST tax + state detection",
		intro: "Compute GST per line, infer the place of supply, and split CGST / SGST / IGST correctly.",
		sections: [
			{ heading: "Place of supply", body: "Intra-state (seller state = buyer state) splits into CGST + SGST. Inter-state, unknown buyer state, or export is IGST." },
			{ heading: "Edge cases", body: "Reverse charge and exports carry no tax on the invoice; the recipient accounts for it." },
		],
	},

	// ── Resources ──
	docs: {
		title: "Documentation",
		intro: "Guides for connecting your systems, setting guardrails, and working with the assistant.",
		sections: [{ heading: "Getting started", body: "Sign up, create your organization, connect banking and upload documents to the knowledge base. Then ask Bhondu to run a workflow." }],
	},
	changelog: {
		title: "Changelog",
		intro: "What's new in Gray Office.",
		sections: [{ heading: "Recent", body: "Knowledge-base memory graph, a full finance analytics dashboard, and a command palette for jumping between invoices, documents and pages." }],
	},
	status: {
		title: "Status",
		intro: "Current operational status of Gray Office services.",
		sections: [{ heading: "All systems operational", body: "App, API, ingestion queue and integrations are running normally. Incidents are posted here." }],
	},
	support: {
		title: "Support",
		intro: "Get help from the team.",
		sections: [{ heading: "Contact", body: "Email support@grayoffice.app with your organization name and a description of the issue. We usually reply within a business day." }],
	},

	// ── Company ──
	about: {
		title: "About",
		intro: "Gray Office is the agent that runs your finance back office.",
		sections: [{ heading: "Why", body: "Finance teams spend most of their time on repetitive reconciliation and close work. Gray Office does that work end to end and brings back only the exceptions." }],
	},
	careers: {
		title: "Careers",
		intro: "We're a small team building the finance operations agent.",
		sections: [{ heading: "Open roles", body: "No open roles right now. Send a note to careers@grayoffice.app if you think you should be an exception." }],
	},
	security: {
		title: "Security",
		intro: "How we protect your data.",
		sections: [
			{ heading: "Isolation", body: "Every organization's data — invoices, ledger, documents, knowledge base — is scoped by organization id and never shared across tenants." },
			{ heading: "Access", body: "Authentication with optional MFA, session cookies, and role-based membership per organization." },
		],
	},
	contact: {
		title: "Contact",
		intro: "Talk to us.",
		sections: [{ heading: "Email", body: "hello@grayoffice.app for general enquiries, support@grayoffice.app for help with your account." }],
	},

	// ── Legal ──
	privacy: {
		title: "Privacy Policy",
		intro: "This placeholder describes how Gray Office handles personal data. Replace with your reviewed policy before launch.",
		sections: [
			{ heading: "Data we hold", body: "Account details, organization membership, and the finance data you connect or upload." },
			{ heading: "Use", body: "Data is used only to operate the service for your organization. It is not sold." },
		],
	},
	terms: {
		title: "Terms of Service",
		intro: "This placeholder sets out the terms for using Gray Office. Replace with your reviewed terms before launch.",
		sections: [{ heading: "Use of the service", body: "You are responsible for the accuracy of the data you connect and for reviewing the exceptions the assistant returns." }],
	},
	cookies: {
		title: "Cookie Policy",
		intro: "How Gray Office uses cookies and local storage.",
		sections: [{ heading: "Essential only", body: "A session cookie to keep you signed in and local storage for your theme preference. No advertising or third-party tracking cookies." }],
	},
};

export const SITE_LINKS: Record<string, { label: string; slug: string }[]> = {
	Product: [
		{ label: "Close the books", slug: "close-the-books" },
		{ label: "Reconciliation", slug: "reconciliation" },
		{ label: "Invoices", slug: "invoices" },
		{ label: "Cash reports", slug: "cash-reports" },
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
	return [{ title: `${data?.page.title ?? "Not found"} | Gray Office` }];
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
			<h1 className="text-4xl font-semibold tracking-tight text-neutral-900">{page.title}</h1>
			<p className="mt-4 text-lg leading-relaxed text-neutral-600">{page.intro}</p>
			<div className="mt-10 space-y-8">
				{page.sections.map((s) => (
					<section key={s.heading}>
						<h2 className="text-lg font-semibold text-neutral-900">{s.heading}</h2>
						<p className="mt-2 leading-relaxed text-neutral-600">{s.body}</p>
					</section>
				))}
			</div>
			<div className="mt-14 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-surface p-6">
				<span className="text-sm text-neutral-600">Ready to hand off the busywork?</span>
				<CTAButton to="/sign-up" size="md">Get started</CTAButton>
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
					? "That page doesn't exist (yet). Try one of these:"
					: "Please try again in a moment."}
			</p>
			<ul className="mt-8 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
				<li><Link to="/" className="text-brand hover:underline">Home</Link></li>
				{Object.values(SITE_LINKS).flat().map((l) => (
					<li key={l.slug}>
						<Link to={`/${l.slug}`} className="text-brand hover:underline">{l.label}</Link>
					</li>
				))}
			</ul>
		</Shell>
	);
}
