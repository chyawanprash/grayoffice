import { useEffect, useRef } from "react";
import { Form, useNavigation } from "react-router";
import {
	CheckCircle2,
	Copy,
	Download,
	ShieldCheck,
	TriangleAlert,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/dashboard.settings";
import {
	deleteUser,
	disableTotp,
	enableTotp,
	findUserById,
	logout,
	requireUserId,
	setName,
	setPassword,
	setTotpSecret,
	verifyPassword,
} from "~/lib/auth.server";
import { countRecoveryCodes, regenerateRecoveryCodes } from "~/lib/mfa.server";
import { requireOrg, setDummyData } from "~/lib/org.server";
import { forget } from "~/lib/pinecone.server";
import { newTotpSecret, totpQrSvg, totpUri, verifyTotp } from "~/lib/totp.server";

export function meta() {
	return [{ title: "Settings | Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const user = await findUserById(DB, userId);
	if (!user) throw new Response("Not found", { status: 404 });
	const { org, role } = await requireOrg(request, context.cloudflare.env);
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
		orgName: org.name,
		canManageOrg: role !== "member",
		dummyData: Boolean(org.dummy_data),
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

	if (intent === "toggle-dummy") {
		const { orgId, role } = await requireOrg(request, context.cloudflare.env);
		if (role === "member") return { error: "Only an owner or admin can change this." };
		await setDummyData(DB, orgId, form.get("on") === "1");
		return { ok: "dummy" as const };
	}

	if (intent === "update-name") {
		const name = String(form.get("name") ?? "").trim();
		if (name.length > 80)
			return { nameError: "Name must be 80 characters or fewer." };
		await setName(DB, userId, name);
		return { ok: "name" as const };
	}

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

const cardClass = "dash-card p-4 text-card-foreground";
const cardTitleClass = "text-lg leading-6 font-medium text-foreground";
const fieldClass =
	"h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";

function RecoveryCodes({ codes }: { codes: string[] }) {
	return (
		<div className="mt-4 rounded-lg border border-[var(--dashboard-no-show)]/40 bg-[color-mix(in_oklch,var(--dashboard-no-show)_10%,transparent)] p-4">
			<div className="flex items-center gap-2 text-sm font-medium text-foreground">
				<TriangleAlert className="size-4 text-[var(--dashboard-no-show)]" /> Save
				these recovery codes now
			</div>
			<p className="mt-1 text-xs text-muted-foreground">
				Each code works once if you lose your authenticator. They won’t be shown
				again.
			</p>
			<div className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-sm text-foreground">
				{codes.map((c) => (
					<span key={c} className="rounded bg-background px-2 py-1">
						{c}
					</span>
				))}
			</div>
		</div>
	);
}

export default function Settings({ actionData, loaderData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.formData != null; // a form submit is in flight (not a plain link nav)
	const err = actionData && "error" in actionData ? actionData.error : null;
	const pwError =
		(actionData && "pwError" in actionData ? actionData.pwError : null) ?? null;
	const nameError =
		(actionData && "nameError" in actionData ? actionData.nameError : null) ?? null;
	const nameSaved = Boolean(
		actionData && "ok" in actionData && actionData.ok === "name",
	);
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
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl leading-[1.4] font-normal text-foreground">
					Settings
				</h1>
				<p className="text-sm text-muted-foreground">
					Your account and security
				</p>
			</div>

			<div className="grid gap-3 lg:max-w-3xl">
				<section className={cardClass}>
					<h2 className={cardTitleClass}>Profile</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Your name is shown in the sidebar and on activity you create.
					</p>
					<Form
						method="post"
						className="mt-4 flex flex-wrap items-end gap-2"
						key={loaderData.name ?? ""}
					>
						<input type="hidden" name="intent" value="update-name" />
						<label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
							Name
							<input
								name="name"
								defaultValue={loaderData.name ?? ""}
								maxLength={80}
								placeholder="Your name"
								className={`${fieldClass} w-64`}
							/>
						</label>
						<Button type="submit" size="sm" disabled={busy}>
							Save
						</Button>
						{nameSaved && (
							<span className="pb-2 text-sm text-[var(--dashboard-completed)]">
								Saved.
							</span>
						)}
						{nameError && (
							<span className="pb-2 text-sm text-destructive">{nameError}</span>
						)}
					</Form>
				</section>

				<section className={cardClass}>
					<h2 className={cardTitleClass}>Account information</h2>
					<dl className="mt-4 divide-y divide-border/60 text-sm">
						<div className="flex justify-between py-2.5">
							<dt className="text-muted-foreground">Email</dt>
							<dd className="text-foreground">{loaderData.email}</dd>
						</div>
						<div className="flex justify-between py-2.5">
							<dt className="text-muted-foreground">Sign-in methods</dt>
							<dd className="text-foreground">
								{[
									loaderData.hasPassword && "Password",
									loaderData.googleLinked && "Google",
								]
									.filter(Boolean)
									.join(" · ") || "-"}
							</dd>
						</div>
						<div className="flex justify-between py-2.5">
							<dt className="text-muted-foreground">Two-factor auth</dt>
							<dd
								className={
									loaderData.totpEnabled
										? "text-[var(--dashboard-completed)]"
										: "text-foreground"
								}
							>
								{loaderData.totpEnabled ? "On" : "Off"}
							</dd>
						</div>
						{loaderData.createdAt && (
							<div className="flex justify-between py-2.5">
								<dt className="text-muted-foreground">Member since</dt>
								<dd className="text-foreground">
									{new Date(loaderData.createdAt * 1000).toLocaleDateString(
										undefined,
										{ year: "numeric", month: "long", day: "numeric" },
									)}
								</dd>
							</div>
						)}
					</dl>
					<div className="mt-4 border-t border-border/60 pt-4">
						<ChangePasswordDialog
							hasPassword={loaderData.hasPassword}
							error={pwError}
							saved={passwordSaved}
							busy={busy}
						/>
					</div>

					<div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
						<div>
							<p className="text-sm font-medium text-foreground">
								Download your data
							</p>
							<p className="text-xs text-muted-foreground">
								A JSON copy of your profile, security settings and connected
								services. Secrets are never included.
							</p>
						</div>
						<Button
							type="button"
							variant="outline"
							size="sm"
							render={
								<a
									href="/settings/data"
									download="gray-office-account.json"
									rel="nofollow"
								/>
							}
						>
							<Download className="size-4" />
							Download
						</Button>
					</div>
				</section>

				<section className={cardClass}>
					<div className="flex items-start gap-3">
						<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
							<ShieldCheck className="size-4.5" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<h2 className={cardTitleClass}>Two-factor authentication</h2>
								{loaderData.totpEnabled && (
									<span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--dashboard-completed)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--dashboard-completed)]">
										<CheckCircle2 className="size-3" /> On
									</span>
								)}
							</div>
							<p className="mt-1 text-sm text-muted-foreground">
								Require an authenticator code (or an emailed code) at sign in.
							</p>

							{err && <p className="mt-3 text-sm text-destructive">{err}</p>}

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
									<p className="text-sm text-foreground/80">
										1. Scan this with Google Authenticator, 1Password, or any
										TOTP app.
									</p>
									<div
										className="mt-3 inline-block rounded-lg border border-border bg-white p-2"
										dangerouslySetInnerHTML={{ __html: loaderData.enroll.qr }}
									/>
									<p className="mt-2 break-all text-xs text-muted-foreground">
										Or enter this key manually:{" "}
										<span className="font-mono text-foreground/80">
											{loaderData.enroll.secret}
										</span>
									</p>
									<p className="mt-4 text-sm text-foreground/80">
										2. Enter the 6-digit code it shows:
									</p>
									<Form
										method="post"
										className="mt-2 flex flex-wrap items-center gap-2"
									>
										<input type="hidden" name="intent" value="mfa-confirm" />
										<input
											name="code"
											inputMode="numeric"
											autoComplete="one-time-code"
											placeholder="123456"
											className={`${fieldClass} w-32 text-center tracking-[0.3em]`}
										/>
										<Button type="submit" disabled={busy} size="sm">
											Turn on
										</Button>
										<button
											type="submit"
											name="intent"
											value="mfa-cancel"
											formNoValidate
											className="text-sm text-muted-foreground hover:text-foreground"
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
									<p className="text-sm text-muted-foreground">
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
											<Button
												type="submit"
												variant="outline"
												size="sm"
												disabled={busy}
											>
												<Copy className="size-3.5" /> Regenerate recovery codes
											</Button>
										</Form>
									</div>
									<Form
										method="post"
										className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4"
									>
										<input type="hidden" name="intent" value="mfa-disable" />
										<input
											name="code"
											inputMode="numeric"
											placeholder="Code to disable"
											className={`${fieldClass} w-40`}
										/>
										<Button
											type="submit"
											variant="outline"
											size="sm"
											disabled={busy}
											className="text-destructive"
										>
											Turn off 2FA
										</Button>
									</Form>
								</div>
							)}
						</div>
					</div>
				</section>

				<section className={`${cardClass} border border-destructive/30`}>
					<h2 className={`${cardTitleClass} text-destructive`}>Delete account</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Permanently removes your account, sign-in methods, recovery codes,
						and saved assistant memory. This can’t be undone.
					</p>
					<DeleteAccountDialog
						hasPassword={loaderData.hasPassword}
						error={deleteError}
						busy={busy}
					/>
				</section>
			</div>
		</div>
	);
}

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
				{saved && (
					<span className="text-sm text-[var(--dashboard-completed)]">
						Password updated.
					</span>
				)}
			</div>

			<dialog
				ref={ref}
				className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-6 text-card-foreground backdrop:bg-black/40"
			>
				<h3 className="font-medium text-foreground">
					{hasPassword ? "Change password" : "Set a password"}
				</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					{hasPassword
						? "You’ll stay signed in on this device."
						: "Add a password so you can sign in without Google."}
				</p>
				{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
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
				className="mt-4 text-destructive"
				onClick={() => ref.current?.showModal()}
			>
				Delete account
			</Button>

			<dialog
				ref={ref}
				className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-6 text-card-foreground backdrop:bg-black/40"
			>
				<h3 className="font-medium text-foreground">Delete your account?</h3>
				<p className="mt-1 text-sm text-muted-foreground">
					This is permanent. Type <b>delete my account</b> below
					{hasPassword && " and enter your password"} to confirm.
				</p>
				{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
				<Form method="post" className="mt-4 grid gap-2">
					<input type="hidden" name="intent" value="delete-account" />
					<input
						name="phrase"
						autoComplete="off"
						placeholder="delete my account"
						className={`${fieldClass} focus:border-destructive focus:ring-destructive/30`}
					/>
					{hasPassword && (
						<input
							name="password"
							type="password"
							autoComplete="current-password"
							placeholder="Current password"
							className={`${fieldClass} focus:border-destructive focus:ring-destructive/30`}
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
