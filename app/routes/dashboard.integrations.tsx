import { useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import { CheckCircle, Copy } from "@phosphor-icons/react";
import type { Route } from "./+types/dashboard.integrations";
import { requireOrg } from "~/lib/org.server";
import { Button } from "~/components/ui/button";
import { DiscordIcon, SlackIcon, TelegramIcon } from "~/components/brand-icons";
import {
	BOT_META,
	BOT_PLATFORMS,
	botWebhookUrl,
	type BotPlatform,
} from "~/lib/bots-catalog";
import {
	deleteBotIntegration,
	deleteTelegramWebhook,
	getBotIntegration,
	listBotIntegrations,
	registerDiscordCommands,
	saveBotIntegration,
	setTelegramWebhook,
} from "~/lib/bots.server";
import { handleInbound } from "../../workers/bot-router";

export function meta() {
	return [{ title: "Integrations | Gray Office" }];
}

const ICON: Record<BotPlatform, typeof SlackIcon> = {
	slack: SlackIcon,
	telegram: TelegramIcon,
	discord: DiscordIcon,
};

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { orgId } = await requireOrg(request, env);
	const base = (env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");

	const connected = await listBotIntegrations(env, orgId);
	const byPlatform = Object.fromEntries(connected.map((c) => [c.platform, c]));

	const { results } = await env.DB.prepare(
		`SELECT source, COUNT(*) AS count, MAX(created_at) AS last_at,
		        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
		 FROM bot_events WHERE org_id = ? GROUP BY source`,
	)
		.bind(orgId)
		.all<{ source: string; count: number; last_at: number | null; errors: number }>();
	const stats = Object.fromEntries((results ?? []).map((r) => [r.source, r]));

	return {
		platforms: BOT_PLATFORMS.map((id) => {
			const c = byPlatform[id];
			const meta = BOT_META[id];
			return {
				id,
				name: meta.name,
				blurb: meta.blurb,
				consoleUrl: meta.consoleUrl,
				fields: meta.fields,
				steps: meta.steps,
				connected: Boolean(c && c.status === "active"),
				appId: c?.app_id ?? null,
				workspaceName: c?.workspace_name ?? null,
				webhookUrl: botWebhookUrl(base, id, orgId),
				inviteUrl: c?.app_id ? meta.invite?.(c.app_id) ?? null : null,
				events: stats[id]?.count ?? 0,
				errors: stats[id]?.errors ?? 0,
				lastAt: stats[id]?.last_at ?? null,
			};
		}),
		aiConfigured: Boolean(env.OPENAI_API_KEY || env.GOOGLE_AI_API_KEY),
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { orgId } = await requireOrg(request, env);
	const base = (env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
	const form = await request.formData();
	const intent = String(form.get("intent"));
	const platform = String(form.get("platform")) as BotPlatform;
	if (!BOT_PLATFORMS.includes(platform)) return { error: "unknown platform" };

	if (intent === "disconnect") {
		const integ = await getBotIntegration(env, orgId, platform);
		if (platform === "telegram" && integ) await deleteTelegramWebhook(integ).catch(() => {});
		await deleteBotIntegration(env, orgId, platform);
		return { ok: "disconnected" as const, platform };
	}

	if (intent === "test") {
		const owner = await env.DB.prepare("SELECT created_by FROM organizations WHERE id = ?")
			.bind(orgId)
			.first<{ created_by: string }>();
		try {
			const res = await handleInbound(env, {
				source: platform,
				orgId,
				userId: owner?.created_by ?? null,
				externalUser: "dashboard-test",
				text: String(form.get("text") ?? "").trim() || "What can you help me with?",
				files: [],
			});
			return { test: { platform, route: res.route, status: res.status, detail: res.detail } };
		} catch (err) {
			return { error: err instanceof Error ? err.message : String(err) };
		}
	}

	// connect / save
	const bot_token = String(form.get("bot_token") ?? "").trim() || undefined;
	const signing_secret = String(form.get("signing_secret") ?? "").trim() || undefined;
	const app_id = String(form.get("app_id") ?? "").trim() || undefined;

	if (platform === "telegram") {
		// Telegram has no signing secret to paste — generate a webhook secret token.
		const secret = crypto.randomUUID().replace(/-/g, "");
		await saveBotIntegration(env, orgId, "telegram", { bot_token, signing_secret: secret });
		const integ = await getBotIntegration(env, orgId, "telegram");
		if (!integ) return { error: "save failed" };
		const err = await setTelegramWebhook(integ, botWebhookUrl(base, "telegram", orgId), secret);
		if (err) return { error: err };
		return { ok: "connected" as const, platform };
	}

	await saveBotIntegration(env, orgId, platform, { bot_token, signing_secret, app_id });

	if (platform === "discord") {
		const integ = await getBotIntegration(env, orgId, "discord");
		const err = integ ? await registerDiscordCommands(integ) : "save failed";
		if (err) return { error: err };
	}
	return { ok: "connected" as const, platform };
}

export default function Integrations({ loaderData, actionData }: Route.ComponentProps) {
	const { platforms, aiConfigured } = loaderData;
	const nav = useNavigation();
	const busy = nav.formData != null;
	const [open, setOpen] = useState<BotPlatform | null>(null);
	const err = actionData && "error" in actionData ? actionData.error : null;
	const test = actionData && "test" in actionData ? actionData.test : null;

	return (
		<div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
			<div>
				<h1 className="text-2xl font-normal text-foreground">Integrations</h1>
				<p className="max-w-2xl text-sm text-muted-foreground">
					Connect the finance assistant to Slack, Telegram and Discord. Messages
					and shared PDFs run through the same agent and tools as the web app;
					credentials are encrypted and never leave the backend.
				</p>
			</div>

			{!aiConfigured && (
				<p className="rounded-lg border border-[var(--dashboard-no-show)]/30 bg-[color-mix(in_oklch,var(--dashboard-no-show)_10%,transparent)] px-3 py-2 text-sm text-[var(--dashboard-no-show)]">
					No agent model key is set (OPENAI_API_KEY / GOOGLE_AI_API_KEY) — bots
					will use the basic Workers AI fallback until one is configured.
				</p>
			)}
			{err && (
				<p className="rounded-lg border border-destructive/30 bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] px-3 py-2 text-sm text-destructive">
					{err}
				</p>
			)}
			{actionData && "ok" in actionData && (
				<p className="rounded-lg border border-[var(--dashboard-completed)]/30 bg-[color-mix(in_oklch,var(--dashboard-completed)_10%,transparent)] px-3 py-2 text-sm text-[var(--dashboard-completed)]">
					{actionData.platform} {actionData.ok}.
				</p>
			)}

			<div className="overflow-x-auto rounded-xl border border-border bg-card">
				<table className="w-full min-w-[36rem] text-left text-sm">
					<thead className="text-xs font-medium text-muted-foreground">
						<tr className="h-11 border-b border-border">
							<th className="px-4">Channel</th>
							<th className="px-4">Activity</th>
							<th className="px-4">Status</th>
							<th className="px-4 text-right">Action</th>
						</tr>
					</thead>
					<tbody>
						{platforms.map((p) => {
							const Icon = ICON[p.id];
							return (
								<tr key={p.id} className="h-16 border-b border-border/60 last:border-0">
									<td className="px-4">
										<div className="flex items-center gap-2.5">
											<Icon className="size-5 shrink-0" />
											<div>
												<div className="font-medium text-foreground">{p.name}</div>
												<div className="text-xs text-muted-foreground">{p.blurb}</div>
											</div>
										</div>
									</td>
									<td className="px-4 text-muted-foreground">
										{p.connected
											? `${p.events} event(s)${p.errors ? ` · ${p.errors} error(s)` : ""}`
											: "—"}
									</td>
									<td className="px-4">
										<span
											className={`rounded-md px-2 py-0.5 text-xs font-medium ${
												p.connected
													? "bg-[color-mix(in_oklch,var(--dashboard-completed)_14%,transparent)] text-[var(--dashboard-completed)]"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{p.connected ? `Connected${p.workspaceName ? ` · ${p.workspaceName}` : ""}` : "Not connected"}
										</span>
									</td>
									<td className="px-4 text-right">
										<Button variant={p.connected ? "outline" : "primary"} size="sm" onClick={() => setOpen(p.id)}>
											{p.connected ? "Manage" : "Integrate"}
										</Button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<p className="text-xs text-muted-foreground">
				Prefer to browse events? <Link to="/dashboard/audit" className="text-brand hover:underline">Audit room →</Link>
			</p>

			{open && (
				<ConnectDialog
					platform={platforms.find((p) => p.id === open)!}
					busy={busy}
					test={test?.platform === open ? test : null}
					onClose={() => setOpen(null)}
				/>
			)}
		</div>
	);
}

type PlatformView = Route.ComponentProps["loaderData"]["platforms"][number];

function ConnectDialog({
	platform,
	busy,
	test,
	onClose,
}: {
	platform: PlatformView;
	busy: boolean;
	test: { route: string; status: string; detail: unknown } | null;
	onClose: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-[8vh]" onClick={onClose}>
			<div
				className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="mb-3 flex items-start justify-between">
					<div>
						<h2 className="text-lg font-medium text-foreground">{platform.name}</h2>
						<a href={platform.consoleUrl} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
							Open {platform.name} console ↗
						</a>
					</div>
					<button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">×</button>
				</div>

				<ol className="mb-4 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
					{platform.steps.map((s) => <li key={s}>{s}</li>)}
				</ol>

				<Form method="post" className="space-y-3">
					<input type="hidden" name="intent" value="connect" />
					<input type="hidden" name="platform" value={platform.id} />
					{platform.fields.map((f) => (
						<label key={f.key} className="flex flex-col gap-1 text-xs text-muted-foreground">
							{f.label}{f.optional ? " (optional)" : ""}
							<input
								name={f.key}
								placeholder={f.placeholder}
								required={!f.optional && !platform.connected}
								className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus:border-brand"
							/>
						</label>
					))}
					<Button type="submit" size="sm" disabled={busy}>
						{busy ? "Saving…" : platform.connected ? "Update" : "Connect"}
					</Button>
				</Form>

				{platform.connected && (
					<div className="mt-4 space-y-3 border-t border-border pt-4 text-xs">
						{platform.id !== "telegram" && (
							<div>
								<div className="mb-1 text-muted-foreground">
									{platform.id === "discord" ? "Interactions Endpoint URL" : "Request URL"} — paste into the {platform.name} app
								</div>
								<CopyRow value={platform.webhookUrl} />
							</div>
						)}
						{platform.inviteUrl && (
							<a
								href={platform.inviteUrl}
								target="_blank"
								rel="noreferrer"
								className="inline-flex h-8 items-center rounded-lg bg-brand px-3 font-medium text-white"
							>
								{platform.id === "discord" ? "Invite bot to a server ↗" : "Install to workspace ↗"}
							</a>
						)}

						<Form method="post" className="flex items-center gap-2 pt-1">
							<input type="hidden" name="intent" value="test" />
							<input type="hidden" name="platform" value={platform.id} />
							<input
								name="text"
								placeholder="Test message to the agent"
								className="h-8 flex-1 rounded-lg border border-border bg-background px-2.5 text-foreground outline-none focus:border-brand"
							/>
							<Button type="submit" size="sm" variant="outline" disabled={busy}>Test</Button>
						</Form>
						{test && (
							<pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 font-mono text-foreground">
								{typeof test.detail === "object" && test.detail && "reply" in test.detail
									? String((test.detail as { reply: string }).reply)
									: JSON.stringify(test.detail, null, 2)}
							</pre>
						)}

						<Form method="post" className="pt-1">
							<input type="hidden" name="intent" value="disconnect" />
							<input type="hidden" name="platform" value={platform.id} />
							<button type="submit" className="text-destructive hover:underline" disabled={busy}>
								Disconnect {platform.name}
							</button>
						</Form>
					</div>
				)}
			</div>
		</div>
	);
}

function CopyRow({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="flex items-center gap-2">
			<code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2.5 py-1.5 font-mono text-[11px] text-foreground">{value}</code>
			<button
				type="button"
				onClick={() => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
				className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground"
				aria-label="Copy"
			>
				{copied ? <CheckCircle weight="fill" className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
			</button>
		</div>
	);
}
