import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A menu wrapper with a single highlight pill that glides to the hovered row.
 * Reimplemented from its usage in context/ai-features/chat-states.md
 * (`@/components/primitives/GlideMenu`): children are rows marked `data-menu-row`.
 */
export default function GlideMenu({
	children,
	className,
	highlightClassName = "inset-x-1 rounded-[6px] bg-hover",
}: {
	children: ReactNode;
	className?: string;
	highlightClassName?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [box, setBox] = useState<{ top: number; height: number } | null>(null);
	const [shown, setShown] = useState(false);

	const move = (e: React.PointerEvent | React.FocusEvent) => {
		const row = (e.target as Element).closest<HTMLElement>("[data-menu-row]");
		const host = ref.current;
		if (!row || !host) return;
		setBox({ top: row.offsetTop, height: row.offsetHeight });
		setShown(true);
	};

	useLayoutEffect(() => setShown(false), []);

	return (
		<div
			ref={ref}
			className={`relative ${className ?? ""}`}
			onPointerMove={move}
			onFocusCapture={move}
			onPointerLeave={() => setShown(false)}
		>
			<span
				aria-hidden
				className={`pointer-events-none absolute ${highlightClassName}`}
				style={{
					top: box?.top ?? 0,
					height: box?.height ?? 0,
					opacity: shown && box ? 1 : 0,
					transition:
						"top 200ms cubic-bezier(0.23,1,0.32,1), height 200ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
				}}
			/>
			{children}
		</div>
	);
}
