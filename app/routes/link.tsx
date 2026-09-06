/**
 * /link — connect a chat bot account ("login" from Discord / Slack / Telegram).
 *
 * The user runs `/login` in the bot, gets a short code, and enters it here while
 * signed in to Gray Office. We match the code to the pending request in
 * `bot_link_codes`, write the confirmed `bot_links` row, and burn the code.
 */
import { Form, Link, useNavigation } from "react-router";
import { AuthShell } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import { findUserById, getUserId } from "~/lib/auth.server";
import type { Route } from "./+types/link";

export function meta() {
	return [{ title: "Connect a bot | Gray Office" }];
}

const SOURCE_LABEL: Record<string, string> = {
	discord: "Discord",
	slack: "Slack",
	telegram: "Telegram",
};

/** 'k7q 2f9', 'K7Q-2F9', 'k7q2f9' -> 'K7Q-2F9' */
function normalizeCode(raw: string): string {
	const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
	return s.length > 3 ? `${s.slice(0, 3)}-${s.slice(3)}` : s;
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await getUserId(request, SESSION_SECRET);
	if (!userId) return { authed: false as const };

	const user = await findUserById(DB, userId);
	const links = await DB.prepare(
		`SELECT source, external_user, display_name, created_at
		 FROM bot_links WHERE user_id = ? ORDER BY created_at DESC`,
	)
		.bind(userId)
		.all<{
			source: string;
			external_user: string;
			display_name: string | null;
			created_at: number;
		}>();

	return {
		authed: true as const,
		email: user?.email ?? "",
		name: user?.name ?? null,
		links: links.results ?? [],
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await getUserId(request, SESSION_SECRET);
	if (!userId) return { error: "Your session expired. Sign in and try again." };

	const form = await request.formData();
	const intent = String(form.get("intent") ?? "connect");

	if (intent === "disconnect") {
		const source = String(form.get("source") ?? "");
		const externalUser = String(form.get("externalUser") ?? "");
		await DB.prepare(
			"DELETE FROM bot_links WHERE user_id = ? AND source = ? AND external_user = ?",
		)
			.bind(userId, source, externalUser)
			.run();
		return { disconnected: true as const };
	}

	const code = normalizeCode(String(form.get("code") ?? ""));
	if (code.length !== 7) return { error: "Enter the 6-character code from the bot." };

	const pending = await DB.prepare(
		`SELECT source, external_user, display_name, expires_at
		 FROM bot_link_codes WHERE code = ?`,
	)
		.bind(code)
		.first<{
			source: string;
			external_user: string;
			display_name: string | null;
			expires_at: number;
		}>();

	if (!pending)
		return { error: "That code isn't valid. Generate a new one in the bot." };
	if (pending.expires_at * 1000 < Date.now()) {
		await DB.prepare("DELETE FROM bot_link_codes WHERE code = ?").bind(code).run();
		return { error: "That code expired. Run /login in the bot again." };
	}

	await DB.prepare(
		`INSERT INTO bot_links (source, external_user, user_id, display_name)
		 VALUES (?1, ?2, ?3, ?4)
		 ON CONFLICT (source, external_user)
		 DO UPDATE SET user_id = ?3, display_name = ?4, created_at = unixepoch()`,
	)
		.bind(pending.source, pending.external_user, userId, pending.display_name)
		.run();
	await DB.prepare("DELETE FROM bot_link_codes WHERE code = ?").bind(code).run();

	return {
		connected: {
			source: pending.source,
			label: SOURCE_LABEL[pending.source] ?? pending.source,
			displayName: pending.display_name,
		},
	};
}

export default function LinkBot({ loaderData, actionData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";

	if (!loaderData.authed) {
		return (
			<AuthShell back={{ to: "/", label: "Back to site" }}>
				<div>
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						Sign in to connect a bot
					</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						You need to be signed in to Gray Office to link your Discord, Slack or
						Telegram account. Sign in, then come back to this page and enter the
						code from the bot.
					</p>
					<Button className="mt-6" size="block" render={<Link to="/sign-in" />}>
						Sign in
					</Button>
				</div>
			</AuthShell>
		);
	}

	const error = actionData && "error" in actionData ? actionData.error : null;
	const connected =
		actionData && "connected" in actionData ? actionData.connected : null;

	return (
		<AuthShell back={{ to: "/dashboard", label: "Back to dashboard" }}>
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">
					Connect a chat bot
				</h1>
				<p className="mt-2 text-sm text-muted-foreground">
					Signed in as {loaderData.name || loaderData.email}. Run{" "}
					<code className="rounded bg-secondary px-1 py-0.5 text-xs">/login</code>{" "}
					in the Gray Office bot on Discord, Slack or Telegram, then enter the code
					it gives you.
				</p>

				{connected && (
					<p className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
						Connected your {connected.label} account
						{connected.displayName ? ` (${connected.displayName})` : ""}. Messages
						you send the bot are now tied to this Gray Office account.
					</p>
				)}
				{error && <p className="mt-4 text-sm text-danger">{error}</p>}

				<Form method="post" className="mt-6 space-y-3">
					<input type="hidden" name="intent" value="connect" />
					<input
						name="code"
						required
						autoFocus
						autoComplete="off"
						spellCheck={false}
						placeholder="K7Q-2F9"
						className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-center text-lg font-semibold uppercase tracking-[0.3em] text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
					/>
					<Button type="submit" size="block" disabled={busy}>
						{busy ? "Connecting…" : "Connect"}
					</Button>
				</Form>

				{loaderData.links.length > 0 && (
					<div className="mt-8">
						<h2 className="text-sm font-medium text-foreground">
							Connected accounts
						</h2>
						<ul className="mt-2 divide-y divide-border rounded-lg border border-border">
							{loaderData.links.map((l) => (
								<li
									key={`${l.source}:${l.external_user}`}
									className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
								>
									<span className="text-foreground">
										{SOURCE_LABEL[l.source] ?? l.source}
										{l.display_name ? (
											<span className="text-muted-foreground">
												{" "}
												· {l.display_name}
											</span>
										) : null}
									</span>
									<Form method="post">
										<input type="hidden" name="intent" value="disconnect" />
										<input type="hidden" name="source" value={l.source} />
										<input
											type="hidden"
											name="externalUser"
											value={l.external_user}
										/>
										<button
											type="submit"
											disabled={busy}
											className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
										>
											Disconnect
										</button>
									</Form>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</AuthShell>
	);
}
