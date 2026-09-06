import { redirect } from "react-router";
import type { Route } from "./+types/dashboard.section";
import { requireUserId } from "~/lib/auth.server";
import { navigationGroups } from "~/components/medesk/data";
import { Construction } from "lucide-react";

const items = navigationGroups.flatMap((g) => g.items);

export async function loader({ request, context, params }: Route.LoaderArgs) {
	await requireUserId(request, context.cloudflare.env.SESSION_SECRET);
	const item = items.find((i) => i.href === `/${params.section}`);
	if (!item) throw redirect("/dashboard");
	return { name: item.name };
}

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `${data?.name ?? "Dashboard"} — Gray Office` }];
}

export default function DashboardSection({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
			<div className="grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground">
				<Construction className="size-6" />
			</div>
			<h1 className="text-xl font-medium text-foreground">{loaderData.name}</h1>
			<p className="max-w-sm text-sm text-muted-foreground">
				This section is coming soon.
			</p>
		</div>
	);
}
