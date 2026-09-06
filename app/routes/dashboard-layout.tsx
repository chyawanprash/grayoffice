import type { CSSProperties } from "react";
import { Outlet } from "react-router";
import type { Route } from "./+types/dashboard-layout";
import { getUser, logout, requireUserId } from "~/lib/auth.server";
import { listOrgsForUser, requireOrg } from "~/lib/org.server";
import { SidebarProvider } from "~/components/ui/sidebar";
import { DashboardSidebar } from "~/components/medesk/sidebar";
import { DashboardTopbar } from "~/components/medesk/topbar";
import { ChatWidget } from "~/components/medesk/chat-widget";
import { ErrorScene, errorToScene } from "~/components/error-scene";
import "~/components/medesk/dashboard.css";

const SHELL_STYLE = {
	"--sidebar-width": "17.25rem",
	"--sidebar-width-icon": "5.125rem",
} as CSSProperties;

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const user = await getUser(DB, userId);
	if (!user) throw await logout(request, SESSION_SECRET);
	const { orgId, role } = await requireOrg(request, context.cloudflare.env);
	const orgs = await listOrgsForUser(DB, userId);
	const org = orgs.find((o) => o.id === orgId)!;
	return { user, org, orgs, role };
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
	const { user, org, orgs } = loaderData;
	return (
		<SidebarProvider
			defaultOpen
			className="medesk-dashboard h-svh overflow-hidden no-scrollbar"
			style={SHELL_STYLE}
		>
			<DashboardSidebar user={user} org={org} orgs={orgs} />
			<main className="flex flex-1 flex-col overflow-hidden bg-sidebar p-0 md:p-2 md:pl-0">
				<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:rounded-xl">
					<DashboardTopbar />
					<div className="flex-1 overflow-y-auto">
						<Outlet />
					</div>
					<ChatWidget />
				</div>
			</main>
		</SidebarProvider>
	);
}

/** Dashboard errors keep the dashboard shell (sidebar + topbar). */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	return (
		<SidebarProvider
			defaultOpen
			className="medesk-dashboard h-svh overflow-hidden no-scrollbar"
			style={SHELL_STYLE}
		>
			<DashboardSidebar user={{ name: null, email: "" }} />
			<main className="flex flex-1 flex-col overflow-hidden bg-sidebar p-0 md:p-2 md:pl-0">
				<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:rounded-xl">
					<DashboardTopbar />
					<div className="flex flex-1 items-center overflow-y-auto">
						<ErrorScene {...errorToScene(error)} compact />
					</div>
				</div>
			</main>
		</SidebarProvider>
	);
}
