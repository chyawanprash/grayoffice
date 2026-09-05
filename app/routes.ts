import {
	type RouteConfig,
	index,
	route,
	layout,
} from "@react-router/dev/routes";

export default [
	index("routes/home.tsx"),
	route("auth", "routes/auth.tsx"),
	route("logout", "routes/logout.tsx"),
	route("agent", "routes/api.agent.tsx"),
	layout("routes/dashboard-layout.tsx", [
		route("dashboard", "routes/dashboard.tsx"),
		route("dashboard/assistant", "routes/dashboard.assistant.tsx"),
	]),
] satisfies RouteConfig;
