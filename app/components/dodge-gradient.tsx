import { useTheme } from "~/components/theme";

const RAINBOW = ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"];

/**
 * Dia Browser-style floor glow: a rainbow band lifted by color-dodge into a
 * light bloom at the bottom, then covered from ~40% upward by the page surface
 * colour so the top edge melts seamlessly into the page (white in light mode,
 * near-black in dark). The rise animation is driven by whatever wraps this.
 */
export function DodgeGradient({ colors = RAINBOW }: { colors?: string[] }) {
	const dark = useTheme().resolvedTheme === "dark";
	const surface = dark ? "#151517" : "#f7f7f7";
	const rampTop = dark ? "#0e0e10" : "#f7f7f7";
	const band = colors.concat(colors[0] ?? RAINBOW[0]);

	return (
		<div
			aria-hidden
			style={{
				height: "100%",
				width: "100%",
				opacity: dark ? 0.72 : 1,
				background: [
					// top cover — fades the bloom into the page surface
					`linear-gradient(0deg, transparent 34%, ${surface} 94%)`,
					// black -> surface ramp, color-dodged over the rainbow
					`linear-gradient(0deg, #000000 0%, ${rampTop} 100%)`,
					// the rainbow itself
					`linear-gradient(90deg, ${band.join(", ")})`,
				].join(", "),
				backgroundBlendMode: "normal, color-dodge, normal",
				WebkitMaskImage:
					"radial-gradient(78% 165% at 50% 100%, #000 34%, transparent 76%)",
				maskImage:
					"radial-gradient(78% 165% at 50% 100%, #000 34%, transparent 76%)",
			}}
		/>
	);
}
