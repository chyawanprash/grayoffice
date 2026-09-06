import { useState } from "react";
import { Form, Link, useNavigation } from "react-router";
import {
	CheckCircle,
	Circle,
	Copy,
	DiscordLogo,
	SlackLogo,
	TelegramLogo,
	type Icon,
} from "@phosphor-icons/react";
import type { Route } from "./+types/dashboard.integrations";
import { requireUserId } from "~/lib/auth.server";
import { Button } from "~/components/ui/button";

export function meta() {
	return [{ title: "Integrations | Gray Office" }];
}

type Source = "slack" | "telegram" | "discord";
const SOURCES: Source[] = ["slack", "telegram", "discord"];

type CatalogEntry = {
	source: Source;
	name: string;
	icon: Icon;
	tint: string;
	blurb: string;
	repo: string;
	entry: string;
	env: string[];
};

/** The bots live in their own repos and POST to /api/bots/ingest. */
const CATALOG: CatalogEntry[] = [
	{
		source: "slack",
		name: "Slack",
		icon: SlackLogo,
		tint: "bg-[#4A154B]/10 text-[#4A154B] dark:bg-[#4A154B]/30 dark:text-[#e0b0e4]",
		blurb:
			"Mentions and DMs (plus shared PDFs) are forwarded to the backend; replies post back in-thread.",
		repo: "https://github.com/chyawanprash/slack.grayoffice",
		entry: "app.py",
		env: ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN", "GRAYOFFICE_URL", "BOT_INGEST_TOKEN"],
	},
	{
		source: "telegram",
		name: "Telegram",
		icon: TelegramLogo,
		tint: "bg-[#229ED9]/10 text-[#229ED9] dark:bg-[#229ED9]/25 dark:text-[#7cc6e8]",
		blurb:
			"Every message and PDF document is forwarded; the bot answers with the finance assistant's reply.",
		repo: "https://github.com/chyawanprash/telegram.grayoffice",
		entry: "bot.py",
		env: ["TELEGRAM_BOT_TOKEN", "GRAYOFFICE_URL", "BOT_INGEST_TOKEN"],
	},
	{
		source: "discord",
		name: "Discord",
		icon: DiscordLogo,
		tint: "bg-[#5865F2]/10 text-[#5865F2] dark:bg-[#5865F2]/25 dark:text-[#a3aaf5]",
		blurb:
			"@mentions, DMs and the /ask command are forwarded; attachments are routed to PDF→JSON.",
		repo: "https://github.com/chyawanprash/discord.grayoffice",
		entry: "bot.py",
		env: ["DISCORD_TOKEN", "GUILD_ID", "GRAYOFFICE_URL", "BOT_INGEST_TOKEN"],
	},
];

type Stat = { count: number; last_at: number | null; errors: number };

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	await requireUserId(request, env.SESSION_SECRET);

	const { results } = await env.DB.prepare(
		`SELECT source,
		        COUNT(*)                                    AS count,
		        MAX(created_at)                             AS last_at,
		        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors
		 FROM bot_events
		 GROUP BY source`,
	).all<{ source: string; count: number; last_at: number | null; errors: number }>();

	const stats: Record<string, Stat> = {};
	for (const r of results ?? [])
		stats[r.source] = { count: r.count, last_at: r.last_at, errors: r.errors ?? 0 };

	return {
		stats,
		ingestUrl: `${(env.APP_URL ?? "").replace(/\/$/, "")}/api/bots/ingest`,
		tokenConfigured: Boolean(env.BOT_INGEST_TOKEN),
		aiConfigured: Boolean(env.AI),
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	await requireUserId(request, env.SESSION_SECRET);

	const form = await request.formData();
	if (form.get("intent") !== "test") return { test: null };

	const source = String(form.get("source") ?? "slack") as Source;
	const text = String(form.get("text") ?? "").trim();
	if (!SOURCES.includes(source) || !text)
		return { test: { error: "Pick a source and enter a message." } };

	// Hit the same public ingest endpoint the bots use, so this is a true
	// end-to-end check of the pipeline (auth header included).
	const base = (env.APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
	try {
		const res = await fetch(`${base}/api/bots/ingest`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(env.BOT_INGEST_TOKEN
					? { authorization: `Bearer ${env.BOT_INGEST_TOKEN}` }
					: {}),
			},
			body: JSON.stringify({
				source,
				externalUser: "dashboard-test",
				text,
				files: [],
			}),
		});
		const body = (await res.json()) as Record<string, unknown>;
		if (!res.ok)
			return { test: { error: `${res.status}: ${JSON.stringify(body)}` } };
		return {
			test: {
				result: body as {
					route: string;
					status: string;
					detail: unknown;
				},
			},
		};
	} catch (err) {
		return { test: { error: err instanceof Error ? err.message : String(err) } };
	}
}

