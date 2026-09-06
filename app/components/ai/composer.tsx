import { useRef, useState } from "react";

/**
 * Chat composer. Ported from context/ai-features/chat-states.md (ChatComposer):
 * a bordered field that focuses on click, Enter to send, dark send button that
 * activates once there's text.
 */
export function Composer({
	onSend,
	disabled,
	placeholder = "Ask the finance agent…",
}: {
	onSend: (text: string) => void;
	disabled?: boolean;
	placeholder?: string;
}) {
	const [draft, setDraft] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const canSend = draft.trim().length > 0 && !disabled;

	const send = () => {
		if (!canSend) return;
		onSend(draft.trim());
		setDraft("");
	};

	return (
		<div
			role="presentation"
			onClick={() => inputRef.current?.focus()}
			className="flex cursor-text flex-col gap-2 rounded-control border border-line bg-field p-2.5 transition-[border-color] duration-150 focus-within:border-line-strong"
		>
			<input
				ref={inputRef}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						send();
					}
				}}
				placeholder={placeholder}
				aria-label="Chat prompt"
				className="min-h-4.5 bg-transparent text-[13px] leading-[1.4] text-ink outline-none placeholder:text-ink-3"
			/>
			<div className="flex items-center justify-end">
				<button
					type="button"
					aria-label="Send"
					disabled={!canSend}
					onClick={send}
					className="flex size-7 items-center justify-center rounded-[8px] transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.96]"
					style={{
						background: canSend ? "var(--ink)" : "var(--line-strong)",
						color: canSend ? "var(--surface)" : "var(--ink-2)",
					}}
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
						<path d="M12 19V5M5 12l7-7 7 7" />
					</svg>
				</button>
			</div>
		</div>
	);
}
