const RAINBOW = ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"];

/**
 * Dia Browser-style floor glow: one rainbow band under a black→white vertical
 * ramp, combined with color-dodge so it reads as light, then feathered by a
 * radial mask so it melts into the page. No SVG, no blur filter — seamless.
 * The rise-from-the-floor animation is driven by whatever wraps this.
 */
export function DodgeGradient({ colors = RAINBOW }: { colors?: string[] }) {
	const band = colors.concat(colors[0] ?? RAINBOW[0]);
	return (
		<div
			aria-hidden
			style={{
				height: "100%",
				width: "100%",
				background:
					`linear-gradient(0deg, #000000 0%, #f7f7f7 100%), ` +
					`linear-gradient(90deg, ${band.join(", ")})`,
				backgroundBlendMode: "color-dodge, normal",
				WebkitMaskImage:
					"radial-gradient(75% 170% at 50% 100%, #000 38%, transparent 78%)",
				maskImage:
					"radial-gradient(75% 170% at 50% 100%, #000 38%, transparent 78%)",
			}}
		/>
	);
}