export default function Integrations({ loaderData, actionData }: Route.ComponentProps) {
	const { stats, ingestUrl, tokenConfigured, aiConfigured } = loaderData;
	const nav = useNavigation();
	const testing =
		nav.state !== "idle" && nav.formData?.get("intent") === "test";
	const test = actionData?.test;

	return (
		<div className="mx-auto max-w-5xl p-1">
			<div className="mb-6">
				<h1 className="text-xl font-semibold tracking-tight text-foreground">
					Integrations
				</h1>
				<p className="text-sm text-muted-foreground">
					The Slack, Telegram and Discord bots run in their own repos and send
					every message and file to this backend, which does the AI routing,
					PDF→JSON and audit logging.
				</p>
			</div>

			{/* Ingest endpoint */}
			<section className="mb-6 rounded-xl border border-border bg-surface p-4">
				<div className="mb-3 flex items-center justify-between gap-3">
					<h2 className="text-sm font-medium text-foreground">Ingest endpoint</h2>
					<div className="flex items-center gap-3 text-xs">
						<StatusDot
							ok={tokenConfigured}
							label={tokenConfigured ? "Token set" : "BOT_INGEST_TOKEN missing"}
						/>
						<StatusDot
							ok={aiConfigured}
							label={aiConfigured ? "AI ready" : "AI binding missing"}
						/>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<code className="min-w-0 flex-1 truncate rounded-lg bg-tint px-3 py-2 font-mono text-xs text-foreground">
						POST {ingestUrl || "<APP_URL>/api/bots/ingest"}
					</code>
					<CopyButton value={ingestUrl} />
				</div>
				<p className="mt-2 text-xs text-muted-foreground">
					Bots authenticate with{" "}
					<code className="font-mono">Authorization: Bearer $BOT_INGEST_TOKEN</code>.
					Point each repo's <code className="font-mono">GRAYOFFICE_URL</code> at
					this host and use the same token.
				</p>
			</section>

			{/* Per-platform cards */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{CATALOG.map((c) => {
					const s = stats[c.source];
					const connected = (s?.count ?? 0) > 0;
					const Icon = c.icon;
					return (
						<div
							key={c.source}
							className="flex flex-col rounded-xl border border-border bg-surface p-4"
						>
							<div className="mb-2 flex items-center justify-between">
								<span className={`grid size-9 place-items-center rounded-lg ${c.tint}`}>
									<Icon weight="fill" className="size-5" />
								</span>
								<span
									className={`rounded-md px-2 py-0.5 text-xs font-medium ${
										connected
											? "bg-emerald-100 text-emerald-700"
											: "bg-neutral-100 text-neutral-600"
									}`}
								>
									{connected ? "Connected" : "Not connected"}
								</span>
							</div>
							<h3 className="text-sm font-semibold text-foreground">{c.name}</h3>
							<p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">
								{c.blurb}
							</p>

							<dl className="mt-3 grid grid-cols-3 gap-2 text-center">
								<Metric label="Events" value={s?.count ?? 0} />
								<Metric label="Errors" value={s?.errors ?? 0} />
								<Metric
									label="Last seen"
									value={
										s?.last_at
											? new Date(s.last_at * 1000).toLocaleDateString(undefined, {
													month: "short",
													day: "numeric",
												})
											: "-"
									}
								/>
							</dl>

							<div className="mt-3 flex flex-wrap gap-1.5">
								{c.env.map((e) => (
									<code
										key={e}
										className="rounded bg-tint px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
									>
										{e}
									</code>
								))}
							</div>

							<div className="mt-3 flex items-center gap-3 text-xs">
								<a
									href={c.repo}
									target="_blank"
									rel="noreferrer"
									className="font-medium text-brand hover:underline"
								>
									Repo ↗
								</a>
								<Link
									to={`/dashboard/audit?source=${c.source}`}
									className="text-muted-foreground hover:text-foreground"
								>
									Activity
								</Link>
							</div>
						</div>
					);
				})}
			</div>

			{/* Pipeline test */}
			<section className="mt-6 rounded-xl border border-border bg-surface p-4">
				<h2 className="text-sm font-medium text-foreground">Test the pipeline</h2>
				<p className="mt-1 text-xs text-muted-foreground">
					POSTs to <code className="font-mono">/api/bots/ingest</code> exactly
					like the bots do (AI routing included) and logs it to the Audit room.
				</p>

				<Form method="post" className="mt-3 space-y-3">
					<input type="hidden" name="intent" value="test" />
					<div className="flex flex-wrap gap-1.5">
						{CATALOG.map((c, i) => {
							const Icon = c.icon;
							return (
								<label
									key={c.source}
									className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-foreground has-checked:border-brand has-checked:bg-brand-tint has-checked:text-brand"
								>
									<input
										type="radio"
										name="source"
										value={c.source}
										defaultChecked={i === 0}
										className="sr-only"
									/>
									<Icon weight="fill" className="size-3.5" />
									{c.name}
								</label>
							);
						})}
					</div>
					<textarea
						name="text"
						rows={3}
						required
						placeholder="e.g. What's the GST rate for a sale from Karnataka to Maharashtra?"
						className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring"
					/>
					<Button type="submit" disabled={testing}>
						{testing ? "Running…" : "Send test message"}
					</Button>
				</Form>

				{test?.error && (
					<p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
						{test.error}
					</p>
				)}
				{test?.result && (
					<div className="mt-3 rounded-lg bg-tint p-3 text-xs">
						<div className="mb-1 flex gap-3 text-muted-foreground">
							<span>
								route: <b className="text-foreground">{test.result.route}</b>
							</span>
							<span>
								status: <b className="text-foreground">{test.result.status}</b>
							</span>
						</div>
						<pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-foreground">
							{typeof test.result.detail === "object" &&
							test.result.detail &&
							"reply" in test.result.detail
								? String((test.result.detail as { reply: string }).reply)
								: JSON.stringify(test.result.detail, null, 2)}
						</pre>
					</div>
				)}
			</section>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg bg-tint py-1.5">
			<div className="text-sm font-semibold text-foreground">{value}</div>
			<div className="text-[10px] uppercase tracking-wide text-muted-foreground">
				{label}
			</div>
		</div>
	);
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
	return (
		<span className="flex items-center gap-1.5 text-muted-foreground">
			{ok ? (
				<CheckCircle weight="fill" className="size-3.5 text-emerald-500" />
			) : (
				<Circle className="size-3.5 text-neutral-400" />
			)}
			{label}
		</span>
	);
}

function CopyButton({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			disabled={!value}
			onClick={() => {
				navigator.clipboard?.writeText(value).then(() => {
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				});
			}}
			aria-label="Copy endpoint URL"
			className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
		>
			{copied ? (
				<CheckCircle weight="fill" className="size-4 text-emerald-500" />
			) : (
				<Copy className="size-4" />
			)}
		</button>
	);
}
