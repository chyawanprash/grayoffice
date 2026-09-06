import type { CSSProperties, ReactNode } from "react";

/**
 * Soft, colour-keyed badge. One saturated hue per colour; the background is a
 * light tint of it (via color-mix), the text is the hue itself — reads on both
 * light and dark themes.
 */
export type TagColor =
	| "green" | "blue" | "amber" | "purple" | "red" | "cyan" | "pink" | "indigo" | "gray";

const HUE: Record<TagColor, string> = {
	green: "oklch(0.68 0.15 155)",
	blue: "oklch(0.62 0.15 245)",
	amber: "oklch(0.72 0.15 65)",
	purple: "oklch(0.60 0.19 300)",
	red: "oklch(0.62 0.20 25)",
	cyan: "oklch(0.68 0.12 210)",
	pink: "oklch(0.65 0.20 5)",
	indigo: "oklch(0.55 0.18 275)",
	gray: "oklch(0.58 0.02 260)",
};

export function Tag({
	children,
	color = "gray",
	className = "",
}: {
	children: ReactNode;
	color?: TagColor;
	className?: string;
}) {
	const h = HUE[color];
	const style: CSSProperties = {
		backgroundColor: `color-mix(in oklch, ${h} 14%, transparent)`,
		color: h,
		boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${h} 26%, transparent)`,
	};
	return (
		<span
			style={style}
			className={`inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium capitalize ${className}`}
		>
			{children}
		</span>
	);
}
