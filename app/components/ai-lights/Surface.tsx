/**
 * The layered inner face of the card body. A couple of very soft greys stacked
 * on each other so a flat panel reads as having depth - plus a hairline top
 * highlight. Scoped entirely by the surrounding face's background colour.
 */
export function Surface({ dark }: { dark: boolean }) {
	return (
		<span
			aria-hidden="true"
			className="pointer-events-none absolute inset-0"
			style={{
				background: dark
					? "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.06), transparent 60%)"
					: "radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,0.85), transparent 55%)",
				boxShadow: dark
					? "inset 0 1px 0 rgba(255,255,255,0.06)"
					: "inset 0 1px 0 rgba(255,255,255,0.9)",
			}}
		/>
	);
}
