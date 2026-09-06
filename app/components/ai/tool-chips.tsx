import { useState } from "react";

/**
 * Agent tool calls as compact rows with inline chips; each row expands to show
 * its input/output. Ported from context/ai-features/chat-states.md (ToolChips),
 * driven by real tool parts.
 */
export type ToolStepData = {
	name: string;
	chip: string;
	detail?: string[];
	running?: boolean;
};

const ICON: Record<string, React.ReactNode> = {
	default: <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />,
};

export function ToolChips({ steps }: { steps: ToolStepData[] }) {
	const [open, setOpen] = useState(true);
	const [openRows, setOpenRows] = useState<Set<string>>(new Set());
	if (steps.length === 0) return null;

	const toggle = (k: string) =>
		setOpenRows((cur) => {
			const next = new Set(cur);
			next.has(k) ? next.delete(k) : next.add(k);
			return next;
		});

	const running = steps.some((s) => s.running);

	return (
		<div className="w-full max-w-95 pb-1">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((c) => !c)}
				className="-mx-1.5 flex w-fit items-center gap-1.5 rounded-control px-1.5 py-1 text-[12.5px] text-ink-2 transition-colors duration-100 hover:bg-hover-2"
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="transition-transform duration-200"
					style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
				<span className="tabular-nums">
					{steps.length} tool call{steps.length === 1 ? "" : "s"}
					{running ? "…" : ""}
				</span>
			</button>

			<div
				className="grid transition-[grid-template-rows,opacity] duration-300"
				style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
			>
				<div className="-mx-1 overflow-hidden px-1.5 pb-1">
					<div className="mt-1.5 flex flex-col gap-1">
						{steps.map((row) => {
							const rowOpen = openRows.has(row.name + row.chip);
							return (
								<div key={row.name + row.chip} style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
									<button
										type="button"
										aria-expanded={rowOpen}
										onClick={() => toggle(row.name + row.chip)}
										className="-mx-[3px] flex h-7 w-[calc(100%+6px)] min-w-0 items-center gap-2 rounded-control px-[3px] text-left transition-colors duration-100 hover:bg-hover-2"
									>
										<span className="flex size-4 shrink-0 items-center justify-center text-ink-3">
											{row.running ? (
												<span
													className="size-3 rounded-full border-[1.5px] border-line-strong border-t-ink-2"
													style={{ animation: "spin 700ms linear infinite" }}
												/>
											) : (
												<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
													{ICON.default}
												</svg>
											)}
										</span>
										<span className="shrink-0 text-[12.5px] font-medium text-ink">{row.name}</span>
										<span className="inline-flex h-5.5 min-w-0 flex-1 items-center truncate rounded-chip bg-field px-1.5 font-mono text-[11.5px] text-ink-2 shadow-hairline">
											{row.chip}
										</span>
									</button>

									<div
										className="grid transition-[grid-template-rows,opacity] duration-300"
										style={{
											gridTemplateRows: rowOpen ? "1fr" : "0fr",
											opacity: rowOpen ? 1 : 0,
											transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
										}}
									>
										<div className="min-h-0 overflow-hidden">
											<div className="mt-0.5 mb-1 ml-2 flex flex-col gap-0.5 border-l border-line py-0.5 pl-3.5">
												{(row.detail ?? []).map((line, i) => (
													<span key={i} className="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-[1.6] text-ink-2">
														{line}
													</span>
												))}
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
