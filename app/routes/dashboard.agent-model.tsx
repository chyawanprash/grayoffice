import { redirect } from "react-router";
import type { Route } from "./+types/dashboard.agent-model";
import { requireOrg, setAgentModel } from "~/lib/org.server";
import { AGENT_MODELS } from "~/lib/agent.server";

/** Set the org's finance-assistant model from the chat composer. */
export async function action({ request, context }: Route.ActionArgs) {
	const { orgId, role } = await requireOrg(request, context.cloudflare.env);
	if (role === "member") return { error: "not allowed" };
	const model = String((await request.formData()).get("model") ?? "");
	await setAgentModel(context.cloudflare.env.DB, orgId, AGENT_MODELS.some((m) => m.id === model) ? model : null);
	return { ok: true, model };
}

export function loader() {
	return redirect("/dashboard/assistant");
}
