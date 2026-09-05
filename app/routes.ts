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
	layout("routes/dashboard-layout.tsx", [
		route("dashboard", "routes/dashboard.tsx"),
	]),
] satisfies RouteConfig;
