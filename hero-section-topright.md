Build this: a lattice of soft black blobs on a pale field that swells out of a flat grid into concentric rings, shears into a slow spiral, and settles back — where the whole picture is ONE SCALAR FIELD, thresholded, and every blob, merge, pinch and sliver falls out of that single evaluation with no per-blob state anywhere. THE FIELD IS A GRID OF GAUSSIAN SOURCES, SUMMED, and ink is wherever the sum clears a threshold. The blobs come out about 17% OUT OF ROUND, fattest on the axes and pinched on the diagonals, and that shape is not drawn: it is what neighbouring sources bleeding into each other produce, because the axis neighbours sit closer than the diagonal ones. Tune the kernel width and the shape arrives on its own. THE EXTENT IS NOT A MASK. The obvious model is a thresholded trig field, cos(x)+cos(y), and it fits a still frame beautifully — but that field is infinite, so it needs a radial envelope to stop, and no envelope can do the job: any falloff steep enough to kill the next shell also eats the corner blobs it has to leave alone. Use a FINITE SET OF SOURCES instead and the envelope disappears entirely, because the pattern stops where the sources stop. AND MAKE IT SEPARABLE. A gaussian sum over a rectangular grid factors exactly into (sum over columns) times (sum over rows), so an 11x7 grid costs 18 exp() calls per pixel instead of 77. The per-source weights have to factor the same way, which they do if a source's weight is its column weight times its row weight — and that also gives you the corners arriving after the edges for free, since their weight is a product of two partial ones. FADE SHELLS IN, DO NOT SWITCH THEM ON. Animate how many source shells are lit as a smooth radius in index space, with a smoothstep on each source's index, so an outer shell emerges as slivers and grows into full blobs rather than popping into being. That band between bare emergence and full blob IS the opening. THE PITCH NEVER CHANGES DURING A BLOOM. Nothing zooms. Everything on screen is one fixed lattice under a changing warp and a changing number of live sources — and keeping that invariant is what makes the piece read as a structure being disturbed rather than as a camera moving. RIPPLE BY DISPLACING r AS A FUNCTION OF r. This is the move that turns a square lattice into rings: adding a sine of r to r compresses the lattice into shells wherever the displacement's slope goes negative. The amplitude is NOT a free dial — folding begins at amplitude = wavelength/TAU, and the interesting behaviour lives in a narrow band just under and over that. Below it nothing happens and it reads as a wobble; far above it the field folds through itself repeatedly and turns to noise. FADE THE RIPPLE OUT BEFORE IT REACHES THE ORIGIN, and make the fade wider than the centre blob. At r = 0 the raw displacement is whatever the sine's phase happens to be, so r goes NEGATIVE and every point near the middle flips through the origin. Clamping r afterwards only trades that for a cusp. And a fade narrower than the centre blob starves it from the outside, so its surviving contour goes CONCAVE and prints a hard four-pointed star in the middle of an otherwise entirely soft picture. GIVE THE LATTICE MORE THAN ONE STRUCTURE. The trap this piece falls into is that every cycle becomes the same handful of warps at different amplitudes: same pitch, always rectangular, always concentric rings, always a radial shear. Louder or softer, never different. Fix it at the root by varying the SOURCE ARRANGEMENT — shift alternate rows sideways for a hexagonal packing, change the density — because the rosette a concentric ripple makes out of a hex lattice is not the rosette it makes out of a rectangular one, so the same warp machinery produces a genuinely different picture. A hex offset makes the x-term depend on the row and so breaks the exact separability the whole shader rests on; recover it by splitting rows into EVEN AND ODD FAMILIES, each a plain rectangular sub-lattice, separable on its own, and sum the two products. That is two axis sums per direction instead of one, and still beats a brute-force 2D sum by better than two to one. WHEN THE DENSITY CHANGES, COMPENSATE THE SHELL RADIUS. Shells are counted in index space, so the composition's physical extent is radius times pitch: changing the pitch alone rescales the whole picture, which is a zoom, not a change of density. Divide the radius by the same factor and the footprint holds while the blob count changes, which is the only thing you wanted. NEVER CHANGE THE STRUCTURE WHILE IT IS VISIBLE. A change of lattice moves every source at once — a different NUMBER of blobs now fills the same footprint — and there is no moment in the cycle where that is safe to do in view. It is tempting to swap at the cycle boundary on the theory that the field is at rest there, but the rest state is fully drawn, and if you have given the ripple a floor then even at rest the field is still warped. Cross-fading two lattices is worse: it doubles the shader cost for the duration and the midpoint is a superposition of two pitches, which reads as moire rather than as a lattice. Swap on RESUME instead — the card already pauses offscreen and on a hidden tab, so re-pick the structure when it starts again, where nobody saw the last frame. KEEP SOMETHING MOVING AT REST. The travelling ripple crest is the only continuous per-second motion, and gating it entirely on the cycle's energy means it disappears exactly when the piece is calmest, so the quarter of the loop nearest rest has nothing moving in it at all and the whole thing feels becalmed rather than patient. Give the ripple amplitude a floor — small enough that the displacement stays well under a blob radius, so the lattice still resolves as a clean grid that is quietly breathing. SKEW THE ENERGY CURVE. A raised cosine spends exactly as long arriving as leaving, and that symmetry is precisely what makes a bloom read as breathing rather than as an event: nothing about it has a direction. Raise the phase to a power below 1 before the cosine so the peak lands about a third of the way through, and the lattice snaps open then takes twice as long to settle. Check it stays continuous in value AND slope across the loop boundary. DRIVE EVERY AMPLITUDE FROM RATES THAT DO NOT DIVIDE THE CYCLE. The warp layers should each be modulated by a slow sine whose period is incommensurate with the bloom period and with the others', so the amplitudes stand in a different relationship every cycle and no two blooms resolve the same way. Round them to a common factor and the card plays one animation on a loop that a viewer catches inside a minute. MOVE THE WARP ORIGIN, NOT THE COMPOSITION. Let the point the ripple and shear work around walk a little way off the frame centre. Drifting the whole composition instead was the obvious version and is wrong for a card: it wanders out of its own frame and reads as broken rather than as moving. THE SHEAR IS A RATE, SO RE-SOLVE IT WHENEVER THE EXTENT CHANGES. An angular shear that grows with radius produces a shear angle that depends on how far the sources actually reach, so widening the grid silently multiplies it — the same constant that gave a pleasing half-turn at the old radius can shear the far corners through nearly a quarter turn at the new one, swinging the outer columns up and throwing ink off the edges. Solve for the ANGLE you want at the outermost source, not for the constant. LET THE POINTER BE A LENS AND A PUSH. The field is already a sum of gaussians, so the pointer joins it as one more gaussian rather than as a special case: a gaussian displacement that shoves the field away from the cursor, and a radial remap inside a disc that magnifies what is under it. Both reuse the vocabulary the ripple already speaks. Two traps. The push must be a DISPLACEMENT, never an added source — adding ink under the cursor puts a blob where the lattice says there is none and reads as a foreign object rather than as the lattice reacting. And the lens remap moves the SAMPLE POINT, not the image, so the sense is easy to get backwards: an exponent below 1 pushes samples outward and MINIFIES, above 1 pulls them inward and magnifies. Ease the remap out toward the rim so there is no seam where the disc ends. IF YOU BIAS THE RIPPLE ORIGIN TOWARD THE POINTER, BIAS IT ONLY A LITTLE. On a wide card the cursor ranges much further from centre than the pattern's own half-width, so a strong bias puts the ripple origin entirely outside the lattice and the shear then bends the whole field around a point in empty space — the grid stops being a grid and bends into an S. Keep the origin inside the pattern. EDGES ARE ANALYTIC. Cross the threshold through a smoothstep whose width comes from fwidth() of the field itself, so the edge is one pixel at any DPR and under any warp. Supersampling costs four times the field evaluations to land somewhere slightly softer than the derivative gets for free. Where the derivatives extension is missing, fall back to an analytic width estimate; on a soft black shape it is invisibly different. KEEP THE PATTERN OFF THE EDGES. Ink touching the frame on a soft, obviously-finite pattern reads as a clipping bug rather than as a bleed. Fit the composition by the OPEN state, not the rest state, and re-check it whenever the grid extent or the shear changes. Two flat colours, no gradient and no texture: the piece is a structure, and shading it would be describing it twice.

