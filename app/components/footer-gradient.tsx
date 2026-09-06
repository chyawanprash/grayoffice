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
	const p = useSpring(scrollYProgress, {
		stiffness: 55,
		damping: 24,
		mass: 0.5,
	});
	const y = useTransform(p, [0, 1], ["45%", "0%"]);
	const opacity = useTransform(p, [0, 0.25, 1], [0, 1, 1]);

	return (
		<div className="relative">
			{children}
			<div
				ref={ref}
				className="relative h-[45vh] w-full overflow-hidden "
			>
				<motion.div
					aria-hidden
					style={{ y, opacity, willChange: "transform, opacity" }}
					className="pointer-events-none absolute inset-0"
				>
					<DodgeGradient />
				</motion.div>
			</div>
		</div>
	);
}
