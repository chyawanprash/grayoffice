import { Form, Link, useNavigation } from "react-router";
import type { Route } from "./+types/invite.$token";
import { AuthShell } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import {
	commitActiveOrg,
	getUserId,
	stashPendingInvite,
} from "~/lib/auth.server";
import { acceptInvite, findInvite } from "~/lib/org.server";

export function meta() {
	return [{ title: "Join organization | Gray Office" }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const token = params.token;
	const invite = await findInvite(DB, token);
	if (!invite) return { state: "invalid" as const };

	const userId = await getUserId(request, SESSION_SECRET);
	if (!userId)
		throw await stashPendingInvite(request, SESSION_SECRET, token, "/sign-up");

	return { state: "ready" as const, orgName: invite.orgName, email: invite.email };
}

export async function action({ request, context, params }: Route.ActionArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await getUserId(request, SESSION_SECRET);
	if (!userId)
		throw await stashPendingInvite(request, SESSION_SECRET, params.token, "/sign-up");

	const orgId = await acceptInvite(DB, params.token, userId);
	if (!orgId) return { error: "This invitation is no longer valid." };
	return commitActiveOrg(request, SESSION_SECRET, orgId, "/dashboard");
}

export default function AcceptInvite({ loaderData, actionData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.formData != null; // a form submit is in flight (not a plain link nav)

	if (loaderData.state === "invalid")
		return (
			<AuthShell back={{ to: "/", label: "Back to site" }}>
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
						Invitation not found
					</h1>
					<p className="mt-2 text-sm text-neutral-500">
						This invite link is invalid or has expired. Ask your admin to send a
						new one.
					</p>
					<Link
						to="/sign-in"
						className="mt-6 inline-block text-sm font-medium text-brand hover:underline"
					>
						Go to sign in
					</Link>
				</div>
			</AuthShell>
		);

	return (
		<AuthShell back={{ to: "/logout", label: "Sign out" }}>
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
					Join {loaderData.orgName}
				</h1>
				<p className="mt-2 text-sm text-neutral-500">
					You've been invited to collaborate on {loaderData.orgName} in Gray
					Office.
				</p>
				{actionData?.error && (
					<p className="mt-4 text-sm text-danger">{actionData.error}</p>
				)}
				<Form method="post" className="mt-6">
					<Button type="submit" size="block" disabled={busy}>
						{busy ? "Joining…" : `Join ${loaderData.orgName}`}
					</Button>
				</Form>
			</div>
		</AuthShell>
	);
}
