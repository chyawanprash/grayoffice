import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { DiaGradient } from "./dia-gradient";

const MAX = 260; // px of pull for a full stretch

/**
 * Rubber-band footer. Once the page is scrolled to the bottom, pulling further
 * stretches the footer up and blooms a Dia-style glow from the floor beneath it.
 * Let go and it springs back. Wraps the real footer.
 */
export function FooterGradient({ children }: { children: ReactNode }) {
	const pull = useMotionValue(0);
	const damped = useSpring(pull, { stiffness: 260, damping: 24, mass: 0.8 });

	const footerY = useTransform(damped, (v) => -v * 0.6);
	const glowScale = useTransform(damped, [0, MAX], [0.14, 1]);
	const glowOpacity = useTransform(damped, [0, 24, MAX], [0, 0.55, 1]);

	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let raw = 0;
		let idle: ReturnType<typeof setTimeout> | undefined;
		let touchStartY = 0;

		const atBottom = () =>
			window.innerHeight + window.scrollY >=
			document.documentElement.scrollHeight - 2;

		const settle = () => {
			raw = 0;
			animate(pull, 0, { type: "spring", stiffness: 120, damping: 12, mass: 1 });
		};

		const push = (dy: number) => {
			// resistance grows as you pull further
			raw = Math.max(0, Math.min(MAX, raw + dy * (1 - raw / (MAX * 1.6))));
			pull.set(raw);
			if (idle) clearTimeout(idle);
			idle = setTimeout(settle, 220);
		};

		const onWheel = (e: WheelEvent) => {
			if (e.deltaY > 0 && atBottom()) {
				e.preventDefault();
				push(e.deltaY);
			} else if (raw > 0 && e.deltaY < 0) {
				e.preventDefault();
				raw = Math.max(0, raw + e.deltaY);
				pull.set(raw);
				if (raw === 0 && idle) clearTimeout(idle);
			}
		};

		const onTouchStart = (e: TouchEvent) => {
			touchStartY = e.touches[0].clientY;
		};
		const onTouchMove = (e: TouchEvent) => {
			const dy = touchStartY - e.touches[0].clientY;
			if (dy > 0 && atBottom()) {
				e.preventDefault();
				raw = Math.max(0, Math.min(MAX, dy));
				pull.set(raw * (1 - raw / (MAX * 2.2)));
			}
		};
		const onTouchEnd = () => raw > 0 && settle();

		window.addEventListener("wheel", onWheel, { passive: false });
		window.addEventListener("touchstart", onTouchStart, { passive: true });
		window.addEventListener("touchmove", onTouchMove, { passive: false });
		window.addEventListener("touchend", onTouchEnd);
		return () => {
			window.removeEventListener("wheel", onWheel);
			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
			if (idle) clearTimeout(idle);
		};
	}, [pull]);

	return (
		<div ref={ref} className="relative">
			<motion.div
				aria-hidden
				style={{ scaleY: glowScale, opacity: glowOpacity, transformOrigin: "bottom" }}
				className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-[45vh]"
			>
				<DiaGradient autoReveal={false} blur={20} valley={0.7} />
			</motion.div>
			<motion.div style={{ y: footerY }} className="relative z-10 bg-surface">
				{children}
			</motion.div>
		</div>
	);
}
