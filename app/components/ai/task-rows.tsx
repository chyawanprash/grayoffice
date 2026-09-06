import { useState } from "react";

/**
 * Multi-step task progress. Ported from context/ai-features/chat-states.md
 * (TaskRows), driven by real rows.
 */
export type TaskRowData = {
	key: string;
	label: string;
	amount?: string;
	status: "done" | "running" | "error";
	details?: { label: string; meta?: string }[];
};

const Check = (
	<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
);
const X = (
	<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
);

function Badge({ tone, children }: { tone: "red" | "green"; children: React.ReactNode }) {
	return (
		<span className={`flex size-5.5 shrink-0 items-center justify-center rounded-full text-white ${tone === "red" ? "bg-red" : "bg-green"}`} style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
			{children}
		</span>
	);
}

export function TaskRows({ rows }: { rows: TaskRowData[] }) {
	const [open, setOpen] = useState<Record<string, boolean>>({});
	if (rows.length === 0) return null;

	return (
		<div className="flex w-full max-w-110 flex-col gap-2">
			{rows.map((row, i) => {
				const isOpen = open[row.key] ?? false;
				return (
					<div
						key={row.key}
						className="self-stretch overflow-hidden bg-surface shadow-card transition-[border-radius] duration-300 hover:bg-inset"
						style={{ borderRadius: isOpen ? 14 : 22, animation: `fade-up 450ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both` }}
					>
						<button
							type="button"
							aria-expanded={isOpen}
							onClick={() => setOpen((c) => ({ ...c, [row.key]: !isOpen }))}
							className="flex h-11 w-full items-center gap-2.5 px-2.5 text-left"
						>
							<span className="flex size-6 shrink-0 items-center justify-center">
								{row.status === "done" ? (
									<Badge tone="green">{Check}</Badge>
								) : row.status === "error" ? (
									<Badge tone="red">{X}</Badge>
								) : (
									<span className="size-4 rounded-full border-[2px] border-line-strong border-t-ink-2" style={{ animation: "spin 800ms linear infinite" }} />
								)}
							</span>
							<span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{row.label}</span>
							{row.amount && <span className="text-[12.5px] text-ink-2 tabular-nums">{row.amount}</span>}
							<span aria-hidden className="-ml-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3">
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-300" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}>
									<path d="M6 9l6 6 6-6" />
								</svg>
							</span>
						</button>

						<div className="grid transition-[grid-template-rows,opacity] duration-300" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", opacity: isOpen ? 1 : 0, transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
							<div className="overflow-hidden">
								<div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
									<span aria-hidden className="mx-auto h-full w-px bg-line" />
									<div className="flex flex-col gap-1.5">
										{(row.details ?? []).map((d) => (
											<div key={d.label} className="flex items-center justify-between">
												<span className="text-[12px] text-ink-2">{d.label}</span>
												{d.meta && <span className="font-mono text-[11.5px] text-ink-3 tabular-nums">{d.meta}</span>}
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
