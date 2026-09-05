import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { apiRoutes } from "./api";
import { queueConsumer } from "./queue";

type Env = {
	AI: Ai;
	AEO_KV: KVNamespace;
	BRAND_VISIBILITY_QUEUE: Queue;
	TARGET_DOMAIN: string;
};

const app = new Hono<{ Bindings: Env }>();

// API routes
app.route("/api", apiRoutes);

// SSR catch-all — React Router handles everything else
app.get("*", (c) => {
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
