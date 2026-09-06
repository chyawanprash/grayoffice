import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";

/**
 * Human-in-the-loop approval card. Ported from
 * context/ai-features/chat-states.md (ApprovalCard): one question at a time,
 * the card height animates between questions, the step counter rolls like an
 * odometer, single-choice answers auto-advance.
 */
export type ApprovalQuestion = {
	q: string;
	type: "radio" | "check";
	options: string[];
};

const ROLL_MS = 400;
const SLIDE = "360ms cubic-bezier(0.22, 1, 0.36, 1)";

function RollingDigits({ value }: { value: string }) {
	const prevRef = useRef(value);
	const [oldVal, setOldVal] = useState(value);
	const [rolling, setRolling] = useState(false);
	const [shifted, setShifted] = useState(false);
	const [dir, setDir] = useState<"up" | "down">("up");

	useEffect(() => {
		if (prevRef.current === value) return;
		const from = prevRef.current;
		prevRef.current = value;
		setDir(parseInt(value, 10) < parseInt(from, 10) ? "down" : "up");
		setOldVal(from);
		setRolling(true);
		setShifted(false);
		const raf1 = requestAnimationFrame(() => requestAnimationFrame(() => setShifted(true)));
		const done = setTimeout(() => {
			setRolling(false);
			setOldVal(value);
			setShifted(false);
		}, ROLL_MS);
		return () => {
			cancelAnimationFrame(raf1);
			clearTimeout(done);
		};
	}, [value]);

	const chars = rolling ? value : oldVal;
	return (
		<>
			{Array.from({ length: chars.length }, (_, i) => {
				const o = oldVal[i] ?? "";
				const n = chars[i] ?? "";
				if (!rolling || o === n) return <span key={`${i}-${n}`}>{n}</span>;
				const top = dir === "down" ? n : o;
				const bottom = dir === "down" ? o : n;
				const restY = dir === "down" ? "0" : "-1em";
				const startY = dir === "down" ? "-1em" : "0";
				return (
					<span key={`${i}-${o}-${n}`} style={{ display: "inline-block", position: "relative", overflow: "hidden", height: "1em", lineHeight: "1em", verticalAlign: "-0.05em" }}>
						<span style={{ display: "flex", flexDirection: "column", transition: "transform 350ms cubic-bezier(0.4,0,0.2,1)", transform: `translateY(${shifted ? restY : startY})` }}>
							<span style={{ height: "1em", lineHeight: "1em" }}>{top}</span>
							<span style={{ height: "1em", lineHeight: "1em" }}>{bottom}</span>
						</span>
					</span>
				);
			})}
		</>
	);
}

