import { useState } from "react";

/**
 * The action row + follow-up prompts shown under a settled assistant message.
 * Ported from context/ai-features/chat-states.md (StreamingText).
 */

const ACTION_ICONS: [string, React.ReactNode][] = [
	["Copy", <g key="c"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></g>],
	["Retry", <path key="r" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />],
];

export function MessageActions({ onCopy, onRetry }: { onCopy?: () => void; onRetry?: () => void }) {
	const [copied, setCopied] = useState(false);
	const handlers: Record<string, (() => void) | undefined> = {
		Copy: () => {
			onCopy?.();
			setCopied(true);
			setTimeout(() => setCopied(false), 1400);
		},
		Retry: onRetry,
	};
	return (
		<div className="mt-2 flex items-center gap-0.5" style={{ animation: "fade-in 400ms ease-out both" }}>
			{ACTION_ICONS.map(([label, icon]) => (
				<button
					key={label}
					type="button"
					aria-label={label}
					onClick={handlers[label]}
					disabled={!handlers[label]}
					className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2 disabled:opacity-40"
				>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
						{label === "Copy" && copied ? <path d="M20 6L9 17l-5-5" /> : icon}
					</svg>
				</button>
			))}
		</div>
	);
}

export function FollowUps({
	items,
	onPick,
	label = "Follow-ups",
}: {
	items: string[];
	onPick: (text: string) => void;
	label?: string;
}) {
	if (items.length === 0) return null;
	return (
		<div className="mt-2.5" style={{ animation: "fade-in 400ms ease-out both" }}>
			<p className="text-[12px] font-medium text-ink-2">{label}</p>
			<div className="mt-0.5 flex flex-col">
				{items.map((text, i) => (
					<button
						key={text}
						type="button"
						onClick={() => onPick(text)}
						className="-mx-1.5 flex items-center gap-2 rounded-[7px] border-b border-line px-1.5 py-1.5 text-left text-[12.5px] text-ink transition-colors duration-100 hover:bg-hover-2"
						style={{ animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${i * 90}ms both` }}
					>
						<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
							<path d="M9 10l-5 5 5 5" />
							<path d="M20 4v7a4 4 0 0 1-4 4H4" />
						</svg>
						{text}
					</button>
				))}
			</div>
		</div>
	);
}
