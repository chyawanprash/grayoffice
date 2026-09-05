import { Link } from "react-router";
import { ArrowUpRight } from "@phosphor-icons/react";

export function Logo({ className = "" }: { className?: string }) {
	return (
		<span
			className={`inline-flex items-center gap-2 text-xl font-semibold tracking-tight text-neutral-900 ${className}`}
		>
			Gray<span className="text-neutral-400 font-normal">Office</span>
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
	{ title: "Company", links: ["About", "Careers", "Security", "Docs", "Changelog", "Status"] },
	{ title: "Legal", links: ["Privacy", "Terms", "DPA", "Sub-processors"] },
];

export function SiteFooter() {
	return (
		<footer className="relative w-full overflow-hidden border-t border-neutral-200 bg-tint font-sans text-neutral-700">
			<div className="mx-auto flex max-w-[1400px] flex-col border-x border-dashed border-neutral-300 px-6 pt-20 md:px-12 md:pt-28 lg:px-16">
				<div className="mb-12 grid grid-cols-1 gap-14 md:mb-16 lg:grid-cols-12 lg:gap-8">
					<div className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">
						<Logo />
						<p className="max-w-[320px] text-[15px] leading-relaxed text-neutral-600">
							The agent that runs your close, reconciliation, and cash
							reporting end to end — exceptions and human review included.
						</p>
						<a
							href="mailto:hello@grayoffice.com"
							className="group mt-1 inline-flex items-center gap-2 text-[17px] text-neutral-900 transition-colors hover:text-brand"
						>
							hello@grayoffice.com
							<ArrowUpRight
								size={17}
								className="text-neutral-400 transition-colors group-hover:text-brand"
							/>
						</a>
					</div>
					<div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7 lg:gap-8 xl:col-span-8">
						{FOOTER_COLS.map((col) => (
							<div key={col.title} className="flex flex-col gap-5">
								<h4 className="font-semibold text-neutral-900">{col.title}</h4>
								<ul className="flex flex-col gap-3">
									{col.links.map((l) => (
										<li key={l}>
											<a
												href="/#"
												className="text-[15px] text-neutral-600 transition-colors hover:text-neutral-900"
											>
												{l}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</div>

				<div className="flex flex-col gap-2 pb-6 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
					<span>© {new Date().getFullYear()} Gray Office, Inc.</span>
					<span>Built for accounting, finance & treasury teams.</span>
				</div>

				{/* oversized wordmark, clipped at the floor */}
				<div className="pointer-events-none -mb-[1.5%] w-full select-none">
					<svg
						viewBox="0 30 800 80"
						preserveAspectRatio="xMidYMid meet"
						className="h-auto w-full"
						aria-hidden
					>
						<defs>
							<linearGradient id="go-watermark" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor="#c7d2fe" />
								<stop offset="55%" stopColor="#e0e7ff" />
								<stop offset="100%" stopColor="#e9d5ff" />
							</linearGradient>
						</defs>
						<text
							x="0"
							y="130"
							textAnchor="start"
							textLength="100%"
							lengthAdjust="spacing"
							fill="url(#go-watermark)"
							className="font-semibold tracking-tighter"
							fontSize="140"
						>
							Gray Office
						</text>
					</svg>
				</div>
			</div>
		</footer>
	);
}
