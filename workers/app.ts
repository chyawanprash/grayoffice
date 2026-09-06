import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { apiRoutes } from "./api";
import { botRoutes } from "./bots";
import { pdfToJson } from "./bot-router";
import { queueConsumer } from "./queue";

const app = new Hono<{ Bindings: Env & { TARGET_DOMAIN?: string } }>();

// API routes
app.route("/api/bots", botRoutes);
app.route("/api", apiRoutes);

// PDF -> JSON. Accepts multipart form (field "file") or JSON { url, name }.
app.post("/api/pdf", async (c) => {
	const ct = c.req.header("content-type") ?? "";
	if (ct.includes("multipart/form-data")) {
		const form = await c.req.formData();
		const f = form.get("file");
		if (!(f instanceof File)) return c.json({ error: "missing file" }, 400);
		return c.json(await pdfToJson(c.env, { name: f.name, blob: f, mime: f.type }));
	}
	const b = await c.req.json<{ url?: string; name?: string }>();
	if (!b.url) return c.json({ error: "missing url" }, 400);
	return c.json(await pdfToJson(c.env, { name: b.name ?? "file.pdf", url: b.url }));
});

// SSR catch-all — React Router handles everything else (GET + form POSTs)
app.all("*", (c) => {
	const requestHandler = createRequestHandler(
		() => import("virtual:react-router/server-build"),
		import.meta.env.MODE,
	);
	return requestHandler(c.req.raw, {
		// hono's ExecutionContext type lags @cloudflare/workers-types v5 (missing
		// tracing/abort/exports); the runtime object is the real thing.
		cloudflare: { env: c.env, ctx: c.executionCtx as unknown as ExecutionContext },
	});
});

export default {
	fetch: app.fetch,
	queue: queueConsumer,
};