The complete, self-contained implementation follows, one file per block. It is framework-agnostic core logic — wire it into your own component and mount it on an element.

### ripple-grid/params.ts
```ts
export const PITCH = 0.18;

export const VIEW_SCALE = 1.55;

export const SIGMA_K = 0.3;

export const THRESHOLD = 0.57;

export const GRID_NX = 5;
export const GRID_NY = 3;

export const RX_REST = 3.25;
export const RX_OPEN = 4.6;
export const RY_REST = 1.5;
export const RY_OPEN = 2.12;

export const SHELL_SOFT = 0.5;

export const RIPPLE_LEN = 0.233;
export const RIPPLE_MAX = 0.042;

export const RIPPLE_SPEED = 2.5;

export const RIPPLE_FLOOR = 0.12;

export const TWIRL_MAX = 0.88;

export const DRIFT_MAX = 0.06;

export const WOBBLE = 0.006;

export const BLOOM_SEC = 8;

export const MODE_OFFSETS = [0, 0.5, 0.25] as const;

export const MODE_PITCH = [1.0, 0.88, 1.14] as const;

export const BLOOM_SKEW = 0.65;

export const RATE_RIPPLE = 0.31;
export const RATE_TWIRL = 0.19;
export const RATE_DRIFT_X = 0.13;
export const RATE_DRIFT_Y = 0.107;
export const RATE_WOBBLE = 0.23;

export const CURSOR_PUSH = 0.045;

export const CURSOR_RADIUS = 0.34;

export const LENS_RADIUS = 0.36;
export const LENS_POWER = 1.7;

export const CURSOR_EASE = 0.19;

export const CURSOR_RIPPLE_BIAS = 0.2;

export const INK = "#1b1b1b";
export const PAPER = "#fcfcfc";

export const DPR_CAP = 1.5;

export function rgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

export interface Frame {
  ripple: number;
  twirl: number;
  driftX: number;
  driftY: number;
  wobble: number;
  rx: number;
  ry: number;
  ripplePhase: number;
}

export function frameAt(t: number): Frame {

  const u = Math.pow(((t % BLOOM_SEC) + BLOOM_SEC) % BLOOM_SEC / BLOOM_SEC, BLOOM_SKEW);
  const energy = 0.5 - 0.5 * Math.cos(2 * Math.PI * u);

  const e = Math.pow(energy, 1.1);
  return {

    ripple:
      RIPPLE_MAX *
      (RIPPLE_FLOOR + (1 - RIPPLE_FLOOR) * e) *
      (0.65 + 0.35 * Math.sin(t * RATE_RIPPLE)),
    twirl: TWIRL_MAX * e * Math.sin(t * RATE_TWIRL),
    driftX: DRIFT_MAX * e * Math.sin(t * RATE_DRIFT_X),
    driftY: DRIFT_MAX * e * Math.sin(t * RATE_DRIFT_Y),

    wobble: WOBBLE * (0.35 + 0.65 * e * (0.6 + 0.4 * Math.sin(t * RATE_WOBBLE))),
    rx: RX_REST + (RX_OPEN - RX_REST) * energy,
    ry: RY_REST + (RY_OPEN - RY_REST) * energy,
    ripplePhase: t * RIPPLE_SPEED,
  };
}

```