export function ApprovalCard({
	questions,
	onSubmitted,
	sentMessage = "Answers sent",
}: {
	questions: ApprovalQuestion[];
	onSubmitted: (answers: Record<number, string[]>) => void;
	sentMessage?: string;
}) {
	const [qi, setQi] = useState(0);
	const [answers, setAnswers] = useState<Record<number, number[]>>({});
	const [sent, setSent] = useState(false);
	const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
	const measured = useRef(false);
	const [viewportH, setViewportH] = useState<number | undefined>();
	const [trackY, setTrackY] = useState(0);
	const [animate, setAnimate] = useState(false);
	const [ready, setReady] = useState(false);

	const last = qi === questions.length - 1;
	const selected = answers[qi] ?? [];
	const hasAnswer = selected.length > 0;

	useLayoutEffect(() => {
		const item = questionRefs.current[qi];
		if (!item) return;
		setViewportH(item.offsetHeight);
		setTrackY(item.offsetTop);
		setAnimate(measured.current);
		measured.current = true;
		setReady(true);
	}, [qi, answers]);

	useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

	const resolve = (a: Record<number, number[]>) => {
		const out: Record<number, string[]> = {};
		questions.forEach((q, i) => {
			out[i] = (a[i] ?? []).map((idx) => q.options[idx]).filter(Boolean);
		});
		return out;
	};

	const send = (a = answers) => {
		if (advanceTimer.current) clearTimeout(advanceTimer.current);
		setSent(true);
		onSubmitted(resolve(a));
	};

	const advance = () => (last ? send() : setQi((c) => Math.min(questions.length - 1, c + 1)));

	const toggle = (index: number) => {
		const type = questions[qi].type;
		setAnswers((cur) => {
			const picked = cur[qi] ?? [];
			const next =
				type === "radio"
					? [index]
					: picked.includes(index)
						? picked.filter((x) => x !== index)
						: [...picked, index];
			const merged = { ...cur, [qi]: next };
			if (type === "radio") {
				if (advanceTimer.current) clearTimeout(advanceTimer.current);
				advanceTimer.current = setTimeout(() => {
					if (last) send(merged);
					else setQi((c) => Math.min(questions.length - 1, c + 1));
				}, 420);
			}
			return merged;
		});
	};

	if (sent) {
		return (
			<div className="flex w-full max-w-80 items-center gap-3" style={{ animation: "pop-in 260ms cubic-bezier(0.23,1,0.32,1) both" }}>
				<span className="inline-flex items-center gap-1.5 rounded-full bg-green-tint py-1 pr-2.5 pl-1 text-[12.5px] font-medium text-green">
					<span className="flex size-4.5 items-center justify-center rounded-full bg-green text-white">
						<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
					</span>
					{sentMessage}
				</span>
			</div>
		);
	}

	return (
		<div className="w-full max-w-80">
			<div className="relative overflow-hidden rounded-card bg-surface shadow-card" style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}>
				<div className="primitive-card-pad">
					<div className="overflow-hidden" style={{ height: viewportH, transition: animate ? `height ${SLIDE}` : undefined }} aria-live="polite">
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: 26,
								transform: `translate3d(0, ${-trackY}px, 0)`,
								transition: animate ? `transform ${SLIDE}` : undefined,
							}}
						>
							{questions.map((question, qIdx) => {
								const active = qIdx === qi;
								if (!ready && !active) return null;
								const picked = answers[qIdx] ?? [];
								return (
									<div
										key={qIdx}
										ref={(el) => { questionRefs.current[qIdx] = el; }}
										aria-hidden={active ? undefined : true}
										style={{ opacity: active ? 1 : 0, transition: animate ? `opacity ${SLIDE}` : undefined, pointerEvents: active ? undefined : "none" }}
									>
										<div className="pr-2 text-[14px] font-medium text-ink">{question.q}</div>
										<div className="mt-2.5 flex flex-col gap-1">
											{question.options.map((option, i) => {
												const on = picked.includes(i);
												return (
													<button
														key={option}
														type="button"
														aria-pressed={on}
														tabIndex={active ? 0 : -1}
														onClick={() => active && toggle(i)}
														className="relative flex items-center gap-1.5 rounded-control py-1 pr-2 pl-1 text-left transition-colors duration-100 hover:bg-hover"
													>
														<span
															className={`flex size-4 shrink-0 items-center justify-center transition-colors duration-200 ${question.type === "radio" ? "rounded-full" : "rounded-[5px]"} ${on ? "bg-ink text-canvas" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)] text-transparent"}`}
														>
															{question.type === "radio" ? (
																<span className="size-1.5 rounded-full bg-canvas transition-transform duration-200" style={{ transform: on ? "scale(1)" : "scale(0)" }} />
															) : (
																<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
															)}
														</span>
														<span className={`text-[13px] leading-none transition-colors duration-200 ${on ? "text-ink" : "text-ink-2"}`}>{option}</span>
													</button>
												);
											})}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>

				<div className="primitive-card-footer flex items-center justify-between gap-3">
					<div className="flex items-center gap-1 text-ink-3">
						<button type="button" aria-label="Previous" disabled={qi <= 0} onClick={() => setQi((c) => Math.max(0, c - 1))} className="flex size-[18px] items-center justify-center rounded-[5px] transition-colors duration-100 enabled:hover:text-ink disabled:opacity-30">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
						</button>
						<span className="inline-flex items-center text-[12px] font-medium tabular-nums text-ink-3" style={{ lineHeight: 1 }}>
							<RollingDigits value={`${qi + 1} / ${questions.length}`} />
						</span>
						<button type="button" aria-label="Next" disabled={last} onClick={() => setQi((c) => Math.min(questions.length - 1, c + 1))} className="flex size-[18px] items-center justify-center rounded-[5px] transition-colors duration-100 enabled:hover:text-ink disabled:opacity-30">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
						</button>
					</div>
					<Button variant="primary" size="sm" disabled={!hasAnswer} onClick={advance}>
						{last ? "Send" : "Continue"}
					</Button>
				</div>
			</div>
		</div>
	);
}
