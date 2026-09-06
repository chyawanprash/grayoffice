import {
	type RouteConfig,
	index,
	route,
	layout,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("auth", "routes/auth.tsx"),
	route("auth/verify", "routes/auth.verify.tsx"),
	route("auth/mfa", "routes/auth.mfa.tsx"),
	route("auth/google", "routes/auth.google.tsx"),
	route("auth/google/callback", "routes/auth.google.callback.tsx"),
	route("logout", "routes/logout.tsx"),
	route("agent", "routes/api.agent.tsx"),
	layout("routes/dashboard-layout.tsx", [
		route("dashboard", "routes/dashboard.tsx"),
		route("dashboard/assistant", "routes/dashboard.assistant.tsx"),
		route("dashboard/settings", "routes/dashboard.settings.tsx"),
	]),
] satisfies RouteConfig;
