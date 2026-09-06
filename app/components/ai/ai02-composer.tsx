import { useRef, useState } from "react";
import {
	IconArrowUp,
	IconChevronDown,
	IconPaperclip,
	IconSparkles,
} from "@tabler/icons-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

/**
 * Composer for the finance assistant. Adapted from @blocks-so/ai-02 — the model
 * dropdown lists the real models (gpt-5.6-luna / gemini-3.8-flash) and the quick
 * prompts kick off the standard finance plays. Attach = PDFs into Documents.
 */

export type ModelOption = { id: string; label: string; ready: boolean };

const QUICK_PROMPTS = [
	{ text: "Run the month-end close", prompt: "Run the month-end close for the current period and walk me through what's still open." },
	{ text: "Reconcile the bank", prompt: "Reconcile the bank — show matched, partial and unmatched transactions." },
	{ text: "Cash position", prompt: "Give me the current cash position and the 13-week forecast." },
	{ text: "GST by state", prompt: "Break our transactions down by state and show the GST split." },
];

export function Ai02Composer({
	onSend,
	onAttach,
	disabled,
	models,
	activeModel,
	onModelChange,
}: {
	onSend: (text: string) => void;
	onAttach?: () => void;
	disabled?: boolean;
	models?: ModelOption[];
	activeModel?: string | null;
	onModelChange?: (id: string) => void;
}) {
	const [value, setValue] = useState("");
	const ref = useRef<HTMLTextAreaElement>(null);
	const canSend = value.trim().length > 0 && !disabled;

	const send = () => {
		if (!canSend) return;
		onSend(value.trim());
		setValue("");
	};

	const current = models?.find((m) => m.id === activeModel) ?? models?.[0];

	return (
		<div className="flex w-full flex-col gap-3">
			<div className="flex min-h-[92px] cursor-text flex-col rounded-2xl border border-border bg-card shadow-sm">
				<div className="max-h-[220px] flex-1 overflow-y-auto">
					<Textarea
						ref={ref}
						value={value}
						onChange={(e) => setValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								send();
							}
						}}
						placeholder="Ask Bhondu…"
						className="min-h-[46px] w-full resize-none border-0 bg-transparent! p-3 text-[15px] text-foreground shadow-none outline-none focus-visible:ring-0"
					/>
				</div>

				<div className="flex min-h-[40px] items-center gap-1.5 p-2 pt-1">
					<span className="flex size-7 items-center justify-center rounded-full bg-muted">
						<IconSparkles className="size-4 text-muted-foreground" />
					</span>

					{models && models.length > 0 && (
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<button
										type="button"
										className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
									/>
								}
							>
								{current?.label ?? "Model"}
								<IconChevronDown className="size-3.5 text-muted-foreground" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-64">
								{models.map((m) => (
									<DropdownMenuItem
										key={m.id}
										onClick={() => onModelChange?.(m.id)}
										className="flex-col items-start gap-0.5"
									>
										<span className="flex items-center gap-1.5 font-medium">
											{m.label}
											{m.id === current?.id && (
												<span className="text-[var(--dashboard-completed)]">•</span>
											)}
										</span>
										<span className="text-xs text-muted-foreground">
											{m.ready ? "Ready" : "API key not set — falls back to Workers AI"}
										</span>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}

					<div className="ml-auto flex items-center gap-1">
						{onAttach && (
							<Button
								type="button"
								aria-label="Attach a PDF"
								title="Attach a PDF"
								size="icon-sm"
								variant="ghost"
								onClick={onAttach}
								className="rounded-full text-muted-foreground hover:text-foreground"
							>
								<IconPaperclip className="size-4.5" />
							</Button>
						)}
						<Button
							type="button"
							aria-label="Send"
							size="icon-sm"
							disabled={!canSend}
							onClick={send}
							className="rounded-full active:not-disabled:scale-[0.96]"
						>
							<IconArrowUp className="size-4" />
						</Button>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap gap-2">
				{QUICK_PROMPTS.map((p) => (
					<button
						key={p.text}
						type="button"
						onClick={() => {
							setValue(p.prompt);
							ref.current?.focus();
						}}
						className="h-8 rounded-full border border-border bg-background px-3 text-sm font-normal text-foreground shadow-xs transition-colors hover:bg-muted"
					>
						{p.text}
					</button>
				))}
			</div>
		</div>
	);
}
