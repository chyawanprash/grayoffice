import { Link } from "react-router";

export function Logo({ className = "" }: { className?: string }) {
	return (
		<span
			className={`inline-flex items-center gap-2 font-semibold tracking-tight text-neutral-900 ${className}`}
		>
			<span className="grid h-6 w-6 place-items-center rounded-md bg-brand text-white text-[13px] font-bold">
				g
			</span>
			gray<span className="text-neutral-400 font-normal">office</span>
		</span>
	);
}

const NAV = [
	{ label: "Product", href: "/#product" },
	{ label: "Workflows", href: "/#workflows" },
	{ label: "How it works", href: "/#how" },
];

export function SiteNav() {
	return (
		<header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-canvas/80 backdrop-blur">
			<div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
				<Link to="/">
					<Logo />
				</Link>
				<nav className="hidden items-center gap-6 text-sm text-neutral-600 md:flex">
					{NAV.map((n) => (
						<a
							key={n.label}
							href={n.href}
							className="transition-colors hover:text-neutral-900"
						>
							{n.label}
						</a>
					))}
				</nav>
				<div className="ml-auto flex items-center gap-2">
					<Link
						to="/auth"
						className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900 sm:block"
					>
						Sign in
					</Link>
					<Link
						to="/auth"
						className="rounded-md bg-brand px-3.5 py-1.5 text-sm font-medium text-white shadow-xs ring-1 ring-brand transition-colors hover:bg-brand-hover"
					>
						Get started
					</Link>
				</div>
			</div>
		</header>
	);
}

const FOOTER_COLS: { title: string; links: string[] }[] = [
	{ title: "Product", links: ["Close the books", "Reconciliation", "Invoices", "Cash reports"] },
	{ title: "Company", links: ["About", "Careers", "Security", "Contact"] },
	{ title: "Resources", links: ["Docs", "Changelog", "Status", "Support"] },
	{ title: "Legal", links: ["Privacy", "Terms", "DPA", "Sub-processors"] },
];

export function SiteFooter() {
	return (
		<footer className="relative overflow-hidden border-t border-neutral-200 bg-surface">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 -bottom-24 h-64 bg-gradient-to-t from-brand/15 via-brand/5 to-transparent blur-2xl"
			/>
			<div className="relative mx-auto max-w-6xl px-6 py-16">
				<div className="grid gap-10 md:grid-cols-[1.5fr_repeat(4,1fr)]">
					<div>
						<Logo />
						<p className="mt-3 max-w-xs text-sm text-neutral-500">
							The agent that runs your close, reconciliation, and cash
							reporting end to end — exceptions and human review included.
						</p>
					</div>
					{FOOTER_COLS.map((col) => (
						<div key={col.title}>
							<div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
								{col.title}
							</div>
							<ul className="mt-3 space-y-2 text-sm text-neutral-600">
								{col.links.map((l) => (
									<li key={l}>
										<a
											href="/#"
											className="transition-colors hover:text-neutral-900"
										>
											{l}
										</a>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<div className="mt-12 flex flex-col gap-2 border-t border-neutral-200 pt-6 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
					<span>© {new Date().getFullYear()} grayoffice, Inc.</span>
					<span>Built for accounting, finance & treasury teams.</span>
				</div>
			</div>
		</footer>
	);
}
