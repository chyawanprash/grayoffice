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
				Math.min(
					o.radius - o.ring,
					(o.width - o.ring * 2) / 2,
					(o.height - o.ring * 2) / 2,
				),
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
