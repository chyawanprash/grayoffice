import { redirect } from "react-router";
import type { Route } from "./+types/org.switch";
import { commitActiveOrg, requireUserId } from "~/lib/auth.server";
import { getMembership } from "~/lib/org.server";

export async function action({ request, context }: Route.ActionArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const form = await request.formData();
	const orgId = String(form.get("orgId") ?? "");
	if (!(await getMembership(DB, orgId, userId))) throw redirect("/dashboard");
	return commitActiveOrg(request, SESSION_SECRET, orgId, "/dashboard");
}

export function loader() {
	return redirect("/dashboard");
}
