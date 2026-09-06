import { useEffect, useRef } from "react";
import { Form, useNavigation } from "react-router";
import { CheckCircle, Copy, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/dashboard.settings";
import {
	deleteUser,
	disableTotp,
	enableTotp,
	findUserById,
	logout,
	requireUserId,
	setPassword,
	setTotpSecret,
	verifyPassword,
} from "~/lib/auth.server";
import { countRecoveryCodes, regenerateRecoveryCodes } from "~/lib/mfa.server";
import { forget } from "~/lib/pinecone.server";
import { newTotpSecret, totpQrSvg, totpUri, verifyTotp } from "~/lib/totp.server";

export function meta() {
	return [{ title: "Settings — Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const user = await findUserById(DB, userId);
	if (!user) throw new Response("Not found", { status: 404 });
	const meta = await DB.prepare(
		"SELECT created_at FROM users WHERE id = ?",
	)
		.bind(userId)
		.first<{ created_at: number }>();

	// Enrollment in progress: secret stored but not yet enabled.
	const enrolling = !user.totp_enabled && Boolean(user.totp_secret);
	return {
		email: user.email,
		name: user.name,
		hasPassword: Boolean(user.password_hash),
		googleLinked: Boolean(user.google_id),
		totpEnabled: Boolean(user.totp_enabled),
		createdAt: meta?.created_at ?? null,
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

	if (intent === "change-password") {
		if (user.password_hash) {
			const current = String(form.get("current") ?? "");
			if (!(await verifyPassword(current, user.password_hash)))
				return { pwError: "Current password is wrong." };
		}
		const next = String(form.get("next") ?? "");
		if (next.length < 8)
			return { pwError: "New password must be at least 8 characters." };
		if (next !== String(form.get("confirm") ?? ""))
			return { pwError: "The two passwords don’t match." };
		await setPassword(DB, userId, next);
		return { ok: "password" as const };
	}

	if (intent === "delete-account") {
		const phrase = String(form.get("phrase") ?? "").trim().toLowerCase();
		if (phrase !== "delete my account")
			return { deleteError: "Type “delete my account” to confirm." };
		if (user.password_hash) {
			const password = String(form.get("password") ?? "");
			if (!(await verifyPassword(password, user.password_hash)))
				return { deleteError: "Wrong password." };
		}
		await deleteUser(DB, userId);
		context.cloudflare.ctx.waitUntil(forget(context.cloudflare.env, userId));
		throw await logout(request, SESSION_SECRET);
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
	const pwError =
		(actionData && "pwError" in actionData ? actionData.pwError : null) ?? null;
	const deleteError =
		(actionData && "deleteError" in actionData
			? actionData.deleteError
			: null) ?? null;
	const passwordSaved = Boolean(
		actionData && "ok" in actionData && actionData.ok === "password",
	);
	const freshCodes =
		actionData && "recoveryCodes" in actionData ? actionData.recoveryCodes : null;

	return (
		<div className="mx-auto max-w-2xl">
			<h1 className="text-xl font-semibold tracking-tight text-neutral-900">
				Settings
			</h1>
			<p className="mt-1 text-sm text-neutral-500">Your account and security</p>

			<section className="mt-8 rounded-xl border border-neutral-200 bg-surface p-6">
				<h2 className="font-medium text-neutral-900">Account information</h2>
				<dl className="mt-4 divide-y divide-neutral-100 text-sm">
					{loaderData.name && (
						<div className="flex justify-between py-2.5">
							<dt className="text-neutral-500">Name</dt>
							<dd className="text-neutral-900">{loaderData.name}</dd>
						</div>
					)}
					<div className="flex justify-between py-2.5">
						<dt className="text-neutral-500">Email</dt>
						<dd className="text-neutral-900">{loaderData.email}</dd>
					</div>
					<div className="flex justify-between py-2.5">
						<dt className="text-neutral-500">Sign-in methods</dt>
						<dd className="text-neutral-900">
							{[
								loaderData.hasPassword && "Password",
								loaderData.googleLinked && "Google",
							]
								.filter(Boolean)
								.join(" · ") || "—"}
						</dd>
					</div>
					<div className="flex justify-between py-2.5">
						<dt className="text-neutral-500">Two-factor auth</dt>
						<dd className={loaderData.totpEnabled ? "text-green-700" : "text-neutral-900"}>
							{loaderData.totpEnabled ? "On" : "Off"}
						</dd>
					</div>
					{loaderData.createdAt && (
						<div className="flex justify-between py-2.5">
							<dt className="text-neutral-500">Member since</dt>
							<dd className="text-neutral-900">
								{new Date(loaderData.createdAt * 1000).toLocaleDateString(undefined, {
									year: "numeric",
									month: "long",
									day: "numeric",
								})}
							</dd>
						</div>
					)}
				</dl>
				<div className="mt-4 border-t border-neutral-200 pt-4">
					<ChangePasswordDialog
						hasPassword={loaderData.hasPassword}
						error={pwError}
						saved={passwordSaved}
						busy={busy}
					/>
				</div>
			</section>

			<section className="mt-6 rounded-xl border border-neutral-200 bg-surface p-6">
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

			<section className="mt-6 rounded-xl border border-danger/30 bg-surface p-6">
				<h2 className="font-medium text-danger">Delete account</h2>
				<p className="mt-1 text-sm text-neutral-500">
					Permanently removes your account, sign-in methods, recovery codes, and
					saved assistant memory. This can’t be undone.
				</p>
				<DeleteAccountDialog
					hasPassword={loaderData.hasPassword}
					error={deleteError}
					busy={busy}
				/>
			</section>
		</div>
	);
}

const fieldClass =
	"h-9 rounded-lg border border-neutral-300 bg-surface px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function ChangePasswordDialog({
	hasPassword,
	error,
	saved,
	busy,
}: {
	hasPassword: boolean;
	error: string | null;
	saved: boolean;
	busy: boolean;
}) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		if (error) ref.current?.showModal();
		if (saved) ref.current?.close();
	}, [error, saved]);

	return (
		<>
			<div className="flex items-center gap-3">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => ref.current?.showModal()}
				>
					{hasPassword ? "Change password" : "Set a password"}
				</Button>
				{saved && <span className="text-sm text-green-700">Password updated.</span>}
			</div>

			<dialog
				ref={ref}
				className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-surface p-6 backdrop:bg-black/40"
			>
				<h3 className="font-medium text-neutral-900">
					{hasPassword ? "Change password" : "Set a password"}
				</h3>
				<p className="mt-1 text-sm text-neutral-500">
					{hasPassword
						? "You’ll stay signed in on this device."
						: "Add a password so you can sign in without Google."}
				</p>
				{error && <p className="mt-3 text-sm text-danger">{error}</p>}
				<Form method="post" className="mt-4 grid gap-2">
					<input type="hidden" name="intent" value="change-password" />
					{hasPassword && (
						<input
							name="current"
							type="password"
							autoComplete="current-password"
							placeholder="Current password"
							className={fieldClass}
						/>
					)}
					<input
						name="next"
						type="password"
						autoComplete="new-password"
						placeholder="New password (min 8 characters)"
						className={fieldClass}
					/>
					<input
						name="confirm"
						type="password"
						autoComplete="new-password"
						placeholder="Confirm new password"
						className={fieldClass}
					/>
					<div className="mt-2 flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => ref.current?.close()}
						>
							Cancel
						</Button>
						<Button type="submit" size="sm" disabled={busy}>
							{hasPassword ? "Update password" : "Set password"}
						</Button>
					</div>
				</Form>
			</dialog>
		</>
	);
}

