/**
 * Pull a plain string out of a Workers AI `env.AI.run(...)` result. The shape
 * varies by model / gateway — sometimes `{ response: "..." }`, sometimes the
 * text is nested, sometimes `response` is an object. Never throws.
 */
export function aiText(r: unknown, depth = 0): string {
	if (typeof r === "string") return r;
	if (depth > 4 || !r || typeof r !== "object") return "";
	const o = r as Record<string, unknown>;

	for (const key of ["response", "text", "output_text", "generated_text", "content", "result"]) {
		const v = o[key];
		if (typeof v === "string" && v.trim()) return v;
		if (v && typeof v === "object") {
			const nested = aiText(v, depth + 1);
			if (nested) return nested;
		}
	}

	// OpenAI-style choices array
	for (const arrKey of ["choices", "messages", "outputs"]) {
		const arr = o[arrKey];
		if (Array.isArray(arr)) {
			for (const item of arr) {
				const t = aiText(item, depth + 1);
				if (t) return t;
			}
		}
	}

	return "";
}
