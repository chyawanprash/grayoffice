Build this: ONE BODY THAT BECOMES FOUR DIFFERENT UI COMPONENTS — a workflow node, a progress row, a terminal panel and a prompt bar — lit by a pulse of rainbow light running around its rim, the kind an AI product uses to say it is working. There is a SINGLE element for the life of the card: it carries the glow, and it animates its width, height and corner radius from one component's shape to the next, so a pill becomes a circle becomes an input becomes a tile as one object changing its mind rather than four objects taking turns. The variants are only CONTENTS plus the shape the body should take to hold them; they draw no container of their own, and critically A VARIANT MUST NOT SET ITS OWN WIDTH OR HEIGHT — it sizes the shared body by being measured, so anything that pins its own box makes the morph animate to the wrong place. Because the mask is built from the body's own measured box and its COMPUTED border-radius, all four shapes come out of one implementation with no branching: a stadium, a circle and two different corner radii all fall out of numbers the layout produced for other reasons. THE MASK IS THE WHOLE TRICK, and it is not CSS. Each glow layer is masked by a PNG drawn on a canvas: take the element's measured box and its computed border-radius, roundRect it, STROKE it with a conic gradient, apply ctx.filter = blur(n), then toDataURL and use that as mask-image. Two things fall out that CSS alone will not give you. FIRST, a stroke of width 20 blurred by 32px is a soft BAND hugging the shape — that reads as light, where a bordered box with a CSS blur reads as a lit border. Stack four at rising width and blur (4/4, 8/8, 16/12, 20/32 at alpha .3/.2/.1/.32) and you have the whole falloff; add a FIFTH with no stroke width at all, which fills the shape and punches a 1px hole inside it, and that carved band is the coloured border itself. Carve from a fill rather than stroking at width 1, or the line straddles the edge and lands half a pixel outside the shape. SECOND, and this is the part everyone misses: the conic painting that stroke is a gradient of OPACITY, not colour. Its stops are #000 at 54deg, transparent at 126deg, transparent at 333deg, rgba(0,0,0,0.10) at 347deg, #000 at 360deg — so the rim is opaque over roughly a third of the circle and gone across the rest. THAT is where the partial coverage comes from. Light the ring evenly and it stops being a highlight travelling along an edge and becomes a glowing border. That lit arc sits on the RIGHT, so DRAW EVERY LAYER TWICE with the second scaleX(-1) mirrored — one copy alone lights one side and the other stays dark. THE VISIBLE COLOUR is a second conic underneath the mask: #005bf6 at 0deg, #b0c6e9 at 16deg, #feca00 at 30deg, #ff1c11 at 43deg, #ff00ea at 59deg, #ffa2fbcc at 72deg, transparent from 84deg to 324deg, #95c1ffa1 at 349deg, back to #005bf6 at 360deg — again a small bright arc with a long dark tail. THE PULSE is a ONE-SHOT, not a loop: opacity 0 -> 1 by 10%, held to 30%, back to 0 by 100% over 1.6s cubic-bezier(.26,.94,.6,1), and as it fades the start angle swings BACKWARDS (180deg -> 30deg) while every stop pushes OUTWARD (16->6, 30->11, 43->17, 59->40, 72->90, 84->120), so the wedge tightens at its head and blooms at its tail as it dies. Rotating it instead looks like a wheel. Declare the start angle and all six stops as registered @property angles or the browser cannot interpolate them and the gradient jumps. Retrigger by flipping a data-playing attribute false then true across TWO rAFs — in one frame the writes coalesce and nothing restarts. Each layer sits OUTSIDE the element by its own mask padding (strokeWidth + blur*3), or the blurred stroke is clipped square, and everything stays UNDER the content: lift a layer above it and the ring's soft inner edge spills across the face and washes the whole element. Inset the face by a pixel instead (the body's 1px of padding IS the gap the ring lives in), and give the face a radius of calc(bodyRadius - 1px) so the two stay concentric. NEVER ANIMATE A RADIUS OF 9999px. A pill or a circle is normally written as an absurd radius that the browser clamps to half the height, and that works fine statically — but it INTERPOLATES NUMERICALLY, so a morph from 9999 to 10 stays above the clamp for about 90% of its duration, rendering a full stadium the whole way, and then collapses to the true corner in the last few frames. It reads as the shape lagging and then snapping, and it is by far the most likely thing to go wrong in a rebuild. Resolve every radius to a REAL number against the box the variant will occupy (half the height for a pill) so the corner travels linearly with the box. HIDE THE GLOW LAYERS WHILE THE BODY MOVES. Ten layers each stretching a PNG mask to a box that changes every frame is ten image rescales per frame, on top of the layout that animating width and height already forces — and because the morph happens in the dark, none of it is ever seen. Use display:none, not opacity:0; a transparent element is still laid out and still rescales its mask. Do the same for the contents with content-visibility:hidden, which skips their layout and paint while they are faded out. KEEP THE MORPH SHORT — around 380ms. Width, height and border-radius are all layout-and-paint properties that the compositor cannot take, so every frame runs on the main thread; a long morph is simply a longer stretch of expensive frames with more room for jank to show, while a brisk one is over before the eye can pick at it and reads as decisive. Ease OUT rather than in-out, so the box leaves fast and settles slowly: an in-out curve spends its slowest frames in the middle of the morph, which is exactly where the shape means least. THE COMPONENT SET should be surfaces from one product family — the kind of UI that sits around a model while it works — rather than generic buttons and toggles: 'something is running' is the state the light already announces, and a generic control says nothing at all. Give them a design language of their own and SCOPE ITS TOKENS TO THE CARD rather than :root, or they restyle everything else by accident: heavier borders than a typical light theme (around #dedede), a deep stack of surface greys each with a stated job (which is what makes a flat UI read as layered), a tight 8px base radius, and a neutral text ramp. Leave out any brand accent — a saturated hue fights a rainbow rim. ONE VARIANT SHOULD INVERT (here a terminal panel, dark on a light page): it is the biggest jump in the rotation, and a change of polarity lands harder than any change of proportion. TRANSITION the face colour over the same beat as the shape, or it flips on a single frame. Draw any connection handles FLUSH to the edge rather than protruding — out there they sit exactly where the glow lives and fight the light. WATCH THE HALO BUDGET: each layer is drawn outside the box by strokeWidth + blur*3, so a 32px blur puts the softest light 116px out, and once the shapes grow past a few hundred px that clips square against the card's own edge. Size the outermost blur to the room actually available, and measure the container before tuning it rather than guessing at hypothetical widths. THE TIMELINE IS THREE BEATS THAT NEVER OVERLAP, and the order is the single most important decision in the whole effect: (1) the light pulses once; (2) the contents fade OUT while the body is still the old shape; (3) the empty body morphs, and only when it has settled do the new contents rise in. MORPHING IN THE DARK IS WHAT MAKES THIS AFFORDABLE. The mask is a PNG sized to a specific box and cannot be interpolated, so light travelling a changing edge would need all five layers redrawn every frame — hundreds of canvas draws and toDataURL calls per morph. Sequenced this way the glow has already gone by the time the box moves, and the mask only has to be correct again once it stops: one rebuild, debounced until the shape settles, with mask-size:100% 100% stretching the old one in the meantime where nobody can see it. DERIVE THE GAP BETWEEN PULSES FROM THE BEATS, never pick it by hand: the entire handover has to finish before the next pulse, or the light starts running a rim that is still moving and whose mask is still stale, which is the exact thing this ordering exists to prevent. Measure every variant's natural box ONCE, off-screen, by rendering each one hidden and reading it back — hardcoding sizes drifts the moment any content or padding changes, and the body needs real px targets because the browser will not transition to `width: auto`. Use visibility:hidden rather than display:none for that probe; a display-none element has no box to measure. Re-measure after document.fonts.ready or every width is the fallback font's. CONTENTS RISE IN PER CHARACTER: each letter enters from translateY(16px) blur(2px) opacity 0 on a ~20ms-per-index stagger, cubic-bezier(.66,0,.34,1) over 300ms. Remount them on every handover (key off a counter) or the text simply appears instead of arriving. PERF: cache the drawn masks by geometry — the body returns to the same four shapes forever, so after one rotation every rebuild is a lookup. Safari's canvas blur is far stronger at the same radius, so scale it down there. Pause when offscreen / hidden / mid route transition. Under reduced motion the card KEEPS CYCLING — frozen on one shape forever is a worse outcome than a calm one — but the glow never lights and the letters fade in place with no travel, blur or stagger. The card is ornamental, so aria-hidden it rather than labelling it: it changes what it is every few seconds, a label never re-announces, and per-character spans get spelled out letter by letter.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### ai-lights/mask.ts
```ts
export interface MaskStop {

  color: string;

  stop: number;
}

export interface MaskOptions {

  width: number;
  height: number;

  radius: number;

  strokeWidth: number;

  blur: number;

  alpha?: number;

  stops: MaskStop[];

  ring?: number;

  stopsStart?: number;
}

export const RIM_STOPS: MaskStop[] = [
  { color: "#000", stop: 54 },
  { color: "transparent", stop: 126 },
  { color: "transparent", stop: 333 },
  { color: "rgba(0,0,0,0.10)", stop: 347 },
  { color: "#000", stop: 360 },
];

export const RIM_LAYERS: {
  strokeWidth: number;
  blur: number;
  alpha: number;

  ring?: number;
}[] = [
  { strokeWidth: 0, blur: 0, alpha: 1, ring: 1 },
  { strokeWidth: 4, blur: 4, alpha: 0.3 },
  { strokeWidth: 8, blur: 8, alpha: 0.2 },
  { strokeWidth: 16, blur: 12, alpha: 0.1 },

  { strokeWidth: 20, blur: 20, alpha: 0.32 },
];

let scratch: HTMLCanvasElement | null = null;

const cache = new Map<string, string>();
const CACHE_MAX = 24;

export function buildMask(o: MaskOptions): string {
  if (typeof document === "undefined") return "";

  const key = [
    Math.round(o.width),
    Math.round(o.height),
    Math.round(o.radius),
    o.strokeWidth,
    o.blur,
    o.alpha ?? 1,
    o.ring ?? 0,
    o.stopsStart ?? 0,
    o.stops?.map((s) => `${s.color}@${s.stop}`).join(",") ?? "",
  ].join("|");
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  const pad = Math.ceil(o.strokeWidth + o.blur * 3);
  const w = Math.max(1, Math.ceil(o.width) + pad * 2);
  const h = Math.max(1, Math.ceil(o.height) + pad * 2);

  if (!scratch) scratch = document.createElement("canvas");
  const c = scratch;
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  ctx.clearRect(0, 0, w, h);

  if (o.blur) {

    const isSafari =
      typeof navigator !== "undefined" &&
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    ctx.filter = `blur(${isSafari ? o.blur * 0.25 : o.blur}px)`;
  }

  if (o.stops?.length) {
    const g = ctx.createConicGradient(
      ((o.stopsStart ?? 0) * Math.PI) / 180,
      w / 2,
      h / 2,
    );
    for (const s of o.stops) g.addColorStop(s.stop / 360, s.color);
    ctx.strokeStyle = g;
    ctx.fillStyle = g;
  }

  if (o.alpha != null) ctx.globalAlpha = o.alpha;

  const x = (w - o.width) / 2;
  const y = (h - o.height) / 2;
  ctx.beginPath();
  if (o.radius > 0) {

    const r = Math.min(o.radius, o.width / 2, o.height / 2);
    ctx.roundRect(x, y, o.width, o.height, r);
  } else {
    ctx.rect(x, y, o.width, o.height);
  }

  if (o.strokeWidth) {
    ctx.lineWidth = o.strokeWidth;
    ctx.stroke();
  } else {
    ctx.fill();

    if (o.ring) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      const r2 = Math.max(
        0,
        Math.min(o.radius - o.ring, (o.width - o.ring * 2) / 2, (o.height - o.ring * 2) / 2),
      );
      ctx.beginPath();
      ctx.roundRect(
        x + o.ring,
        y + o.ring,
        Math.max(0, o.width - o.ring * 2),
        Math.max(0, o.height - o.ring * 2),
        r2,
      );
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
  }

  const url = c.toDataURL("image/png");

  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, url);
  return url;
}

export function radiusOf(el: HTMLElement): number {
  const r = parseFloat(getComputedStyle(el).borderRadius) || 0;
  const { width, height } = el.getBoundingClientRect();
  return Math.min(r, width / 2, height / 2);
}

export function padOf(strokeWidth: number, blur: number): number {
  return Math.ceil(strokeWidth + blur * 3);
}

```

### ai-lights/use-ai-lights.ts
```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { onTransitionChange } from "../../lib/view-transition";
import { RIM_LAYERS, RIM_STOPS, buildMask, padOf, radiusOf } from "./mask";

export type Layer = { mask: string; pad: number; ring?: number };

export const WIDTH_MS = 420;

export function useReducedMotion(): {
  reduced: boolean;
  reducedRef: React.RefObject<boolean>;
} {
  const [reduced, setReduced] = useState(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reducedRef.current = mq.matches;
      setReduced(mq.matches);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return { reduced, reducedRef };
}

export function useRimMask(
  ref: React.RefObject<HTMLElement | null>,
  settleMs: number = WIDTH_MS + 60,
  onReady?: () => void,

  targetRadius?: number,
): Layer[] {
  const [layers, setLayers] = useState<Layer[]>([]);

  const radiusRef = useRef(targetRadius);
  useEffect(() => {
    radiusRef.current = targetRadius;
  }, [targetRadius]);

  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let announced = false;

    const build = () => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;

      const target = radiusRef.current;
      const radius =
        target != null
          ? Math.min(target, box.width / 2, box.height / 2)
          : radiusOf(el);
      if (!announced) {
        announced = true;
        onReadyRef.current?.();
      }
      setLayers(
        RIM_LAYERS.map((l) => ({
          mask: buildMask({
            width: box.width,
            height: box.height,
            radius,
            strokeWidth: l.strokeWidth,
            blur: l.blur,
            alpha: l.alpha,
            ring: l.ring,
            stops: RIM_STOPS,
          }),
          pad: padOf(l.strokeWidth, l.blur),
          ring: l.ring,
        })).filter((l) => l.mask),
      );
    };

    build();

    let settle: number | null = null;
    const ro = new ResizeObserver(() => {
      if (settle !== null) window.clearTimeout(settle);
      settle = window.setTimeout(build, settleMs);
    });
    ro.observe(el);
    return () => {
      if (settle !== null) window.clearTimeout(settle);
      ro.disconnect();
    };
  }, [ref, settleMs]);

  return layers;
}

export interface PulseOptions {

  pulseMs?: number;

  gapMs?: number;

  onPulse?: () => void;

  ref?: React.RefObject<HTMLDivElement | null>;

  paletteRef?: React.RefObject<HTMLElement | null>;
}

export function useAiPulse({
  pulseMs = 1600,
  gapMs = 900,
  onPulse,
  ref: externalRef,
  paletteRef,
}: PulseOptions = {}): {
  ref: React.RefObject<HTMLDivElement | null>;
  pulseCount: number;
} {
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = externalRef ?? ownRef;
  const [pulseCount, setPulseCount] = useState(0);

  const timerRef = useRef<number | null>(null);

  const aliveRef = useRef(false);
  const { reducedRef } = useReducedMotion();

  const onPulseRef = useRef(onPulse);
  useEffect(() => {
    onPulseRef.current = onPulse;
  }, [onPulse]);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    let onScreen = false;
    let hidden = false;
    let inTransition = false;
    const owns = () => aliveRef.current;

    aliveRef.current = true;

    const clear = () => {
      if (timerRef.current !== null && timerRef.current > 0) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = null;
    };

    const pulse = () => {

      if (!owns()) {
        timerRef.current = null;
        return;
      }

      timerRef.current = -1;

      if (!reducedRef.current) {

        rollPalette(paletteRef?.current ?? host);
        host.dataset.playing = "false";
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (owns() && !reducedRef.current) host.dataset.playing = "true";
          }),
        );
      }

      onPulseRef.current?.();
      setPulseCount((n) => n + 1);
      timerRef.current = window.setTimeout(pulse, pulseMs + gapMs);
    };

    const sync = () => {

      if (!owns()) return;
      const should = onScreen && !hidden && !inTransition;
      if (should) {
        if (timerRef.current === null) pulse();
      } else {
        clear();
        host.dataset.playing = "false";
      }
    };

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es.some((e) => e.isIntersecting);
        sync();
      },
      { rootMargin: "200px" },
    );
    io.observe(host);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

    return () => {

      aliveRef.current = false;
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
    };
  }, [pulseMs, gapMs, reducedRef, ref, paletteRef]);

  return { ref, pulseCount };
}

const ARC_MIN = 90;
const ARC_MAX = 190;

function hsl(h: number, s: number, l: number, a = 1): string {
  const hue = ((h % 360) + 360) % 360;
  return a === 1
    ? `hsl(${hue.toFixed(1)} ${s}% ${l}%)`
    : `hsl(${hue.toFixed(1)} ${s}% ${l}% / ${a})`;
}

export function rollPalette(el: HTMLElement) {
  const anchor = Math.random() * 360;

  const arc = (ARC_MIN + Math.random() * (ARC_MAX - ARC_MIN)) *
    (Math.random() < 0.5 ? -1 : 1);
  const at = (t: number) => anchor + arc * t;

  const s = el.style;

  s.setProperty("--ai-c1", hsl(at(0), 96, 48));

  s.setProperty("--ai-c2", hsl(at(0.18), 52, 80));
  s.setProperty("--ai-c3", hsl(at(0.4), 98, 55));
  s.setProperty("--ai-c4", hsl(at(0.66), 96, 52));
  s.setProperty("--ai-c5", hsl(at(0.88), 94, 50));

  s.setProperty("--ai-c6", hsl(at(1), 90, 72, 0.8));

  s.setProperty("--ai-tail", hsl(at(-0.12), 70, 76, 0.63));

  s.setProperty("--ai-bg1", hsl(at(0), 62, 97));
  s.setProperty("--ai-bg2", hsl(at(0.5), 54, 95));
  s.setProperty("--ai-bg3", hsl(at(1), 58, 93));
}

```

### ai-lights/RimGlow.tsx
```ts
"use client";

import type { Layer } from "./use-ai-lights";

export function RimGlow({ layers }: { layers: Layer[] }) {
  return (
    <>
      {layers.map((l, i) =>
        [0, 1].map((side) => (
          <span
            key={`${i}-${side}`}
            aria-hidden="true"
            className="ai-lights-layer"
            style={{
              inset: `${-l.pad}px`,

              maskImage: `url(${l.mask})`,
              transform: side ? "scaleX(-1)" : undefined,
            }}
          />
        )),
      )}
    </>
  );
}

```

### ai-lights/variants.tsx
```ts
"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "./use-ai-lights";

const STAGGER_MS = 20;
const CHAR_MS = 300;

export function RisingText({
  text,
  className = "",
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const { reduced } = useReducedMotion();
  return (

    <span className={`block leading-none whitespace-nowrap ${className}`}>
      {Array.from(text).map((ch, i) => (
        <span
          key={i}
          className={
            reduced
              ? "inline-block align-middle animate-[ai-char-fade_var(--d)_ease_both]"
              : "inline-block align-middle animate-[ai-char_var(--d)_cubic-bezier(0.66,0,0.34,1)_both]"
          }
          style={
            {
              "--d": `${CHAR_MS}ms`,
              animationDelay: reduced ? `${delay}ms` : `${delay + i * STAGGER_MS}ms`,

              width: ch === " " ? "0.28em" : undefined,
            } as React.CSSProperties
          }
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

export interface Variant {
  key: string;

  radius: number | "pill";

  pad: string;
  Content: () => React.ReactElement;
}

const BOX = "px-5 py-3.5";
const BOX_CONTROL = "py-2.5 pr-2.5 pl-5";

function Trail({
  children,
  delay = 140,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <span
      className="shrink-0 animate-[ai-char-fade_300ms_ease_both] text-[13px] leading-none tabular-nums text-[var(--s-text-subtle)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </span>
  );
}

/** One row: body left, trail right, centred against each other. */
function Row({
  children,
  trail,
}: {
  children: React.ReactNode;
  trail?: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="min-w-0 flex-1">{children}</span>
      {trail}
    </span>
  );
}

/* -- 1. Workflow chain ----------------------------------------------------
   Three steps, the middle one running.

   Two earlier attempts failed in opposite directions. The first was a header,
   a divider, a label/value row and a tinted `ready` badge — the shape of every
   dashboard card ever drawn. Stripping all that left a name over a subtitle,
   which is not minimal so much as EMPTY: nothing was being said that the other
   three variants were not already saying better.

   The idea here is the one thing a workflow node genuinely has and no other
   variant does: SEQUENCE. Three dots joined by a hairline, the passed ones
   filled, the live one ringed and pulsing, the pending one hollow. The labels
   sit under the track so the eye reads the shape first and the words second.
   It is still two type sizes and one ink ramp — the interest comes from the
   structure, not from adding colour back. */

/** One node on the track. `state` drives the fill; nothing else differs. */
function Step({
  label,
  state,
  delay,
}: {
  label: string;
  state: "done" | "live" | "next";
  delay: number;
}) {
  return (
    <span className="flex flex-1 flex-col items-center gap-2">
      <span
        className="relative grid size-3.5 shrink-0 animate-[ai-char-fade_300ms_ease_both] place-items-center"
        style={{ animationDelay: `${delay}ms` }}
      >
        {/* Three states, three weights of the same ink — no accent colour, and
            no two states relying on the same fill. `done` is muted because it is
            finished and no longer needs attention; `live` is full-strength;
            `next` is an outline, present but not yet real. */}
        <span
          className={
            state === "done"
              ? "size-3 rounded-[4px] bg-[var(--s-text-subtle)]"
              : state === "live"
                ? "size-3 rounded-[4px] bg-[var(--s-text-primary)]"
                : "size-3 rounded-[4px] border border-[var(--s-border-1)] bg-[var(--s-surface-2)]"
          }
        />
        {}
        {state === "live" ? (
          <span className="absolute inset-[-3px] animate-[ai-ring_1.8s_ease-out_infinite] rounded-[6px] border border-[var(--s-text-primary)]" />
        ) : null}
      </span>
      {}
      <span
        className="animate-[ai-char-fade_300ms_ease_both] text-[14px] leading-none"
        style={{
          animationDelay: `${delay + 60}ms`,
          color:
            state === "next"
              ? "var(--s-text-subtle)"
              : "var(--s-text-body)",
        }}
      >
        {label}
      </span>
    </span>
  );
}

function BlockContent() {
  const steps: { label: string; state: "done" | "live" | "next" }[] = [
    { label: "Fetch", state: "done" },
    { label: "Parse", state: "live" },
    { label: "Write", state: "next" },
  ];
  return (
    <span className="block w-[268px]">
      <span className="relative flex items-start">
        {}
        {}
        <span
          className="absolute top-[7px] right-[16.667%] left-[16.667%] h-px animate-[ai-char-fade_300ms_ease_both] bg-[var(--s-border-1)]"
          style={{ animationDelay: "60ms" }}
        />
        {steps.map((st, i) => (
          <Step key={st.label} {...st} delay={100 + i * 70} />
        ))}
      </span>
    </span>
  );
}

function ProgressContent() {
  return (
    <span className="block w-[246px]">
      <Row
        trail={
          <span className="flex items-center gap-1.5">
            <Trail delay={120}>45%</Trail>
            <svg
              viewBox="0 0 16 16"
              className="size-3.5 shrink-0"
              aria-hidden="true"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                className="fill-none stroke-[var(--s-border-1)]"
                strokeWidth="2"
              />
              <path
                d="M8 2A6 6 0 0 1 14 8"
                className="animate-[ai-spin_900ms_linear_infinite] fill-none stroke-[var(--s-text-body)]"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transformOrigin: "8px 8px" }}
              />
            </svg>
          </span>
        }
      >
        <RisingText
          text="Indexing"
          className="text-[16px] leading-none text-[var(--s-text-body)]"
        />
      </Row>
    </span>
  );
}

/* -- 3. Terminal ----------------------------------------------------------
   The only variant that INVERTS, and the biggest jump in the rotation: a change
   of polarity lands harder than any change of proportion.

   The `$` stays — in a terminal it is not decoration, it is what tells you the
   line is a command rather than output. */

function TerminalContent() {
  return (
    <span className="block w-[242px] space-y-2 font-mono">
      <span className="block text-[14px] leading-none text-[#8c8c8c]">
        <span className="text-[#5f5f5f]">$</span> deploy
      </span>
      <RisingText
        text="published"
        className="block text-[14px] leading-none text-[#d6d6d6]"
        delay={60}
      />
    </span>
  );
}

/* -- 4. Prompt bar --------------------------------------------------------
   Intent in, action out. The send button sits in the trail slot, and the box
   uses the trimmed padding so the button's own bulk does not read as a wider
   right margin than the text has on the left. */

function WandContent() {
  return (
    <span className="block w-[282px]">
      <Row
        trail={
          <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[var(--s-text-primary)]">
            <svg
              viewBox="0 0 12 12"
              className="size-4 fill-none stroke-[var(--s-text-inverse)]"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9.5V2.5M6 2.5 3 5.5M6 2.5 9 5.5" />
            </svg>
          </span>
        }
      >
        <RisingText
          text="build me a scraper"
          className="text-[16px] leading-none text-[var(--s-text-muted)]"
        />
      </Row>
    </span>
  );
}

/** The rotation. Ordered so the body never makes the same kind of move twice
 *  running: a tall node, a short row, the dark panel, then a bar. */
export const VARIANTS: Variant[] = [
  { key: "block", radius: 16, pad: BOX, Content: BlockContent },
  { key: "progress", radius: 15, pad: BOX, Content: ProgressContent },
  { key: "terminal", radius: 16, pad: BOX, Content: TerminalContent },
  { key: "wand", radius: 18, pad: BOX_CONTROL, Content: WandContent },
];

/** Variants whose face INVERTS — a dark panel on a light page. The body reads
 *  this to pick its face colour, so the terminal is the one shape that flips. */
export const DARK_KEYS = new Set(["terminal"]);

/** Resolve a variant's radius against the box it will occupy. */
export function radiusFor(v: Variant, height: number): number {
  return v.radius === "pill" ? height / 2 : v.radius;
}

export function useVariantSizes(): {
  sizes: { w: number; h: number }[] | null;
  probe: React.ReactElement;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<{ w: number; h: number }[] | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const measure = () => {
      const boxes = Array.from(
        host.querySelectorAll<HTMLElement>("[data-probe]"),
      ).map((el) => {
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      });
      if (boxes.length === VARIANTS.length && boxes.every((b) => b.w && b.h)) {
        setSizes(boxes);
      }
    };
    measure();

    document.fonts?.ready.then(measure).catch(() => {});
  }, []);

  const probe = (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none invisible absolute top-0 left-0 -z-10"
    >
      {}
      {VARIANTS.map((v) => (
        <div key={v.key} data-probe className={`inline-block ${v.pad}`}>
          <v.Content />
        </div>
      ))}
    </div>
  );

  return { sizes, probe };
}

```

### ai-lights/AiLightsCard.tsx
```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DARK_KEYS, VARIANTS, radiusFor, useVariantSizes } from "./variants";
import { RimGlow } from "./RimGlow";
import { Surface } from "./Surface";
import { useAiPulse, useRimMask } from "./use-ai-lights";

const PULSE_MS = 1600;

const FADE_OUT_MS = 160;

const MORPH_MS = 380;

const HANDOVER_AT = PULSE_MS + 120;

const SETTLED_MS = 260;

const GAP_MS =
  HANDOVER_AT - PULSE_MS + FADE_OUT_MS + MORPH_MS + 80 + SETTLED_MS;

export function AiLightsCard({ bare = false }: { bare?: boolean } = {}) {
  void bare;

  const bodyRef = useRef<HTMLDivElement>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const { sizes, probe } = useVariantSizes();

  const [slot, setSlot] = useState(0);
  const slotRef = useRef(0);

  const [showing, setShowing] = useState(true);

  const [morphing, setMorphing] = useState(false);

  const [gen, setGen] = useState(0);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  const after = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const variant = VARIANTS[slot];
  const size = sizes?.[slot];

  const radius = size ? radiusFor(variant, size.h + 2) : 0;

  const layers = useRimMask(bodyRef, 90, undefined, radius);

  useAiPulse({
    pulseMs: PULSE_MS,
    gapMs: GAP_MS,
    onPulse: useCallback(() => {

      clearTimers();
      after(HANDOVER_AT, () => {

        setShowing(false);

        after(FADE_OUT_MS, () => {

          bodyRef.current?.removeAttribute("data-playing");
          setMorphing(true);
          slotRef.current = (slotRef.current + 1) % VARIANTS.length;
          setSlot(slotRef.current);
          after(MORPH_MS, () => {
            setMorphing(false);
            setGen((g) => g + 1);
            setShowing(true);
          });
        });
      });
    }, []),
    ref: bodyRef,
    paletteRef: cardRef,
  });

  useEffect(() => clearTimers, []);

  return (
    <div
      data-canvas-card

      aria-hidden="true"
      ref={cardRef}

      className="relative flex aspect-[1344/620] w-full select-none items-center justify-center overflow-hidden rounded-[12px] border border-[var(--border-line)] transition-[--ai-bg1,--ai-bg2,--ai-bg3] duration-[1200ms] ease-[var(--ease-out)] bg-[linear-gradient(180deg,var(--ai-bg1,#f7f9fc)_0%,var(--ai-bg2,#eef4fb)_55%,var(--ai-bg3,#e6f0fa)_100%)]"
    >
      {}
      {probe}

      {}
      <div
        ref={bodyRef}
        data-morphing={morphing ? "true" : undefined}

        className="ai-lights relative rounded-[var(--r)] p-px shadow-[0_1px_2px_rgba(12,38,77,0.06),0_8px_24px_rgba(12,38,77,0.08)] transition-[width,height,border-radius] duration-[var(--m)] ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={
          {
            width: size ? `${size.w + 2}px` : undefined,
            height: size ? `${size.h + 2}px` : undefined,
            "--r": `${radius}px`,
            "--m": `${MORPH_MS}ms`,
          } as React.CSSProperties
        }
      >
        <RimGlow layers={layers} />

        {}
        {}
        <div

          className="relative h-full w-full overflow-hidden rounded-[calc(var(--r)-1px)] transition-colors duration-[var(--m)] ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{
            backgroundColor: DARK_KEYS.has(variant.key)
              ? "#1e1e1e"
              : "var(--s-surface-2)",
          }}
        >
          {}
          <Surface dark={DARK_KEYS.has(variant.key)} />

          <div
            key={gen}

            className={`relative h-full w-full ${variant.pad} transition-opacity duration-[var(--f)] ease-[var(--ease-out)]`}
            style={
              {
                opacity: showing ? 1 : 0,
                contentVisibility: morphing ? "hidden" : undefined,
                "--f": `${FADE_OUT_MS}ms`,
              } as React.CSSProperties
            }
          >
            {}
            <variant.Content />
          </div>
        </div>
      </div>
    </div>
  );
}

```