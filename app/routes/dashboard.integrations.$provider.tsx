import { Form, Link, redirect, useNavigation } from "react-router";
import { ArrowLeft, CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { Route } from "./+types/dashboard.integrations.$provider";
import { requireOrg } from "~/lib/org.server";
import { Button } from "~/components/ui/button";
import {
	PROVIDER_APIS,
	PROVIDER_IDS,
	deleteIntegration,
	fetchResource,
	getIntegration,
	recentEvents,
	saveIntegration,
	type Provider,
	type Record_,
} from "~/lib/payments.server";

const isProvider = (v: string): v is Provider =>
	PROVIDER_IDS.includes(v as Provider);

export function meta({ data }: Route.MetaArgs) {
	return [{ title: `${data?.meta.name ?? "Payments"} | Gray Office` }];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
	const { DB, APP_URL } = context.cloudflare.env;
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	if (!isProvider(params.provider))
		throw redirect("/dashboard/integrations/payments");

	const provider = params.provider;
	const meta = PROVIDER_APIS[provider];
	const integration = await getIntegration(DB, orgId, provider);
	const connected = Boolean(integration?.api_key);
	const selected = new Set(integration?.resources ?? []);

	const data: Array<{
		key: string;
		label: string;
		result: { records: Record_[] } | { error: string };
	}> = [];
	if (connected && integration) {
		await Promise.all(
			meta.resources
				.filter((r) => selected.has(r.key))
				.map(async (r) => {
					data.push({
						key: r.key,
						label: r.label,
						result: await fetchResource(integration, r.key),
					});
				}),
		);
	}
	const events = connected
		? await recentEvents(DB, orgId, provider)
		: [];

	const base = (APP_URL ?? new URL(request.url).origin).replace(/\/$/, "");
	return {
		meta: {
			id: meta.id,
			name: meta.name,
			blurb: meta.blurb,
			docs: meta.docs,
			webhookDocs: meta.webhookDocs,
			fields: meta.fields,
			webhookSecretLabel: meta.webhookSecretLabel,
			modes: meta.modes,
			resources: meta.resources.map((r) => ({ key: r.key, label: r.label })),
		},
		connected,
		mode: integration?.mode ?? "test",
		hasWebhookSecret: Boolean(integration?.webhook_secret),
		extra: integration?.extra ?? {},
		selected: [...selected],
		webhookUrl: `${base}/api/payments/webhook/${provider}/${orgId}`,
		data,
		events,
	};
}

export async function action({ request, context, params }: Route.ActionArgs) {
	const { DB } = context.cloudflare.env;
	const { orgId } = await requireOrg(request, context.cloudflare.env);
	if (!isProvider(params.provider))
		throw redirect("/dashboard/integrations/payments");
	const provider = params.provider;
	const form = await request.formData();
	const intent = String(form.get("intent") ?? "");

	if (intent === "disconnect") {
		await deleteIntegration(DB, orgId, provider);
		return { ok: "disconnected" as const };
	}

	if (intent === "save") {
		const meta = PROVIDER_APIS[provider];
		const extra: Record<string, string> = {};
		let apiKey: string | undefined;
		let apiSecret: string | undefined;
		for (const f of meta.fields) {
			const v = String(form.get(f.key) ?? "").trim();
			if (f.extra) {
				if (v) extra[f.key] = v;
			} else if (f.key === "api_key") apiKey = v || undefined;
			else if (f.key === "api_secret") apiSecret = v || undefined;
		}
		const existing = await getIntegration(DB, orgId, provider);
		if (!apiKey && !existing?.api_key)
			return { error: `${meta.fields[0].label} is required.` };

		const validKeys = new Set(meta.resources.map((r) => r.key));
		const resources = form
			.getAll("resource")
			.map(String)
			.filter((k) => validKeys.has(k));

		await saveIntegration(DB, orgId, provider, {
			mode: form.get("mode") === "live" ? "live" : "test",
			api_key: apiKey,
			api_secret: apiSecret,
			webhook_secret: String(form.get("webhook_secret") ?? "").trim() || undefined,
			extra,
			resources,
		});
		return { ok: "saved" as const };
	}

	return { error: "Unknown request." };
}

const fieldClass =
	"h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
const cardClass = "rounded-xl border border-border bg-card p-4 text-card-foreground";

function CopyField({ value }: { value: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<div className="flex items-center gap-2">
			<code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
				{value}
			</code>
			<Button
				type="button"
				variant="outline"
				size="icon-sm"
				aria-label="Copy"
				onClick={() => {
					navigator.clipboard?.writeText(value);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				}}
			>
				{copied ? (
					<CheckCircle2 className="size-4 text-[var(--dashboard-completed)]" />
				) : (
					<Copy className="size-4" />
				)}
			</Button>
		</div>
	);
}

export default function ProviderPage({ loaderData, actionData }: Route.ComponentProps) {
	const {
		meta,
		connected,
		mode,
		hasWebhookSecret,
		extra,
		selected,
		webhookUrl,
		data,
		events,
	} = loaderData;
	const nav = useNavigation();
	const busy = nav.formData != null; // a form submit is in flight (not a plain link nav)
	const err = actionData && "error" in actionData ? actionData.error : null;
	const saved = actionData && "ok" in actionData && actionData.ok === "saved";
	const sel = new Set(selected);

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-col gap-2">
				<Link
					to="/dashboard/integrations/payments"
					className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
				>
					<ArrowLeft className="size-4" /> Payment gateways
				</Link>
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="text-2xl leading-[1.4] font-normal text-foreground">
						{meta.name}
					</h1>
					{connected && (
						<span className="rounded-md bg-[color-mix(in_oklch,var(--dashboard-completed)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--dashboard-completed)]">
							Connected · {mode}
						</span>
					)}
				</div>
				<p className="max-w-2xl text-sm text-muted-foreground">{meta.blurb}</p>
				<div className="flex gap-4 text-xs">
					<a
						href={meta.docs}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
					>
						API docs <ExternalLink className="size-3" />
					</a>
					<a
						href={meta.webhookDocs}
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-1 font-medium text-brand hover:underline"
					>
						Webhook docs <ExternalLink className="size-3" />
					</a>
				</div>
			</div>

			<Form method="post" className="grid gap-3 lg:grid-cols-2">
				<input type="hidden" name="intent" value="save" />

				{/* Connection */}
				<section className={cardClass}>
					<h2 className="text-sm font-medium text-foreground">Connection</h2>
					{err && <p className="mt-2 text-sm text-destructive">{err}</p>}
					{saved && (
						<p className="mt-2 text-sm text-[var(--dashboard-completed)]">Saved.</p>
					)}
					<div className="mt-3 space-y-3">
						<div className="flex gap-1.5">
							{meta.modes.map((m) => (
								<label
									key={m}
									className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs capitalize text-foreground has-checked:border-brand has-checked:bg-brand-tint has-checked:text-brand"
								>
									<input
										type="radio"
										name="mode"
										value={m}
										defaultChecked={m === mode}
										className="sr-only"
									/>
									{m}
								</label>
							))}
						</div>
						{meta.fields.map((f) => (
							<label
								key={f.key}
								className="block text-xs font-medium text-muted-foreground"
							>
								{f.label}
								<input
									name={f.key}
									type={f.extra ? "text" : "password"}
									autoComplete="off"
									placeholder={
										connected && !f.extra
											? "•••••••• (leave blank to keep)"
											: f.placeholder
									}
									defaultValue={f.extra ? (extra[f.key] ?? "") : ""}
									className={`mt-1 ${fieldClass}`}
								/>
							</label>
						))}
						<label className="block text-xs font-medium text-muted-foreground">
							{meta.webhookSecretLabel}
							<input
								name="webhook_secret"
								type="password"
								autoComplete="off"
								placeholder={
									hasWebhookSecret
										? "•••••••• (leave blank to keep)"
										: "optional"
								}
								className={`mt-1 ${fieldClass}`}
							/>
						</label>
					</div>
				</section>

				{/* Resources to pull */}
				<section className={cardClass}>
					<h2 className="text-sm font-medium text-foreground">Data to pull</h2>
					<p className="mt-1 text-xs text-muted-foreground">
						Choose which {meta.name} resources Gray Office fetches. Everything
						below is a read-only list endpoint.
					</p>
					<div className="mt-3 grid gap-1.5 sm:grid-cols-2">
						{meta.resources.map((r) => (
							<label
								key={r.key}
								className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground has-checked:border-brand has-checked:bg-brand-tint"
							>
								<input
									type="checkbox"
									name="resource"
									value={r.key}
									defaultChecked={sel.has(r.key)}
									className="size-3.5 accent-brand"
								/>
								{r.label}
							</label>
						))}
					</div>
				</section>

				<div className="flex items-center gap-2 lg:col-span-2">
					<Button type="submit" size="sm" disabled={busy}>
						{connected ? "Save changes" : "Connect"}
					</Button>
					{connected && (
						<Button
							type="submit"
							name="intent"
							value="disconnect"
							variant="outline"
							size="sm"
							disabled={busy}
							className="text-destructive"
							formNoValidate
						>
							Disconnect
						</Button>
					)}
				</div>
			</Form>

			{/* Webhook */}
			<section className={cardClass}>
				<h2 className="text-sm font-medium text-foreground">Webhook endpoint</h2>
				<p className="mt-1 text-xs text-muted-foreground">
					Add this URL in {meta.name} and paste its {meta.webhookSecretLabel}{" "}
					above. Verified events show up here.
				</p>
				<div className="mt-3">
					<CopyField value={webhookUrl} />
				</div>
				{events.length > 0 && (
					<ul className="mt-3 divide-y divide-border/60 text-xs">
						{events.map((e) => (
							<li
								key={e.id}
								className="flex items-center justify-between gap-3 py-2"
							>
								<span className="truncate text-foreground">
									{e.summary ?? e.type}
								</span>
								<span className="shrink-0 text-muted-foreground">
									{new Date(e.created_at * 1000).toLocaleString()}
								</span>
							</li>
						))}
					</ul>
				)}
			</section>

			{/* Pulled data */}
			{!connected ? (
				<section className={cardClass}>
					<p className="text-sm text-muted-foreground">
						Connect {meta.name} and pick some resources to see data here.
					</p>
				</section>
			) : data.length === 0 ? (
				<section className={cardClass}>
					<p className="text-sm text-muted-foreground">
						No resources selected. Tick some above and save.
					</p>
				</section>
			) : (
				data.map((d) => (
					<section key={d.key} className={cardClass}>
						<h2 className="text-sm font-medium text-foreground">{d.label}</h2>
						{"error" in d.result ? (
							<p className="mt-2 text-sm text-destructive">{d.result.error}</p>
						) : d.result.records.length === 0 ? (
							<p className="mt-2 text-sm text-muted-foreground">Nothing yet.</p>
						) : (
							<div className="mt-3 overflow-x-auto">
								<table className="w-full min-w-[36rem] text-left text-sm">
									<thead className="text-xs font-medium text-muted-foreground">
										<tr className="h-9">
											<th className="pr-4">ID</th>
											<th className="pr-4">Detail</th>
											<th className="pr-4">Status</th>
											<th className="pr-4">Date</th>
										</tr>
									</thead>
									<tbody>
										{d.result.records.map((r) => (
											<tr
												key={r.id || r.detail}
												className="h-10 border-t border-border/60 text-foreground/90"
											>
												<td className="pr-4 font-mono text-xs">{r.id || "—"}</td>
												<td className="max-w-[16rem] truncate pr-4">
													{r.detail}
												</td>
												<td className="pr-4">
													{r.status ? (
														<span className="rounded-md bg-muted px-2 py-0.5 text-xs capitalize">
															{r.status}
														</span>
													) : (
														"—"
													)}
												</td>
												<td className="pr-4 whitespace-nowrap text-muted-foreground">
													{r.when
														? new Date(r.when * 1000).toLocaleDateString()
														: "—"}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</section>
				))
			)}
		</div>
	);
}
