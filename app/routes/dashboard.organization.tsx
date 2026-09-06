import { Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.organization";
import { Button } from "~/components/ui/button";
import { getUser, requireUserId } from "~/lib/auth.server";
import {
	createInvite,
	leaveOrg,
	listMembers,
	listPendingInvites,
	renameOrg,
	requireOrg,
	setAgentModel,
} from "~/lib/org.server";
import { AGENT_MODELS, availableAgentModels } from "~/lib/agent.server";

export function meta() {
	return [{ title: "Organization | Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId, role, org } = await requireOrg(request, env);
	const available = availableAgentModels(env);
	return {
		org,
		role,
		members: await listMembers(env.DB, orgId),
		invites: await listPendingInvites(env.DB, orgId),
		models: AGENT_MODELS.map((m) => ({ id: m.id, label: m.label, ready: available.includes(m.id) })),
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { orgId, role, org } = await requireOrg(request, env);
	const userId = await requireUserId(request, env.SESSION_SECRET);
	const form = await request.formData();
	const intent = String(form.get("intent") ?? "");

	if (intent === "invite") {
		const email = String(form.get("email") ?? "").trim().toLowerCase();
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
			return { error: "Enter a valid email address." };
		const me = await getUser(env.DB, userId);
		await createInvite(env.DB, env, orgId, org.name, me?.name ?? me?.email ?? "A teammate", email);
		return { ok: "invited" as const };
	}

	if (intent === "model") {
		if (role === "member") return { error: "Only an owner or admin can change the assistant model." };
		const model = String(form.get("model") ?? "");
		await setAgentModel(env.DB, orgId, AGENT_MODELS.some((m) => m.id === model) ? model : null);
		return { ok: "model" as const };
	}

	if (intent === "rename") {
		if (role !== "owner") return { error: "Only the owner can rename the organization." };
		const name = String(form.get("name") ?? "").trim();
		if (name.length < 2) return { error: "Name is too short." };
		await renameOrg(env.DB, orgId, name);
		return { ok: "renamed" as const };
	}

	if (intent === "leave") {
		if (role === "owner") return { error: "The owner can't leave. Transfer or delete the org first." };
		await leaveOrg(env.DB, orgId, userId);
		throw new Response(null, { status: 302, headers: { Location: "/onboarding" } });
	}

	return { error: "Unknown action." };
}

const card = "rounded-xl bg-card p-4 text-card-foreground";

export default function Organization({ loaderData, actionData }: Route.ComponentProps) {
	const { org, role, members, invites, models } = loaderData;
	const nav = useNavigation();
	const busy = nav.formData != null; // a form submit is in flight (not a plain link nav)
	const err = actionData && "error" in actionData ? actionData.error : null;

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div>
				<h1 className="text-2xl font-normal text-foreground">{org.name}</h1>
				<p className="text-sm text-muted-foreground">
					Your role: <span className="capitalize">{role}</span>
				</p>
			</div>

			{err && <p className="text-sm text-destructive">{err}</p>}

			<div className="grid gap-3 lg:max-w-3xl">
				<section className={card}>
					<h2 className="text-lg font-medium">Finance assistant model</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Which LLM powers the assistant for everyone in {org.name}.
					</p>
					<Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
						<input type="hidden" name="intent" value="model" />
						<select
							name="model"
							defaultValue={org.agent_model ?? models[0]?.id ?? ""}
							disabled={role === "member"}
							className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
						>
							{models.map((m) => (
								<option key={m.id} value={m.id}>
									{m.label}
									{m.ready ? "" : " — key not set"}
								</option>
							))}
						</select>
						{role !== "member" && (
							<Button type="submit" size="sm" variant="outline" disabled={busy}>
								Save
							</Button>
						)}
						{actionData && "ok" in actionData && actionData.ok === "model" && (
							<span className="pb-1.5 text-sm text-[var(--dashboard-completed)]">Saved.</span>
						)}
					</Form>
					{models.every((m) => !m.ready) && (
						<p className="mt-2 text-xs text-[var(--dashboard-no-show)]">
							No provider key is configured yet — the assistant runs on the
							Workers AI fallback until one is added.
						</p>
					)}
				</section>

				<section className={card}>
					<h2 className="text-lg font-medium">Members ({members.length})</h2>
					<ul className="mt-3 divide-y divide-border/60 text-sm">
						{members.map((m) => (
							<li key={m.user_id} className="flex items-center justify-between py-2.5">
								<span className="text-foreground">{m.name ?? m.email}</span>
								<span className="text-xs text-muted-foreground capitalize">{m.role}</span>
							</li>
						))}
					</ul>
				</section>

				<section className={card}>
					<h2 className="text-lg font-medium">Invite a teammate</h2>
					<Form method="post" className="mt-3 flex flex-wrap items-end gap-2">
						<input type="hidden" name="intent" value="invite" />
						<input
							name="email"
							type="email"
							required
							placeholder="teammate@company.com"
							className="h-9 w-72 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring"
						/>
						<Button type="submit" size="sm" disabled={busy}>Send invite</Button>
						{actionData && "ok" in actionData && actionData.ok === "invited" && (
							<span className="pb-1.5 text-sm text-[var(--dashboard-completed)]">Invitation sent.</span>
						)}
					</Form>

					{invites.length > 0 && (
						<ul className="mt-4 divide-y divide-border/60 text-sm">
							{invites.map((i) => (
								<li key={i.id} className="flex items-center justify-between py-2">
									<span className="text-muted-foreground">{i.email}</span>
									<span className="text-xs text-muted-foreground">Pending</span>
								</li>
							))}
						</ul>
					)}
				</section>

				{role === "owner" && (
					<section className={card}>
						<h2 className="text-lg font-medium">Rename organization</h2>
						<Form method="post" className="mt-3 flex flex-wrap items-end gap-2" key={org.name}>
							<input type="hidden" name="intent" value="rename" />
							<input
								name="name"
								defaultValue={org.name}
								maxLength={80}
								className="h-9 w-64 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus:border-ring"
							/>
							<Button type="submit" size="sm" variant="outline" disabled={busy}>Save</Button>
						</Form>
					</section>
				)}

				{role !== "owner" && (
					<section className={`${card} border border-destructive/30`}>
						<h2 className="text-lg font-medium text-destructive">Leave organization</h2>
						<p className="mt-1 text-sm text-muted-foreground">
							You'll lose access to {org.name}'s data.
						</p>
						<Form method="post" className="mt-3">
							<input type="hidden" name="intent" value="leave" />
							<Button type="submit" size="sm" variant="outline" className="text-destructive" disabled={busy}>
								Leave {org.name}
							</Button>
						</Form>
					</section>
				)}
			</div>
		</div>
	);
}
