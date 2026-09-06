import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/onboarding";
import { AuthShell } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import { getPendingInvite, requireUserId, commitActiveOrg } from "~/lib/auth.server";
import { acceptInvite, createOrg, listOrgsForUser } from "~/lib/org.server";

export function meta() {
	return [{ title: "Create your organization | Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	if ((await listOrgsForUser(DB, userId)).length > 0) throw redirect("/dashboard");

	const token = await getPendingInvite(request, SESSION_SECRET);
	if (token && (await acceptInvite(DB, token, userId))) throw redirect("/dashboard");
	return null;
}

export async function action({ request, context }: Route.ActionArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const form = await request.formData();
	const name = String(form.get("name") ?? "").trim();
	if (name.length < 2) return { error: "Enter your organization's name." };
	if (name.length > 80) return { error: "That name is too long." };

	const org = await createOrg(DB, userId, name);
	return commitActiveOrg(request, SESSION_SECRET, org.id, "/onboarding/invite");
}

export default function Onboarding({ actionData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";

	return (
		<AuthShell back={{ to: "/logout", label: "Sign out" }}>
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
					Create your organization
				</h1>
				<p className="mt-2 text-sm text-neutral-500">
					Gray Office is built for finance teams. Everything - payments, banking,
					documents - lives inside your organization.
				</p>

				<Form method="post" className="mt-6 space-y-3">
					<label className="block text-sm font-medium text-neutral-700">
						Organization name
						<input
							name="name"
							required
							autoFocus
							maxLength={80}
							placeholder="Acme Inc."
							className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
						/>
					</label>
					{actionData?.error && (
						<p className="text-sm text-danger">{actionData.error}</p>
					)}
					<Button type="submit" size="block" disabled={busy}>
						{busy ? "Creating…" : "Continue"}
					</Button>
				</Form>
			</div>
		</AuthShell>
	);
}
