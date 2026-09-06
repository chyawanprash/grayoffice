"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * LOADING STATE — pixel-grid loader for long-running work
 *
 * Variants:
 *   Drive  — square cells, chevron wavefront driving right;
 *            the 650ms cycle is shorter than the sweep, so
 *            two fronts are always in flight
 *   Dots   — same wavefront, circular cells
 *   Orbit  — a comet lapping the grid perimeter
 *   Surfer — the Drive loader paired with a meme video below
 *
 * Paired with a shimmering label and a live elapsed timer
 * in mono tabular figures. Reduced motion freezes the grid
 * to its dim state; the timer still ticks.
 * ───────────────────────────────────────────────────────── */

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const orbit = Array.from({ length: 9 }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i);
  return k === -1 ? null : k * 110;
});

const PATTERNS: Record<string, { delays: (number | null)[]; dur: number; round: boolean }> = {
  Drive: { delays: chevron, dur: 650, round: false },
  Dots: { delays: chevron, dur: 650, round: true },
  Orbit: { delays: orbit, dur: 950, round: false },
};

function LoaderGrid({
  delays,
  dur,
  round,
}: {
  delays: (number | null)[];
  dur: number;
  round: boolean;
}) {
  return (
    <span aria-hidden className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]">
      {delays.map((delay, index) => (
        <span
          key={index}
          className={`size-[4px] bg-ink ${round ? "rounded-full" : "rounded-[1px]"}`}
          style={{
            opacity: delay === null ? 0.07 : 0.15,
            animation: delay === null ? "none" : `pixel-on ${dur}ms ease-in-out ${delay}ms infinite`,
          }}
        />
      ))}
    </span>
  );
}

function useElapsed() {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, []);
  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export default function LoadingState({
  label,
  variant = "Drive",
  /** the meme feed for the Surfer variant; hosted on Vercel Blob so it plays in
   *  production (the local /public/subway-surfers.mp4 stays gitignored) */
  videoSrc = "https://95dnc2a95qgwt9ff.public.blob.vercel-storage.com/subway-surfers.mp4",
}: {
  label?: string;
  variant?: string;
  videoSrc?: string;
}) {
  const elapsed = useElapsed();
  const surfer = variant === "Surfer";
  const resolvedLabel = label ?? (surfer ? "Subway surfing" : "Churning");
  const [videoOk, setVideoOk] = useState(true);
  const { delays, dur, round } = PATTERNS[variant] ?? PATTERNS.Drive;

  const labelEl = (
    <span
      className="bg-clip-text text-[13px] font-medium text-transparent"
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)",
        backgroundSize: "200% 100%",
        animation: "shimmer-text 1.4s linear infinite",
      }}
    >
      {resolvedLabel}
    </span>
  );
  const elapsedEl = <span className="font-mono text-[12px] text-ink-3 tabular-nums">{elapsed}</span>;

  if (surfer) {
    return (
      <div role="status" className="flex w-fit flex-col items-start">
        <div className="flex items-center gap-2.5">
          <LoaderGrid {...PATTERNS.Drive} />
          {labelEl}
          {elapsedEl}
        </div>

        {/* the context card follows the status text it is illustrating */}
        <div
          className="mt-2 w-56 overflow-hidden rounded-[10px] shadow-overlay"
          style={{ animation: "pop-in 200ms cubic-bezier(0.16,1,0.3,1) both", transformOrigin: "top left" }}
        >
          <div className="relative aspect-video w-full" style={{ background: "var(--tooltip-bg)" }}>
            {videoOk ? (
              <video
                src={videoSrc}
                autoPlay
                muted
                loop
                playsInline
                onError={() => setVideoOk(false)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
                <LoaderGrid {...PATTERNS.Drive} />
                <span className="px-3 text-center font-mono text-[10px]" style={{ color: "var(--tooltip-muted)" }}>
                  Video unavailable
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="flex w-fit items-center gap-2.5">
      <LoaderGrid delays={delays} dur={dur} round={round} />
      {labelEl}
      {elapsedEl}
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * THINKING — expandable agent trace, four variants
 *
 *   Steps      step list with spinner → muted checks
 *   Reasoning  prose reasoning that expands, then settles
 *   Search     web-search trace: query + sources read
 *   Coding     tool trace: files read, edits, commands
 *
 * The trace runs once, settles, and remains expandable.
 * ───────────────────────────────────────────────────────── */

const STAGES = [800, 600, 1800, 2600, 1600];

function useSequence(steps: number[]) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= steps.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), steps[stage]);
    return () => clearTimeout(t);
  }, [stage, steps]);
  return stage;
}

type Row = {
  primary: string;
  secondary?: string;
  mono?: boolean;
  add?: number;
  del?: number;
  href?: string;
};

const VARIANTS: Record<
  string,
  { active: string; done: string; rows: Row[]; query?: string }
> = {
  Steps: {
    active: "Thinking",
    done: "Thought for 4 seconds",
    rows: [
      { primary: "Reading flavor briefs" },
      { primary: "Scanning supplier lists" },
      { primary: "Comparing tasting notes", secondary: "6 flavors" },
      { primary: "Writing the scoop report" },
    ],
  },
  Reasoning: {
    active: "Thinking",
    done: "Thought for 4 seconds",
    rows: [
      { primary: "Summer demand spikes for stone-fruit flavors — peach and apricot lead." },
      { primary: "I should check cone inventory before promoting a waffle-bowl special." },
    ],
  },
  Search: {
    active: "Searching the web",
    done: "Searched the web",
    query: "best waffle cone supplier",
    rows: [
      { primary: "Joy Cone", secondary: "joycone.com", href: "https://joycone.com/fs_products/waffle-cones/" },
      { primary: "WebstaurantStore", secondary: "webstaurantstore.com", href: "https://www.webstaurantstore.com/ice-cream-shop-supplies.html" },
      { primary: "The Konery", secondary: "thekonery.com", href: "https://www.thekonery.com/" },
    ],
  },
  Coding: {
    active: "Running tools",
    done: "Ran 3 tools",
    rows: [
      { primary: "Read", secondary: "flavors.ts", mono: true },
      { primary: "Edit", secondary: "ChurnSchedule.tsx", mono: true, add: 74, del: 41 },
      { primary: "Run", secondary: "npm run freeze", mono: true },
    ],
  },
};

function Dot({ tone }: { tone: string }) {
  return (
    <span className={`flex size-3.5 shrink-0 items-center justify-center rounded-full text-white ${tone}`}>
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="9" />
        <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    </span>
  );
}

const TONES = ["bg-accent", "bg-orange", "bg-green"];