function DeleteAccountDialog({
	hasPassword,
	error,
	busy,
}: {
	hasPassword: boolean;
	error: string | null;
	busy: boolean;
}) {
	const ref = useRef<HTMLDialogElement>(null);

	// Re-open the dialog after a failed attempt so the error is visible.
	useEffect(() => {
		if (error) ref.current?.showModal();
	}, [error]);

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="mt-4 text-danger"
				onClick={() => ref.current?.showModal()}
			>
				Delete account
			</Button>

			<dialog
				ref={ref}
				className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-surface p-6 backdrop:bg-black/40"
			>
				<h3 className="font-medium text-neutral-900">Delete your account?</h3>
				<p className="mt-1 text-sm text-neutral-500">
					This is permanent. Type <b>delete my account</b> below
					{hasPassword && " and enter your password"} to confirm.
				</p>
				{error && <p className="mt-3 text-sm text-danger">{error}</p>}
				<Form method="post" className="mt-4 grid gap-2">
					<input type="hidden" name="intent" value="delete-account" />
					<input
						name="phrase"
						autoComplete="off"
						placeholder="delete my account"
						className="h-9 rounded-lg border border-neutral-300 bg-surface px-3 text-sm outline-none focus:border-danger focus:ring-2 focus:ring-danger/20"
					/>
					{hasPassword && (
						<input
							name="password"
							type="password"
							autoComplete="current-password"
							placeholder="Current password"
							className="h-9 rounded-lg border border-neutral-300 bg-surface px-3 text-sm outline-none focus:border-danger focus:ring-2 focus:ring-danger/20"
						/>
					)}
					<div className="mt-2 flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => ref.current?.close()}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							variant="danger"
							size="sm"
							disabled={busy}
						>
							Delete account
						</Button>
					</div>
				</Form>
			</dialog>
		</>
	);
}
