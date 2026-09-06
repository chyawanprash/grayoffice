import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Send, Sparkles, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

function ChatBubbleIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className={cn("size-6", className)}
			aria-hidden
		>
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

export function ChatWidget() {
	const [open, setOpen] = useState(false);
	const [input, setInput] = useState("");
	const { messages, sendMessage, status } = useChat({
		transport: new DefaultChatTransport({ api: "/agent" }),
	});
	const busy = status === "submitted" || status === "streaming";
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
	}, [messages, busy]);

	useEffect(() => {
		if (open) inputRef.current?.focus();
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	return (
		<>
			{/* dim the main area behind the panel */}
			<div
				onClick={() => setOpen(false)}
				className={cn(
					"absolute inset-0 z-40 bg-black/20 transition-opacity duration-[450ms] ease-out motion-reduce:transition-none",
					open ? "opacity-100" : "pointer-events-none opacity-0",
				)}
			/>

			{/* sliding chat panel */}
			<aside
				aria-hidden={!open}
				className={cn(
					"absolute inset-y-3 right-3 z-50 flex w-[min(420px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl will-change-transform",
					"transition-transform duration-[520ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none motion-reduce:duration-0",
					open
						? "translate-x-0"
						: "pointer-events-none translate-x-[calc(100%+2rem)]",
				)}
			>
				<header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
					<div className="flex items-center gap-2">
						<span className="grid size-7 place-items-center rounded-lg bg-brand-tint text-brand">
							<Sparkles className="size-4" />
						</span>
						<span className="text-sm font-medium text-foreground">
							Finance assistant
						</span>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label="Close assistant"
						onClick={() => setOpen(false)}
					>
						<X className="size-4" />
					</Button>
				</header>

				<div
					ref={scrollRef}
					className="flex-1 space-y-4 overflow-y-auto p-4 no-scrollbar"
				>
					{messages.length === 0 && (
						<p className="mt-8 text-center text-sm text-muted-foreground">
							Ask about your close, reconciliation, invoices, cash or GST.
						</p>
					)}
					{messages.map((m) => (
						<div key={m.id} className="flex gap-2.5">
							<div
								className={cn(
									"mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold",
									m.role === "user"
										? "bg-muted text-muted-foreground"
										: "bg-brand-tint text-brand",
								)}
							>
								{m.role === "user" ? "You" : <Sparkles className="size-3.5" />}
							</div>
							<div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-foreground">
								{m.parts.map((part, i) => {
									if (part.type === "text")
										return (
											<p key={i} className="whitespace-pre-wrap">
												{part.text}
											</p>
										);
									if (part.type.startsWith("tool-"))
										return (
											<span
												key={i}
												className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
											>
												{part.type.replace("tool-", "")}
											</span>
										);
									return null;
								})}
							</div>
						</div>
					))}
					{busy && (
						<p className="pl-9 text-sm text-muted-foreground">Thinking…</p>
					)}
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (!input.trim() || busy) return;
						sendMessage({ text: input });
						setInput("");
					}}
					className="flex items-center gap-2 border-t border-border p-3"
				>
					<input
						ref={inputRef}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Ask the finance agent…"
						className="h-10 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
					/>
					<Button type="submit" size="icon" disabled={busy || !input.trim()}>
						<Send className="size-4" />
					</Button>
				</form>
			</aside>

			{/* floating action button */}
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-label={open ? "Close assistant" : "Open assistant"}
				aria-expanded={open}
				className={cn(
					"absolute bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30",
					"transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-105 active:scale-95 motion-reduce:transition-none",
				)}
			>
				<span
					className={cn(
						"absolute transition-all duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
						open
							? "rotate-90 scale-0 opacity-0"
							: "rotate-0 scale-100 opacity-100",
					)}
				>
					<ChatBubbleIcon className="size-7 text-white" />
				</span>
				<span
					className={cn(
						"absolute transition-all duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
						open
							? "rotate-0 scale-100 opacity-100"
							: "-rotate-90 scale-0 opacity-0",
					)}
				>
					<X className="size-6" />
				</span>
			</button>
		</>
	);
}
