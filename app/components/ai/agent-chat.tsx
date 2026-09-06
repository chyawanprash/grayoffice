import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Sparkles } from "lucide-react";
import { LoadingState } from "./loading-state";
import { ThinkingState } from "./thinking-state";
import { ToolChips, type ToolStepData } from "./tool-chips";
import { ApprovalCard } from "./approval-card";
import { MessageActions, FollowUps } from "./message-extras";
import { PromptBar } from "./prompt-bar";
import { RichBlock, displayBlockOf } from "./blocks";

const SUGGESTIONS = [
	"What's our bank balance?",
	"Who's in my organization?",
	"Any exceptions in the audit log?",
];

const CONFIRM_TOOLS = ["bankCredit", "bankDebit", "bankTransfer"];

type AnyPart = {
	type: string;
	text?: string;
	toolCallId?: string;
	state?: string;
	input?: unknown;
	output?: unknown;
};

function short(v: unknown, n = 80): string {
	if (v == null) return "";
	const s = typeof v === "string" ? v : JSON.stringify(v);
	return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function AgentChat({ compact = false }: { compact?: boolean }) {
	const { messages, sendMessage, status, regenerate } = useChat({
		transport: new DefaultChatTransport({ api: "/agent" }),
	});
	const busy = status === "submitted" || status === "streaming";
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" });
	}, [messages, busy]);

	const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
	const showLoading = status === "submitted";

	return (
		<div className="flex min-h-0 flex-1 flex-col ai-reduce-motion">
			<div ref={scrollRef} className={`flex-1 space-y-5 overflow-y-auto ${compact ? "p-4" : "px-1 py-4"}`}>
				{messages.length === 0 && (
					<p className="mt-8 text-center text-[13px] text-ink-3">
						Ask about your close, reconciliation, invoices, cash, banking, or GST.
					</p>
				)}

				{messages.map((m) => {
					const parts = (m.parts ?? []) as AnyPart[];

					if (m.role === "user") {
						const text = parts.filter((p) => p.type === "text").map((p) => p.text).join(" ");
						return (
							<div key={m.id} className="flex justify-end">
								<div className="max-w-[85%] rounded-xl bg-field px-3 py-1.5 text-[13px] leading-[1.4] text-ink">
									{text}
								</div>
							</div>
						);
					}

					// assistant — group tool parts into ToolChips, surface confirmations
					const toolParts = parts.filter((p) => p.type.startsWith("tool-"));
					const confirmPart = toolParts.find(
						(p) =>
							CONFIRM_TOOLS.includes(p.type.replace("tool-", "")) &&
							p.state === "output-available" &&
							(p.output as { needsConfirmation?: boolean } | undefined)?.needsConfirmation,
					);
					const toolSteps: ToolStepData[] = toolParts
						.filter((p) => p !== confirmPart)
						.map((p) => ({
							name: p.type.replace("tool-", ""),
							chip: short(p.input),
							running: p.state !== "output-available" && p.state !== "output-error",
							detail:
								p.state === "output-available"
									? [short(p.output, 600)]
									: p.state === "output-error"
										? ["error"]
										: undefined,
						}));

					const proposed = confirmPart
						? (confirmPart.output as { proposed?: Record<string, unknown> }).proposed
						: undefined;

					return (
						<div key={m.id} className="flex gap-2.5">
							<div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
								<Sparkles className="size-3.5" />
							</div>
							<div className="min-w-0 flex-1 space-y-3">
								{parts.map((part, i) => {
									if (part.type === "reasoning" && part.text)
										return <ThinkingState key={i} text={part.text} working={busy && m === lastAssistant} />;
									if (part.type === "text" && part.text)
										return (
											<p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
												{part.text}
											</p>
										);
									return null;
								})}

								{toolSteps.length > 0 && <ToolChips steps={toolSteps} />}

								{toolParts.map((p, i) => {
									const block = p.state === "output-available" ? displayBlockOf(p.output) : null;
									return block ? <RichBlock key={`b${i}`} block={block} /> : null;
								})}

								{proposed && (
									<ApprovalCard
										questions={[
											{
												q: `Confirm: ${confirmPart!.type.replace("tool-", "")} ${JSON.stringify(proposed)}`,
												type: "radio",
												options: ["Yes, proceed", "No, cancel"],
											},
										]}
										sentMessage="Sent to the agent"
										onSubmitted={(a) => {
											const ok = (a[0] ?? [])[0]?.startsWith("Yes");
											sendMessage({
												text: ok
													? "Yes — I confirm. Proceed with that exact operation now (confirmed=true)."
													: "No — cancel that, don't run it.",
											});
										}}
									/>
								)}

								{!busy && m === lastAssistant && parts.some((p) => p.type === "text") && (
									<MessageActions
										onCopy={() =>
											navigator.clipboard?.writeText(
												parts.filter((p) => p.type === "text").map((p) => p.text).join("\n"),
											)
										}
										onRetry={regenerate ? () => regenerate() : undefined}
									/>
								)}
							</div>
						</div>
					);
				})}

				{showLoading && (
					<div className="pl-9">
						<LoadingState label="Thinking" />
					</div>
				)}

				{!busy && lastAssistant && (
					<div className="pl-9">
						<FollowUps items={SUGGESTIONS} onPick={(t) => sendMessage({ text: t })} />
					</div>
				)}
			</div>

			<div className={compact ? "border-t border-line p-3" : "pt-3"}>
				<PromptBar
					demo={false}
					placeholder="Ask the finance agent…"
					onSend={(t) => t.trim() && sendMessage({ text: t })}
				/>
			</div>
		</div>
	);
}
