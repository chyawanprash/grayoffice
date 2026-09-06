import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { apiRoutes } from "./api";
import { botRoutes } from "./bots";
import { botCompatRoutes } from "./bot-compat";
import { paymentRoutes } from "./payments";
import { pdfToJson } from "./bot-router";
import { queueConsumer } from "./queue";
import { kbQueueConsumer, type KbJob } from "./kb-queue";

const app = new Hono<{ Bindings: Env & { TARGET_DOMAIN?: string } }>();

// API routes. Compat first: /api/bots/ingest + /api/bots/link/* for the
// standalone bot repos, then the dashboard-connect webhooks (/:platform/:orgId).
app.route("/api/bots", botCompatRoutes);
app.route("/api/bots", botRoutes);
app.route("/api/payments", paymentRoutes);
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

// SSR catch-all - React Router handles everything else (GET + form POSTs)
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
	queue(batch: MessageBatch, env: Env) {
		if (batch.queue === "kb-ingest-jobs")
			return kbQueueConsumer(batch as MessageBatch<KbJob>, env);
		return queueConsumer(batch as Parameters<typeof queueConsumer>[0], env);
	},
};
