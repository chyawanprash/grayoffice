import type { CSSProperties } from "react";
import { Outlet } from "react-router";
import type { Route } from "./+types/dashboard-layout";
import { getUser, logout, requireUserId } from "~/lib/auth.server";
import { SidebarProvider } from "~/components/ui/sidebar";
import { DashboardSidebar } from "~/components/medesk/sidebar";
import { DashboardTopbar } from "~/components/medesk/topbar";
import "~/components/medesk/dashboard.css";

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const user = await getUser(DB, userId);
	if (!user) throw await logout(request, SESSION_SECRET);
	return { user };
}

export default function DashboardLayout({ loaderData }: Route.ComponentProps) {
	const { user } = loaderData;
	return (
			<SidebarProvider
				defaultOpen
				className="medesk-dashboard h-svh overflow-hidden no-scrollbar"
				style={
					{
						"--sidebar-width": "17.25rem",
						"--sidebar-width-icon": "5.125rem",
					} as CSSProperties
				}
			>
				<DashboardSidebar user={user} />
				<main className="flex flex-1 flex-col overflow-hidden bg-sidebar p-0 md:p-2 md:pl-0">
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:rounded-xl">
						<DashboardTopbar />
						<div className="flex-1 overflow-y-auto">
							<Outlet />
						</div>
					</div>
				</main>
			</SidebarProvider>
	);
}
