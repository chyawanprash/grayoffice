import { Form, useNavigation } from "react-router";
import { CheckCircle, Copy, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/dashboard.settings";
import {
	disableTotp,
	enableTotp,
	findUserById,
	requireUserId,
	setTotpSecret,
} from "~/lib/auth.server";
import { countRecoveryCodes, regenerateRecoveryCodes } from "~/lib/mfa.server";
import { newTotpSecret, totpQrSvg, totpUri, verifyTotp } from "~/lib/totp.server";

export function meta() {
	return [{ title: "Settings — Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const user = await findUserById(DB, userId);
	if (!user) throw new Response("Not found", { status: 404 });

	// Enrollment in progress: secret stored but not yet enabled.
	const enrolling = !user.totp_enabled && Boolean(user.totp_secret);
	return {
		email: user.email,
		hasPassword: Boolean(user.password_hash),
		googleLinked: Boolean(user.google_id),
		totpEnabled: Boolean(user.totp_enabled),
		recoveryCount: await countRecoveryCodes(DB, userId),
		enroll:
			enrolling && user.totp_secret
				? {
						secret: user.totp_secret,
						uri: totpUri(user.totp_secret, user.email),
						qr: await totpQrSvg(user.totp_secret, user.email),
					}
				: null,
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const user = await findUserById(DB, userId);
	if (!user) throw new Response("Not found", { status: 404 });

	const form = await request.formData();
	const intent = String(form.get("intent") ?? "");

	if (intent === "mfa-start") {
		await setTotpSecret(DB, userId, newTotpSecret());
		return { ok: "started" as const };
	}

	if (intent === "mfa-cancel") {
		await disableTotp(DB, userId);
		return { ok: "cancelled" as const };
	}

	if (intent === "mfa-confirm") {
		if (!user.totp_secret) return { error: "Start enrollment first." };
		const code = String(form.get("code") ?? "").trim();
		if (!verifyTotp(user.totp_secret, code, user.email))
			return { error: "That code didn’t match. Try the current one." };
		await enableTotp(DB, userId);
		const codes = await regenerateRecoveryCodes(DB, userId);
		return { ok: "enabled" as const, recoveryCodes: codes };
	}

	if (intent === "mfa-disable") {
		const code = String(form.get("code") ?? "").trim();
		if (!user.totp_secret || !verifyTotp(user.totp_secret, code, user.email))
			return { error: "Enter a valid authenticator code to turn off 2FA." };
		await disableTotp(DB, userId);
		return { ok: "disabled" as const };
	}

	if (intent === "mfa-recovery-regen") {
		if (!user.totp_enabled) return { error: "Two-factor auth isn’t on." };
		const codes = await regenerateRecoveryCodes(DB, userId);
		return { ok: "regenerated" as const, recoveryCodes: codes };
	}

	return { error: "Unknown request." };
}

function RecoveryCodes({ codes }: { codes: string[] }) {
	return (
		<div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
			<div className="flex items-center gap-2 text-sm font-medium text-amber-900">
				<WarningCircle size={16} weight="fill" /> Save these recovery codes now
			</div>
			<p className="mt-1 text-xs text-amber-800">
				Each code works once if you lose your authenticator. They won’t be shown
				again.
			</p>
			<div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm text-neutral-800">
				{codes.map((c) => (
					<span key={c} className="rounded bg-surface px-2 py-1">
						{c}
					</span>
				))}
			</div>
		</div>
	);
}

export default function Settings({ actionData, loaderData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";
	const err = actionData && "error" in actionData ? actionData.error : null;
	const freshCodes =
		actionData && "recoveryCodes" in actionData ? actionData.recoveryCodes : null;

	return (
		<div className="mx-auto max-w-2xl">
			<h1 className="text-xl font-semibold tracking-tight text-neutral-900">
				Settings
			</h1>
			<p className="mt-1 text-sm text-neutral-500">
				Signed in as {loaderData.email}
				{loaderData.googleLinked && " · Google linked"}
			</p>

			<section className="mt-8 rounded-xl border border-neutral-200 bg-surface p-6">
				<div className="flex items-start gap-3">
					<div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
						<ShieldCheck size={18} weight="duotone" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h2 className="font-medium text-neutral-900">
								Two-factor authentication
							</h2>
							{loaderData.totpEnabled && (
								<span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
									<CheckCircle size={12} weight="fill" /> On
								</span>
							)}
						</div>
						<p className="mt-1 text-sm text-neutral-500">
							Require an authenticator code (or an emailed code) at sign in.
						</p>

						{err && (
							<p className="mt-3 text-sm text-danger">{err}</p>
						)}

						{/* --- Not enrolled --- */}
						{!loaderData.totpEnabled && !loaderData.enroll && (
							<Form method="post" className="mt-4">
								<input type="hidden" name="intent" value="mfa-start" />
								<Button type="submit" disabled={busy} size="sm">
									Set up two-factor auth
								</Button>
							</Form>
						)}

						{/* --- Enrolling: show QR + confirm --- */}
						{!loaderData.totpEnabled && loaderData.enroll && (
							<div className="mt-4">
								<p className="text-sm text-neutral-600">
									1. Scan this with Google Authenticator, 1Password, or any TOTP
									app.
								</p>
								<div
									className="mt-3 inline-block rounded-lg border border-neutral-200 bg-white p-2"
									dangerouslySetInnerHTML={{ __html: loaderData.enroll.qr }}
								/>
								<p className="mt-2 break-all text-xs text-neutral-400">
									Or enter this key manually:{" "}
									<span className="font-mono text-neutral-600">
										{loaderData.enroll.secret}
									</span>
								</p>
								<p className="mt-4 text-sm text-neutral-600">
									2. Enter the 6-digit code it shows:
								</p>
								<Form method="post" className="mt-2 flex flex-wrap items-center gap-2">
									<input type="hidden" name="intent" value="mfa-confirm" />
									<input
										name="code"
										inputMode="numeric"
										autoComplete="one-time-code"
										placeholder="123456"
										className="h-9 w-32 rounded-lg border border-neutral-300 bg-surface px-3 text-center tracking-[0.3em] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
									/>
									<Button type="submit" disabled={busy} size="sm">
										Turn on
									</Button>
									<button
										type="submit"
										name="intent"
										value="mfa-cancel"
										formNoValidate
										className="text-sm text-neutral-500 hover:text-neutral-900"
									>
										Cancel
									</button>
								</Form>
							</div>
						)}

						{freshCodes && <RecoveryCodes codes={freshCodes} />}

						{/* --- Enabled --- */}
						{loaderData.totpEnabled && (
							<div className="mt-4 space-y-4">
								<p className="text-sm text-neutral-500">
									{loaderData.recoveryCount} recovery code
									{loaderData.recoveryCount === 1 ? "" : "s"} remaining.
								</p>
								<div className="flex flex-wrap gap-2">
									<Form method="post">
										<input
											type="hidden"
											name="intent"
											value="mfa-recovery-regen"
										/>
										<Button type="submit" variant="outline" size="sm" disabled={busy}>
											<Copy size={14} /> Regenerate recovery codes
										</Button>
									</Form>
								</div>
								<Form method="post" className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-4">
									<input type="hidden" name="intent" value="mfa-disable" />
									<input
										name="code"
										inputMode="numeric"
										placeholder="Code to disable"
										className="h-9 w-40 rounded-lg border border-neutral-300 bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
									/>
									<Button
										type="submit"
										variant="outline"
										size="sm"
										disabled={busy}
										className="text-danger"
									>
										Turn off 2FA
									</Button>
								</Form>
							</div>
						)}
					</div>
				</div>
			</section>
		</div>
	);
}