### ripple-grid/engine.ts
```ts
import {
  CURSOR_EASE,
  CURSOR_PUSH,
  CURSOR_RADIUS,
  CURSOR_RIPPLE_BIAS,
  DPR_CAP,
  LENS_POWER,
  LENS_RADIUS,
  MODE_OFFSETS,
  MODE_PITCH,
  GRID_NX,
  GRID_NY,
  INK,
  PAPER,
  PITCH,
  RIPPLE_LEN,
  SHELL_SOFT,
  SIGMA_K,
  THRESHOLD,
  VIEW_SCALE,
  frameAt,
  rgb,
} from "./params";

const VERT = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const frag = (nx: number, ny: number) => `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uPitch;
uniform float uViewScale;
uniform float uSigma;
uniform float uThreshold;
uniform float uRx;
uniform float uRy;
uniform float uShellSoft;
uniform float uRipple;
uniform float uRippleLen;
uniform float uRipplePhase;
uniform float uTwirl;
uniform vec2  uDrift;
uniform float uWobble;
uniform vec2  uCursor;
uniform float uCursorAmt;
uniform float uCursorPush;
uniform float uCursorRadius;
uniform float uRippleBias;
uniform float uRowOffset;
uniform float uLens;
uniform float uLensRadius;
uniform float uLensPower;
uniform vec3  uInk;
uniform vec3  uPaper;

