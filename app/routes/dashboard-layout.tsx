import { NavLink, Outlet } from "react-router";
import {
	Bell,
	ChartLineUp,
	FileText,
	Gauge,
	Gear,
	MagnifyingGlass,
	Receipt,
	ArrowsClockwise,
	Wallet,
} from "@phosphor-icons/react";
import { Logo } from "~/components/brand";

const NAV = [
	{ to: "/dashboard", label: "Overview", icon: Gauge, end: true },
	{ to: "/dashboard#close", label: "Close the books", icon: FileText },
	{ to: "/dashboard#recon", label: "Reconciliation", icon: ArrowsClockwise },
	{ to: "/dashboard#invoices", label: "Invoices", icon: Receipt },
	{ to: "/dashboard#cash", label: "Cash reports", icon: Wallet },
	{ to: "/dashboard#tax", label: "GST & jurisdictions", icon: ChartLineUp },
];

export default function DashboardLayout() {
	return (
		<div className="flex min-h-screen bg-canvas">
			<aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-surface p-3 lg:flex">
				<div className="px-2 py-2">
					<Logo className="text-[15px]" />
				</div>
				<nav className="mt-4 flex flex-col gap-0.5">
					{NAV.map((n) => (
						<NavLink
							key={n.label}
							to={n.to}
							end={n.end}
							className={({ isActive }) =>
								`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
									isActive && n.end
										? "bg-brand-tint font-medium text-brand"
										: "text-neutral-600 hover:bg-tint hover:text-neutral-900"
								}`
							}
						>
							<n.icon size={17} weight="duotone" />
							{n.label}
						</NavLink>
					))}
				</nav>
				<NavLink
					to="/dashboard#settings"
					className="mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-tint hover:text-neutral-900"
				>
					<Gear size={17} weight="duotone" />
					Settings
				</NavLink>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-neutral-200 bg-surface/80 px-5 backdrop-blur">
					<div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-canvas px-3 py-1.5 text-sm text-neutral-400">
						<MagnifyingGlass size={15} />
						<span className="hidden sm:inline">Search transactions, invoices…</span>
					</div>
					<div className="ml-auto flex items-center gap-3">
						<button
							type="button"
							className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 transition-colors hover:bg-tint"
						>
							<Bell size={17} />
						</button>
						<div className="h-8 w-8 rounded-full bg-brand/15 text-center text-sm font-semibold leading-8 text-brand">
							A
						</div>
					</div>
				</header>
				<main className="flex-1 p-5 lg:p-8">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
