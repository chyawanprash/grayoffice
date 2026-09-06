import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { SearchIcon } from "./icons";
import { navigationGroups } from "./data";
import { toAppPath } from "./navigation";

type Hit = { label: string; group: string; to: string };

const PAGES: Hit[] = navigationGroups.flatMap((g) =>
	g.items.map((i) => ({ label: i.name, group: "Pages", to: toAppPath(i.href) })),
);

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const fetcher = useFetcher<{ hits: Hit[] }>();
	const navigate = useNavigate();

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((v) => !v);
			}
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	useEffect(() => {
		if (open) requestAnimationFrame(() => inputRef.current?.focus());
		else setQ("");
	}, [open]);

	useEffect(() => {
		if (q.trim().length >= 2) fetcher.load(`/dashboard/search?q=${encodeURIComponent(q.trim())}`);
	}, [q]); // eslint-disable-line react-hooks/exhaustive-deps

	const term = q.trim().toLowerCase();
	const pageHits = term ? PAGES.filter((p) => p.label.toLowerCase().includes(term)) : PAGES;
	const results: Hit[] = [...pageHits, ...(term.length >= 2 ? fetcher.data?.hits ?? [] : [])];

	const go = (to: string) => {
		setOpen(false);
		navigate(to);
	};

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex h-9 w-full items-center gap-2 rounded-lg border-none bg-secondary px-2.5 text-xs text-muted-foreground md:w-69.25"
				aria-label="Search"
			>
				<SearchIcon className="size-3" />
				<span className="flex-1 text-left">Search invoices, docs, pages…</span>
				<span className="hidden rounded-md bg-background px-1.5 py-1 text-xs leading-none md:inline">⌘K</span>
			</button>

			{open && (
				<div
					className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
					onClick={() => setOpen(false)}
				>
					<div
						className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center gap-2 border-b border-border px-3">
							<SearchIcon className="size-4 text-muted-foreground" />
							<input
								ref={inputRef}
								value={q}
								onChange={(e) => setQ(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && results[0]) go(results[0].to);
								}}
								placeholder="Search…"
								className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
							/>
						</div>
						<ul className="max-h-80 overflow-y-auto p-1.5 text-sm">
							{results.length === 0 && (
								<li className="px-3 py-6 text-center text-muted-foreground">No matches</li>
							)}
							{results.map((h, i) => (
								<li key={`${h.to}-${i}`}>
									<button
										type="button"
										onClick={() => go(h.to)}
										className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted"
									>
										<span className="truncate text-foreground">{h.label}</span>
										<span className="shrink-0 text-xs text-muted-foreground">{h.group}</span>
									</button>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</>
	);
}
