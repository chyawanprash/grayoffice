import { useRef, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { DodgeGradient } from "./dodge-gradient";

/**
 * A quiet zone below the footer. It sits empty until you scroll to the very
 * bottom of the page, where the Dia-style glow rises from the floor. No snap,
 * no scroll hijack — just a scroll-linked reveal.
 */
export function FooterGradient({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: ref,
		offset: ["start end", "end end"],
	});
	const p = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 1 });
	const scaleY = useTransform(p, [0, 1], [0.04, 1]);
	const opacity = useTransform(p, [0, 0.15, 1], [0, 0.5, 1]);

	return (
		<div className="relative">
			{children}
			<div
				ref={ref}
				className="relative h-[45vh] w-full overflow-hidden bg-surface"
			>
				<motion.div
					aria-hidden
					style={{ scaleY, opacity, transformOrigin: "bottom" }}
					className="pointer-events-none absolute inset-0"
				>
					<DodgeGradient />
				</motion.div>
			</div>
		</div>
	);
}
