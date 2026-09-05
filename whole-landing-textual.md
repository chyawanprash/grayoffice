Build this: a plain white card that drops a TRAIL of tiny, compressed monospace badges behind the cursor as it moves. Each badge is a small die-cut box in a different vivid colour (lime, hot pink, cyan, orange, violet, yellow…) with BLACK text of a typography/design term inside (kerning, baseline, bezier, gamut…). Very compact: ~11px mono text, 1px vertical / 4px horizontal padding, small radius, no border. The trail SPAWNS on the raw pointer path — a new badge drops at the cursor at most every ~90ms AND only after the cursor has travelled a min distance, so a still cursor can't stack badges in place. Each badge fades + scales in (~140ms), holds (~620ms), then fades out (~260ms) and is removed. HARD NON-OVERLAP: before spawning, AABB-test the candidate rect (inflated by a small gap) against every live badge and SKIP the drop if it would collide — density self-limits near clusters, badges never touch. Words are drawn from a shuffled bag (no back-to-back repeats) and colours step through the palette so neighbours differ. DOM badges (not canvas) for crisp text at any DPR and trivial CSS transitions; a rAF loop publishes the live set each frame. Pauses offscreen / when the tab is hidden. Pointer-fine only — touch and reduced-motion show a few static example badges instead of the trail. Light mode, no title row, no detail page.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### badge-trail/badges.ts
```ts
export const WORDS = [
  "kerning",
  "baseline",
  "leading",
  "tracking",
  "x-height",
  "ligature",
  "serif",
  "grotesk",
  "bezier",
  "raster",
  "vector",
  "stroke",
  "gamut",
  "bleed",
  "weight",
  "grid",
  "hue",
  "counter",
  "ascender",
  "hinting",
  "widow",
  "orphan",
  "gutter",
  "opacity",
];

export const COLORS = [
  "#c6ff3d",
  "#ff3d81",
  "#38e0ff",
  "#ff8a3d",
  "#b56bff",
  "#ffe234",
  "#ff5c5c",
  "#3dffb0",
  "#4d8dff",
  "#ff5cf0",
];

const HUE_STEP = 24;

function hslHex(h: number, s = 0.85, l = 0.62): string {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const hex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function makeHueWalker(seedHue: number) {
  let h = seedHue;
  return (intensity = 1) => {
    h += HUE_STEP;
    const t = Math.max(0, Math.min(1, intensity));
    const s = 0.32 + 0.53 * t;
    const l = 0.78 - 0.16 * t;
    return hslHex(h, s, l);
  };
}

```

