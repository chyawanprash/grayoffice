import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { AgentChat } from "~/components/ai/agent-chat";

function ChatBubbleIcon({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("size-6", className)} aria-hidden>
			<path
				d="M12 3c5.05 0 9 3.36 9 7.7 0 4.35-3.95 7.71-9 7.71a10.6 10.6 0 0 1-3.02-.43l-3.72 1.49a.6.6 0 0 1-.81-.7l.77-3.22C3.79 15.03 3 12.96 3 10.7 3 6.36 6.95 3 12 3Z"
				fill="currentColor"
			/>
			<circle cx="8.5" cy="10.7" r="1.15" fill="var(--color-brand, #4f46e5)" />
			<circle cx="12" cy="10.7" r="1.15" fill="var(--color-brand, #4f46e5)" />
			<circle cx="15.5" cy="10.7" r="1.15" fill="var(--color-brand, #4f46e5)" />
		</svg>
	);
}

/**
 * Floating finance-assistant widget. Rendered in a body portal with fixed
 * positioning so it never participates in the dashboard's layout, stacking or
 * overflow — opening it can't shift the main container.
 */
export function ChatWidget() {
	const [mounted, setMounted] = useState(false);
	const [open, setOpen] = useState(false);

	useEffect(() => setMounted(true), []);
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	if (!mounted) return null;

	return createPortal(
		<>
			{/* backdrop */}
			<div
				onClick={() => setOpen(false)}
				className={cn(
					"fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 motion-reduce:transition-none",
					open ? "opacity-100" : "pointer-events-none opacity-0",
				)}
			/>

			{/* sliding panel */}
			<aside
				aria-hidden={!open}
				className={cn(
					"fixed inset-y-3 right-3 z-[61] flex w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl",
					"transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none motion-reduce:duration-0",
					open ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+2rem)]",
				)}
			>
				<header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
					<div className="flex items-center gap-2">
						<span className="grid size-7 place-items-center rounded-lg bg-brand-tint text-brand">
							<Sparkles className="size-4" />
						</span>
						<span className="text-sm font-medium text-foreground">Finance assistant</span>
					</div>
					<Button type="button" variant="ghost" size="icon-sm" aria-label="Close assistant" onClick={() => setOpen(false)}>
						<X className="size-4" />
					</Button>
				</header>

				{open && <AgentChat compact />}
			</aside>

			{/* floating action button */}
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-label={open ? "Close assistant" : "Open assistant"}
				aria-expanded={open}
				className={cn(
					"fixed bottom-5 right-5 z-[61] grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30",
					"transition-[scale] duration-200 ease-out hover:scale-105 active:scale-95 motion-reduce:transition-none",
				)}
			>
				<span
					className={cn(
						"absolute inset-0 grid place-items-center transition-[opacity,rotate] duration-300 motion-reduce:transition-none",
						open ? "rotate-45 opacity-0" : "rotate-0 opacity-100",
					)}
				>
					<ChatBubbleIcon className="size-6 text-white" />
				</span>
				<span
					className={cn(
						"absolute inset-0 grid place-items-center transition-[opacity,rotate] duration-300 motion-reduce:transition-none",
						open ? "rotate-0 opacity-100" : "-rotate-45 opacity-0",
					)}
				>
					<X className="size-6" />
				</span>
			</button>
		</>,
		document.body,
	);
}