#define TAU 6.28318530718
#define NX ${nx}
#define NY ${ny}

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),                  hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float axisWeight(float fk, float radius){
  return 1.0 - smoothstep(radius - uShellSoft, radius + uShellSoft, abs(fk));
}

float axisSumX(float u, float radius){
  float s = 0.0;
  for (int k = -NX; k <= NX; k++) {
    float fk = float(k);
    float d = u - fk * uPitch;
    s += axisWeight(fk, radius) * exp(-(d * d) / (2.0 * uSigma * uSigma));
  }
  return s;
}

float axisSumYParity(float u, float radius, float want){
  float s = 0.0;
  for (int k = -NY; k <= NY; k++) {
    float fk = float(k);

    float parity = abs(fk - 2.0 * floor(fk * 0.5));
    if (abs(parity - want) > 0.5) continue;
    float d = u - fk * uPitch;
    s += axisWeight(fk, radius) * exp(-(d * d) / (2.0 * uSigma * uSigma));
  }
  return s;
}

vec2 warp(vec2 p){
  p -= uDrift;

  vec2 origin = uCursor * (uRippleBias * uCursorAmt);

  float r = length(p - origin);
  float a = atan(p.y - origin.y, p.x - origin.x);

  a += uTwirl * r;

  r += uRipple * sin(TAU * r / uRippleLen - uRipplePhase)
             * smoothstep(0.0, 0.1, r);
  r = max(r, 0.0);

  p = origin + vec2(cos(a), sin(a)) * r;

  vec2 toL = p - uCursor;
  float dL = length(toL);
  if (dL < uLensRadius && uLens > 0.001) {
    float x = dL / uLensRadius;

    float mapped = pow(max(x, 1e-4), uLensPower);

    float rim = 1.0 - smoothstep(0.7, 1.0, x);
    float nr = mix(x, mapped, uLens * rim) * uLensRadius;
    p = uCursor + (toL / (dL + 1e-4)) * nr;
  }

  vec2 toC = p - uCursor;
  float dC = length(toC);

  float bump = exp(-(dC * dC) / (2.0 * uCursorRadius * uCursorRadius));

  p += (toC / (dC + 1e-4)) * bump * uCursorPush * uCursorAmt;

  p += uWobble * vec2(vnoise(p * 7.0 + uTime * 0.05) - 0.5,
                      vnoise(p * 7.0 + 31.7 - uTime * 0.04) - 0.5);

  return p;
}

float field(vec2 P){
  vec2 q = warp(P);

  float even = axisSumX(q.x, uRx) * axisSumYParity(q.y, uRy, 0.0);
  float odd  = axisSumX(q.x - uRowOffset * uPitch, uRx)
             * axisSumYParity(q.y, uRy, 1.0);
  return even + odd - uThreshold;
}

