import { useEffect, useRef, useState } from "react";
import { onTransitionChange } from "~/lib/view-transition";
import { RIM_LAYERS, RIM_STOPS, buildMask, padOf, radiusOf } from "./mask";

export type Layer = { mask: string; pad: number; ring?: number };

export const WIDTH_MS = 420;

export function useReducedMotion(): {
	reduced: boolean;
	reducedRef: React.RefObject<boolean>;
} {
	const [reduced, setReduced] = useState(false);
	const reducedRef = useRef(false);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => {
			reducedRef.current = mq.matches;
			setReduced(mq.matches);
		};
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);

	return { reduced, reducedRef };
}

export function useRimMask(
	ref: React.RefObject<HTMLElement | null>,
	settleMs = WIDTH_MS + 60,
	onReady?: () => void,
	targetRadius?: number,
): Layer[] {
	const [layers, setLayers] = useState<Layer[]>([]);

	const radiusRef = useRef(targetRadius);
	useEffect(() => {
		radiusRef.current = targetRadius;
	}, [targetRadius]);

	const onReadyRef = useRef(onReady);
	useEffect(() => {
		onReadyRef.current = onReady;
	}, [onReady]);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		let announced = false;

		const build = () => {
			const box = el.getBoundingClientRect();
			if (!box.width || !box.height) return;

			const target = radiusRef.current;
			const radius =
				target != null
					? Math.min(target, box.width / 2, box.height / 2)
					: radiusOf(el);
			if (!announced) {
				announced = true;
				onReadyRef.current?.();
			}
			setLayers(
				RIM_LAYERS.map((l) => ({
					mask: buildMask({
						width: box.width,
						height: box.height,
						radius,
						strokeWidth: l.strokeWidth,
						blur: l.blur,
						alpha: l.alpha,
						ring: l.ring,
						stops: RIM_STOPS,
					}),
					pad: padOf(l.strokeWidth, l.blur),
					ring: l.ring,
				})).filter((l) => l.mask),
			);
		};

		build();

		let settle: number | null = null;
		const ro = new ResizeObserver(() => {
			if (settle !== null) window.clearTimeout(settle);
			settle = window.setTimeout(build, settleMs);
		});
		ro.observe(el);
		return () => {
			if (settle !== null) window.clearTimeout(settle);
			ro.disconnect();
		};
	}, [ref, settleMs]);

	return layers;
}

export interface PulseOptions {
	pulseMs?: number;
	gapMs?: number;
	onPulse?: () => void;
	ref?: React.RefObject<HTMLDivElement | null>;
	paletteRef?: React.RefObject<HTMLElement | null>;
}

export function useAiPulse({
	pulseMs = 1600,
	gapMs = 900,
	onPulse,
	ref: externalRef,
	paletteRef,
}: PulseOptions = {}): {
	ref: React.RefObject<HTMLDivElement | null>;
	pulseCount: number;
} {
	const ownRef = useRef<HTMLDivElement>(null);
	const ref = externalRef ?? ownRef;
	const [pulseCount, setPulseCount] = useState(0);

	const timerRef = useRef<number | null>(null);
	const aliveRef = useRef(false);
	const { reducedRef } = useReducedMotion();

	const onPulseRef = useRef(onPulse);
	useEffect(() => {
		onPulseRef.current = onPulse;
	}, [onPulse]);

	useEffect(() => {
		const host = ref.current;
		if (!host) return;

		let onScreen = false;
		let hidden = false;
		let inTransition = false;
		const owns = () => aliveRef.current;

		aliveRef.current = true;

		const clear = () => {
			if (timerRef.current !== null && timerRef.current > 0) {
				window.clearTimeout(timerRef.current);
			}
			timerRef.current = null;
		};

		const pulse = () => {
			if (!owns()) {
				timerRef.current = null;
				return;
			}

			timerRef.current = -1;

			if (!reducedRef.current) {
				rollPalette(paletteRef?.current ?? host);
				host.dataset.playing = "false";
				requestAnimationFrame(() =>
					requestAnimationFrame(() => {
						if (owns() && !reducedRef.current) host.dataset.playing = "true";
					}),
				);
			}

			onPulseRef.current?.();
			setPulseCount((n) => n + 1);
			timerRef.current = window.setTimeout(pulse, pulseMs + gapMs);
		};

		const sync = () => {
			if (!owns()) return;
			const should = onScreen && !hidden && !inTransition;
			if (should) {
				if (timerRef.current === null) pulse();
			} else {
				clear();
				host.dataset.playing = "false";
			}
		};

		const io = new IntersectionObserver(
			(es) => {
				onScreen = es.some((e) => e.isIntersecting);
				sync();
			},
			{ rootMargin: "200px" },
		);
		io.observe(host);

		const onVis = () => {
			hidden = document.hidden;
			sync();
		};
		document.addEventListener("visibilitychange", onVis);
		const offTransition = onTransitionChange((active) => {
			inTransition = active;
			sync();
		});

		return () => {
			aliveRef.current = false;
			io.disconnect();
			document.removeEventListener("visibilitychange", onVis);
			offTransition();
		};
	}, [pulseMs, gapMs, reducedRef, ref, paletteRef]);

	return { ref, pulseCount };
}

const ARC_MIN = 90;
const ARC_MAX = 190;

function hsl(h: number, s: number, l: number, a = 1): string {
	const hue = ((h % 360) + 360) % 360;
	return a === 1
		? `hsl(${hue.toFixed(1)} ${s}% ${l}%)`
		: `hsl(${hue.toFixed(1)} ${s}% ${l}% / ${a})`;
}

export function rollPalette(el: HTMLElement) {
	const anchor = Math.random() * 360;
	const arc =
		(ARC_MIN + Math.random() * (ARC_MAX - ARC_MIN)) *
		(Math.random() < 0.5 ? -1 : 1);
	const at = (t: number) => anchor + arc * t;

	const s = el.style;
	s.setProperty("--ai-c1", hsl(at(0), 96, 48));
	s.setProperty("--ai-c2", hsl(at(0.18), 52, 80));
	s.setProperty("--ai-c3", hsl(at(0.4), 98, 55));
	s.setProperty("--ai-c4", hsl(at(0.66), 96, 52));
	s.setProperty("--ai-c5", hsl(at(0.88), 94, 50));
	s.setProperty("--ai-c6", hsl(at(1), 90, 72, 0.8));
	s.setProperty("--ai-tail", hsl(at(-0.12), 70, 76, 0.63));
	s.setProperty("--ai-bg1", hsl(at(0), 62, 97));
	s.setProperty("--ai-bg2", hsl(at(0.5), 54, 95));
	s.setProperty("--ai-bg3", hsl(at(1), 58, 93));
}
