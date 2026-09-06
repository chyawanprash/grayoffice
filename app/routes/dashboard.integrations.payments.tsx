import { Link } from "react-router";
import type { Route } from "./+types/dashboard.integrations.payments";
import { requireUserId } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";
import { PROVIDERS, PROVIDER_IDS, listIntegrations } from "~/lib/payments.server";

export function meta() {
	return [{ title: "Payment gateways | Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const connected = await listIntegrations(DB, userId);
	return {
		providers: PROVIDER_IDS.map((id) => ({
			id,
			name: PROVIDERS[id].name,
			blurb: PROVIDERS[id].blurb,
			txLabel: PROVIDERS[id].txLabel,
			connected: Boolean(connected[id]?.api_key),
			mode: connected[id]?.mode ?? null,
		})),
	};
}

export default function PaymentGateways({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl leading-[1.4] font-normal text-foreground">
					Payment gateways
				</h1>
				<p className="max-w-2xl text-sm text-muted-foreground">
					Connect a gateway to pull its transactions into Gray Office and
					receive its webhooks. Each connection is stored per account.
				</p>
			</div>

			<div className="overflow-x-auto rounded-xl border border-border bg-card">
				<table className="w-full min-w-[36rem] text-left text-sm">
					<thead className="text-xs font-medium text-muted-foreground">
						<tr className="h-11 border-b border-border">
							<th className="px-4">Gateway</th>
							<th className="px-4">Pulls</th>
							<th className="px-4">Status</th>
							<th className="px-4 text-right">Action</th>
						</tr>
					</thead>
					<tbody>
						{loaderData.providers.map((p) => (
							<tr
								key={p.id}
								className="h-16 border-b border-border/60 last:border-0"
							>
								<td className="px-4">
									<div className="font-medium text-foreground">{p.name}</div>
									<div className="text-xs text-muted-foreground">{p.blurb}</div>
								</td>
								<td className="px-4 text-muted-foreground">{p.txLabel}</td>
								<td className="px-4">
									<span
										className={`rounded-md px-2 py-0.5 text-xs font-medium ${
											p.connected
												? "bg-[color-mix(in_oklch,var(--dashboard-completed)_14%,transparent)] text-[var(--dashboard-completed)]"
												: "bg-muted text-muted-foreground"
										}`}
									>
										{p.connected ? `Connected · ${p.mode}` : "Not connected"}
									</span>
								</td>
								<td className="px-4 text-right">
									<Button
										render={<Link to={`/dashboard/integrations/${p.id}`} />}
										variant={p.connected ? "outline" : "primary"}
										size="sm"
									>
										{p.connected ? "Manage" : "Integrate"}
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