### badge-trail/BadgeTrailCard.tsx
```ts
"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { WORDS, COLORS, makeHueWalker } from "./badges";
import { onTransitionChange } from "../../lib/view-transition";

function useMedia(query: string, server: boolean): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => server,
  );
}

function useReducedMotion(): boolean {
  return useMedia("(prefers-reduced-motion: reduce)", false);
}

function useFinePointer(): boolean {

  return useMedia("(hover: hover) and (pointer: fine)", true);
}

const FONT_PX = 11;
const CHAR_W = 6.6;
const PAD_X = 4;
const PAD_Y = 1;
const RADIUS = 3;
const GAP = 3;

const DROP_MS = 45;
const MIN_TRAVEL = 14;
const APPEAR_MS = 110;
const HOLD_MS = 480;
const FADE_MS = 240;
const LIFE_MS = APPEAR_MS + HOLD_MS + FADE_MS;
const MAX_LIVE = 22;

const SLAM_OFFSET = 5;
const SLAM_OVERSHOOT = 1.03;

const IDLE_WOBBLE = 0.35;
const IDLE_BREATH = 0.01;

const SPECIAL_EVERY = 15;

const SCRAMBLE_MS = 130;
const SCRAMBLE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#*";

const SPEED_FULL = 40;
const INTENSITY_FLOOR = 0.35;

const REPEL_PX = 3;
const REPEL_RANGE = 64;
const REPEL_CHASE = 0.16;
const REPEL_DECAY = 0.05;

const GHOST_IDLE_MS = 600;

const GHOST_FX = 0.00156;
const GHOST_FX2 = 0.00465;
const GHOST_AX = 0.3;
const GHOST_AX2 = 0.11;
const GHOST_FY = 0.00219;
const GHOST_FY2 = 0.0063;
const GHOST_AY = 0.3;
const GHOST_AY2 = 0.12;
const GHOST_BLEND_MS = 420;

type Badge = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  color: string;
  born: number;

  dirX: number;
  dirY: number;

  exitRot: number;

  seed: number;

  depth: number;

  special: boolean;

  scram: string;

  offX: number;
  offY: number;
  tgtX: number;
  tgtY: number;
};

const badgeH = FONT_PX + PAD_Y * 2;
const badgeW = (text: string) => Math.round(text.length * CHAR_W) + PAD_X * 2;

function hits(x: number, y: number, w: number, h: number, b: Badge): boolean {
  return (
    x < b.x + b.w + GAP &&
    x + w + GAP > b.x &&
    y < b.y + b.h + GAP &&
    y + h + GAP > b.y
  );
}

function shuffled(n: number, rnd: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function BadgeTrailCard({ bare = false }: { bare?: boolean } = {}) {
  void bare;
  const hostRef = useRef<HTMLDivElement>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const reduced = useReducedMotion();
  const fine = useFinePointer();

  useEffect(() => {
    const host = hostRef.current;
    if (!host || reduced) return;

    const rnd = Math.random;

    let onScreen = false;
    let hidden = false;
    let inTransition = false;
    let raf = 0;
    let seq = 0;
    const live: Badge[] = [];

    let rpx = -1;
    let rpy = -1;
    let px = -1;
    let py = -1;
    let lastDropT = 0;
    let lastDropX = 0;
    let lastDropY = 0;
    let haveLast = false;

    let leftAt = -Infinity;
    let blendFromX = 0;
    let blendFromY = 0;

    let bag: number[] = [];
    const nextWord = () => {
      if (bag.length === 0) bag = shuffled(WORDS.length, rnd);
      return WORDS[bag.pop()!];
    };

    const nextColor = makeHueWalker(rnd() * 360);

    let prevPx = -1;
    let prevPy = -1;
    let dropCount = 0;

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      rpx = e.clientX - r.left;
      rpy = e.clientY - r.top;
    };

    const onDown = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      rpx = e.clientX - r.left;
      rpy = e.clientY - r.top;
      if (e.pointerType === "touch") e.preventDefault();
    };
    const onLeave = () => {

      if (px >= 0) {
        blendFromX = px;
        blendFromY = py;
      }
      rpx = -1;
      rpy = -1;
      leftAt = performance.now();
    };

    const ghostPoint = (t: number, w: number, h: number): [number, number] => {
      const gx =
        w * 0.5 +
        (Math.sin(t * GHOST_FX) * GHOST_AX + Math.sin(t * GHOST_FX2 + 2.3) * GHOST_AX2) * w;
      const gy =
        h * 0.5 +
        (Math.sin(t * GHOST_FY + 1.7) * GHOST_AY + Math.cos(t * GHOST_FY2 + 0.6) * GHOST_AY2) * h;
      return [gx, gy];
    };

    let lastNow = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (!onScreen || hidden || inTransition) return;

      const dtFrames = lastNow ? Math.min(4, (now - lastNow) / 16.6667) : 1;
      lastNow = now;

      const r = host.getBoundingClientRect();
      if (rpx >= 0) {

        px = rpx;
        py = rpy;
      } else if (now - leftAt >= GHOST_IDLE_MS) {

        const [gx, gy] = ghostPoint(now, r.width, r.height);
        const k = Math.min(1, (now - leftAt - GHOST_IDLE_MS) / GHOST_BLEND_MS);
        if (isFinite(leftAt) && k < 1) {
          px = blendFromX + (gx - blendFromX) * k;
          py = blendFromY + (gy - blendFromY) * k;
        } else {
          px = gx;
          py = gy;
        }
      } else {

        px = -1;
        py = -1;
      }

      for (let i = live.length - 1; i >= 0; i--) {
        if (now - live[i].born >= LIFE_MS) live.splice(i, 1);
      }

      if (px >= 0 && live.length < MAX_LIVE) {
        const traveled = haveLast ? Math.hypot(px - lastDropX, py - lastDropY) : Infinity;
        if (now - lastDropT >= DROP_MS && traveled >= MIN_TRAVEL) {
          const text = nextWord();
          const w = badgeW(text);
          const h = badgeH;

          let x = px - w / 2;
          let y = py - h / 2;
          x = Math.max(0, Math.min(r.width - w, x));
          y = Math.max(0, Math.min(r.height - h, y));

          const collides = live.some((b) => hits(x, y, w, h, b));
          if (!collides) {

            let dx = prevPx >= 0 ? px - prevPx : 0;
            let dy = prevPy >= 0 ? py - prevPy : -1;
            const speed = Math.hypot(prevPx >= 0 ? px - prevPx : 0, prevPy >= 0 ? py - prevPy : 0);
            const dm = Math.hypot(dx, dy) || 1;
            dx /= dm;
            dy /= dm;

            const intensity =
              INTENSITY_FLOOR + (1 - INTENSITY_FLOOR) * Math.max(0, Math.min(1, speed / SPEED_FULL));
            const cxn = x + w / 2;
            const cyn = y + h / 2;

            for (const b of live) {
              const bx = b.x + b.w / 2;
              const by = b.y + b.h / 2;
              const vx = bx - cxn;
              const vy = by - cyn;
              const d = Math.hypot(vx, vy) || 1;
              if (d < REPEL_RANGE) {
                const push = REPEL_PX * (1 - d / REPEL_RANGE);
                b.tgtX += (vx / d) * push;
                b.tgtY += (vy / d) * push;
              }
            }
            live.push({
              id: seq++,
              x,
              y,
              w,
              h,
              text,
              color: nextColor(intensity),
              born: now,
              dirX: dx,
              dirY: dy,
              exitRot: (rnd() < 0.5 ? -1 : 1) * (4 + rnd() * 5),
              seed: rnd() * 1000,
              depth: 0,
              special: dropCount % SPECIAL_EVERY === SPECIAL_EVERY - 1,
              scram: text,
              offX: 0,
              offY: 0,
              tgtX: 0,
              tgtY: 0,
            });
            dropCount++;
            lastDropT = now;
            lastDropX = px;
            lastDropY = py;
            haveLast = true;
          }
        }
      }
      prevPx = px;
      prevPy = py;

      const n = live.length;
      const chaseK = 1 - Math.pow(1 - REPEL_CHASE, dtFrames);
      const decayK = 1 - Math.pow(1 - REPEL_DECAY, dtFrames);
      for (let i = 0; i < n; i++) {
        const b = live[i];

        b.depth = n > 1 ? 1 - i / (n - 1) : 0;

        b.offX += (b.tgtX - b.offX) * chaseK;
        b.offY += (b.tgtY - b.offY) * chaseK;
        b.tgtX *= 1 - decayK;
        b.tgtY *= 1 - decayK;

        const age = now - b.born;
        if (age < SCRAMBLE_MS && b.text.length > 1) {
          const prog = age / SCRAMBLE_MS;
          const locked = Math.floor(prog * b.text.length);
          let s = "";
          for (let c = 0; c < b.text.length; c++) {
            s +=
              c < locked
                ? b.text[c]
                : SCRAMBLE_CHARS[(Math.floor(rnd() * SCRAMBLE_CHARS.length))];
          }
          b.scram = s;
        } else {
          b.scram = b.text;
        }
      }

      setBadges(live.slice());
    };

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
      },
      { threshold: 0.15 },
    );
    io.observe(host);
    const onVis = () => {
      hidden = document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
    });

    const onMoveGuarded = (e: PointerEvent) => {
      onMove(e);
      if (e.pointerType === "touch") e.preventDefault();
    };
    host.addEventListener("pointermove", onMoveGuarded, { passive: false });
    host.addEventListener("pointerdown", onDown, { passive: false });
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerup", onLeave);
    host.addEventListener("pointercancel", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
      host.removeEventListener("pointermove", onMoveGuarded);
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerup", onLeave);
      host.removeEventListener("pointercancel", onLeave);
    };
  }, [reduced]);

  const STATIC: Array<{ text: string; color: string }> = [
    { text: "kerning", color: COLORS[0] },
    { text: "baseline", color: COLORS[2] },
    { text: "bezier", color: COLORS[4] },
    { text: "gamut", color: COLORS[6] },
  ];

  return (
    <div
      ref={hostRef}
      data-canvas-card
      aria-label="A white card that drops a trail of small coloured monospace badges of typography terms as you move the cursor over it. On touch, drag a finger across it to lay the trail."
      className="relative mx-auto aspect-[1344/620] w-full cursor-crosshair select-none overflow-hidden rounded-[12px] border border-[var(--border-line)] bg-white"
      style={{
        fontFamily: "var(--font-neue-mono)",

        ...(!fine && !reduced ? { touchAction: "none" as const } : null),
      }}
    >
      {reduced ? (
        <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-2 px-8">
          {STATIC.map((b, i) => (
            <span
              key={i}
              style={{
                fontFamily: "var(--font-neue-mono)",
                fontSize: FONT_PX,
                lineHeight: 1,
                padding: `${PAD_Y}px ${PAD_X}px`,
                borderRadius: RADIUS,
                background: b.color,
                color: "#000",
                textTransform: "uppercase",
              }}
            >
              {b.text}
            </span>
          ))}
        </div>
      ) : (
        (() => {
          const clock = performanceNowSafe();
          return (
            <>
              {badges.map((b) => {
                const m = badgeMotion(b, clock);

                const depthScale = 1 - b.depth * 0.06;
                const depthDim = 1 - b.depth * 0.12;
                return (
                  <span
                    key={b.id}
                    style={{
                      position: "absolute",
                      left: b.x,
                      top: b.y,
                      fontFamily: "var(--font-neue-mono)",
                      fontSize: FONT_PX,
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      padding: `${PAD_Y}px ${PAD_X}px`,
                      borderRadius: RADIUS,

                      background: b.special ? "transparent" : b.color,
                      boxShadow: b.special
                        ? `inset 0 0 0 1px ${b.color}`
                        : "0 1px 2px -1px rgba(20,20,30,0.35)",
                      color: b.special ? b.color : "#000",
                      textTransform: "uppercase",
                      opacity: m.opacity * depthDim,

                      transform: `translate(${m.dx + b.offX}px, ${m.dy + b.offY}px) scale(${m.scale * depthScale}) rotate(${m.rot}deg)`,
                      transformOrigin: "center",
                      pointerEvents: "none",
                      willChange: "opacity, transform",
                    }}
                  >
                    {b.scram}
                  </span>
                );
              })}
            </>
          );
        })()
      )}
    </div>
  );
}

// performance.now() guarded for the (impossible here, but cheap) case it's unavailable.
function performanceNowSafe(): number {
  return typeof performance !== "undefined" ? performance.now() : 0;
}

// Derive a badge's per-frame motion from its age + seed. Combines four layers:
//   #1 slam entrance   — enters offset back along cursor travel, springs to place (WEAK)
//   #2 flick exit      — collapses thinner + rotates as it dies (different verb from entrance)
//   #4 idle wobble     — sub-pixel positional wobble + scale breath while held
// Returns the composited dx/dy (px), scale, rotation (deg) and opacity.
function badgeMotion(
  b: Badge,
  clock: number,
): { dx: number; dy: number; scale: number; rot: number; opacity: number } {
  const age = clock - b.born;
  let opacity = 1;
  let scale = 1;
  let rot = 0;
  let dx = 0;
  let dy = 0;

  if (age < APPEAR_MS) {

    const t = age / APPEAR_MS;
    const spring = 1 - Math.pow(1 - t, 3);
    opacity = Math.min(1, t * 1.4);

    const base = 0.9 + 0.1 * spring;
    scale = base + (SLAM_OVERSHOOT - 1) * Math.sin(Math.PI * t);
    const back = (1 - spring) * SLAM_OFFSET;
    dx = -b.dirX * back;
    dy = -b.dirY * back;
  } else if (age > APPEAR_MS + HOLD_MS) {

    const t = Math.min(1, (age - APPEAR_MS - HOLD_MS) / FADE_MS);
    const e = t * t;
    opacity = 1 - t;
    scale = 1 - 0.2 * e;
    rot = b.exitRot * e;
  }

  if (age >= APPEAR_MS) {
    const idle = opacity;
    const p = clock * 0.004 + b.seed;
    dx += Math.sin(p) * IDLE_WOBBLE * idle;
    dy += Math.cos(p * 1.3 + 0.7) * IDLE_WOBBLE * idle;
    scale += Math.sin(p * 0.9) * IDLE_BREATH * idle;
  }

  return { dx, dy, scale, rot, opacity };
}

```