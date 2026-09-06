import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { PaperPlaneRight, Sparkle, Wrench } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";

export function meta() {
	return [{ title: "Assistant | Gray Office" }];
}

export default function Assistant() {
	const { messages, sendMessage, status } = useChat({
		transport: new DefaultChatTransport({ api: "/agent" }),
	});
	const [input, setInput] = useState("");
	const busy = status === "submitted" || status === "streaming";

	return (
		<div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
			<div className="mb-4">
				<h1 className="text-xl font-semibold tracking-tight text-neutral-900">
					Finance assistant
				</h1>
				<p className="text-sm text-neutral-500">
					Ask about your close, reconciliation, invoices, cash, or GST. It
					remembers what you tell it.
				</p>
			</div>

			<div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-neutral-200 bg-surface p-5">
				{messages.length === 0 && (
					<p className="mt-10 text-center text-sm text-neutral-400">
						Try: “We close on the 5th business day. What should I check first?”
					</p>
				)}
				{messages.map((m) => (
					<div key={m.id} className="flex gap-3">
						<div
							className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-semibold ${
								m.role === "user"
									? "bg-neutral-200 text-neutral-600"
									: "bg-brand-tint text-brand"
							}`}
						>
							{m.role === "user" ? "You" : <Sparkle size={14} weight="fill" />}
						</div>
						<div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed text-neutral-800">
							{m.parts.map((part, i) => {
								if (part.type === "text")
									return (
										<p key={i} className="whitespace-pre-wrap">
											{part.text}
										</p>
									);
								if (part.type.startsWith("tool-"))
									return (
										<p
											key={i}
											className="inline-flex items-center gap-1.5 rounded-md bg-tint px-2 py-1 text-xs text-neutral-500"
										>
											<Wrench size={12} />
											{part.type.replace("tool-", "")}
										</p>
									);
								return null;
							})}
						</div>
					</div>
				))}
				{busy && (
					<p className="pl-10 text-sm text-neutral-400">Thinking…</p>
				)}
			</div>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (!input.trim() || busy) return;
					sendMessage({ text: input });
					setInput("");
				}}
				className="mt-4 flex items-center gap-2"
			>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Ask the finance agent…"
					className="h-11 flex-1 rounded-lg border border-neutral-300 bg-surface px-4 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
				/>
				<Button type="submit" size="md" disabled={busy || !input.trim()}>
					<PaperPlaneRight size={15} weight="fill" />
				</Button>
			</form>
		</div>
	);
}
