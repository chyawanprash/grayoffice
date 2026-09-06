import { useEffect, useState } from "react";
import { Link } from "react-router";
import { GithubLogo, LinkedinLogo, XLogo } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { ThemeToggle } from "~/components/theme";

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
	{ label: "Product", href: "/#product", id: "product" },
	{ label: "Workflows", href: "/#workflows", id: "workflows" },
	{ label: "How it works", href: "/#how", id: "how" },
];

const SECTION_IDS = NAV.map((n) => n.id);

function useActiveSection(ids: string[]) {
	const [active, setActive] = useState<string | null>(null);

	useEffect(() => {
		const sections = ids
			.map((id) => document.getElementById(id))
			.filter((el): el is HTMLElement => el !== null);
		if (sections.length === 0) return;

		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
				const next = visible[0]?.target.id;
				if (next) {
					setActive(next);
					const hash = `#${next}`;
					if (window.location.hash !== hash) {
						window.history.replaceState(null, "", hash);
					}
				}
			},
			{ rootMargin: "-45% 0px -50% 0px", threshold: [0, 0.25, 0.5, 1] },
		);

		sections.forEach((el) => observer.observe(el));
		return () => observer.disconnect();
	}, [ids]);

	return active;
}

export function SiteNav() {
	const active = useActiveSection(SECTION_IDS);
	return (
		<header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-canvas/80 backdrop-blur">
			<div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-10 px-4 md:px-6">
				<Link to="/">
					<Logo />
				</Link>
				<nav className="hidden items-center gap-8 text-[15px] font-medium text-neutral-600 md:flex">
					{NAV.map((n) => (
						<a
							key={n.label}
							href={n.href}
							aria-current={active === n.id ? "true" : undefined}
							className={`transition-colors hover:text-neutral-900 ${
								active === n.id ? "text-neutral-900" : ""
							}`}
						>
							{n.label}
						</a>
					))}
				</nav>
				<div className="ml-auto flex items-center gap-2.5">
					<ThemeToggle />
					<Button
						render={<Link to="/sign-in" />}
						variant="ghost"
						size="md"
						className="hidden sm:inline-flex"
					>
						Sign in
					</Button>
					<Button render={<Link to="/sign-up" />} size="md">
						Get started
					</Button>
				</div>
			</div>
		</header>
	);
}

const FOOTER_COLS: { title: string; links: string[] }[] = [
	{ title: "Product", links: ["Close the books", "Reconciliation", "Invoices", "Cash reports"] },
	{ title: "Resources", links: ["Documentation", "Changelog", "Status", "Support"] },
	{ title: "Company", links: ["About", "Careers", "Security", "Contact"] },
];

const SOCIALS = [
	{ label: "LinkedIn", href: "#", Icon: LinkedinLogo },
	{ label: "X", href: "#", Icon: XLogo },
	{ label: "GitHub", href: "#", Icon: GithubLogo },
];

const LEGAL = ["Privacy Policy", "Terms of Service", "Cookies"];

export function SiteFooter() {
	return (
		<footer className="w-full px-4 py-12 font-sans md:px-6">
			<div className="mx-auto max-w-7xl overflow-hidden rounded-3xl border border-neutral-200 bg-tint p-1">
				<div className="rounded-[1.375rem] bg-surface shadow-sm">
					<div className="px-8 py-12 md:px-12 md:py-16">
						<div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
							<div className="flex flex-col items-start lg:col-span-4">
								<Logo />
								<p className="mb-8 mt-6 max-w-sm text-sm leading-relaxed text-neutral-500">
									The agent that runs your close, reconciliation, and cash
									reporting end to end, exceptions and human review included.
								</p>
								<div className="flex items-center gap-3">
									{SOCIALS.map(({ label, href, Icon }) => (
										<a
											key={label}
											href={href}
											aria-label={label}
											className="grid h-10 w-10 place-items-center rounded-xl bg-tint text-neutral-500 shadow-[inset_0_2px_0_0_rgba(255,255,255,0.6),0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-neutral-200 transition-colors hover:text-neutral-900"
										>
											<Icon size={16} weight="fill" />
										</a>
									))}
								</div>
							</div>

							<div className="lg:col-span-8">
								<div className="grid grid-cols-2 gap-8 md:grid-cols-3">
									{FOOTER_COLS.map((col) => (
										<div key={col.title} className="flex flex-col gap-4">
											<h4 className="mb-1 text-sm font-semibold text-neutral-900">
												{col.title}
											</h4>
											<ul className="flex flex-col gap-3">
												{col.links.map((l) => (
													<li key={l}>
														<a
															href="/#"
															className="text-sm text-neutral-500 transition-colors hover:text-brand"
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
						</div>
					</div>

					<div className="border-t border-neutral-200 bg-tint/60 px-8 py-6 md:px-12">
						<div className="flex flex-col items-center justify-between gap-4 md:flex-row">
							<p className="text-sm text-neutral-500">
								© {new Date().getFullYear()} Gray Office, Inc. All rights
								reserved.
							</p>
							<div className="flex items-center gap-4 text-sm text-neutral-500">
								{LEGAL.map((l, i) => (
									<span key={l} className="flex items-center gap-4">
										{i > 0 && <span className="h-4 w-px bg-neutral-300" />}
										<a href="/#" className="transition-colors hover:text-neutral-900">
											{l}
										</a>
									</span>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
