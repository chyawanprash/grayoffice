import {
	type RouteConfig,
	index,
	route,
	layout,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("sign-in", "routes/auth.tsx"),
	route("sign-up", "routes/sign-up.tsx"),
	route("auth/verify", "routes/auth.verify.tsx"),
	route("auth/reset", "routes/auth.reset.tsx"),
	route("auth/mfa", "routes/auth.mfa.tsx"),
	route("auth/google", "routes/auth.google.tsx"),
	route("auth/google/callback", "routes/auth.google.callback.tsx"),
	route("logout", "routes/logout.tsx"),
	route("agent", "routes/api.agent.tsx"),
	route("settings/data", "routes/settings.data.tsx"),
	layout("routes/dashboard-layout.tsx", [
		route("dashboard", "routes/dashboard.tsx"),
		route("dashboard/assistant", "routes/dashboard.assistant.tsx"),
		route("dashboard/audit", "routes/dashboard.audit.tsx"),
		route("dashboard/integrations", "routes/dashboard.integrations.tsx"),
		route(
			"dashboard/integrations/payments",
			"routes/dashboard.integrations.payments.tsx",
		),
		route(
			"dashboard/integrations/:provider",
			"routes/dashboard.integrations.$provider.tsx",
		),
		route("dashboard/settings", "routes/dashboard.settings.tsx"),
		route("dashboard/:section", "routes/dashboard.section.tsx"),
	]),
] satisfies RouteConfig;
