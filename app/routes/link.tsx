/**
 * /link — connect a chat-bot account (Discord / Slack / Telegram) to the
 * signed-in Gray Office user. The bot's /login command shows a short code; the
 * user enters it here while signed in and we record the mapping in `bot_links`.
 */
import { Form, Link, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/link";
import { requireUserId } from "~/lib/auth.server";
import { listOrgsForUser } from "~/lib/org.server";
import { Button } from "~/components/ui/button";

export function meta() {
	return [{ title: "Connect a bot | Gray Office" }];
}

const SOURCE_LABEL: Record<string, string> = {
	discord: "Discord",
	slack: "Slack",
	telegram: "Telegram",
};

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const orgs = await listOrgsForUser(DB, userId);
	if (orgs.length === 0) throw redirect("/onboarding");
	return { orgName: orgs[0].name };
}

export async function action({ request, context }: Route.ActionArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);

	const form = await request.formData();
	const code = String(form.get("code") ?? "")
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, "")
		.replace(/^(.{3})(.{3})$/, "$1-$2");

	if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(code))
		return { error: "That doesn't look like a valid code. It looks like ABC-234." };

	const row = await DB.prepare(
		`SELECT source, external_user, display_name
		 FROM bot_link_codes WHERE code = ? AND expires_at > unixepoch()`,
	)
		.bind(code)
		.first<{ source: string; external_user: string; display_name: string | null }>();

	if (!row)
		return { error: "That code is expired or wrong. Run /login in the bot again for a fresh one." };

	const orgs = await listOrgsForUser(DB, userId);
	if (orgs.length === 0) return { error: "Finish setting up your organization first." };

	await DB.prepare(
		`INSERT INTO bot_links (source, external_user, user_id, org_id, display_name)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT (source, external_user) DO UPDATE SET
		   user_id = excluded.user_id,
		   org_id = excluded.org_id,
		   display_name = excluded.display_name,
		   created_at = unixepoch()`,
	)
		.bind(row.source, row.external_user, userId, orgs[0].id, row.display_name)
		.run();

	await DB.prepare("DELETE FROM bot_link_codes WHERE code = ?").bind(code).run();

	return {
		connected: {
			source: SOURCE_LABEL[row.source] ?? row.source,
			handle: row.display_name ?? row.external_user,
			org: orgs[0].name,
		},
	};
}

export default function LinkPage({ loaderData, actionData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";
	const connected = actionData && "connected" in actionData ? actionData.connected : null;
	const error = actionData && "error" in actionData ? actionData.error : null;

	return (
		<div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
			<div className="rounded-2xl border border-border bg-surface p-6">
				<h1 className="text-lg font-semibold tracking-tight text-foreground">
					Connect a chat bot
				</h1>

				{connected ? (
					<div className="mt-4 space-y-4">
						<p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
							✅ <b>{connected.source}</b> account <b>{connected.handle}</b> is now
							linked to <b>{connected.org}</b>. Head back to the bot — your messages
							run as you.
						</p>
						<Link
							to="/dashboard"
							className="inline-flex w-full items-center justify-center rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
						>
							Go to dashboard
						</Link>
					</div>
				) : (
					<>
						<p className="mt-1 text-sm text-muted-foreground">
							Run <code className="font-mono">/login</code> in the bot, then enter the
							code it gives you.
						</p>
						<Form method="post" className="mt-4 space-y-3">
							<input
								name="code"
								autoFocus
								autoComplete="one-time-code"
								placeholder="ABC-234"
								className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-center font-mono text-lg tracking-widest text-foreground uppercase outline-none placeholder:text-muted-foreground focus-visible:border-ring"
							/>
							{error && (
								<p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
									{error}
								</p>
							)}
							<Button type="submit" disabled={busy} className="w-full">
								{busy ? "Connecting…" : "Connect"}
							</Button>
						</Form>
					</>
				)}
			</div>
			<p className="mt-4 text-center text-xs text-muted-foreground">
				<Link to="/dashboard" className="hover:text-foreground">
					← Back to Gray Office
				</Link>
			</p>
		</div>
	);
}