void main(){

  vec2 P = uViewScale * (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  float f = field(P);

  #ifdef HAS_FWIDTH
    float w = fwidth(f) * 0.75;
  #else

    float w = 1.6 / (uSigma * uRes.y);
  #endif
  w = max(w, 1e-5);

  float ink = smoothstep(-w, w, f);
  gl_FragColor = vec4(mix(uPaper, uInk, ink), 1.0);
}
`;

type U = Record<string, WebGLUniformLocation | null>;

export class RippleGrid {
  readonly ok: boolean;

  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private prog: WebGLProgram | null = null;
  private quad: WebGLBuffer | null = null;
  private u: U = {};

  private raf = 0;
  private running = false;
  private destroyed = false;

  private clock = 0;
  private last = 0;

  private curX = 0;
  private curY = 0;
  private curTX = 0;
  private curTY = 0;
  private curAmt = 0;
  private curTAmt = 0;

  private mode = 0;

  private modePitch = 1;

  private started = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    }) as WebGLRenderingContext | null;
    this.gl = gl;
    this.ok = !!gl && this.build();
    if (this.ok) {
      this.resize();
      this.renderStill();
    }
  }

  private compile(type: number, src: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private build(): boolean {
    const gl = this.gl;
    if (!gl) return false;

    const hasDeriv = !!gl.getExtension("OES_standard_derivatives");
    const src =
      (hasDeriv
        ? "#extension GL_OES_standard_derivatives : enable\n#define HAS_FWIDTH 1\n"
        : "") + frag(GRID_NX, GRID_NY);

    const vs = this.compile(gl.VERTEX_SHADER, VERT);
    const fs = this.compile(gl.FRAGMENT_SHADER, src);
    if (!vs || !fs) return false;

    const prog = gl.createProgram();
    if (!prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog);
      return false;
    }
    this.prog = prog;
    gl.useProgram(prog);

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    for (const n of [
      "uRes", "uTime", "uPitch", "uViewScale", "uSigma", "uThreshold", "uRx", "uRy",
      "uShellSoft", "uRipple", "uRippleLen", "uRipplePhase", "uTwirl",
      "uDrift", "uWobble", "uInk", "uPaper",
      "uCursor", "uCursorAmt", "uCursorPush", "uCursorRadius", "uRippleBias",
      "uRowOffset", "uLens", "uLensRadius", "uLensPower",
    ]) {
      this.u[n] = gl.getUniformLocation(prog, n);
    }

    gl.uniform1f(this.u.uPitch, PITCH);
    gl.uniform1f(this.u.uViewScale, VIEW_SCALE);
    gl.uniform1f(this.u.uSigma, SIGMA_K * PITCH);
    gl.uniform1f(this.u.uThreshold, THRESHOLD);
    gl.uniform1f(this.u.uShellSoft, SHELL_SOFT);
    gl.uniform1f(this.u.uRippleLen, RIPPLE_LEN);
    gl.uniform3fv(this.u.uInk, rgb(INK));
    gl.uniform3fv(this.u.uPaper, rgb(PAPER));
    gl.uniform1f(this.u.uCursorPush, CURSOR_PUSH);
    gl.uniform1f(this.u.uCursorRadius, CURSOR_RADIUS);
    gl.uniform1f(this.u.uRippleBias, CURSOR_RIPPLE_BIAS);
    gl.uniform1f(this.u.uLensRadius, LENS_RADIUS);
    gl.uniform1f(this.u.uLensPower, LENS_POWER);

    this.mode = -1;
    this.pickMode();
    return true;
  }

  private pickMode() {
    const gl = this.gl;
    if (!gl || !this.prog || this.destroyed) return;
    gl.useProgram(this.prog);
    let next = this.mode;
    while (next === this.mode && MODE_OFFSETS.length > 1) {
      next = Math.floor(Math.random() * MODE_OFFSETS.length);
    }
    this.mode = next;
    const mp = MODE_PITCH[this.mode];
    this.modePitch = mp;
    gl.uniform1f(this.u.uRowOffset, MODE_OFFSETS[this.mode]);
    gl.uniform1f(this.u.uPitch, PITCH * mp);
    gl.uniform1f(this.u.uSigma, SIGMA_K * PITCH * mp);
  }

  setPointer(x: number, y: number) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return;
    this.curTX = (VIEW_SCALE * (x - 0.5) * w) / h;

    this.curTY = VIEW_SCALE * (0.5 - y);
    this.curTAmt = 1;
  }

  clearPointer() {
    this.curTAmt = 0;
  }

  resize() {
    const gl = this.gl;
    if (!gl || this.destroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    gl.viewport(0, 0, w, h);
    if (!this.running) this.draw(this.clock);
  }

  private draw(t: number) {
    const gl = this.gl;
    if (!gl || !this.prog || this.destroyed) return;
    const f = frameAt(t);

    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uTime, t);
    gl.uniform1f(this.u.uRx, f.rx / this.modePitch);
    gl.uniform1f(this.u.uRy, f.ry / this.modePitch);
    gl.uniform1f(this.u.uRipple, f.ripple);
    gl.uniform1f(this.u.uRipplePhase, f.ripplePhase);
    gl.uniform1f(this.u.uTwirl, f.twirl);
    gl.uniform2f(this.u.uDrift, f.driftX, f.driftY);
    gl.uniform1f(this.u.uWobble, f.wobble);
    gl.uniform2f(this.u.uCursor, this.curX, this.curY);
    gl.uniform1f(this.u.uCursorAmt, this.curAmt);
    gl.uniform1f(this.u.uLens, this.curAmt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  start() {
    if (this.running || !this.ok || this.destroyed) return;

    if (this.started) this.pickMode();
    this.started = true;
    this.running = true;
    this.last = performance.now();
    const tick = () => {
      if (!this.running || this.destroyed) return;
      const now = performance.now();

      const dt = Math.min(now - this.last, 50) / 1000;
      this.clock += dt;
      this.last = now;

      const k = 1 - Math.exp(-dt / CURSOR_EASE);
      this.curX += (this.curTX - this.curX) * k;
      this.curY += (this.curTY - this.curY) * k;
      this.curAmt += (this.curTAmt - this.curAmt) * k;

      this.draw(this.clock);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  renderStill() {
    if (this.ok) this.draw(0);
  }

  destroy() {
    this.stop();
    this.destroyed = true;
    const gl = this.gl;
    if (!gl) return;
    if (this.prog) gl.deleteProgram(this.prog);
    if (this.quad) gl.deleteBuffer(this.quad);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.gl = null;
    this.prog = null;
    this.quad = null;
  }
}

```

### ripple-grid/RippleGridCard.tsx
```ts
"use client";

import { useEffect, useRef } from "react";
import { RippleGrid } from "./engine";
import { PAPER } from "./params";
import { onTransitionChange } from "../../lib/view-transition";

export function RippleGridCard({
  bare = false,
  viewTransitionName,
}: {
  bare?: boolean;
  viewTransitionName?: string;
} = {}) {
  void bare;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let engine: RippleGrid | null = null;
    let onScreen = false;
    let hidden = false;
    let inTransition = false;

    const sync = () => {
      if (!engine || reduced) return;
      if (onScreen && !hidden && !inTransition) engine.start();
      else engine.stop();
    };

    const raf = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      engine = new RippleGrid(canvas);
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
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

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
      offTransition();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(rt);
      engine?.destroy();
    };
  }, []);

  return (
    <div
      data-canvas-card
      role="img"
      aria-label="A three by three grid of soft black blobs on a pale field. The grid swells open, its rows bend into concentric rings and then into a slow spiral that leans off centre, thinning to slivers at the edge, before folding back into the plain grid it started from."
      style={{
        ...(viewTransitionName ? { viewTransitionName } : null),
        backgroundColor: PAPER,
      }}
      className="relative mx-auto aspect-[1344/620] w-full select-none overflow-hidden rounded-[12px] border border-[var(--border-line)]"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

```