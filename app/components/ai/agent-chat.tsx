import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useFetcher } from "react-router";
import { DefaultChatTransport } from "ai";
import { Paperclip, Sparkles, X } from "lucide-react";
import { LoadingState } from "./loading-state";
import { ThinkingState } from "./thinking-state";
import { ToolChips, type ToolStepData } from "./tool-chips";
import { ApprovalCard } from "./approval-card";
import { MessageActions, FollowUps } from "./message-extras";
import { Markdown } from "./markdown";
import { Ai02Composer, type ModelOption } from "./ai02-composer";
import { RichBlock, displayBlockOf } from "./blocks";

const SUGGESTIONS = [
	"What's our bank balance?",
	"Who's in my organization?",
	"Any exceptions in the audit log?",
];

const CONFIRM_TOOLS = [
	"bankCredit",
	"bankDebit",
	"bankTransfer",
	"bankSubscribe",
	"refundPayment",
	"createInvoice",
	"markInvoicePaid",
	"createJournalEntry",
	"postJournalEntry",
	"reverseAccrual",
];

function fileToPart(f: File): Promise<{ type: "file"; mediaType: string; filename: string; url: string }> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve({ type: "file", mediaType: f.type || "application/pdf", filename: f.name, url: r.result as string });
		r.onerror = () => reject(r.error);
		r.readAsDataURL(f);
	});
}

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

export function AgentChat({
	compact = false,
	models,
	activeModel,
}: {
	compact?: boolean;
	models?: ModelOption[];
	activeModel?: string | null;
}) {
	const { messages, sendMessage, status, regenerate, error } = useChat({
		transport: new DefaultChatTransport({ api: "/agent" }),
	});
	const busy = status === "submitted" || status === "streaming";
	const scrollRef = useRef<HTMLDivElement>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const [staged, setStaged] = useState<File[]>([]);
	const modelFetcher = useFetcher();
	const pickedModel =
		(modelFetcher.formData?.get("model") as string | undefined) ?? activeModel ?? models?.[0]?.id ?? null;

	const send = async (text: string) => {
		const t = text.trim();
		if (!t && staged.length === 0) return;
		const files = staged.length ? await Promise.all(staged.map(fileToPart)) : undefined;
		setStaged([]);
		sendMessage({ text: t || "Please process the attached document(s).", files });
	};

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
										return <Markdown key={i} text={part.text} />;
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

				{status === "error" && (
					<div className="ml-9 flex items-start gap-2.5 rounded-lg border border-[color-mix(in_oklch,var(--destructive)_30%,transparent)] bg-[color-mix(in_oklch,var(--destructive)_8%,transparent)] p-3">
						<img src="/system%20error.svg" alt="" aria-hidden className="mt-0.5 h-8 w-8 shrink-0" />
						<div className="min-w-0 text-[13px]">
							<p className="font-medium text-foreground">The assistant hit an error</p>
							<p className="mt-0.5 text-muted-foreground">
								{error?.message?.slice(0, 200) || "Something went wrong generating a reply."}
							</p>
							<button
								type="button"
								onClick={() => regenerate()}
								className="mt-1.5 text-[12.5px] font-medium text-brand hover:underline"
							>
								Try again
							</button>
						</div>
					</div>
				)}

				{!busy && status !== "error" && lastAssistant && (
					<div className="pl-9">
						<FollowUps items={SUGGESTIONS} onPick={(t) => sendMessage({ text: t })} />
					</div>
				)}
			</div>

			<div className={compact ? "space-y-2 border-t border-line p-3" : "space-y-2 pt-3"}>
				{staged.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{staged.map((f, i) => (
							<span
								key={i}
								className="inline-flex items-center gap-1.5 rounded-chip bg-field px-2 py-1 text-[11.5px] text-ink-2 shadow-hairline"
							>
								<Paperclip className="size-3" />
								<span className="max-w-40 truncate">{f.name}</span>
								<button
									type="button"
									aria-label={`Remove ${f.name}`}
									onClick={() => setStaged((s) => s.filter((_, j) => j !== i))}
									className="text-ink-3 hover:text-ink"
								>
									<X className="size-3" />
								</button>
							</span>
						))}
					</div>
				)}
				<input
					ref={fileRef}
					type="file"
					accept="application/pdf"
					multiple
					className="hidden"
					onChange={(e) => {
						const picked = Array.from(e.target.files ?? []).filter(
							(f) => /pdf/i.test(f.type) || /\.pdf$/i.test(f.name),
						);
						setStaged((s) => [...s, ...picked].slice(0, 10));
						e.target.value = "";
					}}
				/>
				<Ai02Composer
					onSend={send}
					onAttach={() => fileRef.current?.click()}
					disabled={busy}
					models={models}
					activeModel={pickedModel}
					onModelChange={(id) =>
						modelFetcher.submit({ model: id }, { method: "post", action: "/dashboard/agent-model" })
					}
				/>
			</div>
		</div>
	);
}
