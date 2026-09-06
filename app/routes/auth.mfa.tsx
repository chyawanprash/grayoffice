import { useState } from "react";
import { Form, redirect, useNavigation } from "react-router";
import { AuthShell } from "~/components/auth-shell";
import { OtpField } from "~/components/otp-field";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/auth.mfa";
import {
	completeMfaSession,
	findUserById,
	getPendingMfa,
} from "~/lib/auth.server";
import {
	countRecoveryCodes,
	createEmailOtp,
	peekDevOtp,
	useRecoveryCode,
	verifyEmailOtp,
} from "~/lib/mfa.server";
import { sendOtpEmail } from "~/lib/email.server";
import { verifyTotp } from "~/lib/totp.server";

export function meta() {
	return [{ title: "Two-factor verification — Gray Office" }];
}

function maskEmail(email: string): string {
	const [name, domain] = email.split("@");
	const head = name.length <= 2 ? name[0] : name.slice(0, 2);
	return `${head}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const pending = await getPendingMfa(request, SESSION_SECRET);
	if (!pending) throw redirect("/sign-in");
	const user = await findUserById(DB, pending.userId);
	if (!user || !user.totp_enabled) throw redirect("/sign-in");
	return {
		email: maskEmail(user.email),
		recoveryCount: await countRecoveryCodes(DB, user.id),
		devCode: peekDevOtp(user.id, "mfa"),
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { DB, SESSION_SECRET } = env;
	const pending = await getPendingMfa(request, SESSION_SECRET);
	if (!pending) throw redirect("/sign-in");
	const user = await findUserById(DB, pending.userId);
	if (!user || !user.totp_secret) throw redirect("/sign-in");

	const form = await request.formData();
	const intent = String(form.get("intent") ?? "");

	if (intent === "email-send") {
		const code = await createEmailOtp(DB, user.id, "mfa");
		try {
			await sendOtpEmail(env, user.email, code, "mfa");
		} catch (err) {
			console.error("[mfa] email send failed", err);
			return {
				error:
					"We couldn’t send the email right now. Use your authenticator app, or try again.",
			};
		}
		return { sent: true };
	}

	const code = String(form.get("code") ?? "").trim();
	if (!code) return { error: "Enter a code." };

	if (intent === "totp") {
		if (!verifyTotp(user.totp_secret, code, user.email))
			return { error: "That code isn’t valid. Check your authenticator app." };
	} else if (intent === "email") {
		const res = await verifyEmailOtp(DB, user.id, "mfa", code);
		if (res !== "ok")
			return {
				error:
					res === "expired"
						? "That code expired. Send a new one."
						: res === "too_many_attempts"
							? "Too many attempts. Send a new code."
							: "That code isn’t valid.",
			};
	} else if (intent === "recovery") {
		if (!(await useRecoveryCode(DB, user.id, code)))
			return { error: "That recovery code isn’t valid or was already used." };
	} else {
		return { error: "Unknown request." };
	}

	return completeMfaSession(request, SESSION_SECRET, user.id, pending.redirectTo);
}

type Mode = "totp" | "email" | "recovery";

export default function MfaChallenge({ actionData, loaderData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";
	const [mode, setMode] = useState<Mode>("totp");

	const titles: Record<Mode, string> = {
		totp: "Enter your authenticator code",
		email: "Enter the code we emailed you",
		recovery: "Enter a recovery code",
	};

	return (
		<AuthShell back={{ to: "/sign-in", label: "Back to sign in" }}>
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
					{titles[mode]}
				</h1>
				<p className="mt-2 text-sm text-neutral-500">
					{mode === "totp" && "Open your authenticator app and enter the 6-digit code for Gray Office."}
					{mode === "email" && `We can send a one-time code to ${loaderData.email}.`}
					{mode === "recovery" && "Use one of the recovery codes you saved when setting up two-factor auth."}
				</p>

				{mode === "email" && loaderData.devCode && (
					<p className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
						Dev mode — your code is <span className="font-semibold tracking-wide">{loaderData.devCode}</span>
					</p>
				)}

				<Form method="post" className="mt-6 space-y-4" key={mode}>
					<input type="hidden" name="intent" value={mode} />
					{mode === "recovery" ? (
						<input
							name="code"
							inputMode="text"
							autoComplete="one-time-code"
							autoFocus
							placeholder="xxxxx-xxxxx"
							className="h-11 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-center text-lg tracking-[0.3em] text-neutral-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
						/>
					) : (
						<OtpField autoFocus />
					)}
					{actionData && "error" in actionData && actionData.error && (
						<p className="text-sm text-danger">{actionData.error}</p>
					)}
					{actionData && "sent" in actionData && actionData.sent && (
						<p className="text-sm text-brand">Code sent. Check your inbox.</p>
					)}
					<Button type="submit" size="block" disabled={busy}>
						{busy ? "Verifying…" : "Verify"}
					</Button>
				</Form>

				{mode === "email" && (
					<Form method="post" className="mt-3">
						<input type="hidden" name="intent" value="email-send" />
						<button
							type="submit"
							disabled={busy}
							className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
						>
							Send me a code
						</button>
					</Form>
				)}

				<div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm text-neutral-500">
					{mode !== "totp" && (
						<button type="button" onClick={() => setMode("totp")} className="hover:text-neutral-900">
							Use authenticator app
						</button>
					)}
					{mode !== "email" && (
						<button type="button" onClick={() => setMode("email")} className="hover:text-neutral-900">
							Email me a code instead
						</button>
					)}
					{mode !== "recovery" && loaderData.recoveryCount > 0 && (
						<button type="button" onClick={() => setMode("recovery")} className="hover:text-neutral-900">
							Use a recovery code
						</button>
					)}
				</div>
			</div>
		</AuthShell>
	);
}