export default function ThinkingState({ variant = "Steps", onSettled }: { variant?: string; onSettled?: () => void }) {
  const stage = useSequence(STAGES);
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const v = VARIANTS[variant] ?? VARIANTS.Steps;
  const autoExpanded = stage >= 1 && stage < 4;
  const expanded = manualExpanded ?? autoExpanded;
  const working = stage < 3;
  const visible = stage < 2 ? 0 : stage === 2 ? Math.min(2, v.rows.length) : v.rows.length;
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);
  useLayoutEffect(() => {
    if (traceRef.current) setLineHeight(traceRef.current.offsetHeight);
  }, [visible, expanded, variant, stage]);

  /* let embedders sequence content after the trace settles */
  const settledRef = useRef(false);
  useEffect(() => {
    if (working || settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
  }, [working, onSettled]);

  return (
    <div
      key={variant}
      className="flex w-full max-w-95 flex-col"
      style={{
        minHeight: working || expanded ? 176 : undefined,
        transition: "min-height 400ms cubic-bezier(0.23,1,0.32,1)",
      }}
    >
      {/* header — shared across variants */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setManualExpanded((current) => !(current ?? autoExpanded))}
        className="-mx-1.5 flex w-fit items-center gap-2 rounded-control px-1.5 py-1
          transition-colors duration-100 hover:bg-hover-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={working ? "var(--ink-2)" : "var(--ink-3)"}>
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
        <span role="status" className="contents">
          {working ? (
            <span
              className="bg-clip-text text-[13px] font-medium whitespace-nowrap text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--ink-3) 35%, var(--ink) 50%, var(--ink-3) 65%)",
                backgroundSize: "200% 100%",
                animation: "shimmer-text 1.4s linear infinite",
              }}
            >
              {v.active}
            </span>
          ) : (
            <span
              className="text-[13px] font-medium whitespace-nowrap text-ink-2"
              style={{ animation: "fade-in 350ms ease-out both" }}
            >
              {v.done}
            </span>
          )}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          className="transition-transform duration-300"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* expandable trace */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-400"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="relative mt-1 ml-[5px] pl-4">
            <span
              aria-hidden
              className="absolute left-[3px] w-px bg-line"
              style={{ top: -8, height: lineHeight ? lineHeight - 2 : 0, transition: "height 500ms cubic-bezier(0.23,1,0.32,1)" }}
            />
            <div ref={traceRef} className="flex flex-col gap-1 py-1">
            {v.query && (
              <div className="flex h-6 items-center gap-2 px-1.5" style={{ animation: expanded ? "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" : undefined }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <span className="text-[12.5px] text-ink-2">{v.query}</span>
              </div>
            )}
            {v.rows.slice(0, visible).map((row, i) => {
              const content = (
                <>
                {variant === "Search" && <Dot tone={TONES[i % 3]} />}
                {variant === "Steps" && (
                  i < visible - 1 || !working ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <span className="size-3 shrink-0 rounded-full border-[1.5px] border-line-strong border-t-ink-2" style={{ animation: "spin 700ms linear infinite" }} />
                  )
                )}
                <span className={`min-w-0 truncate text-[12.5px] ${variant === "Reasoning" ? "whitespace-normal leading-relaxed text-ink-2" : "font-medium text-ink"} ${variant === "Search" ? "animated-underline" : ""}`}>
                  {row.primary}
                </span>
                {row.secondary && (
                  <span className={`shrink-0 text-[11.5px] text-ink-3 ${row.mono ? "font-mono" : ""}`}>
                    {row.secondary}
                  </span>
                )}
                {row.add !== undefined && (
                  <span className="shrink-0 font-mono text-[11px] tabular-nums">
                    <span className="text-green">+{row.add}</span>{" "}
                    <span className="text-red">−{row.del}</span>
                  </span>
                )}
                </>
              );
              const rowClass = "flex min-h-7 w-full items-center gap-2 rounded-[6px] px-1.5 py-0.5 text-left";
              const animation = { animation: `fade-up 320ms cubic-bezier(0.23,1,0.32,1) ${i * 120}ms both` };

              if (variant === "Search") {
                return (
                  <a
                    key={row.primary}
                    href={row.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`${rowClass} transition-colors duration-150 hover:bg-hover`}
                    style={animation}
                  >
                    {content}
                  </a>
                );
              }

              if (variant === "Coding") {
                const selected = selectedTool === row.primary;
                return (
                  <button
                    key={row.primary}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedTool(selected ? null : row.primary)}
                    className={`${rowClass} transition-colors duration-150 ${selected ? "bg-inset" : "hover:bg-hover"}`}
                    style={animation}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <div key={row.primary} className={rowClass} style={animation}>
                  {content}
                </div>
              );
            })}
            {variant === "Search" && stage >= 3 && (
              <span className="text-[12px] text-ink-3" style={{ animation: "fade-in 300ms ease-out both" }}>
                +7 more
              </span>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * STREAMING TEXT
 * Words resolve out of blur, inline citations appear in
 * context, then actions and follow-up prompts become usable.
 * ───────────────────────────────────────────────────────── */

const WORD_MS = 55;
const HOLD_MS = 3400;

/* one streamed word, or a `cite` placeholder that renders an inline source chip */
export type StreamingToken = { text: string; cite?: boolean };

const TOKENS: StreamingToken[] = [
  ..."Pistachio is your fastest-growing flavor — sales are up 23% this month and margins beat vanilla by 8 points."
    .split(" ")
    .map((text) => ({ text })),
  { text: "", cite: true },
  ..."Stone-fruit flavors are trending in the same range."
    .split(" ")
    .map((text) => ({ text })),
];

const FOLLOW_UPS = [
  "Which flavors sell best in winter",
  "Compare gelato and soft serve margins",
];

const SOURCE_IMAGES = {
  scoop:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%231f7a5f'/%3E%3Cpath d='M20 36c0 7 5.4 12 12 12s12-5 12-12H20Z' fill='%23fff'/%3E%3Ccircle cx='32' cy='25' r='11' fill='%23bff3dd'/%3E%3Cpath d='M24 24c4-7 13-7 17 0' fill='none' stroke='%231f7a5f' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E",
  trends:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%232f6fec'/%3E%3Cpath d='M15 43 27 31l8 7 14-18' fill='none' stroke='%23fff' stroke-width='7' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='49' cy='20' r='5' fill='%23bfe0ff'/%3E%3C/svg%3E",
  market:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%23e56d24'/%3E%3Cpath d='M17 45V25h8v20h-8Zm11 0V16h8v29h-8Zm11 0V30h8v15h-8Z' fill='%23fff'/%3E%3Cpath d='M16 49h32' stroke='%23ffd6b8' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E",
};

/* one cited source rendered as an inline chip and in the sources list */
export type StreamingSource = { name: string; domain: string; href: string; image: string };

const SOURCES: StreamingSource[] = [
  { name: "Scoop Data", domain: "scoopdata.io", href: "https://scoopdata.io/", image: SOURCE_IMAGES.scoop },
  { name: "Trends Index", domain: "trends.google.com", href: "https://trends.google.com/trends/", image: SOURCE_IMAGES.trends },
  { name: "Market Basket", domain: "marketbasket.io", href: "https://marketbasket.io/", image: SOURCE_IMAGES.market },
];

function sourceImage(source: StreamingSource) {
  return source.image;
}

function SourceChip({ source }: { source?: StreamingSource }) {
  if (!source) return null;
  return (
    <a
      href={source.href}
      target="_blank"
      rel="noreferrer"
      className="ml-0 mr-1 inline-flex h-4.5 translate-y-[-1px] items-center gap-1 rounded-[5px]
        bg-inset pr-[3px] pl-[3px] align-middle font-mono text-[10.5px] text-ink-2 shadow-hairline
        transition-colors duration-150 hover:bg-hover hover:text-ink"
      style={{ animation: "pop-in 250ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      <img src={sourceImage(source)} alt="" className="source-avatar size-3 rounded-[3px]" />
      <span>{source.domain}</span>
    </a>
  );
}

const ACTION_ICONS: React.ReactNode[] = [
  <g key="copy"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></g>,
  <path key="retry" d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />,
  <path key="up" d="M7 10v12M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88z" />,
  <path key="down" d="M17 14V2M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88z" />,
];

export type StreamingLabels = {
  /** label on the collapsed sources toggle */
  sources: string;
  /** heading above the follow-up prompts */
  followUps: string;
};

const DEFAULT_LABELS: StreamingLabels = {
  sources: "10 sources",
  followUps: "Follow-ups",
};

export default function StreamingText({
  content = TOKENS,
  sources = SOURCES,
  followUps = FOLLOW_UPS,
  labels,
  loop = true,
  fill = false,
  onDone,
  onFollowUp,
}: {
  variant?: string;
  /** the streamed tokens; `cite` tokens render an inline source chip */
  content?: StreamingToken[];
  /** cited sources shown in the chip, avatar stack, and expanded list */
  sources?: StreamingSource[];
  /** follow-up prompt suggestions shown once the stream completes */
  followUps?: string[];
  /** prominent copy strings */
  labels?: Partial<StreamingLabels>;
  /** restart the stream after a hold; turn off when embedding in a real thread */
  loop?: boolean;
  /** fill the parent width instead of the gallery's fixed measure */
  fill?: boolean;
  onDone?: () => void;
  /** fired when a follow-up prompt is chosen */
  onFollowUp?: (text: string, index: number) => void;
} = {}) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const [count, setCount] = useState(0);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const done = count >= content.length;

  useEffect(() => {
    if (done && !loop) {
      onDone?.();
      return;
    }
    const t = setTimeout(
      () => setCount((c) => (c >= content.length ? 0 : c + 1)),
      done ? HOLD_MS : WORD_MS,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, done, loop]);

  return (
    <div className={fill ? "w-full" : "min-h-[15.5rem] w-full max-w-95"}>
      <p className="text-[13px] leading-relaxed text-ink">
        {content.slice(0, count).map((token, i) =>
          token.cite ? (
            <SourceChip key={i} source={sources[0]} />
          ) : (
            <span key={i} className="inline">
              {token.text}{" "}
            </span>
          ),
        )}
        {!done && (
          <span
            className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-full bg-ink"
            style={{ animation: "fade-in 150ms ease-out both" }}
          />
        )}
      </p>

      {/* action icons row */}
      <div
        className="mt-2 flex items-center gap-0.5 transition-opacity duration-400"
        style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
      >
        {ACTION_ICONS.map((icon, i) => (
          <button
            key={i}
            type="button"
            aria-label="Action"
            className="flex size-6 items-center justify-center rounded-[6px] text-ink-3
              transition-colors duration-100 hover:bg-hover-2 hover:text-ink-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {icon}
            </svg>
          </button>
        ))}
        <button
          type="button"
          aria-expanded={sourcesOpen}
          onClick={() => setSourcesOpen((current) => !current)}
          className="ml-1.5 flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 text-left transition-colors duration-150 hover:bg-hover"
        >
          <span className="flex -space-x-1">
            {sources.map((source) => (
              <img
                key={source.domain}
                src={sourceImage(source)}
                alt=""
                className="source-avatar size-3.5 rounded-full bg-surface shadow-[0_0_0_1.5px_var(--canvas)]"
              />
            ))}
          </span>
          <span className="text-[12px] text-ink-2">{l.sources}</span>
        </button>
      </div>

      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: done && sourcesOpen ? "1fr" : "0fr",
          opacity: done && sourcesOpen ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 flex flex-col rounded-[10px] bg-inset p-1 shadow-hairline">
            {sources.map((source) => (
              <a
                key={source.domain}
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 text-[12px] text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink"
              >
                <img src={sourceImage(source)} alt="" className="source-avatar size-4 rounded-[4px]" />
                <span className="animated-underline">{source.name}</span>
                <span className="ml-auto font-mono text-[10.5px] text-ink-3">{source.domain}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* follow-ups */}
      <div
        className="mt-2.5 transition-opacity duration-400"
        style={{ opacity: done ? 1 : 0, pointerEvents: done ? "auto" : "none" }}
      >
        <p className="text-[12px] font-medium text-ink-2">{l.followUps}</p>
        <div className="mt-0.5 flex flex-col">
          {followUps.map((text, i) => (
            <button
              key={text}
              onClick={() => onFollowUp?.(text, i)}
              className="-mx-1.5 flex items-center gap-2 rounded-[7px] border-b border-line
                px-1.5 py-1.5 text-left text-[12.5px] text-ink transition-colors
                duration-100 hover:bg-hover-2"
              style={
                done
                  ? { animation: `fade-up 350ms cubic-bezier(0.23,1,0.32,1) ${i * 90}ms both` }
                  : { opacity: 0 }
              }
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M9 10l-5 5 5 5" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/atoms/Button";
import GlideMenu from "@/components/primitives/GlideMenu";

/* ─────────────────────────────────────────────────────────
 * APPROVAL CARD (human-in-the-loop)
 * One question at a time. The stack slides vertically as you
 * move between questions (the card's height animates to fit),
 * the step counter rolls like an odometer, and the footer uses
 * pill actions — a quiet Skip and a dark Continue with a ⏎.
 * Single-choice answers auto-advance; multi-select waits.
 * ───────────────────────────────────────────────────────── */

export type ApprovalQuestion = {
  q: string;
  type: "radio" | "check";
  options: string[];
};

const QUESTIONS: ApprovalQuestion[] = [
  {
    q: "How many flavors should we launch?",
    type: "radio",
    options: ["Three (core line)", "Five (full case)", "Just one hero"],
  },
  {
    q: "Which mix-ins should we stock?",
    type: "check",
    options: ["Chocolate chips", "Waffle bits", "Sprinkles"],
  },
  {
    q: "Which market do we enter first?",
    type: "radio",
    options: ["Food trucks", "Grocery freezers", "Scoop shops"],
  },
];

export type ApprovalLabels = {
  skip: string;
  continue: string;
  send: string;
  customPlaceholder: string;
  sentMessage: string;
};

const DEFAULT_LABELS: ApprovalLabels = {
  skip: "Skip",
  continue: "Continue",
  send: "Send",
  customPlaceholder: "Something else…",
  sentMessage: "Answers sent",
};

const ROLL_MS = 400;
const SLIDE = "360ms cubic-bezier(0.22, 1, 0.36, 1)";

/* odometer digits — each character that changes rolls up (or down) */
function RollingDigits({ value }: { value: string }) {
  const prevRef = useRef(value);
  const [oldVal, setOldVal] = useState(value);
  const [newVal, setNewVal] = useState(value);
  const [rolling, setRolling] = useState(false);
  const [shifted, setShifted] = useState(false);
  const [dir, setDir] = useState<"up" | "down">("up");

  useEffect(() => {
    if (prevRef.current === value) return;
    const from = prevRef.current;
    prevRef.current = value;
    const fromN = parseInt(from, 10);
    const toN = parseInt(value, 10);
    setDir(Number.isFinite(fromN) && Number.isFinite(toN) && toN < fromN ? "down" : "up");
    setOldVal(from);
    setNewVal(value);
    setRolling(true);
    setShifted(false);

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShifted(true));
    });
    const done = setTimeout(() => {
      setRolling(false);
      setOldVal(value);
      setShifted(false);
    }, ROLL_MS);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(done);
    };
  }, [value]);

  const chars = rolling ? newVal : oldVal;

  return (
    <>
      {Array.from({ length: chars.length }, (_, i) => {
        const o = oldVal[i] ?? "";
        const n = chars[i] ?? "";
        if (!rolling || o === n) {
          return <span key={`${i}-${n}`}>{n}</span>;
        }
        const top = dir === "down" ? n : o;
        const bottom = dir === "down" ? o : n;
        const restY = dir === "down" ? "0" : "-1em";
        const startY = dir === "down" ? "-1em" : "0";
        return (
          <span
            key={`${i}-${o}-${n}-${dir}`}
            style={{ display: "inline-block", position: "relative", overflow: "hidden", height: "1em", lineHeight: "1em", verticalAlign: "-0.05em" }}
          >
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                transition: "transform 350ms cubic-bezier(0.4, 0, 0.2, 1)",
                transform: `translateY(${shifted ? restY : startY})`,
              }}
            >
              <span style={{ height: "1em", lineHeight: "1em" }}>{top}</span>
              <span style={{ height: "1em", lineHeight: "1em" }}>{bottom}</span>
            </span>
          </span>
        );
      })}
    </>
  );
}

function Ico({ path, size = 14, sw = 2 }: { path: React.ReactNode; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  );
}

export default function ApprovalCard({
  questions = QUESTIONS,
  labels,
  onSubmitted,
  onAnswerChange,
  resettable = true,
}: {
  questions?: ApprovalQuestion[];
  labels?: Partial<ApprovalLabels>;
  onSubmitted?: (answers: Record<number, number[]>) => void;
  onAnswerChange?: (questionIndex: number, answer: number[]) => void;
  resettable?: boolean;
  variant?: string;
} = {}) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [custom, setCustom] = useState<Record<number, string>>({});
  const [sent, setSent] = useState(false);
  const [open, setOpen] = useState(true);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const measured = useRef(false);
  const [viewportH, setViewportH] = useState<number | undefined>(undefined);
  const [trackY, setTrackY] = useState(0);
  const [animate, setAnimate] = useState(false);
  // Until the first question is measured, render only the active one so the
  // initial (and SSR) height is Q1's height — not all questions stacked, which
  // would flash to full height and then shrink on mount.
  const [ready, setReady] = useState(false);

  const last = qi === questions.length - 1;
  const selected = answers[qi] ?? [];
  const hasAnswer = selected.length > 0 || Boolean(custom[qi]?.trim());

  const sync = (withAnim: boolean) => {
    const item = questionRefs.current[qi];
    if (!item) return;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setViewportH(item.offsetHeight);
    setTrackY(item.offsetTop);
    setAnimate(withAnim && !reduce);
  };

  useLayoutEffect(() => {
    const withAnim = measured.current;
    measured.current = true;
    sync(withAnim);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi, answers, custom, open, sent]);

  useEffect(() => {
    const id = requestAnimationFrame(() => sync(measured.current));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qi]);

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current); }, []);

  const goTo = (next: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setQi(Math.min(Math.max(next, 0), questions.length - 1));
  };

  const send = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setSent(true);
    onSubmitted?.(answers);
  };

  const advance = () => {
    if (last) send();
    else goTo(qi + 1);
  };

  const toggle = (index: number) => {
    const type = questions[qi].type;
    setAnswers((current) => {
      const picked = current[qi] ?? [];
      const next = type === "radio"
        ? [index]
        : picked.includes(index)
          ? picked.filter((item) => item !== index)
          : [...picked, index];
      onAnswerChange?.(qi, next);
      return { ...current, [qi]: next };
    });
    if (type === "radio") {
      setCustom((current) => ({ ...current, [qi]: "" }));
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        if (last) send();
        else setQi((current) => Math.min(questions.length - 1, current + 1));
      }, 480);
    }
  };

  const reset = () => {
    setQi(0);
    setAnswers({});
    setCustom({});
    setSent(false);
    setOpen(true);
    measured.current = false;
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-control bg-surface px-3 py-2 text-[12.5px] font-medium text-ink shadow-btn transition-colors duration-150 hover:bg-hover">
        Open approval
      </button>
    );
  }

  if (sent) {
    return (
      <div className="flex w-full max-w-80 items-center gap-3" style={{ animation: "pop-in 260ms cubic-bezier(0.23,1,0.32,1) both" }}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-tint py-1 pr-2.5 pl-1 text-[12.5px] font-medium text-green">
          <span className="flex size-4.5 items-center justify-center rounded-full bg-green text-white">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </span>
          {t.sentMessage}
        </span>
        {resettable && (
          <button type="button" onClick={reset} className="text-[12px] font-medium text-ink-3 transition-colors duration-150 hover:text-ink">
            Start over
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-80">
      <div className="relative overflow-hidden rounded-card bg-surface shadow-card" style={{ animation: "fade-up 380ms cubic-bezier(0.23,1,0.32,1) both" }}>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setOpen(false)}
          className="primitive-icon-button absolute right-2.5 top-2.5 z-10 text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink"
        >
          <Ico size={14} sw={2.2} path={<path d="M18 6L6 18M6 6l12 12" />} />
        </button>
        <div className="primitive-card-pad">
          {/* the question itself is the heading */}
          <div
            className="overflow-hidden"
            style={{ height: viewportH, transition: animate ? `height ${SLIDE}` : undefined }}
            aria-live="polite"
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 26,
                transform: `translate3d(0, ${-trackY}px, 0)`,
                transition: animate ? `transform ${SLIDE}` : undefined,
                willChange: "transform",
              }}
            >
              {questions.map((question, qIdx) => {
                const active = qIdx === qi;
                // Before the first measure, mount only the active question so the
                // card opens at its real height instead of flashing to full height.
                if (!ready && !active) return null;
                const picked = answers[qIdx] ?? [];
                const questionStyle: CSSProperties = {
                  opacity: active ? 1 : 0,
                  transition: animate ? `opacity ${SLIDE}` : undefined,
                  pointerEvents: active ? undefined : "none",
                };
                return (
                  <div
                    key={qIdx}
                    ref={(el) => { questionRefs.current[qIdx] = el; }}
                    aria-hidden={active ? undefined : true}
                    style={questionStyle}
                  >
                    <div className="pr-7 text-[14px] font-medium text-ink">{question.q}</div>
                    <GlideMenu className="mt-2.5 flex flex-col gap-1" highlightClassName="inset-x-0 rounded-control bg-hover">
                      {question.options.map((option, i) => {
                        const on = picked.includes(i);
                        return (
                          <button
                            key={option}
                            type="button"
                            data-menu-row
                            aria-pressed={on}
                            tabIndex={active ? 0 : -1}
                            onClick={() => { if (active) toggle(i); }}
                            className="relative z-10 flex items-center gap-1.5 rounded-control pl-1 pr-2 py-1 text-left transition-colors duration-100"
                          >
                            <span
                              className={`flex size-4 shrink-0 items-center justify-center transition-colors duration-200
                                ${question.type === "radio" ? "rounded-full" : "rounded-[5px]"}
                                ${on ? "bg-ink text-canvas" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)] text-transparent"}`}
                            >
                              {question.type === "radio" ? (
                                <span className="size-1.5 rounded-full bg-canvas transition-transform duration-200" style={{ transform: on ? "scale(1)" : "scale(0)" }} />
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                              )}
                            </span>
                            <span className={`text-[13px] leading-none transition-colors duration-200 ${on ? "text-ink" : "text-ink-2"}`}>
                              {option}
                            </span>
                          </button>
                        );
                      })}
                      <label data-menu-row className="relative z-10 flex items-center gap-1.5 rounded-control pl-1 pr-2 py-1 transition-colors duration-100">
                        <input
                          value={custom[qIdx] ?? ""}
                          tabIndex={active ? 0 : -1}
                          onChange={(event) => {
                            if (!active) return;
                            setCustom((current) => ({ ...current, [qIdx]: event.target.value }));
                            if (question.type === "radio") setAnswers((current) => ({ ...current, [qIdx]: [] }));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" && hasAnswer) {
                              event.preventDefault();
                              advance();
                            }
                          }}
                          placeholder={t.customPlaceholder}
                          aria-label="Custom answer"
                          className="min-w-0 flex-1 bg-transparent pl-1.5 text-[13px] text-ink outline-none placeholder:text-ink-3"
                        />
                      </label>
                    </GlideMenu>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* footer — step nav (rolling counter) + pill actions */}
        <div className="primitive-card-footer flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 text-ink-3">
            <button
              type="button"
              aria-label="Previous question"
              disabled={qi <= 0}
              onClick={() => goTo(qi - 1)}
              className="flex size-[18px] items-center justify-center rounded-[5px] transition-colors duration-100 enabled:hover:text-ink disabled:opacity-30"
            >
              <Ico size={14} path={<path d="M18 15l-6-6-6 6" />} />
            </button>
            <span className="inline-flex items-center text-[12px] font-medium tabular-nums text-ink-3" style={{ letterSpacing: "-0.1px", lineHeight: 1 }}>
              <RollingDigits value={`${qi + 1} / ${questions.length}`} />
            </span>
            <button
              type="button"
              aria-label="Next question"
              disabled={last}
              onClick={() => goTo(qi + 1)}
              className="flex size-[18px] items-center justify-center rounded-[5px] transition-colors duration-100 enabled:hover:text-ink disabled:opacity-30"
            >
              <Ico size={14} path={<path d="M6 9l6 6 6-6" />} />
            </button>
          </div>

          <div className="-mr-0.5 flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => (last ? setOpen(false) : goTo(qi + 1))}>
              {t.skip}
            </Button>
            <Button variant="accent" size="sm" disabled={!hasAnswer} onClick={advance}>
              {last ? t.send : t.continue}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/* ─────────────────────────────────────────────────────────
 * TOOL CHIPS
 * An agent run as compact rows: tool calls with inline
 * chips, then file-diff chips summarizing the edits.
 * Hover a row to reveal its chevron; every row expands
 * to show what the tool actually did.
 * ───────────────────────────────────────────────────────── */

const STEP_MS = 700;

const Icons: Record<string, React.ReactNode> = {
  think: <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />,
  write: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></g>,
  run: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 17l6-5-6-5M12 19h8" /></g>,
  read: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></g>,
};

export type ToolDetailLine = { text: string; tone?: "add" };

export type ToolStep = {
  icon: string;
  label: string;
  chip: string;
  mono: boolean;
  detailMono: boolean;
  detail: ToolDetailLine[];
};

export type ToolDiff = { file: string; add: number; del: number };

export type ToolDiffLine = { text: string; tone: "add" | "del" | "ctx" };

export type ToolChipsLabels = {
  header: string;
  more: string;
};

const DEFAULT_LABELS: ToolChipsLabels = {
  header: "4 tool calls, 2 messages",
  more: "+2 more",
};

const ROWS: ToolStep[] = [
  {
    icon: "think", label: "Thinking", chip: "Planning the churn schedule…", mono: false, detailMono: false,
    detail: [
      { text: "Weekend demand carries pistachio, so it churns first." },
      { text: "Batch capacity leaves two evening freezer windows." },
    ],
  },
  {
    icon: "write", label: "Write 204 lines", chip: "ChurnSchedule.tsx", mono: true, detailMono: true,
    detail: [
      { text: "+ const windows = slots.filter((s) => s.temp <= -12)", tone: "add" },
      { text: "+ return schedule(windows, { hero: \"pistachio\" })", tone: "add" },
    ],
  },
  {
    icon: "run", label: "Rebuild and verify", chip: "npm run freeze", mono: true, detailMono: true,
    detail: [
      { text: "✓ built in 1.2s" },
      { text: "✓ 34 checks passed" },
    ],
  },
  {
    icon: "read", label: "Read image", chip: "flavor-chart.png", mono: true, detailMono: false,
    detail: [
      { text: "1280 × 720 · line chart, three summers." },
      { text: "Mint chip trends up 12% through July." },
    ],
  },
];

const DIFFS: ToolDiff[] = [
  { file: "flavors.css", add: 13, del: 0 },
  { file: "ChurnSchedule.tsx", add: 74, del: 41 },
  { file: "menu.ts", add: 8, del: 2 },
];

/* hovering a file chip opens its diff — green added, red removed */
const DIFF_LINES: Record<string, ToolDiffLine[]> = {
  "flavors.css": [
    { text: ".scoop-card {", tone: "ctx" },
    { text: "  gap: 14px;", tone: "del" },
    { text: "  gap: 12px;", tone: "add" },
    { text: "  container-type: inline-size;", tone: "add" },
    { text: "}", tone: "ctx" },
  ],
  "ChurnSchedule.tsx": [
    { text: "const slots = coldSlots(week);", tone: "ctx" },
    { text: "const windows = slots;", tone: "del" },
    { text: "const windows = slots.filter(", tone: "add" },
    { text: "  (s) => s.temp <= -12,", tone: "add" },
    { text: ");", tone: "add" },
  ],
  "menu.ts": [
    { text: "export const hero = \"mint-chip\";", tone: "del" },
    { text: "export const hero = \"pistachio\";", tone: "add" },
  ],
};

export default function ToolChips({
  steps = ROWS,
  diffs = DIFFS,
  diffLines = DIFF_LINES,
  labels,
  className,
  onOpenChange,
  onToggleRow,
}: {
  /** Accepted for gallery/registry parity; ToolChips has no visual variants. */
  variant?: string;
  steps?: ToolStep[];
  diffs?: ToolDiff[];
  diffLines?: Record<string, ToolDiffLine[]>;
  labels?: Partial<ToolChipsLabels>;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  onToggleRow?: (label: string, open: boolean) => void;
} = {}) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(true);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  /* Rendered in a body portal so animated/translated reply wrappers cannot
   * redefine the fixed-position coordinate system. */
  const [preview, setPreview] = useState<{
    file: string;
    x: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const openPreview = (file: string) => (event: React.SyntheticEvent) => {
    const rect = (event.currentTarget as Element).closest("[data-diffchip]")!.getBoundingClientRect();
    const previewHeight = 38 + (diffLines[file]?.length ?? 0) * 19;
    const fitsBelow = rect.bottom + 6 + previewHeight <= window.innerHeight - 12;
    setPreview({
      file,
      x: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
      ...(fitsBelow
        ? { top: rect.bottom + 6 }
        : { bottom: window.innerHeight - rect.top + 6 }),
    });
  };
  const closePreview = (file: string) => () =>
    setPreview((current) => (current?.file === file ? null : current));
  const total = steps.length + 1; // rows, then diff chips

  useEffect(() => {
    if (step >= total) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, total]);

  const toggleRow = (label: string) =>
    setOpenRows((current) => {
      const next = new Set(current);
      next.has(label) ? next.delete(label) : next.add(label);
      onToggleRow?.(label, next.has(label));
      return next;
    });

  return (
    <div className={`min-h-[220px] w-full max-w-80 pb-1${className ? ` ${className}` : ""}`}>
      {/* collapsed run header */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() =>
          setOpen((current) => {
            onOpenChange?.(!current);
            return !current;
          })
        }
        className="-mx-1.5 flex w-fit items-center gap-1.5 rounded-control px-1.5 py-1 text-[12.5px] text-ink-2 transition-colors duration-100 hover:bg-hover-2"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200" style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
        <span className="tabular-nums">{copy.header}</span>
      </button>

      {/* tool call rows */}
      <div className="grid transition-[grid-template-rows,opacity] duration-300" style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}>
        {/* -mx-1 + px-1.5 keeps content at the same x while giving the
            row hover pills room inside this overflow-hidden clip box */}
        <div className="-mx-1 overflow-hidden px-1.5 pb-1">
        <div className="mt-1.5 flex flex-col gap-1">
          {steps.slice(0, step).map((row) => {
            const rowOpen = openRows.has(row.label);
            return (
            <div key={row.label} style={{ animation: "fade-up 300ms cubic-bezier(0.23,1,0.32,1) both" }}>
              <button
                type="button"
                aria-expanded={rowOpen}
                onClick={() => toggleRow(row.label)}
                className="group/row -mx-[3px] flex h-7 w-[calc(100%+6px)] min-w-0 items-center gap-2 rounded-control px-[3px] text-left transition-colors duration-100 hover:bg-hover-2"
              >
                <span className="relative flex size-4 shrink-0 items-center justify-center text-ink-3">
                  <svg
                    width="13" height="13" viewBox="0 0 24 24" fill={row.icon === "think" ? "currentColor" : "none"} stroke="currentColor"
                    className={`transition-opacity duration-100 group-hover/row:opacity-0 ${rowOpen ? "opacity-0" : ""}`}
                  >
                    {Icons[row.icon]}
                  </svg>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                    className={`absolute transition-[opacity,transform] duration-150 group-hover/row:opacity-100 ${rowOpen ? "opacity-100" : "opacity-0"}`}
                    style={{ transform: rowOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
                <span className="shrink-0 text-[12.5px] font-medium text-ink">{row.label}</span>
                <span
                  className={`inline-flex h-5.5 min-w-0 flex-1 cursor-pointer items-center truncate rounded-chip bg-field px-1.5
                    text-[11.5px] text-ink-2 shadow-hairline transition-colors duration-100 hover:bg-hover-2
                    ${row.mono ? "font-mono" : ""}`}
                >
                  {row.chip}
                </span>
              </button>

              {/* expanded detail */}
              <div
                className="grid transition-[grid-template-rows,opacity] duration-300"
                style={{ gridTemplateRows: rowOpen ? "1fr" : "0fr", opacity: rowOpen ? 1 : 0, transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="mt-0.5 mb-1 ml-2 flex flex-col gap-0.5 border-l border-line py-0.5 pl-3.5">
                    {row.detail.map((line) => (
                      <span
                        key={line.text}
                        className={`truncate text-[11.5px] leading-[1.6] ${row.detailMono ? "font-mono" : ""} ${line.tone === "add" ? "text-green" : "text-ink-2"}`}
                      >
                        {line.text}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>

      {/* file-diff chips */}
      {step >= total && (
        <div className="mt-2.5 flex max-w-full flex-wrap gap-1.5 border-t border-line pt-2.5">
          {diffs.map((d, i) => (
            <span
              key={d.file}
              data-diffchip
              className="relative"
              onMouseEnter={openPreview(d.file)}
              onMouseLeave={closePreview(d.file)}
            >
              <button
                type="button"
                aria-expanded={preview?.file === d.file}
                aria-label={`Show diff for ${d.file}`}
                onFocus={openPreview(d.file)}
                onBlur={closePreview(d.file)}
                className="inline-flex h-7 max-w-full items-center gap-2 rounded-chip
                  bg-surface px-2 font-mono text-[11.5px] text-ink shadow-btn
                  transition-colors duration-100 hover:bg-hover"
                style={{ animation: `pop-in 250ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both` }}
              >
                <span className="min-w-0 truncate">{d.file}</span>
                <span className="shrink-0 text-green tabular-nums">+{d.add}</span>
                {d.del > 0 && <span className="shrink-0 text-red tabular-nums">−{d.del}</span>}
              </button>

            </span>
          ))}
          <button
            type="button"
            className="inline-flex h-7 items-center rounded-chip px-1.5 font-mono text-[11.5px] text-ink-3
              underline decoration-transparent underline-offset-2 transition-colors duration-100
              hover:text-ink-2 hover:decoration-current"
            style={{ animation: `fade-in 300ms ease-out ${diffs.length * 80}ms both` }}
          >
            {copy.more}
          </button>
        </div>
      )}
        </div>
      </div>
      {preview && typeof document !== "undefined" && createPortal(
        <div
          className="fixed z-50 w-72 overflow-hidden rounded-[10px] bg-surface shadow-overlay"
          style={{
            left: preview.x,
            top: preview.top,
            bottom: preview.bottom,
            animation: "pop-in 160ms cubic-bezier(0.23,1,0.32,1) both",
            transformOrigin: preview.top === undefined ? "bottom left" : "top left",
          }}
        >
          <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5 font-mono text-[11px]">
            <span className="min-w-0 truncate text-ink-2">{preview.file}</span>
            <span className="shrink-0 tabular-nums">
              <span className="text-green">+{diffs.find((diff) => diff.file === preview.file)?.add}</span>
              {(diffs.find((diff) => diff.file === preview.file)?.del ?? 0) > 0 && (
                <span className="text-red"> −{diffs.find((diff) => diff.file === preview.file)?.del}</span>
              )}
            </span>
          </div>
          <div className="py-1 font-mono text-[11px] leading-[1.8]">
            {(diffLines[preview.file] ?? []).map((line, index) => (
              <div
                key={index}
                className={`flex gap-2 px-2.5 whitespace-pre ${
                  line.tone === "add"
                    ? "bg-green-tint text-green"
                    : line.tone === "del"
                      ? "bg-red-tint text-red"
                      : "text-ink-2"
                }`}
              >
                <span className="w-3 shrink-0 select-none">{line.tone === "add" ? "+" : line.tone === "del" ? "−" : " "}</span>
                <span className="min-w-0 truncate">{line.text}</span>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * TASK ROWS
 *
 *     0ms   rows enter staggered (80ms apart)
 *   600ms   row 1 ring sweeps 0 → 66%
 *  1500ms   row 1 expands — detail steps drop down
 *  3900ms   row 1 collapses; row 2 flips to Failed + retry
 *  5300ms   row 2 resolves to Completed
 * The status run completes once; task details stay clickable.
 * ───────────────────────────────────────────────────────── */

const TICKS = [600, 900, 2400, 1400, 2400, 600];

function useTick(intervals: number[]) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (tick >= intervals.length - 1) return;
    const t = setTimeout(() => setTick((x) => x + 1), intervals[tick]);
    return () => clearTimeout(t);
  }, [tick, intervals]);
  return tick;
}

function SpinnerRing({ active, children }: { active?: boolean; children?: React.ReactNode }) {
  const size = 24, stroke = 2;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size} height={size} className="absolute inset-0"
        style={active ? { animation: "spin 1.1s linear infinite" } : undefined}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        {active && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--ink-3)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${c * 0.28} ${c * 0.72}`}
          />
        )}
      </svg>
      <span className="relative text-[10.5px] font-semibold tabular-nums text-ink">{children}</span>
    </span>
  );
}

function Badge({ tone, children }: { tone: "red" | "green"; children: React.ReactNode }) {
  return (
    <span
      className={`flex size-5.5 shrink-0 items-center justify-center rounded-full text-white
        ${tone === "red" ? "bg-red" : "bg-green"}`}
      style={{ animation: "pop-in 300ms cubic-bezier(0.23,1,0.32,1) both" }}
    >
      {children}
    </span>
  );
}

const XIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
);
const CheckIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
);
const RetryIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
);

/* One detail line shown when a task row is expanded. */
export type TaskDetail = { label: string; meta: string };

/* A single task row.
 *  - "done"     → green check badge + completed pill (static)
 *  - "running"  → active spinner showing `step`, no pill (static)
 *  - "sequence" → animation-driven: pending spinner → failed → completed
 */
export type TaskRow = {
  key: string;
  label: string;
  amount: string;
  status: "done" | "running" | "sequence";
  step?: number;
  details: TaskDetail[];
};

export type TaskRowsLabels = {
  completed: string;
  failed: string;
};

const DEFAULT_LABELS: TaskRowsLabels = {
  completed: "Completed",
  failed: "Failed",
};

const TASK_ROWS: TaskRow[] = [
  {
    key: "verify",
    label: "Verified vendor records",
    amount: "12 suppliers",
    status: "done",
    details: [
      { label: "Matched tax and contact IDs", meta: "12/12" },
      { label: "Flagged stale records", meta: "0" },
    ],
  },
  {
    key: "index",
    label: "Build reorder task list",
    amount: "7 SKUs",
    status: "running",
    step: 2,
    details: [
      { label: "Reading POS export", meta: "3 files" },
      { label: "Scoring stockout risk", meta: "68%" },
    ],
  },
  {
    key: "draft",
    label: "Draft supplier emails",
    amount: "2 messages",
    status: "sequence",
    step: 3,
    details: [
      { label: "Cone supplier follow-up", meta: "draft" },
      { label: "Pistachio reorder note", meta: "draft" },
    ],
  },
];

export default function TaskRows({
  variant = "Capsules",
  rows = TASK_ROWS,
  labels,
  className,
  onToggleRow,
}: {
  variant?: string;
  rows?: TaskRow[];
  labels?: Partial<TaskRowsLabels>;
  className?: string;
  onToggleRow?: (key: string, open: boolean) => void;
}) {
  const tick = useTick(TICKS);
  const [manualOpen, setManualOpen] = useState<Record<string, boolean>>({});
  const row2: "pending" | "failed" | "done" = tick < 3 ? "pending" : tick === 3 ? "failed" : "done";
  const copy = { ...DEFAULT_LABELS, ...labels };

  const badgeFor = (row: TaskRow) => {
    if (row.status === "done") return <Badge tone="green">{CheckIcon}</Badge>;
    if (row.status === "running") return <SpinnerRing active>{row.step}</SpinnerRing>;
    return row2 === "pending" ? (
      <SpinnerRing>{row.step}</SpinnerRing>
    ) : row2 === "failed" ? (
      <Badge tone="red">{XIcon}</Badge>
    ) : (
      <Badge tone="green">{CheckIcon}</Badge>
    );
  };

  const pillFor = (row: TaskRow) => {
    if (row.status === "done")
      return (
        <span className="inline-flex h-5.5 items-center rounded-full bg-green-tint px-2 text-[11.5px] font-medium text-green">
          {copy.completed}
        </span>
      );
    if (row.status === "running") return null;
    return row2 === "failed" ? (
      <span className="inline-flex h-5.5 items-center gap-1.5 rounded-full bg-red-tint px-2 text-[11.5px] font-medium text-red" style={{ animation: "fade-in 200ms ease-out both" }}>
        {copy.failed} <span style={{ animation: "spin 1.2s linear infinite" }} className="flex">{RetryIcon}</span>
      </span>
    ) : row2 === "done" ? (
      <span className="inline-flex h-5.5 items-center gap-1.5 rounded-full bg-green-tint px-2 text-[11.5px] font-medium text-green" style={{ animation: "fade-in 200ms ease-out both" }}>
        {copy.completed}
      </span>
    ) : null;
  };

  const list = variant === "List";
  return (
    <div
      className={`flex w-full max-w-110 flex-col ${
        list ? "gap-0 self-start overflow-hidden rounded-card bg-surface shadow-card" : "min-h-[196px] gap-2"
      }${className ? ` ${className}` : ""}`}
    >
      {rows.map((row, i) => {
        const open = manualOpen[row.key] ?? (row.key === "index" && tick === 2);
        return (
          <div
            key={row.key}
            className={`self-stretch overflow-hidden transition-[border-radius,background-color] duration-300 hover:bg-inset ${
              list ? "border-b border-line last:border-0" : "bg-surface shadow-card"
            }`}
            style={{
              borderRadius: list ? 0 : open ? 14 : 22,
              animation: `fade-up 450ms cubic-bezier(0.23,1,0.32,1) ${i * 80}ms both`,
            }}
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() => {
                setManualOpen((current) => ({ ...current, [row.key]: !open }));
                onToggleRow?.(row.key, !open);
              }}
              className="flex h-11 w-full items-center gap-2.5 px-2.5 text-left"
            >
              <span className="flex size-6 shrink-0 items-center justify-center">
                {badgeFor(row)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {row.label}
              </span>
              <span className="text-[12.5px] text-ink-2 tabular-nums">{row.amount}</span>
              {pillFor(row)}
              <span
                aria-hidden="true"
                className="-ml-2 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3"
              >
                <svg
                  width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                  className="transition-transform duration-300"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>

            {/* dropdown detail — same expandable grammar as Chain of Thought */}
            <div
              className="grid transition-[grid-template-rows,opacity] duration-300"
                style={{
                  gridTemplateRows: open ? "1fr" : "0fr",
                  opacity: open ? 1 : 0,
                  transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                }}
              >
                <div className="overflow-hidden">
                  <div className="mb-2.5 grid grid-cols-[24px_1fr] gap-2.5 px-2.5">
                    <span aria-hidden className="mx-auto h-full w-px bg-line" />
                    <div className="flex flex-col gap-1.5">
                      {row.details.map((d, j) => (
                        <div
                          key={d.label}
                          className="flex items-center justify-between"
                          style={
                            open
                              ? { animation: `fade-up 300ms cubic-bezier(0.23,1,0.32,1) ${120 + j * 100}ms both` }
                              : undefined
                          }
                        >
                          <span className="text-[12px] text-ink-2">{d.label}</span>
                          <span className="font-mono text-[11.5px] text-ink-3 tabular-nums">
                            {d.meta}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * CHAT — interactive panel with tabs, replies, and composer.
 * The reply sequence begins only after the user sends.
 * ───────────────────────────────────────────────────────── */

type Phase = "idle" | "sent" | "reply1" | "reply2" | "done";

/* one scripted agent reply in the thread */
export type ChatMessage = {
  label: string;
  sub: string;
  time: string;
  body: string;
};

const MESSAGES: ChatMessage[] = [
  {
    label: "Sales History",
    sub: "Flavor Data",
    time: "4s",
    body: "Pulled 3 summers of mint chip sales for comparison.",
  },
  {
    label: "Comparison",
    sub: "Trend Detection",
    time: "2s",
    body: "Mint chip is up 12% with stronger weekend peaks.",
  },
];

const SUGGESTIONS = ["Flavors", "Suppliers"];

export type ChatComposerLabels = {
  /** the pre-filled prompt shown in the first user bubble */
  initialPrompt: string;
  /** composer input placeholder */
  placeholder: string;
};

const DEFAULT_LABELS: ChatComposerLabels = {
  initialPrompt: "Compare mint chip to last summer",
  placeholder: "Prompt or tag a flavor with @",
};

function Section({
  label,
  sub,
  time,
  body,
  resolving,
}: {
  label: string;
  sub: string;
  time: string;
  body: string;
  resolving?: boolean;
}) {
  return (
    <div
      className="flex w-full flex-col gap-1.5 transition-[opacity,filter,transform] duration-400"
      style={{
        opacity: resolving ? 0.55 : 1,
        filter: resolving ? "blur(0.5px)" : "blur(0)",
        transform: resolving ? "scale(0.985)" : "scale(1)",
        transformOrigin: "top left",
        transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        animation: "fade-up 400ms cubic-bezier(0.23,1,0.32,1) both",
      }}
    >
      <div className="flex items-center gap-1 text-[12px] leading-[1.3]">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-ink-2">{sub}</span>
        <span className="text-ink">for {time}</span>
      </div>
      <p className="text-[13px] leading-normal text-ink">{body}</p>
    </div>
  );
}

export default function ChatComposer({
  messages = MESSAGES,
  suggestions = SUGGESTIONS,
  labels,
  onSend,
}: {
  variant?: string;
  /** scripted agent replies revealed in sequence after the user sends */
  messages?: ChatMessage[];
  /** header chips (tabs) for switching context */
  suggestions?: string[];
  /** prominent copy strings */
  labels?: Partial<ChatComposerLabels>;
  /** fired with the trimmed prompt text when the user sends */
  onSend?: (text: string) => void;
} = {}) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const [phase, setPhase] = useState<Phase>("done");
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState(l.initialPrompt);
  const [tab, setTab] = useState(suggestions[0] ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (phase === "sent") t = setTimeout(() => setPhase("reply1"), 500);
    else if (phase === "reply1") t = setTimeout(() => setPhase("reply2"), 1400);
    else if (phase === "reply2") t = setTimeout(() => setPhase("done"), 1200);
    else return;
    return () => clearTimeout(t);
  }, [phase]);

  const sent = phase !== "idle";
  const canSend = draft.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    const text = draft.trim();
    setSubmitted(text);
    onSend?.(text);
    setDraft("");
    setPhase("sent");
  };

  return (
    <div className="flex h-[288px] w-full max-w-95 flex-col self-start overflow-hidden rounded-[14px] bg-surface shadow-card">
      {/* header — tabs + actions */}
      <div className="flex shrink-0 items-center justify-between border-b border-line p-1.5">
        <div className="flex items-center">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={tab === item}
              onClick={() => setTab(item)}
              className={`rounded-[6px] px-2 py-[3px] text-[13px] text-ink transition-[background-color,opacity] duration-100 ${tab === item ? "bg-field" : "opacity-50 hover:opacity-75"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[
            <path key="p" d="M12 5v14M5 12h14" />,
            <g key="h"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></g>,
            <g key="e" fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></g>,
          ].map((icon, i) => (
            <button
              key={i}
              type="button"
              aria-label="Action"
              className="flex size-6 items-center justify-center rounded-[6px] text-ink-3
                transition-colors duration-100 hover:bg-hover hover:text-ink-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {icon}
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* conversation — fixed region so the card never changes shape */}
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pt-2.5 pb-1">
        {/* user bubble — right aligned, soft block */}
        <div className="flex justify-end pl-14">
          <div
            className="rounded-xl bg-field px-3 py-1.5 text-[13px] leading-[1.4] text-ink
              transition-[opacity,transform] duration-300"
            style={{
              opacity: sent ? 1 : 0,
              transform: sent ? "translateY(0)" : "translateY(10px)",
              transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
            }}
          >
            {submitted}
          </div>
        </div>

        {messages[0] && (phase === "reply1" || phase === "reply2" || phase === "done") ? (
          <Section
            label={messages[0].label}
            sub={messages[0].sub}
            time={messages[0].time}
            body={messages[0].body}
          />
        ) : null}
        {messages[1] && (phase === "reply2" || phase === "done") ? (
          <Section
            label={messages[1].label}
            sub={messages[1].sub}
            time={messages[1].time}
            body={messages[1].body}
            resolving={phase === "reply2"}
          />
        ) : null}
      </div>

      {/* composer */}
      <div className="mt-auto shrink-0 p-1.5">
        <div
          role="presentation"
          onClick={() => inputRef.current?.focus()}
          className="flex cursor-text flex-col gap-2 rounded-control border border-line bg-field p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.035)] transition-[border-color,box-shadow] duration-150 focus-within:border-line-strong focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.025)]"
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
            }}
            placeholder={l.placeholder}
            aria-label="Chat prompt"
            className="min-h-4.5 bg-transparent text-[13px] leading-[1.4] text-ink outline-none placeholder:text-ink-3"
          />
          <div className="flex items-center justify-end">
            <button
              type="button"
              aria-label="Send"
              disabled={!canSend}
              onClick={send}
              className="flex size-7 items-center justify-center rounded-[8px]
                transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.96]"
              style={{
                background: canSend ? "var(--ink)" : "var(--line-strong)",
                color: canSend ? "var(--surface)" : "var(--ink-2)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createShader, playSweep, accentChain, ACCENTS } from "glimm";

/* The built-in "prism" palette is only cyan→indigo→magenta, so a sweep
 * reads as blue/purple. Build a true full-spectrum rainbow instead. */
const RAINBOW = accentChain([
  ACCENTS.red,
  ACCENTS.orange,
  ACCENTS.yellow,
  ACCENTS.green,
  ACCENTS.cyan,
  ACCENTS.blue,
  ACCENTS.purple,
]);

/* ─────────────────────────────────────────────────────────
 * PROMPT BAR
 * A composer with real controls: attach, @ data sources,
 * / commands, a model picker, dictation, and send.
 * Type @ or / to open the menus; ↑↓ + Enter to pick.
 * Variants: Rounded (card radius) · Pill (full radius).
 * ───────────────────────────────────────────────────────── */

function Icon({ children, size = 15, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, React.ReactNode> = {
  clip: <path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  layers: <g><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5M2 12l10 5 10-5" /></g>,
  globe: <g><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></g>,
};

/* real product marks, inline so the file stays self-contained */
const BRANDS: Record<string, React.ReactNode> = {
  figma: (
    <svg width="11" height="16" viewBox="0 0 38 57" aria-hidden="true">
      <path d="M9.5 57A9.5 9.5 0 0 0 19 47.5V38H9.5a9.5 9.5 0 0 0 0 19z" fill="#0ACF83" />
      <path d="M0 28.5A9.5 9.5 0 0 1 9.5 19H19v19H9.5A9.5 9.5 0 0 1 0 28.5z" fill="#A259FF" />
      <path d="M0 9.5A9.5 9.5 0 0 1 9.5 0H19v19H9.5A9.5 9.5 0 0 1 0 9.5z" fill="#F24E1E" />
      <path d="M19 0h9.5a9.5 9.5 0 1 1 0 19H19V0z" fill="#FF7262" />
      <path d="M38 28.5a9.5 9.5 0 1 1-19 0 9.5 9.5 0 0 1 19 0z" fill="#1ABCFE" />
    </svg>
  ),
  slack: (
    <svg width="15" height="15" viewBox="0 0 127 127" aria-hidden="true">
      <path d="M27.2 80c0 7.3-5.9 13.2-13.2 13.2C6.7 93.2.8 87.3.8 80c0-7.3 5.9-13.2 13.2-13.2h13.2V80zm6.6 0c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2v33c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V80z" fill="#E01E5A" />
      <path d="M47 27.2c-7.3 0-13.2-5.9-13.2-13.2C33.8 6.7 39.7.8 47 .8c7.3 0 13.2 5.9 13.2 13.2v13.2H47zm0 6.7c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H13.9C6.6 60.3.7 54.4.7 47.1c0-7.3 5.9-13.2 13.2-13.2H47z" fill="#36C5F0" />
      <path d="M99.9 47.1c0-7.3 5.9-13.2 13.2-13.2 7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H99.9V47.1zm-6.6 0c0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V13.9C66.9 6.6 72.8.7 80.1.7c7.3 0 13.2 5.9 13.2 13.2v33.2z" fill="#2EB67D" />
      <path d="M80.1 99.8c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2-7.3 0-13.2-5.9-13.2-13.2V99.8h13.2zm0-6.6c-7.3 0-13.2-5.9-13.2-13.2 0-7.3 5.9-13.2 13.2-13.2h33.1c7.3 0 13.2 5.9 13.2 13.2 0 7.3-5.9 13.2-13.2 13.2H80.1z" fill="#ECB22E" />
    </svg>
  ),
  gmail: (
    <svg width="15" height="12" viewBox="0 0 256 193" aria-hidden="true">
      <path d="M58.182 192.05V93.14L27.507 65.077 0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455h40.727Z" fill="#4285F4" />
      <path d="M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.156 17.837-27.026 25.798v98.91Z" fill="#34A853" />
      <path d="m58.182 93.14-4.174-38.647 4.174-36.989L128 69.868l69.818-52.364 4.669 34.992-4.669 40.644L128 145.504 58.182 93.14Z" fill="#EA4335" />
      <path d="M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945l-16.292 12.218Z" fill="#FBBC04" />
      <path d="m0 49.504 26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23v23.273Z" fill="#C5221F" />
    </svg>
  ),
};

type Source = {
  key: string;
  name: string;
  desc: string;
  glyph?: string;
  brand?: string;
  attach?: boolean;
  connect?: boolean;
};

const SOURCES: Source[] = [
  { key: "attach", name: "Add photos & files", desc: "Upload from your computer", glyph: "clip", attach: true },
  { key: "scoop", name: "Scoop Data", desc: "Sales & churn metrics", glyph: "chart" },
  { key: "flavors", name: "Flavor records", desc: "26 makers, tags, links", glyph: "layers" },
  { key: "web", name: "Web search", desc: "Real-time news and info", glyph: "globe" },
  { key: "figma", name: "Figma", desc: "Design-to-code workflows", brand: "figma" },
  { key: "slack", name: "Slack", desc: "Read and manage Slack", brand: "slack" },
  { key: "gmail", name: "Gmail", desc: "Read and manage Gmail", brand: "gmail", connect: true },
];

const COMMANDS = [
  { key: "compare", name: "/compare", desc: "Flavor vs. last summer" },
  { key: "churn-plan", name: "/churn-plan", desc: "Draft a churn schedule" },
  { key: "restock", name: "/restock", desc: "Build a reorder list" },
  { key: "draft-email", name: "/draft-email", desc: "Write a supplier email" },
  { key: "summarize", name: "/summarize", desc: "Digest the thread so far" },
];

const MODELS = [
  { key: "sprinkles-5", name: "Sprinkles 5", tag: "Flagship" },
  { key: "vanilla-1", name: "Vanilla 1", tag: "Basic" },
  { key: "freezer-burn", name: "Freezer Burn 0.4", tag: "Stale" },
];

const FILES = ["flavor-chart.png", "summer-menu.pdf", "pos-export.csv"];
const DICTATION = "Compare pistachio weekends to last summer";

/* self-running demo: walk the @ menu, then the / menu, and repeat.
 * Any pointer or key interaction hands control to the user. */
const AUTO_STEPS: {
  draft: string;
  active?: number;
  connect?: boolean;
  modelOpen?: boolean;
  model?: string;
  hold: number;
}[] = [
  { draft: "", connect: false, model: "vanilla-1", hold: 1100 },
  { draft: "@", active: 0, hold: 900 },
  { draft: "@", active: 1, hold: 620 },
  { draft: "@", active: 4, hold: 620 },
  { draft: "@", active: 6, hold: 700 },
  { draft: "@", active: 6, connect: true, hold: 1000 },
  { draft: "", hold: 700 },
  { draft: "/", active: 0, hold: 900 },
  { draft: "/", active: 1, hold: 620 },
  { draft: "/", active: 3, hold: 1000 },
  { draft: "", hold: 800 },
  // open the model picker and upgrade to the flagship → rainbow sweep
  { draft: "", modelOpen: true, hold: 1200 },
  { draft: "", model: "sprinkles-5", hold: 2400 },
  { draft: "", hold: 900 },
];

/* the last @word or /word being typed, if any */
function parseToken(draft: string): { kind: "at" | "slash"; query: string; start: number } | null {
  const match = /(^|\s)([@/])([\w-]*)$/.exec(draft);
  if (!match) return null;
  return {
    kind: match[2] === "@" ? "at" : "slash",
    query: match[3].toLowerCase(),
    start: match.index + match[1].length,
  };
}

export default function PromptBar({
  variant = "Rounded",
  demo = true,
  tall = false,
  placeholder,
  onSend,
}: {
  variant?: string;
  /** the self-running walkthrough; turn off when embedding in a real surface */
  demo?: boolean;
  /** hero sizing: a multi-line input with controls on their own row */
  tall?: boolean;
  placeholder?: string;
  onSend?: (text: string) => void;
}) {
  const pill = variant === "Pill";
  const [draft, setDraft] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [plusOpen, setPlusOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState(MODELS[1]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [active, setActive] = useState(0);
  const [listening, setListening] = useState(false);
  const [auto, setAuto] = useState(demo);
  const [autoStep, setAutoStep] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const wide = expanded || tall;
  const [rowBox, setRowBox] = useState<{ top: number; height: number } | null>(null);
  const [engaged, setEngaged] = useState(false);
  const [modelBox, setModelBox] = useState<{ top: number; height: number } | null>(null);
  const [modelHovered, setModelHovered] = useState<number | null>(null);
  const [modelMenuLeft, setModelMenuLeft] = useState(0);
  const [modelMenuBottom, setModelMenuBottom] = useState(0);
  const composerAnchorRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const modelRef = useRef<HTMLButtonElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modelRowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const glimmRef = useRef<HTMLCanvasElement>(null);
  const shaderRef = useRef<ReturnType<typeof createShader> | null>(null);
  const sweepingRef = useRef(false);

  /* hand control to the user: stop the demo loop, and when they aim at
   * the input itself, clear the demo's leftover draft for a clean start */
  const takeOver = (event: { target: EventTarget | null }) => {
    setAuto(false);
    if (auto && event.target === inputRef.current) setDraft("");
  };

  const token = dismissed ? null : parseToken(draft);
  const menu: "at" | "slash" | null = plusOpen ? "at" : token?.kind ?? null;
  const query = plusOpen ? "" : token?.query ?? "";

  const rows: { key: string; name: string; desc: string }[] =
    menu === "at"
      ? SOURCES.filter((s) => s.name.toLowerCase().includes(query))
      : menu === "slash"
        ? COMMANDS.filter((c) => c.name.slice(1).startsWith(query))
        : [];

  useEffect(() => {
    setActive(0);
    setEngaged(false);
  }, [menu, query]);

  /* a single highlight glides to the active row instead of each row
   * toggling its own background — matches the gliding pill in the nav */
  useLayoutEffect(() => {
    const target = rowRefs.current[active];
    if (target) setRowBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [menu, query, active, connected, rows.length]);

  /* same gliding highlight in the model menu — floats to the hovered
   * row, falling back to the currently-selected model */
  const modelIndex = MODELS.findIndex((m) => m.key === model.key);
  useLayoutEffect(() => {
    if (!modelOpen) return;
    const target = modelRowRefs.current[modelHovered ?? modelIndex];
    if (target) setModelBox({ top: target.offsetTop, height: target.offsetHeight });
  }, [modelOpen, modelHovered, modelIndex]);

  /* The menu is outside the clipped composer, so align it to the model
   * trigger by measurement instead of pinning it to the far-right edge. */
  useLayoutEffect(() => {
    if (!modelOpen || !composerAnchorRef.current || !modelRef.current) return;
    const anchorRect = composerAnchorRef.current.getBoundingClientRect();
    const triggerRect = modelRef.current.getBoundingClientRect();
    setModelMenuLeft(Math.max(0, Math.min(triggerRect.left - anchorRect.left, anchorRect.width - 176)));
    setModelMenuBottom(anchorRect.bottom - triggerRect.top + 8);
  }, [modelOpen, wide, model.name]);

  useEffect(() => {
    if (!modelOpen) setModelHovered(null);
  }, [modelOpen]);

  /* Build the shader with a pinned hue phase. createShader seeds its
   * internal hueShift from Math.random(), which made the sweep a different
   * colour on every reload — pin it so the rainbow is identical each time. */
  const makeShader = () => {
    const canvas = glimmRef.current;
    if (!canvas) return null;
    const random = Math.random;
    Math.random = () => 0;
    try {
      return createShader({
        canvas,
        palette: RAINBOW,
        direction: "ltr",
        bandTight: 10,
        swellAmount: 0.85,
      });
    } finally {
      Math.random = random;
    }
  };

  /* Glimm shader lives inside the composer, invisible at rest. Selecting
   * the flagship model fires a one-shot rainbow sweep across the interior. */
  useEffect(() => {
    shaderRef.current = makeShader();
    return () => {
      shaderRef.current?.destroy();
      shaderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const celebrate = () => {
    if (sweepingRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Recreate the shader per sweep so uTime restarts at 0 — the hue phase
    // (which drifts with time) is then identical on every trigger.
    shaderRef.current?.destroy();
    const shader = makeShader();
    shaderRef.current = shader;
    if (!shader) return;
    sweepingRef.current = true;
    const sweep = playSweep(shader, {
      palette: RAINBOW,
      direction: "ltr",
      sweepMs: 570,
      outroMs: 80,
      peakAlpha: 1.3,
      bandTight: 10,
      brightness: 1.4,
      swellAmount: 1,
      waveSpeed: 1.8,
      easing: "easeOutExpo",
    });
    sweep.done.finally(() => {
      sweepingRef.current = false;
    });
  };

  const selectModel = (next: (typeof MODELS)[number]) => {
    setModel(next);
    setModelOpen(false);
    if (next.key === "sprinkles-5") celebrate();
  };

  /* autoplay: apply the current step, then advance after its hold */
  useEffect(() => {
    if (!auto) return;
    const step = AUTO_STEPS[autoStep % AUTO_STEPS.length];
    setDraft(step.draft);
    if (step.active !== undefined) setActive(step.active);
    if (step.connect !== undefined) setConnected(step.connect);
    if (step.modelOpen !== undefined) setModelOpen(step.modelOpen);
    if (step.model) {
      const next = MODELS.find((m) => m.key === step.model);
      if (next) selectModel(next);
    }
    const t = setTimeout(() => setAutoStep((s) => s + 1), step.hold);
    return () => clearTimeout(t);
  }, [auto, autoStep]);

  /* dictation resolves after a beat, like a real transcript landing */
  useEffect(() => {
    if (!listening) return;
    const t = setTimeout(() => {
      setDraft((current) => (current ? `${current.trimEnd()} ${DICTATION}` : DICTATION));
      setListening(false);
      inputRef.current?.focus();
    }, 2200);
    return () => clearTimeout(t);
  }, [listening]);

  /* Move wrapped text above the controls, then grow to a compact maximum. */
  useLayoutEffect(() => {
    const input = inputRef.current;
    const controls = controlsRef.current;
    const measure = measureRef.current;
    const modelButton = modelRef.current;
    if (!input || !controls || !measure || !modelButton) return;

    const fixedControlsWidth = 28 * 3 + modelButton.offsetWidth;
    const inlineGaps = 4 * 4;
    const inlineInputWidth = controls.clientWidth - fixedControlsWidth - inlineGaps;
    const needsFullWidth = draft.includes("\n") || measure.offsetWidth + 8 > inlineInputWidth;
    if (needsFullWidth !== expanded) {
      setExpanded(needsFullWidth);
    }

    const minHeight = 28;
    const maxHeight = 100;
    input.style.height = "0px";
    const contentHeight = input.scrollHeight;
    input.style.height = `${Math.min(Math.max(contentHeight, minHeight), maxHeight)}px`;
    input.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [draft, expanded]);

  /* clicking anywhere outside the composer closes the open menus */
  useEffect(() => {
    if (!modelOpen && !plusOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-promptbar]")) {
        setModelOpen(false);
        setPlusOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [modelOpen, plusOpen]);

  const closeMenus = () => {
    setPlusOpen(false);
    setModelOpen(false);
  };

  const pick = (row: { key: string; name: string }) => {
    const source = SOURCES.find((s) => s.key === row.key);
    if (source?.attach) {
      setAttachments((current) => [...current, FILES[current.length % FILES.length]]);
      if (token) setDraft(draft.slice(0, token.start));
    } else if (menu === "at") {
      setDraft(`${token ? draft.slice(0, token.start) : draft}@${row.name} `);
    } else {
      setDraft(`${token ? draft.slice(0, token.start) : draft}${row.name} `);
    }
    setPlusOpen(false);
    setDismissed(false);
    inputRef.current?.focus();
  };

  const canSend = draft.trim().length > 0 || attachments.length > 0;
  const send = () => {
    if (!canSend) return;
    onSend?.(draft.trim());
    setDraft("");
    setAttachments([]);
    closeMenus();
  };

  return (
    <div
      data-promptbar
      className={demo ? "flex min-h-[384px] w-full max-w-105 flex-col justify-end pb-8" : "w-full"}
      onPointerDownCapture={takeOver}
      onKeyDownCapture={takeOver}
    >
      {/* composer is the anchor — menus grow up from its top edge */}
      <div ref={composerAnchorRef} className="relative">
      {/* ── @ / slash menu ─────────────────────────────── */}
      {menu && (
        <div
          onMouseLeave={() => setEngaged(false)}
          className="absolute inset-x-0 bottom-full z-10 mb-2 rounded-[10px] bg-surface p-1 shadow-raised"
          style={{ animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom center" }}
        >
          {/* single gliding highlight — appears once a row is hovered */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
            style={{
              top: rowBox?.top ?? 0,
              height: rowBox?.height ?? 0,
              opacity: rowBox && engaged && rows.length > 0 ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {rows.map((row, i) => {
            const source = menu === "at" ? SOURCES.find((s) => s.key === row.key) : undefined;
            return (
              <button
                key={row.key}
                type="button"
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => {
                  setActive(i);
                  setEngaged(true);
                }}
                onClick={() => pick(row)}
                className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[6px] px-2 text-left"
              >
                {source && (
                  <span className="flex size-5.5 shrink-0 items-center justify-center text-ink-2">
                    {source.brand ? BRANDS[source.brand] : <Icon size={15}>{GLYPHS[source.glyph ?? "clip"]}</Icon>}
                  </span>
                )}
                <span className="shrink-0 text-[12.5px] font-medium text-ink">
                  {row.name}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-3">{row.desc}</span>
                {source?.connect && (
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(event) => {
                      event.stopPropagation();
                      setConnected((current) => !current);
                    }}
                    className={`shrink-0 text-[12px] font-medium transition-colors duration-100 ${
                      connected ? "text-green" : "text-accent-ink hover:underline"
                    }`}
                  >
                    {connected ? "Connected" : "Connect"}
                  </span>
                )}
              </button>
            );
          })}
          {rows.length === 0 && (
            <div className="flex h-9 items-center px-2 text-[12px] text-ink-3">
              No matches for “{query}”
            </div>
          )}
          <div className="mt-1 border-t border-line px-2 pt-1.5 pb-1 text-[11px] text-ink-3">
            {menu === "at" ? "Type to search sources & files" : "Type to search commands"}
          </div>
        </div>
      )}

      {/* ── model menu ─────────────────────────────────── */}
      {modelOpen && (
        <div
          onMouseLeave={() => setModelHovered(null)}
          className="absolute z-10 w-44 rounded-[10px] bg-surface p-1 shadow-raised"
          style={{ left: modelMenuLeft, bottom: modelMenuBottom, animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "bottom left" }}
        >
          {/* single gliding highlight — floats to the hovered / selected row */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
            style={{
              top: modelBox?.top ?? 0,
              height: modelBox?.height ?? 0,
              opacity: modelBox && modelHovered !== null ? 1 : 0,
              transition:
                "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
            }}
          />
          {MODELS.map((m, i) => (
            <button
              key={m.key}
              type="button"
              ref={(el) => {
                modelRowRefs.current[i] = el;
              }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setModelHovered(i)}
              onClick={() => {
                selectModel(m);
                inputRef.current?.focus();
              }}
              className="relative z-10 flex h-7.5 w-full items-center gap-2 rounded-[6px] px-2 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{m.name}</span>
              <span className="shrink-0 text-[11px] text-ink-3">{m.tag}</span>
              <span className={`shrink-0 text-ink ${m.key === model.key ? "" : "invisible"}`}>
                <Icon size={13} strokeWidth={2.5}><path d="M20 6L9 17l-5-5" /></Icon>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── composer ───────────────────────────────────── */}
      <div
        className={`relative isolate flex flex-col overflow-hidden border border-line bg-surface shadow-card transition-[border-color,border-radius] duration-150 focus-within:border-line-strong ${
          tall ? "gap-2.5 p-3.5" : "gap-1.5 p-1.5"
        } ${
          pill ? (attachments.length > 0 || wide ? "rounded-[24px]" : "rounded-full") : tall ? "rounded-[22px]" : "rounded-[14px]"
        }`}
      >
        {/* rainbow glimm sweep — plays across the interior on model change.
            explicit w/h: a <canvas> is a replaced element and won't stretch
            to inset-0 alone, which feeds back into the shader's ResizeObserver. */}
        <canvas
          ref={glimmRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
          style={{ borderRadius: "inherit" }}
        />
        <span
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none absolute invisible whitespace-pre text-[13px] leading-[18px]"
        >
          {draft}
        </span>

        {attachments.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 pt-0.5 ${pill ? "px-1" : "px-0.5"}`}>
            {attachments.map((file, i) => (
              <span
                key={`${file}-${i}`}
                className={`flex h-6.5 items-center gap-1.5 bg-field py-1 pr-1 pl-1.5 text-[11.5px] text-ink-2 shadow-hairline ${
                  pill ? "rounded-full" : "rounded-chip"
                }`}
                style={{ animation: "pop-in 200ms cubic-bezier(0.23,1,0.32,1) both" }}
              >
                <Icon size={12}><g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></g></Icon>
                <span className="max-w-36 truncate">{file}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file}`}
                  onClick={() => setAttachments((current) => current.filter((_, j) => j !== i))}
                  className={`-my-1 flex size-6 items-center justify-center text-ink-3 transition-colors duration-100 hover:bg-line/70 hover:text-ink ${
                    pill ? "rounded-full" : "rounded-[5px]"
                  }`}
                >
                  <Icon size={10} strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></Icon>
                </button>
              </span>
            ))}
          </div>
        )}

        <div
          ref={controlsRef}
          className={`grid items-end gap-x-1 gap-y-1.5 ${
            wide
              ? "grid-cols-[28px_auto_minmax(0,1fr)_28px_28px]"
              : "grid-cols-[28px_minmax(0,1fr)_auto_28px_28px]"
          }`}
        >
          <button
            type="button"
            aria-label="Add attachments and sources"
            aria-expanded={plusOpen}
            onClick={() => {
              setModelOpen(false);
              setPlusOpen((current) => !current);
              inputRef.current?.focus();
            }}
            className={`flex size-7 shrink-0 items-center justify-center justify-self-start text-ink-3 transition-[background-color,color,transform] duration-150 hover:bg-hover hover:text-ink active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${plusOpen ? "bg-hover text-ink" : ""} ${wide ? "col-start-1 row-start-2" : "col-start-1 row-start-1"}`}
          >
            <Icon size={16} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Icon>
          </button>

          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setDismissed(false);
              setPlusOpen(false);
            }}
            onKeyDown={(event) => {
              if (menu && rows.length > 0) {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setEngaged(true);
                  setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
                  return;
                }
                if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
                  event.preventDefault();
                  pick(rows[active]);
                  return;
                }
              }
              if (event.key === "Escape") {
                setDismissed(true);
                closeMenus();
                return;
              }
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={listening ? "Listening…" : placeholder ?? "Write a message…"}
            aria-label="Prompt"
            className={`${tall ? "min-h-[68px] px-2 py-2 text-[14px] leading-5" : "min-h-7 px-1 py-[5px] text-[13px] leading-[18px]"} min-w-0 w-full resize-none bg-transparent text-ink outline-none [overflow-wrap:anywhere] placeholder:text-ink-3 ${
              wide ? "col-span-full col-start-1 row-start-1" : "col-start-2 row-start-1"
            }`}
          />

          {/* model picker */}
          <button
            ref={modelRef}
            type="button"
            aria-expanded={modelOpen}
            aria-label="Choose model"
            onClick={() => {
              setPlusOpen(false);
              setModelOpen((current) => !current);
            }}
            className={`flex h-7 shrink-0 items-center gap-1 px-1.5 text-[12px] font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${wide ? "col-start-2 row-start-2 justify-self-start" : "col-start-3 row-start-1"}`}
          >
            {model.name}
            <span className="text-ink-3">
              <Icon size={11} strokeWidth={2.4}><path d="M6 9l6 6 6-6" /></Icon>
            </span>
          </button>

          {/* dictation */}
          <button
            type="button"
            aria-label={listening ? "Stop dictation" : "Start dictation"}
            aria-pressed={listening}
            onClick={() => setListening((current) => !current)}
            className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-150 active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${listening ? "bg-accent-tint text-accent-ink" : "text-ink-3 hover:bg-hover hover:text-ink"} ${wide ? "col-start-4 row-start-2" : "col-start-4 row-start-1"}`}
          >
            {listening ? (
              <span className="flex h-3.5 items-center gap-[2.5px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-[2.5px] rounded-full bg-current"
                    style={{ height: "100%", animation: `eq-bounce 900ms ease-in-out ${i * 150}ms infinite` }}
                  />
                ))}
              </span>
            ) : (
              <Icon size={15} strokeWidth={2}><g><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" /></g></Icon>
            )}
          </button>

          {/* send — tactile square (round in the pill variant) */}
          <button
            type="button"
            aria-label="Send"
            disabled={!canSend}
            onClick={send}
            className={`flex size-7 shrink-0 items-center justify-center transition-[background-color,color,transform] duration-200 enabled:active:scale-[0.94] ${
              pill ? "rounded-full" : "rounded-[8px]"
            } ${wide ? "col-start-5 row-start-2" : "col-start-5 row-start-1"}`}
            style={{
              background: canSend ? "var(--ink)" : "var(--line-strong)",
              color: canSend ? "var(--surface)" : "var(--ink-2)",
            }}
          >
            <Icon size={16} strokeWidth={2.4}><path d="M12 19V5M5 12l7-7 7 7" /></Icon>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button, type ButtonVariant } from "@/components/atoms/Button";
import { EntityChip } from "@/components/atoms/EntityChip";
import { ValuePill } from "@/components/atoms/ValuePill";

/* ─────────────────────────────────────────────────────────
 * RECOMMENDATION CARD
 * The card holds its shape. Pressing "Alternatives" opens a
 * new drawer listing the other options; picking one promotes
 * it to the recommendation. The primary action confirms.
 * ───────────────────────────────────────────────────────── */

export type RecommendationOption = {
  key: string;
  body: React.ReactNode;
  short: string;
  signal: number;
  tone: string;
  label: string;
  cta: string;
  ctaVariant: ButtonVariant;
};

export type RecommendationLabels = {
  title: string;
  alternatives: string;
  otherOptions: string;
  accepted: string;
};

const DEFAULT_LABELS: RecommendationLabels = {
  title: "Want me to place this restock order?",
  alternatives: "Alternatives",
  otherOptions: "Other options",
  accepted: "Accepted",
};

const OPTIONS: RecommendationOption[] = [
  {
    key: "high",
    body: (
      <>
        Reorder waffle cones from{" "}
        <EntityChip name="Cone King" />{" "}
        with lead time <ValuePill tone="green">7 days</ValuePill>
      </>
    ),
    short: "Reorder from Cone King · 7-day lead",
    signal: 3,
    tone: "var(--green)",
    label: "High confidence",
    cta: "Accept",
    ctaVariant: "accent",
  },
  {
    key: "review",
    body: (
      <>
        Switch vanilla to <ValuePill>Vanilla Madagascar</ValuePill> for peak season.
      </>
    ),
    short: "Switch to Vanilla Madagascar",
    signal: 2,
    tone: "var(--orange)",
    label: "Needs review",
    cta: "Configure",
    ctaVariant: "primary",
  },
  {
    key: "none",
    body: (
      <>
        Fall back to a <span className="font-medium text-ink">full restock</span> across every SKU.
      </>
    ),
    short: "Full restock across every SKU",
    signal: 0,
    tone: "var(--ink-3)",
    label: "No signal",
    cta: "Accept full restock",
    ctaVariant: "primary",
  },
];

function Meter({ signal, tone }: { signal: number; tone: string }) {
  return (
    <span className="flex items-end gap-0.5">
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="w-1 rounded-full transition-colors duration-300"
          style={{ height: 10, background: bar < signal ? tone : "var(--line-strong)" }}
        />
      ))}
    </span>
  );
}

export default function RecommendationCard({
  options = OPTIONS,
  labels,
}: {
  options?: RecommendationOption[];
  labels?: Partial<RecommendationLabels>;
  variant?: string;
} = {}) {
  const t = { ...DEFAULT_LABELS, ...labels };
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const active = options[selected];
  const others = options.map((o, i) => ({ o, i })).filter(({ i }) => i !== selected);

  return (
    <div className="w-full max-w-95 overflow-hidden rounded-card bg-surface shadow-card">
      <div className="primitive-card-pad">
        <span className="text-[14px] font-medium text-ink">
          {t.title}
        </span>
        <p
          key={active.key}
          className="mt-1.5 min-h-12 text-[13px] leading-relaxed text-ink-2"
          style={{ animation: "fade-in 180ms ease-out both" }}
        >
          {active.body}
        </p>
      </div>

      {/* alternatives drawer — a distinctly new section of the card */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          opacity: open ? 1 : 0,
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line bg-surface px-2 py-2">
            <p className="px-1.5 pb-1 text-[11px] font-medium text-ink-3">
              {t.otherOptions}
            </p>
            {others.map(({ o, i }) => (
              <button
                key={o.key}
                type="button"
                onClick={() => {
                  setSelected(i);
                  setAccepted(false);
                }}
                className="flex w-full items-center gap-2.5 rounded-control px-1.5 py-1.5
                  text-left transition-colors duration-100 hover:bg-hover"
              >
                <Meter signal={o.signal} tone={o.tone} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{o.short}</span>
                <span className="shrink-0 text-[11px] text-ink-3">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="primitive-card-footer flex items-center justify-between gap-3 bg-surface">
        <span className="flex items-center gap-2">
          <Meter signal={active.signal} tone={active.tone} />
          <span className="text-[12.5px] font-medium text-ink-2">{active.label}</span>
        </span>

        <span className="-mr-0.5 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
            className="px-2.5 text-[12.5px]"
          >
            {t.alternatives}
          </Button>
          <Button
            variant={accepted ? "success" : active.ctaVariant}
            size="sm"
            onClick={() => setAccepted(true)}
            className="text-[12.5px]"
          >
            {accepted ? t.accepted : active.cta}
          </Button>
        </span>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * CONTEXT CARDS
 * Retrieved chunks enter once, then remain available.
 * ───────────────────────────────────────────────────────── */

export type ContextChunk = {
  title: string;
  chars: string;
  body: string;
  source: string;
  badge: string;
  tone: string;
};

export type ContextCardsLabels = {
  header: string;
  count: string;
};

const DEFAULT_LABELS: ContextCardsLabels = {
  header: "All chunks",
  count: "32",
};

const CHUNKS: ContextChunk[] = [
  {
    title: "Vendor onboarding rule",
    chars: "290 characters",
    body: "Cold-chain certification must be verified before a new dairy can be added to the reorder workflow.",
    source: "Dairy Onboarding SOP.pdf",
    badge: "PDF",
    tone: "bg-red",
  },
  {
    title: "Seasonal demand row",
    chars: "1,250 characters",
    body: "Q4 velocity table: pistachio +18%, vanilla +6%, rocky road -11%; retire flavors below 40 scoops weekly.",
    source: "Sales Velocity Export.csv",
    badge: "CSV",
    tone: "bg-green",
  },
];

export default function ContextCards({
  chunks = CHUNKS,
  labels,
  className,
}: {
  /** Accepted for gallery/registry parity; ContextCards has no visual variants. */
  variant?: string;
  chunks?: ContextChunk[];
  labels?: Partial<ContextCardsLabels>;
  className?: string;
} = {}) {
  const [chipsShown, setChipsShown] = useState(false);
  const copy = { ...DEFAULT_LABELS, ...labels };

  useEffect(() => {
    const chips = setTimeout(() => setChipsShown(true), 700);
    return () => clearTimeout(chips);
  }, []);

  return (
    <div className={`flex w-full max-w-95 flex-col gap-2${className ? ` ${className}` : ""}`}>
      <div
        className="flex items-center gap-2 px-0.5"
        style={{ animation: "fade-in 400ms ease-out both" }}
      >
        <span className="text-[13px] font-semibold text-ink">{copy.header}</span>
        <span className="inline-flex h-5 items-center rounded-md bg-inset px-1.5 text-[11.5px] font-medium text-ink-2 shadow-hairline tabular-nums">
          {copy.count}
        </span>
      </div>

      {chunks.map((chunk, i) => (
        <div
          key={chunk.title}
          className="overflow-hidden rounded-card bg-surface shadow-card"
          style={{
            animation: `fade-up 400ms cubic-bezier(0.23,1,0.32,1) ${i * 100}ms both`,
          }}
        >
          <div className="primitive-card-bar flex items-center gap-2.5 border-b border-line">
            <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-ink">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
              <span className="truncate">{chunk.title}</span>
            </span>
            <span className="ml-auto shrink-0 text-[12px] text-ink-3 tabular-nums">{chunk.chars}</span>
          </div>
          <p className="px-3 pt-2 pb-1 text-[12.5px] leading-relaxed text-ink-2">
            {chunk.body}
          </p>
          <div className="px-3 pb-3">
            <span
              className="inline-flex h-6 items-center gap-1.5 rounded-full bg-inset px-2
                text-[12px] font-medium text-ink-2 shadow-btn
                transition-[opacity,transform,background-color] duration-300 hover:bg-hover"
              style={{
                opacity: chipsShown ? 1 : 0,
                transform: chipsShown ? "scale(1)" : "scale(0.95)",
                transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                transitionDelay: `${i * 80}ms`,
              }}
            >
              <span className={`flex size-3.5 items-center justify-center rounded-[4px] ${chunk.tone} text-[7px] font-bold text-white`}>
                {chunk.badge}
              </span>
              {chunk.source}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M7 7h10v10" /></svg>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}


"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import GlideMenu from "@/components/primitives/GlideMenu";

/* ─────────────────────────────────────────────────────────
 * RECORDS TABLE — an AI spreadsheet grid. Columns are
 * *properties*: click a header to open its configuration
 * popover (type, tool, grounding, inputs, prompt, run), add
 * a new AI property from the + header, and watch cells
 * resolve row-by-row while it calculates.
 * ───────────────────────────────────────────────────────── */

type Strength = "strong" | "weak" | "veryweak" | "none";
type SortKey = "name" | "last" | "strength";
type ColumnKey = "company" | "categories" | "last" | "strength" | "links" | "ai";

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  company: 270,
  categories: 275,
  last: 190,
  strength: 210,
  links: 175,
  ai: 240,
};

const STRENGTH: Record<Strength, { label: string; color: string; rank: number }> = {
  strong: { label: "Very strong", color: "var(--green)", rank: 3 },
  weak: { label: "Weak", color: "var(--orange)", rank: 2 },
  veryweak: { label: "Very weak", color: "var(--red)", rank: 1 },
  none: { label: "No communication", color: "var(--ink-3)", rank: 0 },
};

// A single mid-lightness base hue per tag. Background, text, and border are
// derived from this via color-mix() against the theme tokens in .records-tag,
// so the chips adapt to light and dark automatically (same pattern as FilterTable).
type TagColor = { base: string };

const TAG_PALETTE: Record<string, TagColor> = {
  amber: { base: "oklch(0.76 0.13 70)" },
  lime: { base: "oklch(0.77 0.16 122)" },
  yellow: { base: "oklch(0.80 0.15 101)" },
  purple: { base: "oklch(0.62 0.18 293)" },
  orange: { base: "oklch(0.71 0.16 48)" },
  cyan: { base: "oklch(0.72 0.10 221)" },
  red: { base: "oklch(0.64 0.19 27)" },
  magenta: { base: "oklch(0.66 0.21 323)" },
  green: { base: "oklch(0.70 0.13 162)" },
  pink: { base: "oklch(0.67 0.19 3)" },
};

const TAG_COLORS: Record<string, TagColor> = {
  B2B: TAG_PALETTE.amber,
  B2C: TAG_PALETTE.lime,
  Cafe: TAG_PALETTE.red,
  Catering: TAG_PALETTE.magenta,
  "Dairy-free": TAG_PALETTE.cyan,
  Gelato: TAG_PALETTE.purple,
  Imports: TAG_PALETTE.orange,
  Local: TAG_PALETTE.green,
  Seasonal: TAG_PALETTE.yellow,
  Sorbet: TAG_PALETTE.pink,
  Vegan: TAG_PALETTE.lime,
  Wholesale: TAG_PALETTE.amber,
};

export type RecordRow = {
  id: string;
  name: string;
  tags: string[];
  last: string;
  strength: Strength;
  website?: string;
};

const INITIAL_ROWS: RecordRow[] = [
  { id: "aurora", name: "Aurora Scoops — Reykjavík", tags: ["Gelato", "Seasonal"], last: "9 days ago", strength: "strong", website: "aurora-scoops.example.com" },
  { id: "kumo", name: "Kumo Creamery — Tokyo", tags: ["B2C", "Cafe", "Vegan"], last: "3 weeks ago", strength: "strong", website: "kumo-creamery.example.com" },
  { id: "sol-nieve", name: "Sol y Nieve — Buenos Aires", tags: ["Gelato", "Local"], last: "2 months ago", strength: "weak", website: "sol-y-nieve.example.com" },
  { id: "maple-orbit", name: "Maple Orbit — Montréal", tags: ["B2B", "Wholesale", "Seasonal"], last: "15 days ago", strength: "weak", website: "maple-orbit.example.com" },
  { id: "blue-fig", name: "Blue Fig Gelato — Florence", tags: ["Gelato", "Cafe"], last: "over 1 year ago", strength: "veryweak", website: "blue-fig.example.com" },
  { id: "sahara-swirl", name: "Sahara Swirl — Marrakech", tags: ["Sorbet", "Local"], last: "5 months ago", strength: "veryweak" },
  { id: "cloudberry", name: "Cloudberry Cone — Helsinki", tags: ["Dairy-free", "Seasonal"], last: "No contact", strength: "none", website: "cloudberry-cone.example.com" },
  { id: "palm-sugar", name: "Palm Sugar Creamery — Bangkok", tags: ["B2C", "Vegan"], last: "3 months ago", strength: "veryweak", website: "palm-sugar.example.com" },
  { id: "cape-vanilla", name: "Cape Vanilla Co. — Cape Town", tags: ["Wholesale", "Imports"], last: "over 1 year ago", strength: "veryweak", website: "cape-vanilla.example.com" },
  { id: "andes-snow", name: "Andes Snow Creamery — Quito", tags: ["Gelato", "Catering"], last: "almost 2 years ago", strength: "veryweak" },
  { id: "tasman-sea", name: "Tasman Sea Gelato — Hobart", tags: ["Gelato", "Local"], last: "2 months ago", strength: "weak", website: "tasman-sea.example.com" },
  { id: "silk-road", name: "Silk Road Sorbet — Tbilisi", tags: ["Sorbet", "Imports"], last: "about 1 month ago", strength: "weak", website: "silk-road.example.com" },
  { id: "rosewater", name: "Rosewater Kulfi — Jaipur", tags: ["B2C", "Seasonal"], last: "2 months ago", strength: "veryweak" },
  { id: "lumen", name: "Lumen Soft Serve — Copenhagen", tags: ["Dairy-free", "Cafe"], last: "8 months ago", strength: "weak", website: "lumen-soft-serve.example.com" },
  { id: "cacao-norte", name: "Cacao Norte — Oaxaca", tags: ["B2B", "Local", "Wholesale"], last: "about 2 years ago", strength: "none", website: "cacao-norte.example.com" },
  { id: "pine-pistachio", name: "Pine & Pistachio — Istanbul", tags: ["Gelato", "Catering"], last: "about 1 month ago", strength: "veryweak" },
  { id: "ember-cone", name: "Ember Cone Company — Seoul", tags: ["B2C", "Vegan"], last: "15 days ago", strength: "weak", website: "ember-cone.example.com" },
  { id: "coral-coast", name: "Coral Coast Sorbet — Honolulu", tags: ["Sorbet", "Local"], last: "9 days ago", strength: "strong", website: "coral-coast.example.com" },
  { id: "sunbird", name: "Sunbird Gelateria — Lisbon", tags: ["Gelato", "Cafe"], last: "over 2 years ago", strength: "none", website: "sunbird.example.com" },
  { id: "mooncake", name: "Mooncake Ice Cream — Singapore", tags: ["B2B", "Wholesale"], last: "about 1 month ago", strength: "veryweak", website: "mooncake-ice-cream.example.com" },
  { id: "juniper", name: "Juniper & Cream — Vancouver", tags: ["Dairy-free", "Catering"], last: "No contact", strength: "none" },
  { id: "mango-moon", name: "Mango Moon Gelato — Nairobi", tags: ["Sorbet", "Vegan"], last: "almost 2 years ago", strength: "veryweak", website: "mango-moon.example.com" },
  { id: "fjord-fizz", name: "Fjord Fizz Ice — Oslo", tags: ["Dairy-free", "Seasonal"], last: "No contact", strength: "none" },
  { id: "pampa", name: "Pampa Creamery — Córdoba", tags: ["B2C", "Local"], last: "12 months ago", strength: "veryweak", website: "pampa-creamery.example.com" },
  { id: "lotus-leaf", name: "Lotus Leaf Scoops — Hanoi", tags: ["Vegan", "Cafe"], last: "15 days ago", strength: "weak" },
  { id: "saffron-sky", name: "Saffron Sky Kulfi — Dubai", tags: ["Imports", "Catering"], last: "almost 2 years ago", strength: "veryweak", website: "saffron-sky.example.com" },
  { id: "alpine-churn", name: "Alpine Churn — Zürich", tags: ["B2B", "Gelato", "Wholesale"], last: "4 days ago", strength: "strong", website: "alpine-churn.example.com" },
  { id: "monsoon-mango", name: "Monsoon Mango — Mumbai", tags: ["Sorbet", "Vegan", "Catering"], last: "18 days ago", strength: "weak", website: "monsoon-mango.example.com" },
  { id: "cedar-spoon", name: "Cedar Spoon — Beirut", tags: ["Cafe", "Local", "Seasonal"], last: "6 days ago", strength: "strong", website: "cedar-spoon.example.com" },
  { id: "baltic-berry", name: "Baltic Berry — Tallinn", tags: ["Dairy-free", "Seasonal", "B2C"], last: "5 weeks ago", strength: "weak", website: "baltic-berry.example.com" },
  { id: "delta-dairy", name: "Delta Dairy Works — New Orleans", tags: ["B2B", "Wholesale", "Local"], last: "2 days ago", strength: "strong", website: "delta-dairy.example.com" },
  { id: "yuzu-yard", name: "Yuzu Yard — Kyoto", tags: ["Sorbet", "Cafe", "Seasonal"], last: "11 days ago", strength: "strong", website: "yuzu-yard.example.com" },
  { id: "copper-cone", name: "Copper Cone — Melbourne", tags: ["Gelato", "Cafe", "B2C"], last: "about 1 month ago", strength: "weak", website: "copper-cone.example.com" },
  { id: "mint-medina", name: "Mint Medina — Tunis", tags: ["Dairy-free", "Vegan", "Local"], last: "No contact", strength: "none" },
  { id: "glacier-grove", name: "Glacier Grove — Anchorage", tags: ["Seasonal", "Local", "Catering"], last: "7 weeks ago", strength: "weak", website: "glacier-grove.example.com" },
  { id: "orchard-cloud", name: "Orchard Cloud — Lyon", tags: ["Gelato", "Seasonal", "Cafe"], last: "5 days ago", strength: "strong", website: "orchard-cloud.example.com" },
  { id: "tamarind-tide", name: "Tamarind Tide — Chennai", tags: ["Vegan", "Sorbet", "B2C"], last: "9 months ago", strength: "veryweak", website: "tamarind-tide.example.com" },
  { id: "amber-scoop", name: "Amber Scoop — Prague", tags: ["Gelato", "B2B"], last: "over 1 year ago", strength: "none" },
  { id: "boreal-batch", name: "Boreal Batch — Yellowknife", tags: ["Dairy-free", "Local", "Seasonal"], last: "8 days ago", strength: "strong", website: "boreal-batch.example.com" },
  { id: "coconut-commons", name: "Coconut Commons — Manila", tags: ["Vegan", "B2C", "Cafe"], last: "24 days ago", strength: "weak", website: "coconut-commons.example.com" },
  { id: "dolomite-dairy", name: "Dolomite Dairy — Bolzano", tags: ["Gelato", "Wholesale"], last: "3 days ago", strength: "strong", website: "dolomite-dairy.example.com" },
  { id: "equator-cream", name: "Equator Cream — Kampala", tags: ["B2B", "Catering", "Local"], last: "10 months ago", strength: "veryweak", website: "equator-cream.example.com" },
  { id: "hibiscus-house", name: "Hibiscus House — Accra", tags: ["Sorbet", "Cafe"], last: "6 weeks ago", strength: "weak", website: "hibiscus-house.example.com" },
  { id: "lagoon-ladle", name: "Lagoon Ladle — Venice", tags: ["Gelato", "Seasonal", "Catering"], last: "7 days ago", strength: "strong", website: "lagoon-ladle.example.com" },
  { id: "midnight-milk", name: "Midnight Milk — Tromsø", tags: ["Dairy-free", "Vegan", "Wholesale"], last: "No contact", strength: "none" },
  { id: "nomad-nougat", name: "Nomad Nougat — Ulaanbaatar", tags: ["Imports", "B2B"], last: "almost 2 years ago", strength: "none", website: "nomad-nougat.example.com" },
  { id: "olive-snow", name: "Olive Snow — Athens", tags: ["Gelato", "Cafe", "Local"], last: "4 days ago", strength: "strong", website: "olive-snow.example.com" },
  { id: "pacific-pear", name: "Pacific Pear — Valparaíso", tags: ["Sorbet", "Seasonal"], last: "2 months ago", strength: "weak", website: "pacific-pear.example.com" },
  { id: "quartz-cone", name: "Quartz Cone — Denver", tags: ["B2C", "Wholesale"], last: "10 days ago", strength: "strong", website: "quartz-cone.example.com" },
  { id: "red-lantern", name: "Red Lantern Creamery — Taipei", tags: ["Cafe", "Vegan"], last: "about 1 month ago", strength: "weak", website: "red-lantern.example.com" },
  { id: "salt-silk", name: "Salt & Silk — Muscat", tags: ["Imports", "Catering", "Gelato"], last: "8 months ago", strength: "veryweak", website: "salt-and-silk.example.com" },
  { id: "tropic-churn", name: "Tropic Churn — San Juan", tags: ["Sorbet", "Local", "B2C"], last: "6 days ago", strength: "strong", website: "tropic-churn.example.com" },
  { id: "umber-cream", name: "Umber Cream — Warsaw", tags: ["B2B", "Wholesale", "Cafe"], last: "5 weeks ago", strength: "weak", website: "umber-cream.example.com" },
  { id: "vanilla-vale", name: "Vanilla Vale — Antananarivo", tags: ["Imports", "Local"], last: "No contact", strength: "none" },
  { id: "willow-whip", name: "Willow Whip — Portland", tags: ["Dairy-free", "Vegan", "Cafe"], last: "3 days ago", strength: "strong", website: "willow-whip.example.com" },
  { id: "zenith-gelato", name: "Zenith Gelato — Auckland", tags: ["Gelato", "Seasonal"], last: "3 weeks ago", strength: "weak", website: "zenith-gelato.example.com" },
  { id: "apricot-atlas", name: "Apricot Atlas — Algiers", tags: ["Sorbet", "Imports"], last: "11 months ago", strength: "veryweak", website: "apricot-atlas.example.com" },
  { id: "black-sesame", name: "Black Sesame Social — Bandung", tags: ["Vegan", "Cafe", "B2C"], last: "9 days ago", strength: "strong", website: "black-sesame.example.com" },
  { id: "crimson-clover", name: "Crimson Clover — Brussels", tags: ["Gelato", "Wholesale", "Catering"], last: "2 months ago", strength: "weak", website: "crimson-clover.example.com" },
  { id: "dragonfruit-dock", name: "Dragonfruit Dock — Shenzhen", tags: ["Sorbet", "B2B", "Wholesale"], last: "No contact", strength: "none" },
];

/* the AI column resolves to fictional competitor pairs */
const AI_LABEL = "Competitors";
const COMPETITOR_POOL = [
  "Frost & Ladle",
  "Polar Pint Co.",
  "Meltwater Creamery",
  "Cirrus Scoops",
  "Golden Churn",
  "Velvet Freeze",
  "North Cone Collective",
  "Sundae Syndicate",
];
const competitorsFor = (index: number) => `${COMPETITOR_POOL[index % 8]}, ${COMPETITOR_POOL[(index + 3) % 8]}`;

function Icon({ children, size = 14, strokeWidth = 1.8 }: { children: React.ReactNode; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/* glyph library for property types & tools */
const TYPE_GLYPHS: Record<string, React.ReactNode> = {
  Text: <path d="M4 6h16M4 12h10M4 18h7" />,
  File: <g><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></g>,
  Collection: <g><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" /></g>,
  "Single select": <g><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4 4.6-4.9" /></g>,
  "Multi select": <g><path d="M11 6h9M11 12h9M11 18h9" /><path d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17" /></g>,
  URL: <g><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" /><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></g>,
  Reference: <path d="M7 17 17 7M9 7h8v8" />,
  JSON: <g><path d="M8 4c-2 0-2 2-2 3s.5 3-2 3c2.5 0 2 2 2 3s0 3 2 3" /><path d="M16 4c2 0 2 2 2 3s-.5 3 2 3c-2.5 0-2 2-2 3s0 3-2 3" /></g>,
  "File splitter": <g><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></g>,
  Date: <g><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" /></g>,
};

const TOOL_GLYPHS: Record<string, React.ReactNode> = {
  model: <path d="M12 3l1.7 5.1a2 2 0 0 0 1.2 1.2L20 11l-5.1 1.7a2 2 0 0 0-1.2 1.2L12 19l-1.7-5.1a2 2 0 0 0-1.2-1.2L4 11l5.1-1.7a2 2 0 0 0 1.2-1.2z" />,
  web: <g><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a13.5 13.5 0 0 1 3.5 9 13.5 13.5 0 0 1-3.5 9 13.5 13.5 0 0 1-3.5-9A13.5 13.5 0 0 1 12 3z" /></g>,
  user: <g><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></g>,
};

/* per-property configuration shown in the popover */
type Prompt = { before: string; chip?: string; after?: string };
type ToolKind = "model" | "web" | "user";
type ColumnMeta = { type: string; tool: string; toolKind: ToolKind; inputs?: string; prompt?: Prompt };

const COLUMN_META: Record<string, ColumnMeta> = {
  Company: { type: "Text", tool: "User input", toolKind: "user" },
  Categories: { type: "Multi select", tool: "Sprinkles 5", toolKind: "model", inputs: "Company", prompt: { before: "Tag each ", chip: "Company", after: " with its market categories." } },
  "Last interaction": { type: "Date", tool: "User input", toolKind: "user" },
  "Connection strength": { type: "Single select", tool: "Sprinkles 5", toolKind: "model", inputs: "Last interaction", prompt: { before: "Score the relationship from ", chip: "Last interaction", after: "." } },
  Links: { type: "URL", tool: "Web search", toolKind: "web", inputs: "Company", prompt: { before: "Find the website for ", chip: "Company", after: "." } },
  [AI_LABEL]: { type: "Text", tool: "Web search", toolKind: "web", inputs: "Company", prompt: { before: "Find competitors for ", chip: "Company" } },
};

const NEW_PROPERTY_TYPES = ["Text", "File", "Collection", "Single select", "Multi select", "URL", "Reference", "JSON", "File splitter"];
const MODEL_OPTIONS = ["Sprinkles 5", "Sprinkles 4.2", "Sprinkles Mini"];
const INPUT_OPTIONS = ["Company", "Categories", "Last interaction", "Connection strength", "Links"];

function Checkbox({ checked, mixed = false, onChange, label }: { checked: boolean; mixed?: boolean; onChange: () => void; label: string }) {
  return (
    <label className="records-checkbox" title={label} onClick={(event) => event.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span className={`records-checkbox-box ${checked || mixed ? "is-active" : ""}`}>
        {mixed ? <span className="records-checkbox-dash" /> : checked ? <Icon size={12}><path d="m5 12 4 4L19 6" /></Icon> : null}
      </span>
    </label>
  );
}

function Tag({ name }: { name: string }) {
  const color = TAG_COLORS[name] ?? { base: "var(--ink-3)" };
  return (
    <span
      className="records-tag"
      style={{ "--tag-base": color.base } as React.CSSProperties}
    >
      {name}
    </span>
  );
}

function TagList({ tags }: { tags: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tags.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const update = () => {
      const available = container.clientWidth;
      const tagWidths = Array.from(measure.querySelectorAll<HTMLElement>("[data-tag-measure]"), (tag) => tag.offsetWidth);
      const moreWidth = measure.querySelector<HTMLElement>("[data-more-measure]")?.offsetWidth ?? 0;
      let used = 0;
      let count = 0;

      for (let index = 0; index < tagWidths.length; index += 1) {
        const nextUsed = used + (count > 0 ? 4 : 0) + tagWidths[index];
        const hiddenAfter = tags.length - (index + 1);
        const totalWithOverflow = nextUsed + (hiddenAfter > 0 ? 4 + moreWidth : 0);
        if (totalWithOverflow > available) break;
        used = nextUsed;
        count += 1;
      }

      setVisibleCount(count);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [tags]);

  const hiddenCount = tags.length - visibleCount;

  return (
    <div ref={containerRef} className="records-tags" title={tags.join(", ")} aria-label={`Categories: ${tags.join(", ")}`}>
      <div ref={measureRef} className="records-tags-measure" aria-hidden>
        {tags.map((tag) => <span key={tag} data-tag-measure><Tag name={tag} /></span>)}
        <span data-more-measure className="records-more-tag">+{tags.length}</span>
      </div>
      {tags.slice(0, visibleCount).map((tag) => <Tag key={tag} name={tag} />)}
      {hiddenCount > 0 && <span className="records-more-tag">+{hiddenCount}</span>}
    </div>
  );
}

function CalcCell() {
  return (
    <span className="records-calc">
      <span className="records-muted">Calculating…</span>
      <span className="records-pulse" />
    </span>
  );
}

function MiniSwitch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="relative h-4.5 w-7.5 shrink-0 rounded-full transition-colors duration-150"
      style={{ background: on ? "var(--accent)" : "var(--line-strong)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 size-3.5 rounded-full bg-white shadow-btn transition-transform duration-150"
        style={{ transform: on ? "translateX(12px)" : "translateX(0)", transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)" }}
      />
    </button>
  );
}

function HeaderCell({ label, icon, sortKey, sort, onSort, onResizeStart, resizing = false, className = "", selected = false, onPick }: { label: string; icon: React.ReactNode; sortKey?: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (key: SortKey) => void; onResizeStart: (event: React.PointerEvent<HTMLSpanElement>) => void; resizing?: boolean; className?: string; selected?: boolean; onPick?: (event: React.MouseEvent) => void }) {
  return (
    <th className={`records-header-cell ${selected ? "is-colsel" : ""} ${className}`}>
      {/* header click opens the property config; the arrow sorts */}
      <button type="button" className="records-header-button" onClick={onPick}>
        <span className="records-header-icon">{icon}</span>
        <span className="truncate">{label}</span>
        {sortKey && (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Sort by ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              onSort(sortKey);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                onSort(sortKey);
              }
            }}
            className={`records-sort ${sort.key === sortKey ? "is-visible" : ""}`}
            style={{ transform: sort.key === sortKey && sort.dir === -1 ? "rotate(180deg)" : undefined }}
          >
            <Icon size={12}><path d="M12 5v14M5 12l7 7 7-7" /></Icon>
          </span>
        )}
      </button>
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label} column`}
        className={`records-resize-handle ${resizing ? "is-resizing" : ""}`}
        onPointerDown={onResizeStart}
      />
    </th>
  );
}

/* config row inside the property popover */
function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative flex h-8 items-center justify-between">
      <span className="text-[13px] text-ink-3">{label}</span>
      {children}
    </div>
  );
}

function ConfigPicker({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { label: string; icon: React.ReactNode }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div
      role="menu"
      aria-label={label}
      className="absolute left-full top-0 z-30 ml-5 w-[210px] rounded-[12px] bg-surface p-1.5 shadow-overlay"
      style={{ animation: "pop-in 140ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}
    >
      <div className="px-2 pb-1 pt-0.5 text-[11.5px] font-medium text-ink-3">{label}</div>
      <GlideMenu className="flex flex-col gap-px">
        {options.map((option) => (
          <button
            key={option.label}
            data-menu-row
            type="button"
            role="menuitemradio"
            aria-checked={selected === option.label}
            onClick={() => onSelect(option.label)}
            className="relative z-10 flex h-8 w-full items-center gap-1.5 rounded-[8px] px-1.5 text-left text-[13px] font-medium text-ink"
          >
            <span className="flex size-4 shrink-0 items-center justify-center text-ink-2">{option.icon}</span>
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
            <span className={selected === option.label ? "text-ink" : "invisible"}>
              <Icon size={14} strokeWidth={2.2}><path d="m5 12 4 4L19 6" /></Icon>
            </span>
          </button>
        ))}
      </GlideMenu>
    </div>
  );
}

function InputPicker({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div
      role="menu"
      aria-label="Calculation inputs"
      className="absolute left-full top-0 z-30 ml-5 w-[220px] rounded-[12px] bg-surface p-1.5 shadow-overlay"
      style={{ animation: "pop-in 140ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}
    >
      <div className="px-2 pb-1 pt-0.5 text-[11.5px] font-medium text-ink-3">Use values from</div>
      <GlideMenu className="flex flex-col gap-px">
        {options.map((option) => {
          const checked = selected.includes(option);
          return (
            <button
              key={option}
              data-menu-row
              type="button"
              role="menuitemcheckbox"
              aria-checked={checked}
              onClick={() => onToggle(option)}
              className="relative z-10 flex h-8 w-full items-center gap-1.5 rounded-[8px] px-1.5 text-left text-[13px] font-medium text-ink"
            >
              <span className={`flex size-4 shrink-0 items-center justify-center rounded-[5px] border ${checked ? "border-accent bg-accent text-white" : "border-line-strong text-transparent"}`}>
                <Icon size={11} strokeWidth={2.4}><path d="m5 12 4 4L19 6" /></Icon>
              </span>
              <span className="min-w-0 flex-1 truncate">{option}</span>
            </button>
          );
        })}
      </GlideMenu>
    </div>
  );
}

export default function RecordsTable({ rows = INITIAL_ROWS, fill = false }: { rows?: RecordRow[]; fill?: boolean; variant?: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [columnWidths, setColumnWidths] = useState(DEFAULT_COLUMN_WIDTHS);
  const [actionColumnWidth, setActionColumnWidth] = useState(100);
  const [columnWidthsLocked, setColumnWidthsLocked] = useState(false);
  const [resizingColumn, setResizingColumn] = useState<ColumnKey | null>(null);
  const initialColumnWidthsRef = useRef<Record<ColumnKey, number> | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  /* property popover, anchored to the clicked header */
  const [prop, setProp] = useState<{ col: string; x: number; y: number } | null>(null);
  const [grounding, setGrounding] = useState(false);
  const [groundingHelpOpen, setGroundingHelpOpen] = useState(false);
  const [configMenu, setConfigMenu] = useState<"type" | "tool" | "inputs" | null>(null);
  const [columnOverrides, setColumnOverrides] = useState<Record<string, Partial<ColumnMeta>>>({});
  const [inputSelections, setInputSelections] = useState<Record<string, string[]>>({});
  const [pinnedColumns, setPinnedColumns] = useState<Set<string>>(new Set());
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState({ required: false, allowEmpty: true, confidence: false });
  /* + new-property menu */
  const [addOpen, setAddOpen] = useState<{ x: number; y: number } | null>(null);
  const [tableMenuOpen, setTableMenuOpen] = useState<{ x: number; y: number } | null>(null);
  /* the added AI column and its lifecycle */
  const [aiAdded, setAiAdded] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [pendingOpenAi, setPendingOpenAi] = useState(false);
  const aiThRef = useRef<HTMLTableCellElement>(null);
  /* programmatic scrolls (revealing the new column) shouldn't close popovers */
  const ignoreScrollRef = useRef(false);
  /* a running calculation resolves rows one by one */
  const [calc, setCalc] = useState<{ col: string; resolved: number } | null>(null);

  /* Let the table fill its available space once, then capture those rendered
   * widths before paint. From that point on every column is explicit, so a
   * resize changes only the dragged column and the table's total width. */
  useLayoutEffect(() => {
    if (columnWidthsLocked || !tableRef.current) return;
    const headers = Array.from(tableRef.current.querySelectorAll<HTMLTableCellElement>("thead th"));
    if (headers.length < 6) return;

    const measured: Record<ColumnKey, number> = {
      company: headers[0].getBoundingClientRect().width,
      categories: headers[1].getBoundingClientRect().width,
      last: headers[2].getBoundingClientRect().width,
      strength: headers[3].getBoundingClientRect().width,
      links: headers[4].getBoundingClientRect().width,
      ai: DEFAULT_COLUMN_WIDTHS.ai,
    };
    initialColumnWidthsRef.current = measured;
    setColumnWidths(measured);
    setActionColumnWidth(headers[headers.length - 1].getBoundingClientRect().width);
    setColumnWidthsLocked(true);
  }, [columnWidthsLocked]);

  const visibleRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const value = sort.key === "name"
        ? a.name.localeCompare(b.name)
        : sort.key === "last"
          ? a.last.localeCompare(b.last)
          : STRENGTH[a.strength].rank - STRENGTH[b.strength].rank;
      return value * sort.dir;
    });
  }, [rows, sort]);

  /* stagger: one row resolves every beat */
  useEffect(() => {
    if (!calc) return;
    if (calc.resolved > visibleRows.length) {
      if (calc.col === AI_LABEL) setAiDone(true);
      setCalc(null);
      return;
    }
    const t = setTimeout(() => setCalc((current) => (current ? { ...current, resolved: current.resolved + 1 } : current)), 110);
    return () => clearTimeout(t);
  }, [calc, visibleRows.length]);

  /* after adding the AI column, scroll it into view and open its config
   * anchored to the new header */
  useEffect(() => {
    if (!pendingOpenAi || !aiThRef.current) return;
    const scroller = aiThRef.current.closest(".records-scroll");
    if (scroller) {
      ignoreScrollRef.current = true;
      scroller.scrollLeft = scroller.scrollWidth;
    }
    const rect = aiThRef.current.getBoundingClientRect();
    setProp({ col: AI_LABEL, x: Math.min(rect.left, window.innerWidth - 336), y: rect.bottom + 6 });
    setPendingOpenAi(false);
  }, [pendingOpenAi, aiAdded]);

  /* click anywhere else closes popovers */
  useEffect(() => {
    if (!prop && !addOpen && !tableMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-recpop]")) {
        setProp(null);
        setConfigMenu(null);
        setGroundingHelpOpen(false);
        setMoreSettingsOpen(false);
        setAddOpen(null);
        setTableMenuOpen(null);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [prop, addOpen, tableMenuOpen]);

  const openProp = (col: string) => (event: React.MouseEvent) => {
    const th = (event.currentTarget as Element).closest("th");
    if (!th) return;
    setAddOpen(null);
    setTableMenuOpen(null);
    setConfigMenu(null);
    setGroundingHelpOpen(false);
    setMoreSettingsOpen(false);
    setProp((current) => {
      if (current?.col === col) return null;
      const rect = th.getBoundingClientRect();
      return { col, x: Math.min(rect.left, window.innerWidth - 336), y: rect.bottom + 6 };
    });
  };

  const isCalc = (col: string, index: number) => !!calc && calc.col === col && index >= calc.resolved;

  const allSelected = visibleRows.length > 0 && visibleRows.every((row) => selected.has(row.id));
  const partiallySelected = !allSelected && visibleRows.some((row) => selected.has(row.id));

  const toggleSort = (key: SortKey) => setSort((current) => current.key === key ? { key, dir: (current.dir * -1) as 1 | -1 } : { key, dir: 1 });
  const startColumnResize = (key: ColumnKey, minWidth = 120) => (event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setProp(null);
    setConfigMenu(null);
    setGroundingHelpOpen(false);
    setMoreSettingsOpen(false);
    setAddOpen(null);
    setTableMenuOpen(null);

    const startX = event.clientX;
    const startWidth = columnWidths[key];
    const previousCursor = document.body.style.cursor;
    const previousSelection = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setResizingColumn(key);

    const move = (moveEvent: PointerEvent) => {
      const width = Math.max(minWidth, startWidth + moveEvent.clientX - startX);
      setColumnWidths((current) => ({ ...current, [key]: width }));
    };
    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelection;
      setResizingColumn(null);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };
  const toggleRow = (id: string) => setSelected((current) => {
    const next = new Set(current);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((current) => {
    const next = new Set(current);
    if (allSelected) visibleRows.forEach((row) => next.delete(row.id));
    else visibleRows.forEach((row) => next.add(row.id));
    return next;
  });

  const meta = prop ? { ...COLUMN_META[prop.col], ...columnOverrides[prop.col] } : null;
  const selectedInputs = prop && meta
    ? inputSelections[prop.col] ?? (meta.inputs ? [meta.inputs] : [])
    : [];
  const tableWidth = columnWidths.company + columnWidths.categories + columnWidths.last + columnWidths.strength + columnWidths.links + (aiAdded ? columnWidths.ai : 0) + actionColumnWidth;

  return (
    <div className={`records-shell${fill ? " is-fill" : ""}`}>
      <div
        className="records-scroll"
        tabIndex={0}
        aria-label="Companies table. Scroll horizontally and vertically to view all columns and records."
        onScroll={() => {
          if (ignoreScrollRef.current) {
            ignoreScrollRef.current = false;
            return;
          }
          setProp(null);
          setConfigMenu(null);
          setGroundingHelpOpen(false);
          setMoreSettingsOpen(false);
          setAddOpen(null);
          setTableMenuOpen(null);
        }}
      >
        <table ref={tableRef} className="records-table" style={{ width: columnWidthsLocked ? tableWidth : "100%", minWidth: tableWidth }}>
          <colgroup>
            <col className="records-company-col" style={{ width: columnWidths.company }} />
            <col className="records-category-col" style={{ width: columnWidths.categories }} />
            <col className="records-last-col" style={{ width: columnWidths.last }} />
            <col className="records-strength-col" style={{ width: columnWidths.strength }} />
            <col className="records-link-col" style={{ width: columnWidths.links }} />
            {aiAdded && <col style={{ width: columnWidths.ai }} />}
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr>
              <th className={`records-header-cell records-sticky-cell ${prop?.col === "Company" ? "is-colsel" : ""}`}>
                <div className="records-company-header" style={{ cursor: "pointer" }} onClick={(event) => openProp("Company")(event)}>
                  <Checkbox checked={allSelected} mixed={partiallySelected} onChange={toggleAll} label="Select all companies" />
                  <span>Company</span>
                </div>
                <span role="separator" aria-orientation="vertical" aria-label="Resize Company column" className={`records-resize-handle ${resizingColumn === "company" ? "is-resizing" : ""}`} onPointerDown={startColumnResize("company", 180)} />
              </th>
              <HeaderCell label="Categories" selected={prop?.col === "Categories"} onPick={openProp("Categories")} sort={sort} onSort={toggleSort} onResizeStart={startColumnResize("categories")} resizing={resizingColumn === "categories"} icon={<Icon size={15}>{TYPE_GLYPHS["Multi select"]}</Icon>} />
              <HeaderCell label="Last interaction" selected={prop?.col === "Last interaction"} onPick={openProp("Last interaction")} sortKey="last" sort={sort} onSort={toggleSort} onResizeStart={startColumnResize("last")} resizing={resizingColumn === "last"} icon={<Icon size={15}>{TYPE_GLYPHS.Date}</Icon>} />
              <HeaderCell label="Connection strength" selected={prop?.col === "Connection strength"} onPick={openProp("Connection strength")} sortKey="strength" sort={sort} onSort={toggleSort} onResizeStart={startColumnResize("strength")} resizing={resizingColumn === "strength"} icon={<Icon size={15}>{TYPE_GLYPHS["Single select"]}</Icon>} />
              <HeaderCell label="Links" selected={prop?.col === "Links"} onPick={openProp("Links")} sort={sort} onSort={toggleSort} onResizeStart={startColumnResize("links")} resizing={resizingColumn === "links"} icon={<Icon size={15}>{TYPE_GLYPHS.URL}</Icon>} />
              {aiAdded && (
                <th ref={aiThRef} className={`records-header-cell ${prop?.col === AI_LABEL ? "is-colsel" : ""}`}>
                  <button type="button" className="records-header-button" onClick={openProp(AI_LABEL)}>
                    <span className="records-header-icon"><Icon size={15}>{TYPE_GLYPHS.Text}</Icon></span>
                    <span className="truncate">{AI_LABEL}</span>
                  </button>
                  <span role="separator" aria-orientation="vertical" aria-label={`Resize ${AI_LABEL} column`} className={`records-resize-handle ${resizingColumn === "ai" ? "is-resizing" : ""}`} onPointerDown={startColumnResize("ai")} />
                </th>
              )}
              <th className="records-header-cell">
                <div className="flex h-[35px] items-center gap-1 px-2">
                  <button
                    type="button"
                    aria-label="New property"
                    data-recpop
                    onClick={(event) => {
                      setProp(null);
                      setTableMenuOpen(null);
                      const rect = (event.currentTarget as Element).getBoundingClientRect();
                      setAddOpen((current) => (current ? null : { x: Math.min(rect.left, window.innerWidth - 276), y: rect.bottom + 6 }));
                    }}
                    className="flex size-7 items-center justify-center rounded-[7px] text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink"
                  >
                    <Icon size={15} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Icon>
                  </button>
                  <button
                    type="button"
                    aria-label="Table options"
                    aria-expanded={!!tableMenuOpen}
                    data-recpop
                    onClick={(event) => {
                      setProp(null);
                      setAddOpen(null);
                      const rect = event.currentTarget.getBoundingClientRect();
                      setTableMenuOpen((current) => current ? null : {
                        x: Math.max(8, Math.min(rect.right - 220, window.innerWidth - 228)),
                        y: rect.bottom + 6,
                      });
                    }}
                    className="flex size-7 items-center justify-center rounded-[7px] text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          {/* data cells stay silent — the papery link/flick sound is too much when scanning rows */}
          <tbody data-sound-silent>
            {visibleRows.map((row, index) => {
              const selectedRow = selected.has(row.id);
              const strength = STRENGTH[row.strength];
              return <tr key={row.id} className={`records-row ${selectedRow ? "is-selected" : ""}`}>
                <td className={`records-cell records-sticky-cell records-company-cell ${prop?.col === "Company" ? "is-colsel" : ""}`}><span className="records-rownum">{index + 1}</span><Checkbox checked={selectedRow} onChange={() => toggleRow(row.id)} label={`Select ${row.name}`} /><span className="records-company-mark">{row.name.slice(0, 1).toUpperCase()}</span><a href={row.website ? `https://${row.website}` : "#"} onClick={(event) => !row.website && event.preventDefault()} title={row.name} className={`records-company-name ${row.website ? "has-link" : ""}`}>{row.name}</a></td>
                <td className={`records-cell ${prop?.col === "Categories" ? "is-colsel" : ""}`}>{isCalc("Categories", index) ? <CalcCell /> : <TagList tags={row.tags} />}</td>
                <td className={`records-cell ${row.last === "No contact" ? "records-muted" : ""} ${prop?.col === "Last interaction" ? "is-colsel" : ""}`}>{isCalc("Last interaction", index) ? <CalcCell /> : row.last}</td>
                <td className={`records-cell ${prop?.col === "Connection strength" ? "is-colsel" : ""}`}>{isCalc("Connection strength", index) ? <CalcCell /> : <span className="records-strength"><span className="records-strength-dot" style={{ background: strength.color }} />{strength.label}</span>}</td>
                <td className={`records-cell ${prop?.col === "Links" ? "is-colsel" : ""}`}>{isCalc("Links", index) ? <CalcCell /> : row.website ? <a className="records-link" href={`https://${row.website}`} title={row.website} target="_blank" rel="noreferrer"><span className="records-link-label">{row.website}</span><Icon size={12}><path d="M14 5h5v5M19 5l-8 8" /></Icon></a> : <span className="records-muted">—</span>}</td>
                {aiAdded && (
                  <td className={`records-cell ${prop?.col === AI_LABEL ? "is-colsel" : ""}`}>
                    {calc?.col === AI_LABEL ? (index < calc.resolved ? competitorsFor(index) : <CalcCell />) : aiDone ? competitorsFor(index) : <span className="records-muted">—</span>}
                  </td>
                )}
                <td className="records-cell" />
              </tr>;
            })}
          </tbody>
          <tfoot>
            <tr className="records-calculation-row">
              <td className="records-cell records-sticky-cell">
                <span className="records-footer-value records-calculation-label"><span className="records-calculation-number">{rows.length}</span> count</span>
              </td>
              <td className="records-cell">
                <button type="button" className="records-add-calculation"><Icon size={15}><path d="M12 5v14M5 12h14" /></Icon>Add calculation</button>
              </td>
              <td className="records-cell records-muted"><span className="records-footer-value">—</span></td>
              <td className="records-cell">
                <span className="records-footer-value records-average"><span className="records-strength-dot" style={{ background: "var(--orange)" }} />{Math.round(rows.reduce((sum, row) => sum + STRENGTH[row.strength].rank, 0) / rows.length / 3 * 100)}% average</span>
              </td>
              <td className="records-cell"><span className="records-footer-value records-muted">{rows.filter((row) => row.website).length} links</span></td>
              {aiAdded && <td className="records-cell records-muted"><span className="records-footer-value">{aiDone ? `${rows.length} filled` : "—"}</span></td>}
              <td className="records-cell" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── property configuration popover ─────────────────── */}
      {prop && meta && (
        <div
          data-recpop
          className="fixed z-50 w-[320px] rounded-[14px] bg-surface px-3 pt-3 pb-1.5 shadow-overlay"
          style={{ top: prop.y, left: prop.x, animation: "pop-in 160ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}
        >
          <div className="pb-2 text-[13.5px] font-medium text-ink">{prop.col}</div>

          <ConfigRow label="Type">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={configMenu === "type"}
              onClick={() => setConfigMenu((current) => current === "type" ? null : "type")}
              className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-[13px] font-medium text-ink transition-colors duration-100 hover:bg-hover"
            >
              <span className="text-ink-2"><Icon size={14}>{TYPE_GLYPHS[meta.type] ?? TYPE_GLYPHS.Text}</Icon></span>
              {meta.type}
              <span className="text-ink-3"><Icon size={12} strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></Icon></span>
            </button>
            {configMenu === "type" && (
              <ConfigPicker
                label="Property type"
                selected={meta.type}
                options={NEW_PROPERTY_TYPES.map((type) => ({ label: type, icon: <Icon size={15}>{TYPE_GLYPHS[type]}</Icon> }))}
                onSelect={(type) => {
                  setColumnOverrides((current) => ({ ...current, [prop.col]: { ...current[prop.col], type } }));
                  setConfigMenu(null);
                }}
              />
            )}
          </ConfigRow>
          <ConfigRow label="Tool">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={configMenu === "tool"}
              onClick={() => setConfigMenu((current) => current === "tool" ? null : "tool")}
              className="flex items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-[13px] font-medium text-ink transition-colors duration-100 hover:bg-hover"
            >
              <span className={meta.toolKind === "model" ? "text-accent" : "text-ink-2"}>
                {meta.toolKind === "model"
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{TOOL_GLYPHS.model}</svg>
                  : <Icon size={14}>{TOOL_GLYPHS[meta.toolKind]}</Icon>}
              </span>
              {meta.tool}
              <span className="text-ink-3"><Icon size={12} strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></Icon></span>
            </button>
            {configMenu === "tool" && (
              <ConfigPicker
                label="Model"
                selected={meta.tool}
                options={MODEL_OPTIONS.map((model) => ({
                  label: model,
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>{TOOL_GLYPHS.model}</svg>,
                }))}
                onSelect={(tool) => {
                  setColumnOverrides((current) => ({ ...current, [prop.col]: { ...current[prop.col], tool, toolKind: "model" } }));
                  setConfigMenu(null);
                }}
              />
            )}
          </ConfigRow>
          <ConfigRow label="Grounding">
            <span className="flex items-center gap-2">
              <MiniSwitch label="Grounding" on={grounding} onToggle={() => setGrounding((current) => !current)} />
              <button
                type="button"
                aria-label="About grounding"
                aria-expanded={groundingHelpOpen}
                onClick={() => setGroundingHelpOpen((open) => !open)}
                className="flex size-6 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-100 hover:bg-hover hover:text-ink"
              >
                <Icon size={13}><g><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></g></Icon>
              </button>
            </span>
            {groundingHelpOpen && (
              <div className="absolute right-0 top-[30px] z-30 w-[230px] rounded-[10px] px-3 py-2.5 text-[12px] leading-relaxed shadow-overlay" style={{ color: "var(--tooltip-fg)", background: "var(--tooltip-bg)" }} role="status">
                Grounding lets the model verify generated values against connected sources.
              </div>
            )}
          </ConfigRow>
          <ConfigRow label="Inputs">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={configMenu === "inputs"}
              onClick={() => setConfigMenu((current) => current === "inputs" ? null : "inputs")}
              className="flex max-w-[220px] items-center gap-1.5 rounded-[6px] px-1.5 py-1 text-[13px] text-ink-2 transition-colors duration-100 hover:bg-hover hover:text-ink"
            >
              {selectedInputs.length ? (
                <span className="flex min-w-0 items-center gap-1">
                  {selectedInputs.slice(0, 2).map((input) => (
                    <span key={input} className="max-w-[92px] truncate rounded-[5px] bg-accent-tint px-1.5 py-0.5 text-[12px] font-medium text-accent-ink">{input}</span>
                  ))}
                  {selectedInputs.length > 2 && <span className="text-[11px] font-medium text-ink-3">+{selectedInputs.length - 2}</span>}
                </span>
              ) : (
                <span>Select inputs</span>
              )}
              <span className="shrink-0 text-ink-3"><Icon size={12} strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></Icon></span>
            </button>
            {configMenu === "inputs" && (
              <InputPicker
                selected={selectedInputs}
                options={INPUT_OPTIONS.filter((input) => input !== prop.col)}
                onToggle={(input) => {
                  setInputSelections((current) => {
                    const existing = current[prop.col] ?? (meta.inputs ? [meta.inputs] : []);
                    const next = existing.includes(input) ? existing.filter((item) => item !== input) : [...existing, input];
                    return { ...current, [prop.col]: next };
                  });
                }}
              />
            )}
          </ConfigRow>

          {/* prompt — @-mention chips inline */}
          <div
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={`${prop.col} calculation prompt`}
            aria-multiline="true"
            spellCheck
            className="mt-2 min-h-[88px] cursor-text rounded-[10px] bg-inset p-3 text-[13px] leading-relaxed shadow-hairline outline-none transition-[box-shadow] duration-150 focus:shadow-[0_0_0_2px_var(--accent)]"
          >
            {meta.prompt ? (
              <span className="text-ink">
                {meta.prompt.before}
                {meta.prompt.chip && <span contentEditable={false} className="rounded-[5px] bg-accent-tint px-1.5 py-0.5 text-[12px] font-medium text-accent-ink">{meta.prompt.chip}</span>}
                {meta.prompt.after}
              </span>
            ) : (
              <span className="text-ink-3">Set a prompt (press @ to mention an input)</span>
            )}
          </div>

          <button
            type="button"
            disabled={!!calc}
            onClick={() => {
              setCalc({ col: prop.col, resolved: 0 });
              setProp(null);
            }}
            className="mt-2.5 flex h-9 w-full items-center justify-center gap-2 rounded-[9px] text-[12.5px] font-medium text-ink shadow-btn transition-[background-color,transform] duration-150 hover:bg-hover active:scale-[0.98] disabled:opacity-60"
          >
            <Icon size={14} strokeWidth={1.9}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></Icon>
            Go calculate
          </button>

          <GlideMenu className="mt-3 flex flex-col gap-0.5 border-t border-line pt-2" highlightClassName="-inset-x-1.5 rounded-[8px] bg-hover">
            <button
              data-menu-row
              type="button"
              aria-pressed={pinnedColumns.has(prop.col)}
              onClick={() => setPinnedColumns((current) => {
                const next = new Set(current);
                next.has(prop.col) ? next.delete(prop.col) : next.add(prop.col);
                return next;
              })}
              className="relative z-10 -mx-1.5 flex h-8 items-center gap-2.5 rounded-[8px] px-1.5 text-left text-[13px] leading-none text-ink transition-transform duration-150 active:scale-[0.96]"
            >
              <span className={pinnedColumns.has(prop.col) ? "text-accent" : "text-ink-2"}><Icon size={15}><path d="M12 17v5M8 3h8l-1 7 3 3H6l3-3-1-7z" /></Icon></span>
              {pinnedColumns.has(prop.col) ? "Unpin" : "Pin"}
            </button>
            <button
              data-menu-row
              type="button"
              aria-expanded={moreSettingsOpen}
              onClick={() => setMoreSettingsOpen((open) => !open)}
              className="relative z-10 -mx-1.5 flex h-8 items-center gap-2.5 rounded-[8px] px-1.5 text-left text-[13px] leading-none text-ink transition-transform duration-150 active:scale-[0.96]"
            >
              <span className={moreSettingsOpen ? "text-ink" : "text-ink-2"}><Icon size={15}><g><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></g></Icon></span>
              <span className="flex-1">More settings</span>
              <span className={`text-ink-3 transition-transform duration-150 ${moreSettingsOpen ? "rotate-90" : ""}`}><Icon size={12} strokeWidth={2.2}><path d="M9 6l6 6-6 6" /></Icon></span>
            </button>
            {prop.col === AI_LABEL && (
              <button
                data-menu-row
                type="button"
                onClick={() => {
                  setAiAdded(false);
                  setAiDone(false);
                  setProp(null);
                }}
                className="relative z-10 -mx-1.5 flex h-8 items-center gap-2.5 rounded-[8px] px-1.5 text-left text-[13px] leading-none text-ink transition-transform duration-150 active:scale-[0.96]"
              >
                <span className="text-ink-2"><Icon size={15}><g><path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c7 0 10 7 10 7a16.3 16.3 0 0 1-2.1 3M6.6 6.6A16 16 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></g></Icon></span>
                Hide from view
              </button>
            )}
          </GlideMenu>

          {moreSettingsOpen && (
            <div className="mt-2 border-t border-line pt-2" style={{ animation: "fade-up 160ms cubic-bezier(0.23,1,0.32,1) both" }}>
              <div className="pb-1 text-[11.5px] font-medium text-ink-3">Behavior</div>
              <ConfigRow label="Required value">
                <MiniSwitch label="Required value" on={advancedSettings.required} onToggle={() => setAdvancedSettings((current) => ({ ...current, required: !current.required }))} />
              </ConfigRow>
              <ConfigRow label="Allow empty results">
                <MiniSwitch label="Allow empty results" on={advancedSettings.allowEmpty} onToggle={() => setAdvancedSettings((current) => ({ ...current, allowEmpty: !current.allowEmpty }))} />
              </ConfigRow>
              <ConfigRow label="Show confidence">
                <MiniSwitch label="Show confidence" on={advancedSettings.confidence} onToggle={() => setAdvancedSettings((current) => ({ ...current, confidence: !current.confidence }))} />
              </ConfigRow>
            </div>
          )}
        </div>
      )}

      {/* ── new property type menu ─────────────────────────── */}
      {addOpen && (
        <div
          data-recpop
          className="fixed z-50 w-[260px] rounded-[14px] bg-surface p-1.5 shadow-overlay"
          style={{ top: addOpen.y, left: addOpen.x, animation: "pop-in 160ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top left" }}
        >
          <div className="px-2 pb-1 pt-1 text-[12px] font-medium text-ink-3">New property</div>
          <GlideMenu className="flex flex-col gap-px">
            {NEW_PROPERTY_TYPES.map((type) => (
              <button
                key={type}
                data-menu-row
                type="button"
                onClick={() => {
                  setAddOpen(null);
                  setAiDone(false);
                  setAiAdded(true);
                  setPendingOpenAi(true);
                }}
                className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[13px] text-ink"
              >
                <span className="text-ink-2"><Icon size={15}>{TYPE_GLYPHS[type]}</Icon></span>
                {type}
              </button>
            ))}
          </GlideMenu>
        </div>
      )}

      {/* ── table options menu ─────────────────────────────── */}
      {tableMenuOpen && (
        <div
          data-recpop
          className="fixed z-50 w-[220px] rounded-[14px] bg-surface p-1.5 shadow-overlay"
          style={{ top: tableMenuOpen.y, left: tableMenuOpen.x, animation: "pop-in 160ms cubic-bezier(0.23,1,0.32,1) both", transformOrigin: "top right" }}
        >
          <div className="px-2 pb-1 pt-1 text-[12px] font-medium text-ink-3">Table options</div>
          <GlideMenu className="flex flex-col gap-px">
          <button
            data-menu-row
            type="button"
            onClick={() => {
              const position = tableMenuOpen;
              setTableMenuOpen(null);
              setAddOpen({ x: Math.min(position.x, window.innerWidth - 276), y: position.y });
            }}
            className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[13px] text-ink"
          >
            <span className="text-ink-2"><Icon size={15} strokeWidth={2}><path d="M12 5v14M5 12h14" /></Icon></span>
            Add property
          </button>
          <button
            data-menu-row
            type="button"
            onClick={() => {
              setColumnWidths({ company: 220, categories: 220, last: 155, strength: 180, links: 160, ai: 200 });
              setTableMenuOpen(null);
            }}
            className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[13px] text-ink"
          >
            <span className="text-ink-2"><Icon size={15}><path d="M4 8h16M7 4 3 8l4 4M17 4l4 4-4 4M4 16h16" /></Icon></span>
            Compact columns
          </button>
          <button
            data-menu-row
            type="button"
            onClick={() => {
              setColumnWidths({ ...(initialColumnWidthsRef.current ?? DEFAULT_COLUMN_WIDTHS) });
              setTableMenuOpen(null);
            }}
            className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[13px] text-ink"
          >
            <span className="text-ink-2"><Icon size={15}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v6h6" /></Icon></span>
            Reset column widths
          </button>
          <div className="my-1 h-px bg-line" />
          <button
            data-menu-row
            type="button"
            onClick={() => {
              setSelected(new Set());
              setTableMenuOpen(null);
            }}
            className="relative z-10 flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[13px] text-ink"
          >
            <span className="text-ink-2"><Icon size={15}><path d="M5 5l14 14M19 5 5 19" /></Icon></span>
            Clear selection
          </button>
          </GlideMenu>
        </div>
      )}
    </div>
  );
}


"use client";

import { useState } from "react";

/* ─────────────────────────────────────────────────────────
 * FILTER TABLE
 * Status chips directly filter the task table.
 * ───────────────────────────────────────────────────────── */

type Status = "todo" | "progress" | "done";

export type TableRow = { task: string; date: string; status: Status; owner: string };

export type FilterTableLabels = {
  columns: { task: string; date: string; status: string; owner: string };
};

const FILTERS: { key: "all" | Status; label: string; dot?: string; count: number }[] = [
  { key: "all", label: "All", count: 5 },
  { key: "todo", label: "To do", dot: "#f09a2f", count: 2 },
  { key: "progress", label: "In Progress", dot: "#16a6c7", count: 2 },
  { key: "done", label: "Completed", dot: "#25a878", count: 1 },
];

const ROWS: TableRow[] = [
  { task: "Restock mango sorbet", date: "Dec 03", status: "todo", owner: "Mango Moon Gelato" },
  { task: "Churn black sesame", date: "Sep 22", status: "progress", owner: "Kumo Creamery" },
  { task: "Print summer menu", date: "Jan 02", status: "todo", owner: "Coral Coast Sorbet" },
  { task: "Taste-test batch 42", date: "Nov 08", status: "progress", owner: "Maple Orbit" },
  { task: "Order waffle cones", date: "Apr 14", status: "done", owner: "Aurora Scoops" },
];

const LABELS: FilterTableLabels = {
  columns: { task: "Task name", date: "Date", status: "Status", owner: "Advisor" },
};

const PILLS: Record<Status, { label: string; cls: string }> = {
  todo: { label: "To do", cls: "filter-status-todo" },
  progress: { label: "In Progress", cls: "filter-status-progress" },
  done: { label: "Completed", cls: "filter-status-done" },
};

export default function FilterTable({
  rows = ROWS,
  labels = LABELS,
}: {
  rows?: TableRow[];
  labels?: FilterTableLabels;
  variant?: string;
} = {}) {
  const [filter, setFilter] = useState<"all" | Status>("all");

  return (
    <div className="w-full max-w-105">
      {/* filter chips */}
      <div
        className="-mx-1 mb-1 flex items-center gap-1 overflow-x-auto px-1 py-1"
        style={{ scrollbarWidth: "none" }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f.key)}
              className={`flex h-6.5 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px]
                font-medium transition-[background-color,box-shadow,color] duration-200
                ${active ? "bg-surface text-ink shadow-btn" : "text-ink-2 hover:bg-hover"}`}
            >
              {f.dot && <span className="size-1.5 rounded-full" style={{ background: f.dot }} />}
              {f.label}
              <span
                className={`rounded-[4px] px-1 text-[10.5px] tabular-nums
                  ${active ? "bg-field text-ink-2" : "text-ink-3"}`}
              >
                {f.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* table */}
      <div
        aria-label="Scrollable task table"
        className="overflow-x-auto rounded-card bg-surface shadow-card"
        role="region"
        tabIndex={0}
        style={{ scrollbarWidth: "none" }}
      >
        <div className="min-w-[420px]">
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.6fr)_minmax(0,0.95fr)_minmax(0,0.9fr)] border-b border-[var(--grid-line)] text-[12.5px] font-medium text-ink-2">
            <span className="border-r border-[var(--grid-line)] px-3 py-2">{labels.columns.task}</span>
            <span className="border-r border-[var(--grid-line)] px-3 py-2">{labels.columns.date}</span>
            <span className="border-r border-[var(--grid-line)] px-3 py-2">{labels.columns.status}</span>
            <span className="px-3 py-2">{labels.columns.owner}</span>
          </div>
          {rows.map((row) => {
            const shown = filter === "all" || row.status === filter;
            const pill = PILLS[row.status];
            return (
              <div
                key={row.task}
                className="grid transition-[grid-template-rows,opacity] duration-300"
                style={{
                  gridTemplateRows: shown ? "1fr" : "0fr",
                  opacity: shown ? 1 : 0,
                  transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                }}
              >
                <div className="overflow-hidden">
                  <div
                    className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.6fr)_minmax(0,0.95fr)_minmax(0,0.9fr)] border-b
                      border-[var(--grid-line)] text-[13px] transition-colors duration-100 hover:bg-hover"
                  >
                    <span className="flex min-w-0 items-center border-r border-[var(--grid-line)] px-3 py-2">
                      <span className="truncate font-medium text-ink">{row.task}</span>
                    </span>
                    <span className="flex items-center whitespace-nowrap border-r border-[var(--grid-line)] px-3 py-2 text-ink-2 tabular-nums">
                      {row.date}
                    </span>
                    <span className="flex items-center border-r border-[var(--grid-line)] px-3 py-2">
                      <span
                        className={`inline-flex h-[23px] shrink-0 items-center whitespace-nowrap rounded-[8px] border px-[7px]
                          text-[13px] font-medium ${pill.cls}`}
                      >
                        {pill.label}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center px-3 py-2 text-ink-2">
                      <span className="truncate">{row.owner}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


"use client";

import { useEffect, useRef, useState } from "react";
import { useLayoutEffect } from "react";

/* ─────────────────────────────────────────────────────────
 * FLOWCHART — an agent workflow on a dotted editor canvas.
 * Two steps: a Trigger card and an If/Else condition card,
 * joined by a measured connector. Cards drag anywhere on
 * the canvas; the connector follows. Condition chips open
 * real dropdowns (same menu as the PromptBar model picker).
 * ───────────────────────────────────────────────────────── */

const PURPLE = "#9a5cff";
const AMBER = "#f09a2f";

const mix = (hue: string, pct: number, base = "var(--surface)") =>
  `color-mix(in srgb, ${hue} ${pct}%, ${base})`;

/* ── layout constants ── */
const PAD_Y = 24;
const ROW_GAP = 64;
const PILL_OFFSET = 30; // kind pill + gap above a card

export type StepNode = {
  id: string;
  row: number;
  x: number; // 0–1 center of the node
  w: number;
  kind?: { label: string; hue: string };
  hue?: string;
  title?: string;
  caption?: string;
  condition?: boolean; // renders the if/else chip rows instead
};

const NODES: StepNode[] = [
  {
    id: "trigger",
    row: 0,
    x: 0.5,
    w: 300,
    kind: { label: "Trigger", hue: PURPLE },
    hue: PURPLE,
    title: "New order created",
    caption: "Trigger when a new order is created",
  },
  {
    id: "cond",
    row: 1,
    x: 0.5,
    w: 356,
    kind: { label: "If / Else", hue: AMBER },
    condition: true,
  },
];

const EDGES = [{ from: "trigger", to: "cond" }];

/* estimated heights for the first paint; measured immediately after */
const EST_H: Record<string, number> = { trigger: 92, cond: 134 };

const PROPERTIES = ["flavor", "topping", "size", "scoops"];
const FLAVORS = [
  { name: "Rocky Road", tag: "Classic" },
  { name: "Mint Chip", tag: "Classic" },
  { name: "Pistachio", tag: "Seasonal" },
  { name: "Bubblegum", tag: "Retro" },
];
const TOPPINGS = [
  { name: "Brown butter bourbon brittle crunch" },
  { name: "Rainbow sprinkles" },
  { name: "Hot fudge" },
  { name: "Candied pecans" },
];

/* ── icons ── */
function ConeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11" />
      <path d="M17 7A5 5 0 0 0 7 7" />
      <path d="M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-3">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Handle() {
  return (
    <svg width="10" height="16" viewBox="0 0 10 16" className="shrink-0 cursor-grab text-ink-3/70">
      {[3, 8, 13].flatMap((y) => [
        <circle key={`l${y}`} cx="3" cy={y} r="1.1" fill="currentColor" />,
        <circle key={`r${y}`} cx="7.5" cy={y} r="1.1" fill="currentColor" />,
      ])}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/* ── dropdown menu — same pattern as the PromptBar model picker ── */
function Menu({
  items,
  value,
  width,
  align,
  onPick,
}: {
  items: { name: string; tag?: string }[];
  value: string;
  width: string;
  align: "left" | "right";
  onPick: (name: string) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);

  const valueIndex = items.findIndex((item) => item.name === value);
  useLayoutEffect(() => {
    const row = rowRefs.current[hovered ?? valueIndex];
    if (row) setBox({ top: row.offsetTop, height: row.offsetHeight });
  }, [hovered, valueIndex]);

  return (
    <div
      onMouseLeave={() => setHovered(null)}
      className={`absolute bottom-full z-20 mb-1.5 rounded-[10px] bg-surface p-1 shadow-raised ${width}
        ${align === "right" ? "right-0" : "left-0"}`}
      style={{
        animation: "pop-in 180ms cubic-bezier(0.23,1,0.32,1) both",
        transformOrigin: align === "right" ? "bottom right" : "bottom left",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-1 rounded-[6px] bg-hover"
        style={{
          top: box?.top ?? 0,
          height: box?.height ?? 0,
          opacity: box && hovered !== null ? 1 : 0,
          transition:
            "top 220ms cubic-bezier(0.23,1,0.32,1), height 220ms cubic-bezier(0.23,1,0.32,1), opacity 150ms ease",
        }}
      />
      {items.map((item, i) => (
        <button
          key={item.name}
          type="button"
          ref={(el) => {
            rowRefs.current[i] = el;
          }}
          onMouseEnter={() => setHovered(i)}
          onClick={() => onPick(item.name)}
          className="relative z-10 flex h-7.5 w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 text-left"
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{item.name}</span>
          {item.tag && <span className="shrink-0 text-[11px] text-ink-3">{item.tag}</span>}
          <span className={`shrink-0 text-ink ${item.name === value ? "" : "invisible"}`}>
            <CheckIcon />
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── chips used inside the condition card ── */
function SourceChip() {
  return (
    <span
      data-ui
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[6px] bg-surface px-1.5 text-[12px] font-medium text-ink shadow-btn"
    >
      <span className="text-ink-2">
        <ConeIcon size={12} />
      </span>
      order
    </span>
  );
}

function SelectChip({
  id,
  value,
  dot,
  items,
  width,
  align = "left",
  open,
  onToggle,
  onPick,
}: {
  id: string;
  value: string;
  dot?: boolean;
  items: { name: string; tag?: string }[];
  width: string;
  align?: "left" | "right";
  open: boolean;
  onToggle: (id: string) => void;
  onPick: (id: string, name: string) => void;
}) {
  return (
    <span data-ui className="relative inline-flex min-w-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(id)}
        className={`inline-flex h-6 min-w-0 cursor-pointer items-center gap-1 rounded-[6px] px-1.5
          text-[12px] font-medium text-ink transition-colors duration-100
          ${open ? "bg-hover-2" : "bg-field hover:bg-hover-2"}`}
      >
        {dot && <span className="size-1.5 shrink-0 rounded-full" style={{ background: AMBER }} />}
        <span className="min-w-0 truncate">{value}</span>
        <Chevron />
      </button>
      {open && (
        <Menu
          items={items}
          value={value}
          width={width}
          align={align}
          onPick={(name) => onPick(id, name)}
        />
      )}
    </span>
  );
}

function ConditionBody() {
  const [values, setValues] = useState<Record<string, string>>({
    prop1: "flavor",
    val1: "Rocky Road",
    prop2: "topping",
    val2: "Brown butter bourbon brittle crunch",
  });
  const [open, setOpen] = useState<string | null>(null);

  /* click anywhere else closes the menu */
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-ui]")) setOpen(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));
  const pick = (id: string, name: string) => {
    setValues((current) => ({ ...current, [id]: name }));
    setOpen(null);
  };

  const chip = (id: string, items: { name: string; tag?: string }[], width: string, extra?: object) => (
    <SelectChip
      id={id}
      value={values[id]}
      items={items}
      width={width}
      open={open === id}
      onToggle={toggle}
      onPick={pick}
      {...extra}
    />
  );

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <Handle />
        <span className="w-7 text-[12.5px] text-ink-2">If</span>
        <SourceChip />
        {chip("prop1", PROPERTIES.map((name) => ({ name })), "w-36")}
        <span className="text-[12.5px] text-ink-2">is</span>
        {chip("val1", FLAVORS, "w-44", { dot: true, align: "right" })}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1.5">
        <Handle />
        <span className="w-7 text-[12.5px] text-ink-2">and</span>
        <SourceChip />
        {chip("prop2", PROPERTIES.map((name) => ({ name })), "w-36")}
        <span className="text-[12.5px] text-ink-2">is</span>
        <span className="max-w-full pl-[49px]">
          {chip("val2", TOPPINGS, "w-64", { dot: true })}
        </span>
      </div>
    </div>
  );
}

function StepBody({ node }: { node: StepNode }) {
  return (
    <div className="flex items-center gap-2.5 p-2.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-[8px]"
        style={{
          background: mix(node.hue!, 12),
          color: node.hue,
          boxShadow: `0 0 0 1px ${mix(node.hue!, 20)}`,
        }}
      >
        <ConeIcon />
      </span>
      <span className="min-w-0 text-left">
        <span className="block truncate text-[13px] font-semibold leading-tight text-ink">{node.title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-ink-2">{node.caption}</span>
      </span>
    </div>
  );
}

/* ── the canvas ── */
export default function Flowchart({ steps = NODES }: { steps?: StepNode[]; variant?: string } = {}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [width, setWidth] = useState(0);
  const [heights, setHeights] = useState<Record<string, number>>(EST_H);
  const [selected, setSelected] = useState<string | null>(null);
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    baseDx: number;
    baseDy: number;
    moved: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const measure = () => {
      setWidth(canvas.clientWidth);
      setHeights((prev) => {
        const next = { ...prev };
        let changed = false;
        nodeRefs.current.forEach((el, id) => {
          const h = el.offsetHeight;
          if (h && Math.abs(h - (next[id] ?? 0)) > 0.5) {
            next[id] = h;
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    nodeRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /* rows → y offsets from measured node heights */
  const rows = [...new Set(steps.map((n) => n.row))].sort((a, b) => a - b);
  const rowH = rows.map((r) =>
    Math.max(...steps.filter((n) => n.row === r).map((n) => heights[n.id] ?? 90)),
  );
  const rowY: number[] = [];
  rows.forEach((_, i) => {
    rowY[i] = i === 0 ? PAD_Y : rowY[i - 1] + rowH[i - 1] + ROW_GAP;
  });
  const canvasH = rowY[rows.length - 1] + rowH[rows.length - 1] + PAD_Y;

  const cw = width || 480;
  const place = (n: StepNode) => {
    const w = Math.min(n.w, cw * 0.92);
    const off = offsets[n.id];
    return {
      w,
      cx: n.x * cw + (off?.dx ?? 0),
      top: rowY[rows.indexOf(n.row)] + (off?.dy ?? 0),
    };
  };

  /* card anchor points (pills sit above the card, so offset the top) */
  const anchors = (n: StepNode) => {
    const { cx, top } = place(n);
    return {
      top: { x: cx, y: top + (n.kind ? PILL_OFFSET : 0) },
      bottom: { x: cx, y: top + (heights[n.id] ?? 90) },
    };
  };

  const bezier = (edge: { from: string; to: string }) => {
    const from = anchors(steps.find((n) => n.id === edge.from)!).bottom;
    const to = anchors(steps.find((n) => n.id === edge.to)!).top;
    const k = Math.min(Math.max(Math.abs(to.y - from.y) * 0.55, 24), 84);
    return `M ${from.x} ${from.y} C ${from.x} ${from.y + k}, ${to.x} ${to.y - k}, ${to.x} ${to.y}`;
  };

  /* ── dragging ── */
  const onPointerDown = (node: StepNode) => (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("[data-ui]")) return;
    const off = offsets[node.id];
    drag.current = {
      id: node.id,
      startX: event.clientX,
      startY: event.clientY,
      baseDx: off?.dx ?? 0,
      baseDy: off?.dy ?? 0,
      moved: false,
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (node: StepNode) => (event: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== node.id) return;
    const dx = d.baseDx + event.clientX - d.startX;
    const dy = d.baseDy + event.clientY - d.startY;
    if (!d.moved && Math.hypot(dx - d.baseDx, dy - d.baseDy) < 3) return;
    d.moved = true;

    /* keep the card inside the canvas */
    const { w } = place(node);
    const h = heights[node.id] ?? 90;
    const baseCx = node.x * cw;
    const baseTop = rowY[rows.indexOf(node.row)];
    const cx = Math.min(Math.max(baseCx + dx, w / 2 + 8), cw - w / 2 - 8);
    const top = Math.min(Math.max(baseTop + dy, 8), canvasH - h - 8);
    setOffsets((current) => ({ ...current, [node.id]: { dx: cx - baseCx, dy: top - baseTop } }));
  };

  const onPointerUp = (node: StepNode) => () => {
    const d = drag.current;
    if (d?.id === node.id) {
      /* a real drag shouldn't also toggle selection */
      if (d.moved) setTimeout(() => (drag.current = null), 0);
      else drag.current = null;
    }
  };

  const wasDragged = () => drag.current?.moved === true;

  const isLit = (edge: { from: string; to: string }) =>
    selected === edge.from || selected === edge.to;

  return (
    <div
      ref={canvasRef}
      className="relative w-full select-none overflow-hidden rounded-card bg-page shadow-hairline"
      style={{
        height: canvasH,
        backgroundImage: "radial-gradient(var(--line-strong) 1px, transparent 1.25px)",
        backgroundSize: "22px 22px",
        backgroundPosition: "center",
      }}
    >
      {/* connectors */}
      <svg width={cw} height={canvasH} className="pointer-events-none absolute inset-0">
        {EDGES.map((edge) => (
          <path
            key={`${edge.from}-${edge.to}`}
            d={bezier(edge)}
            fill="none"
            stroke={isLit(edge) ? "var(--accent)" : "var(--line-strong)"}
            strokeWidth="1.25"
            className="transition-[stroke] duration-150"
          />
        ))}
      </svg>

      {/* nodes */}
      {steps.map((node) => {
        const { w, cx, top } = place(node);
        const active = selected === node.id;
        return (
          <div
            key={node.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(node.id, el);
              else nodeRefs.current.delete(node.id);
            }}
            onPointerDown={onPointerDown(node)}
            onPointerMove={onPointerMove(node)}
            onPointerUp={onPointerUp(node)}
            className="absolute flex -translate-x-1/2 touch-none flex-col items-start gap-1.5"
            style={{ left: cx, top, width: w, zIndex: drag.current?.id === node.id ? 2 : 1 }}
          >
            {node.kind && (
              <span
                className="inline-flex h-6 items-center rounded-[6px] px-2 text-[11.5px] font-medium"
                style={{
                  background: mix(node.kind.hue, 14, "var(--page)"),
                  color: mix(node.kind.hue, 80, "var(--ink)"),
                }}
              >
                {node.kind.label}
              </span>
            )}
            {node.condition ? (
              <div className="w-full rounded-[18px] bg-surface shadow-card transition-shadow duration-150 hover:shadow-raised">
                <ConditionBody />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (wasDragged()) return;
                  setSelected(active ? null : node.id);
                }}
                aria-pressed={active}
                className={`w-full cursor-pointer rounded-[18px] bg-surface text-left outline-none
                  transition-shadow duration-150 focus-visible:shadow-[0_0_0_1.5px_var(--accent)]
                  ${
                    active
                      ? "shadow-[0_0_0_1.5px_var(--accent),0_2px_10px_rgba(0,0,0,0.045)]"
                      : "shadow-card hover:shadow-raised"
                  }`}
              >
                <StepBody node={node} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { Liveline, type LivelinePoint, type LivelineSeries } from "liveline";
import { useEffect, useMemo, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * INSIGHT CARDS
 * Embedded mini-visualizations in an "Insights N ‹ ›"
 * carousel. Autoplay yields as soon as a person uses it.
 * ───────────────────────────────────────────────────────── */

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const formatPercent = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
const formatMoney = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
/* anchor the snapshot to *call* time (inside each card's mount-time memo) —
 * a module-load constant goes stale, and once the points age past the chart
 * window the canvas renders empty */
function makePoints(values: number[], gap = 6): LivelinePoint[] {
  const end = Math.floor(Date.now() / 1000);
  return values.map((value, index) => ({
    time: end - (values.length - 1 - index) * gap,
    value,
  }));
}

/* Catmull-Rom resample — turn a sparse series into a dense, smoothly curved
 * one so both the line and the hover cursor glide instead of stepping between
 * a handful of points. */
function smooth(values: number[], perSegment = 9): number[] {
  if (values.length < 3) return values.slice();
  const out: number[] = [];
  const n = values.length;
  for (let i = 0; i < n - 1; i += 1) {
    const p0 = values[Math.max(0, i - 1)];
    const p1 = values[i];
    const p2 = values[i + 1];
    const p3 = values[Math.min(n - 1, i + 2)];
    for (let s = 0; s < perSegment; s += 1) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push(
        0.5 *
          (2 * p1 +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3),
      );
    }
  }
  out.push(values[n - 1]);
  return out;
}

/* dense, smoothed points spanning exactly `spanSecs` — keeps the chart window
 * unchanged while multiplying the resolution. */
function smoothPoints(values: number[], spanSecs: number): LivelinePoint[] {
  const dense = smooth(values);
  return makePoints(dense, spanSecs / (dense.length - 1));
}

function useDarkMode() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return dark;
}

/* inline @entity mention */
function Entity({ name, tone }: { name: string; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-baseline font-medium text-ink">
      <span className={`inline-block size-2.5 rounded-full ${tone}`} />
      @{name}
    </span>
  );
}

function Mono({ children, tone }: { children: React.ReactNode; tone: "red" | "green" }) {
  return (
    <code className={`font-mono text-[11.5px] ${tone === "red" ? "text-red" : "text-green"}`}>
      {children}
    </code>
  );
}

function chartIndexFromPointer(event: React.PointerEvent<HTMLDivElement>, pointCount: number) {
  const rect = event.currentTarget.getBoundingClientRect();
  const progress = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  return Math.round(progress * (pointCount - 1));
}

function ChartTooltip({ rows }: { rows: { label: string; value: string; color: string }[] }) {
  return (
    <div className="insight-chart-tooltip">
      {rows.map((row) => (
        <span key={row.label} className="insight-chart-tooltip-item">
          <span className="insight-chart-tooltip-dot" style={{ background: row.color }} />
          {row.value}
        </span>
      ))}
    </div>
  );
}

/* content shape for the return-comparison card's two plotted series */
export type CompareSeries = {
  name: string;
  values: number[];
  sub: string;
  tone: "red" | "green";
  dot: string;
  color: string;
  tooltipColor: string;
};

const COMPARE_SERIES: CompareSeries[] = [
  {
    name: "Mint Chip",
    values: [-2.9, -3.4, -3.05, -3.86, -3.52, -4.1, -3.82, -4.41],
    sub: "-$2,377.66",
    tone: "red",
    dot: "bg-orange",
    color: "#f68f3c",
    tooltipColor: "var(--orange)",
  },
  {
    name: "Pistachio",
    values: [0.22, 0.58, 0.42, 0.91, 0.76, 1.08, 0.96, 1.15],
    sub: "+$617.22",
    tone: "green",
    dot: "bg-accent",
    color: "#3d9aff",
    tooltipColor: "var(--accent)",
  },
];

/* 1 — return comparison: 2 series, legend + big deltas + line chart */
function CompareCard({ series = COMPARE_SERIES }: { series?: CompareSeries[] }) {
  const dark = useDarkMode();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const points = useMemo(
    () => series.map((s) => smoothPoints(s.values, 42)),
    [series],
  );
  const pointCount = points[0]?.length ?? 0;

  const chartSeries: LivelineSeries[] = useMemo(
    () =>
      series.map((s, i) => ({
        id: s.name,
        label: "",
        data: points[i],
        value: points[i].at(-1)?.value ?? (s.values.at(-1) ?? 0),
        color: s.color,
      })),
    [series, points],
  );

  return (
    <div className="min-h-[278px] rounded-card bg-surface p-3 shadow-hairline">
      <div className="flex items-center gap-4">
        {series.map((s, i) => (
          <div key={s.name} className="flex-1">
            <span className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
              <span className={`size-2 rounded-full ${s.dot}`} />
              {s.name}
            </span>
            <span className={`block text-[17px] font-semibold tracking-[-0.01em] tabular-nums ${s.tone === "red" ? "text-red" : "text-green"}`}>
              {formatPercent(points[i].at(-1)?.value ?? (s.values.at(-1) ?? 0))}
            </span>
            <Mono tone={s.tone}>{s.sub}</Mono>
          </div>
        ))}
      </div>
      <div className="mt-2 overflow-hidden rounded-control bg-inset shadow-hairline">
        <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
          <span className="text-[11px] text-ink-3 tabular-nums">
            Trend snapshot
          </span>
          <span className="rounded-full bg-field px-2 py-0.5 text-[10.5px] font-medium text-ink-2">
            Snapshot
          </span>
        </div>
        <div
          className="insight-chart-stage relative h-[166px]"
          onPointerDown={(event) => setHoverIndex(chartIndexFromPointer(event, pointCount))}
          onPointerMove={(event) => setHoverIndex(chartIndexFromPointer(event, pointCount))}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerCancel={() => setHoverIndex(null)}
          onPointerUp={() => setHoverIndex(null)}
        >
          <Liveline
            data={[]}
            value={0}
            series={chartSeries}
            theme={dark ? "dark" : "light"}
            grid={false}
            pulse={false}
            window={42}
            paused
            scrub={false}
            cursor="default"
            lineWidth={2.25}
            padding={{ top: 40, right: 0, bottom: 22, left: 0 }}
            formatValue={formatPercent}
          />
          {hoverIndex !== null && <>
            <span className="insight-chart-cursor" style={{ left: `${(hoverIndex / (pointCount - 1)) * 100}%` }} />
            <span className="insight-chart-tooltip-anchor" style={{ left: `${Math.min(Math.max((hoverIndex / (pointCount - 1)) * 100, 28), 72)}%` }}>
              <ChartTooltip rows={series.map((s, i) => ({ label: s.name, value: formatPercent(points[i][hoverIndex].value), color: s.tooltipColor }))} />
            </span>
          </>}
        </div>
      </div>
    </div>
  );
}

/* content shape for the anomaly card's two toggled metric series */
export type AnomalyData = {
  spend: number[];
  usage: number[];
};

const ANOMALY_DATA: AnomalyData = {
  spend: [274, 289, 264, 307, 331, 1210, 1718, 2112],
  usage: [18, 19, 17, 21, 22, 58, 81, 96],
};

/* 2 — anomaly: bars with threshold + big spent value */
function AnomalyCard({ data: anomaly = ANOMALY_DATA }: { data?: AnomalyData }) {
  const dark = useDarkMode();
  const [metric, setMetric] = useState<"spend" | "usage">("spend");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const spend = useMemo(
    () => makePoints(anomaly.spend, 7),
    [anomaly],
  );
  const usage = useMemo(
    () => makePoints(anomaly.usage, 7),
    [anomaly],
  );

  const data = metric === "spend" ? spend : usage;
  const value = data.at(-1)?.value ?? (metric === "spend" ? 2112 : 96);
  const threshold = metric === "spend" ? "$2,112" : "82 kWh";
  const moneyLabel = formatMoney(spend.at(-1)?.value ?? 2112);

  return (
    <div className="min-h-[278px] rounded-card bg-surface p-3 shadow-hairline">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          High freezer spend
        </span>
        <span className="rounded-full bg-field px-2 py-0.5 text-[10.5px] font-medium text-ink-2">
          Snapshot
        </span>
      </div>
      <div className="mt-2 overflow-hidden rounded-control bg-inset shadow-hairline">
        <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
          <span className="text-[11px] text-ink-3 tabular-nums">
            {hoverIndex !== null
              ? metric === "spend"
                ? formatMoney(data[hoverIndex].value)
                : `${Math.round(data[hoverIndex].value)} kWh`
              : `${threshold} threshold`}
          </span>
          <span className="flex rounded-full bg-field p-0.5">
            {(["spend", "usage"] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={metric === item}
                onClick={() => setMetric(item)}
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96] ${
                  metric === item ? "bg-surface text-ink shadow-btn" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                {item === "spend" ? "Spend" : "Usage"}
              </button>
            ))}
          </span>
        </div>
        <div
          className="insight-chart-stage relative h-[166px]"
          onPointerDown={(event) => setHoverIndex(chartIndexFromPointer(event, data.length))}
          onPointerMove={(event) => setHoverIndex(chartIndexFromPointer(event, data.length))}
          onPointerLeave={() => setHoverIndex(null)}
          onPointerCancel={() => setHoverIndex(null)}
          onPointerUp={() => setHoverIndex(null)}
        >
          <Liveline
            data={data}
            value={value}
            theme={dark ? "dark" : "light"}
            color="#ee5c61"
            grid
            scrub={false}
            fill={false}
            pulse={false}
            momentum={false}
            paused
            window={49}
            lineWidth={2.25}
            cursor="crosshair"
            padding={{ top: 34, right: 0, bottom: 22, left: 0 }}
            formatValue={(v) => (metric === "spend" ? formatMoney(v) : `${Math.round(v)} kWh`)}
          />
          {hoverIndex !== null && <>
            <span className="insight-chart-cursor" style={{ left: `${(hoverIndex / (data.length - 1)) * 100}%` }} />
            <span className="insight-chart-tooltip-anchor" style={{ left: `${Math.min(Math.max((hoverIndex / (data.length - 1)) * 100, 28), 72)}%` }}>
              <ChartTooltip rows={[{ label: metric === "spend" ? "Spend" : "Usage", value: metric === "spend" ? formatMoney(data[hoverIndex].value) : `${Math.round(data[hoverIndex].value)} kWh`, color: "var(--red)" }]} />
            </span>
          </>}
        </div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink tabular-nums">
          {moneyLabel} spent
        </span>
        <Mono tone="red">+$1,834.66</Mono>
        <span className="text-[11px] text-ink-3">vs 3 months</span>
      </div>
    </div>
  );
}

/* content shape for one allocation segment */
export type AllocationSegment = {
  name: string;
  label: string;
  pct: number;
  amount: string;
  cls: string;
  tone: string;
};

const ALLOCATION_SEGMENTS: AllocationSegment[] = [
  { name: "VAN", label: "Vanilla", pct: 72.5, amount: "$51,785", cls: "bg-orange", tone: "text-orange" },
  { name: "CHOC", label: "Chocolate", pct: 22.8, amount: "$16,278", cls: "bg-line-strong", tone: "text-ink-2" },
  { name: "MINT", label: "Mint", pct: 4.7, amount: "$3,357", cls: "bg-line", tone: "text-ink-3" },
];

/* 3 — allocation: hero number + segmented bar + legend */
function AllocationCard({ segments = ALLOCATION_SEGMENTS }: { segments?: AllocationSegment[] }) {
  const [selected, setSelected] = useState(segments[0].name);
  const active = segments.find((segment) => segment.name === selected) ?? segments[0];

  return (
    <div className="min-h-[278px] rounded-card bg-surface p-3 shadow-hairline">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
        <span className="flex size-3.5 items-center justify-center rounded-full bg-orange text-[8px] font-bold text-white">
          V
        </span>
        Vanilla allocation
      </span>
      <span className="mt-1 block text-[20px] font-semibold tracking-[-0.01em] text-ink tabular-nums">
        {active.amount}
      </span>
      <div
        className="mt-3 flex h-9 gap-0.5 overflow-hidden rounded-full bg-field p-0.5"
        role="group"
        aria-label="Allocation segments"
      >
        {segments.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-pressed={selected === s.name}
            aria-label={`${s.label}: ${s.pct}%`}
            onClick={() => setSelected(s.name)}
            className={`relative h-full overflow-hidden rounded-full ${s.cls} transition-[opacity,transform,box-shadow] duration-300 active:scale-[0.98]`}
            style={{
              width: `${s.pct}%`,
              opacity: selected === s.name ? 1 : 0.58,
              boxShadow: selected === s.name ? "inset 0 0 0 1px rgba(255,255,255,0.22)" : undefined,
              transitionTimingFunction: EASE,
            }}
          >
            <span
              className="absolute inset-y-1 left-1 rounded-full bg-white/20 transition-[width,opacity] duration-500"
              style={{
                width: selected === s.name ? "calc(100% - 8px)" : "0%",
                opacity: selected === s.name ? 1 : 0,
                transitionTimingFunction: EASE,
              }}
            />
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {segments.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-pressed={selected === s.name}
            onClick={() => setSelected(s.name)}
            className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
              selected === s.name ? "bg-field text-ink" : "text-ink-2 hover:bg-hover hover:text-ink"
            }`}
          >
            <span className={`size-1.5 rounded-full ${s.cls}`} />
            {s.name} <span className="tabular-nums">{s.pct}%</span>
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-16 rounded-control bg-inset px-2.5 py-2 shadow-hairline">
        <span className={`block text-[11.5px] font-medium ${active.tone}`}>{active.label}</span>
        <span className="mt-1 block text-[11px] leading-relaxed text-ink-3">
          Contribution snapshot across current inventory value. Segment selection changes the inspected group without moving the card.
        </span>
      </div>
    </div>
  );
}

/* content shape for one insight page in the carousel */
export type InsightPage = {
  key: string;
  prose: React.ReactNode;
  Card: React.ComponentType;
  pill: string;
};

const PAGES: InsightPage[] = [
  {
    key: "compare",
    prose: (
      <>
        The worst performer in your <Entity name="Creamery" tone="bg-orange" /> is
        Rocky Road — down <Mono tone="red">-6%</Mono> or <Mono tone="red">-$2,453.44</Mono>.
      </>
    ),
    Card: CompareCard,
    pill: "Should I rebalance flavors?",
  },
  {
    key: "anomaly",
    prose: (
      <>
        Unusually high freezer bill on <span className="font-medium text-ink">Dec 13</span> —{" "}
        <Mono tone="red">+$1,834.66</Mono> above your average.
      </>
    ),
    Card: AnomalyCard,
    pill: "Get tips on cutting freezer costs",
  },
  {
    key: "allocation",
    prose: (
      <>
        You’re heavily invested in <Entity name="Vanilla" tone="bg-orange" /> — it’s{" "}
        <span className="font-medium text-ink">72.5%</span> of your case.
      </>
    ),
    Card: AllocationCard,
    pill: "If we look at seasonals, what changes?",
  },
];

export type InsightCardsLabels = {
  /** carousel heading shown before the page count */
  title: string;
};

const DEFAULT_INSIGHT_LABELS: InsightCardsLabels = {
  title: "Insights",
};

export default function InsightCards({
  pages = PAGES,
  labels,
}: {
  variant?: string;
  pages?: InsightPage[];
  labels?: Partial<InsightCardsLabels>;
} = {}) {
  const l = { ...DEFAULT_INSIGHT_LABELS, ...labels };
  const [page, setPage] = useState(0);

  const move = (direction: -1 | 1) => {
    setPage((current) => (current + direction + pages.length) % pages.length);
  };

  const { prose, Card, pill } = pages[page];

  return (
    <div className="min-h-[408px] w-full max-w-86">
      {/* pager header */}
      <div className="flex items-center justify-between">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[13px] font-semibold text-ink">{l.title}</span>
          <span className="text-[13px] text-ink-3 tabular-nums">{pages.length}</span>
        </span>
        <span className="flex items-center gap-0.5">
          {(["M15 18l-6-6 6-6", "M9 6l6 6-6 6"] as const).map((d, i) => (
            <button
              key={i}
              aria-label={i === 0 ? "Previous insight" : "Next insight"}
              onClick={() => move(i === 0 ? -1 : 1)}
              className="flex size-6 items-center justify-center rounded-[6px] text-ink-3
                transition-[background-color,color,transform] duration-100 hover:bg-hover
                hover:text-ink active:scale-[0.96]"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
            </button>
          ))}
        </span>
      </div>

      {/* page content — blurred crossfade */}
      <div
        className="transition-[opacity,filter] duration-250"
        style={{ opacity: 1, filter: "blur(0)" }}
      >
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{prose}</p>
        <div className="mt-2">
          <Card />
        </div>
        <button
          className="mt-2 rounded-full bg-surface px-3 py-1.5 text-left text-[12px] text-ink
            shadow-btn transition-colors duration-100 hover:bg-hover"
        >
          {pill}
        </button>
      </div>
    </div>
  );
}

