# Dia Browser's gradient

Dia Browser has a soft glow at the bottom of the screen. A row of blurry colour bars, short on the sides and tall in the middle, going from dark up through blue, white, yellow, red and pink, then fading out at the top. It grows up from the floor when the page loads.
It is simpler than it looks. Just a few tall rectangles in one small SVG, all painted with the same rainbow and blurred a lot so they melt together. It starts flat at the bottom and scales up to full height, so it looks like it rises from the floor. Below you can change the bars, the blur, the curve and the colours.

## Code

### dia-gradient/standalone/DiaGradient.tsx
```tsx
"use client";

import { useEffect, useState } from "react";

type Stop = { offset: number; color: string };

const DIA_STOPS: Stop[] = [
  { offset: 0, color: "#340B05" },
  { offset: 0.1827, color: "#0358F7" },
  { offset: 0.2837, color: "#5092C7" },
  { offset: 0.4135, color: "#E1ECFE" },
  { offset: 0.5866, color: "#FFD400" },
  { offset: 0.6827, color: "#FA3D1D" },
  { offset: 0.8029, color: "#FD02F5" },
  { offset: 1, color: "#FFC0FD00" },
];

const VBW = 1271;
const VBH = 599;

function bellHeights(n: number, peak: number, valley: number): number[] {
  const out: number[] = [];
  const mid = (n - 1) / 2;
  for (let i = 0; i < n; i++) {
    const t = mid === 0 ? 0 : Math.abs(i - mid) / mid;
    const eased = 1 - Math.pow(t, 1.24);
    out.push(peak * VBH * (valley + (1 - valley) * eased));
  }
  return out;
}

export function DiaGradient({
  bars = 9,
  blur = 15,
  peak = 0.98,
  valley = 0.55,
  stops = DIA_STOPS,
  riseMs = 1100,
}: {
  bars?: number;
  blur?: number;
  peak?: number;
  valley?: number;
  stops?: Stop[];
  riseMs?: number;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true)),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  const heights = bellHeights(bars, peak, valley);
  const colW = VBW / bars;

  return (
    <div
      aria-hidden
      style={{
        height: "100%",
        width: "100%",
        transformOrigin: "bottom",
        transform: shown ? "scaleY(1)" : "scaleY(0)",
        transition: `transform ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        willChange: "transform",
      }}
    >
      <svg
        style={{ height: "100%", width: "100%" }}
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {}
          <linearGradient id="dia-grad" x1="0" y1="1" x2="0" y2="0">
            {stops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
          <filter id="dia-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
        {heights.map((h, i) => (
          <g key={i} filter="url(#dia-blur)">
            <rect
              x={i * colW}
              y={VBH - h}
              width={colW * 1.23}
              height={h}
              fill="url(#dia-grad)"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}

```

### dia-gradient/standalone/PeakedGradient.tsx
```tsx
"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const VBW = 1271;
const VBH = 599;

function peakPath(widthFrac: number, heightFrac: number, pointiness: number): string {
  const w = widthFrac * VBW;
  const startX = (VBW - w) / 2;
  const endX = startX + w;
  const peakX = VBW / 2;
  const peakY = VBH - heightFrac * VBH;
  const spread = (1 - pointiness) * (w / 2);
  const ext = VBH * 0.6;
  return [
    `M ${startX} ${VBH}`,
    `Q ${peakX - spread} ${peakY}, ${peakX} ${peakY}`,
    `Q ${peakX + spread} ${peakY}, ${endX} ${VBH}`,
    `L ${endX} ${VBH + ext}`,
    `L ${startX} ${VBH + ext}`,
    "Z",
  ].join(" ");
}

export interface PeakedGradientProps {

  colors?: string[];

  peak?: number;

  pointiness?: number;

  blur?: number;
  reveal?: "mount" | "scroll" | "none";
  riseMs?: number;
  replayKey?: number;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_COLORS = ["#E1ECFE", "#FFD400", "#FA3D1D", "#FD02F5", "#0358F7", "#340B05"];

export function PeakedGradient({
  colors = DEFAULT_COLORS,
  peak = 0.92,
  pointiness = 0.5,
  blur = 26,
  reveal = "mount",
  riseMs = 1100,
  replayKey = 0,
  className,
  style,
}: PeakedGradientProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scaleY, setScaleY] = useState(reveal === "none" ? 1 : 0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reveal === "none" || reduced) {
      setScaleY(1);
      return;
    }
    if (reveal === "mount") {
      setScaleY(0);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setScaleY(1)),
      );
      return () => cancelAnimationFrame(id);
    }
    let ticking = false;
    const measure = () => {
      ticking = false;
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      setScaleY(Math.max(0, Math.min(1, (vh - r.top) / (vh * 0.65))));
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(measure);
      }
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reveal, replayKey]);

  const fid = `peak-blur-${replayKey}`;

  const layers = colors
    .slice()
    .reverse()
    .map((color, i, arr) => {
      const t = arr.length === 1 ? 1 : i / (arr.length - 1);
      const heightFrac = peak * (0.55 + 0.45 * t);
      const widthFrac = 1.05 - 0.45 * t;
      return { color, d: peakPath(widthFrac, heightFrac, pointiness) };
    });

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className={className}
      style={{
        transformOrigin: "bottom",
        transform: `scaleY(${scaleY})`,
        transition:
          reveal === "mount"
            ? `transform ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1)`
            : undefined,
        willChange: "transform",
        ...style,
      }}
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id={fid} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
        <g filter={`url(#${fid})`}>
          {layers.map((l, i) => (
            <path key={i} d={l.d} fill={l.color} />
          ))}
        </g>
      </svg>
    </div>
  );
}

```

### dia-gradient/standalone/DodgeGradient.tsx
```tsx
"use client";

import { useEffect, useState } from "react";

const BLEND = "color-dodge, normal";
const RAINBOW = ["#FF0000", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#FF00FF"];

export function DodgeGradient({
  colors = RAINBOW,
  riseMs = 1100,
}: {
  colors?: string[];
  riseMs?: number;
}) {

  const band = (colors.length ? colors : RAINBOW).concat(colors[0] ?? RAINBOW[0]);
  const BACKGROUND =
    "linear-gradient(0deg, #000000 0%, #f7f7f7 100%), " +
    `linear-gradient(90deg, ${band.join(", ")})`;

  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true)),
    );
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      aria-hidden
      style={{
        height: "100%",
        width: "100%",
        transformOrigin: "bottom",
        transform: shown ? "scaleY(1)" : "scaleY(0)",
        transition: `transform ${riseMs}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        willChange: "transform",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          background: BACKGROUND,
          backgroundBlendMode: BLEND,

          WebkitMaskImage:
            "radial-gradient(75% 170% at 50% 100%, #000 38%, transparent 78%)",
          maskImage:
            "radial-gradient(75% 170% at 50% 100%, #000 38%, transparent 78%)",
        }}
      />
    </div>
  );
}

```

## Credits
- Company: Dia Browser
- Date: Jun 26, 2026
- Tags: SVG, Gradient, Reveal
- Source: https://www.diabrowser.com