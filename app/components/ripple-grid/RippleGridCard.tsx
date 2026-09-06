import { useEffect, useRef } from "react";
import { RippleGrid } from "./engine";
import { useIsDark } from "~/components/theme";

// Blob / field colors per theme - the field matches the section the card sits in
// so the card reads as seamless.
const THEME_COLORS = {
  light: { ink: "#1b1b1b", paper: "#fcfcfc" },
  dark: { ink: "#e5e5e5", paper: "#151517" },
} as const;

export function RippleGridCard({ className = "" }: { className?: string } = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = THEME_COLORS[useIsDark() ? "dark" : "light"];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let engine: RippleGrid | null = null;
    let onScreen = false;
    let hidden = false;

    const sync = () => {
      if (!engine || reduced) return;
      if (onScreen && !hidden) engine.start();
      else engine.stop();
    };

    const raf = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      engine = new RippleGrid(canvas, colors);
      if (!engine.ok) return;
      if (reduced) engine.renderStill();
      else sync();
    });

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      engine?.setPointer(
        (e.clientX - r.left) / r.width,
        (e.clientY - r.top) / r.height,
      );
    };
    const onLeave = () => engine?.clearPointer();
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointercancel", onLeave);
    canvas.addEventListener("pointerup", onLeave);

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.2 },
    );
    io.observe(canvas);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => engine?.resize(), 120);
    };
    window.addEventListener("resize", onResize);

    return () => {
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointercancel", onLeave);
      canvas.removeEventListener("pointerup", onLeave);
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(rt);
      engine?.destroy();
    };
  }, [colors]);

  return (
    <div
      role="img"
      aria-label="A grid of soft black blobs on a pale field. The grid swells open, its rows bend into concentric rings and then into a slow spiral that leans off centre, thinning to slivers at the edge, before folding back into the plain grid it started from."
      style={{ backgroundColor: colors.paper }}
      className={`relative aspect-[1344/620] w-full select-none overflow-hidden rounded-xl border border-neutral-200 shadow-sm ${className}`}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
