import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/onboarding";
import { AuthShell } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import { getPendingInvite, requireUserId, commitActiveOrg } from "~/lib/auth.server";
import { acceptInvite, createOrg, listOrgsForUser } from "~/lib/org.server";
import { setOrgProfile } from "~/lib/ledger.server";

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
	await setOrgProfile(DB, org.id, {
		address: String(form.get("address") ?? "").trim(),
		tax_id: String(form.get("tax_id") ?? "").trim(),
		home_state: String(form.get("home_state") ?? "").trim(),
		home_country: String(form.get("home_country") ?? "").trim() || "IN",
	});
	return commitActiveOrg(request, SESSION_SECRET, org.id, "/onboarding/invite");
}

export default function Onboarding({ actionData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.formData != null; // a form submit is in flight (not a plain link nav)

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
					<label className="block text-sm font-medium text-neutral-700">
						Registered address
						<textarea
							name="address"
							rows={2}
							placeholder="Street, city, PIN"
							className="mt-1.5 w-full rounded-lg border border-neutral-300 bg-surface px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
						/>
					</label>
					<label className="block text-sm font-medium text-neutral-700">
						GST number / VAT ID
						<input
							name="tax_id"
							placeholder="e.g. 29ABCDE1234F1Z5"
							className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
						/>
					</label>
					<div className="flex gap-2">
						<label className="block flex-1 text-sm font-medium text-neutral-700">
							State
							<input
								name="home_state"
								placeholder="Karnataka"
								className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
							/>
						</label>
						<label className="block w-24 text-sm font-medium text-neutral-700">
							Country
							<input
								name="home_country"
								defaultValue="IN"
								className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
							/>
						</label>
					</div>
					<p className="text-xs text-neutral-400">
						Used on invoices and for GST — you can change these later.
					</p>
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
