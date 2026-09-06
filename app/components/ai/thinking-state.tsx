import { useLayoutEffect, useRef, useState } from "react";

/**
 * Expandable agent reasoning trace. Ported from
 * context/ai-features/chat-states.md (ThinkingState) but driven by real data:
 * pass the reasoning `text` and whether the model is still `working`.
 */
export function ThinkingState({
	text,
	working = false,
	defaultOpen,
}: {
	text: string;
	working?: boolean;
	defaultOpen?: boolean;
}) {
	const [manual, setManual] = useState<boolean | null>(null);
	const expanded = manual ?? defaultOpen ?? working;
	const traceRef = useRef<HTMLDivElement>(null);
	const [lineHeight, setLineHeight] = useState(0);
	useLayoutEffect(() => {
		if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
	}, [expanded, text]);

	const lines = text.split(/\n+/).filter(Boolean);

	return (
		<div className="flex w-full max-w-95 flex-col">
			<button
				type="button"
				aria-expanded={expanded}
				onClick={() => setManual((c) => !(c ?? expanded))}
				className="-mx-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 py-1 transition-colors duration-100 hover:bg-hover-2"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill={working ? "var(--ink-2)" : "var(--ink-3)"}>
					<path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
				</svg>
				{working ? (
					<span
						className="bg-clip-text text-[13px] font-medium whitespace-nowrap text-transparent"
						style={{
							backgroundImage: "linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)",
							backgroundSize: "200% 100%",
							animation: "shimmer-text 1.4s linear infinite",
						}}
					>
						Thinking
					</span>
				) : (
					<span className="text-[13px] font-medium whitespace-nowrap text-ink-2">Thought it through</span>
				)}
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="var(--ink-3)"
					strokeWidth="2.2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="transition-transform duration-300"
					style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</button>

			<div
				className="grid transition-[grid-template-rows,opacity] duration-300"
				style={{
					gridTemplateRows: expanded ? "1fr" : "0fr",
					opacity: expanded ? 1 : 0,
					transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
				}}
			>
				<div className="overflow-hidden">
					<div className="relative mt-1 ml-[5px] pl-4">
						<span
							aria-hidden
							className="absolute left-[3px] w-px bg-line"
							style={{ top: -8, height: lineHeight ? lineHeight - 2 : 0 }}
						/>
						<div ref={traceRef} className="flex flex-col gap-1 py-1">
							{lines.map((line, i) => (
								<span
									key={i}
									className="min-w-0 whitespace-normal text-[12.5px] leading-relaxed text-ink-2"
								>
									{line}
								</span>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
