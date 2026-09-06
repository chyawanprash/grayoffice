import type { Route } from "./+types/dashboard.assistant";
import { AgentChat } from "~/components/ai/agent-chat";
import { requireOrg } from "~/lib/org.server";
import { AGENT_MODELS, availableAgentModels } from "~/lib/agent.server";

export function meta() {
	return [{ title: "Talk to Bhondu | Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { org } = await requireOrg(request, env);
	const ready = availableAgentModels(env);
	return {
		activeModel: org.agent_model,
		models: AGENT_MODELS.map((m) => ({ id: m.id, label: m.label, ready: ready.includes(m.id) })),
	};
}

export default function Assistant({ loaderData }: Route.ComponentProps) {
	return (
		<div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col p-4 md:p-6">
			<div className="mb-4">
				<h1 className="text-2xl font-normal text-foreground">Talk to Bhondu</h1>
				<p className="text-sm text-muted-foreground">
					Your finance agent. Ask it to run the close, reconcile the bank, raise
					an invoice, process a document, or pull the cash position — it reads
					every entity in your organization and acts with your confirmation.
				</p>
			</div>
			<AgentChat models={loaderData.models} activeModel={loaderData.activeModel} />
		</div>
	);
}
