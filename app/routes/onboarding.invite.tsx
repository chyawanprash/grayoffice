import { Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/onboarding.invite";
import { AuthShell } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import { getUser, requireUserId } from "~/lib/auth.server";
import { createInvite, requireOrg } from "~/lib/org.server";

export function meta() {
	return [{ title: "Invite your team | Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { org } = await requireOrg(request, context.cloudflare.env);
	return { orgName: org.name };
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { orgId, org } = await requireOrg(request, env);
	const userId = await requireUserId(request, env.SESSION_SECRET);
	const me = await getUser(env.DB, userId);
	const form = await request.formData();
	const emails = String(form.get("emails") ?? "")
		.split(/[\s,;]+/)
		.map((e) => e.trim().toLowerCase())
		.filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
		.slice(0, 25);

	for (const email of emails)
		await createInvite(env.DB, env, orgId, org.name, me?.name ?? me?.email ?? "A teammate", email);

	throw redirect("/dashboard");
}

export default function OnboardingInvite({ loaderData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";

	return (
		<AuthShell back={{ to: "/dashboard", label: "Skip for now" }}>
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
					Invite your team to {loaderData.orgName}
				</h1>
				<p className="mt-2 text-sm text-neutral-500">
					Add the people who close the books with you. They'll get an email to
					join. You can always do this later from Organization settings.
				</p>

				<Form method="post" className="mt-6 space-y-3">
					<label className="block text-sm font-medium text-neutral-700">
						Email addresses
						<textarea
							name="emails"
							rows={4}
							autoFocus
							placeholder="alex@acme.com, sam@acme.com"
							className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-surface px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
						/>
					</label>
					<Button type="submit" size="block" disabled={busy}>
						{busy ? "Sending invites…" : "Send invites & continue"}
					</Button>
					<Link
						to="/dashboard"
						className="block text-center text-sm font-medium text-neutral-500 hover:text-neutral-800"
					>
						Skip for now
					</Link>
				</Form>
			</div>
		</AuthShell>
	);
}
