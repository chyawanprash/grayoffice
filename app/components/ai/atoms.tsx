import type { ReactNode } from "react";

/**
 * Small inline atoms used by the ported chat-states cards. Reimplemented from
 * their usage (`@/components/atoms/EntityChip`, `ValuePill`).
 */

export function EntityChip({ name }: { name: string }) {
	return (
		<span className="inline-flex items-center gap-1 rounded-[5px] bg-inset px-1.5 py-0.5 align-baseline text-[12px] font-medium text-ink shadow-hairline">
			<span className="size-1.5 rounded-full bg-aic" />
			{name}
		</span>
	);
}

export function ValuePill({
	children,
	tone,
}: {
	children: ReactNode;
	tone?: "green" | "red" | "orange";
}) {
	const c =
		tone === "green"
			? "text-green"
			: tone === "red"
				? "text-red"
				: tone === "orange"
					? "text-orange"
					: "text-ink";
	return (
		<span className={`inline-flex items-center rounded-[5px] bg-field px-1.5 py-0.5 align-baseline font-mono text-[12px] font-medium ${c}`}>
			{children}
		</span>
	);
}
