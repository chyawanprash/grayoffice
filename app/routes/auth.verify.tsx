import { Form, redirect, useNavigation } from "react-router";
import { AuthShell } from "~/components/auth-shell";
import { OtpField } from "~/components/otp-field";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/auth.verify";
import {
	completeVerifySession,
	createPendingMfaSession,
	findUserById,
	getPendingVerifyUserId,
	markEmailVerified,
} from "~/lib/auth.server";
import { createEmailOtp, verifyEmailOtp } from "~/lib/mfa.server";
import { sendOtpEmail } from "~/lib/email.server";

export function meta() {
	return [{ title: "Confirm your email — Gray Office" }];
}

function maskEmail(email: string): string {
	const [name, domain] = email.split("@");
	const head = name.length <= 2 ? name[0] : name.slice(0, 2);
	return `${head}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await getPendingVerifyUserId(request, SESSION_SECRET);
	if (!userId) throw redirect("/auth");
	const user = await findUserById(DB, userId);
	if (!user) throw redirect("/auth");
	if (user.email_verified) throw redirect("/dashboard");
	return { email: maskEmail(user.email) };
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { DB, SESSION_SECRET } = env;
	const userId = await getPendingVerifyUserId(request, SESSION_SECRET);
	if (!userId) throw redirect("/auth");
	const user = await findUserById(DB, userId);
	if (!user) throw redirect("/auth");

	const form = await request.formData();
	const intent = String(form.get("intent") ?? "");

	if (intent === "resend") {
		const code = await createEmailOtp(DB, user.id, "verify");
		try {
			await sendOtpEmail(env, user.email, code, "verify");
		} catch (err) {
			console.error("[verify] resend failed", err);
			return { error: "Couldn’t send the email. Try again in a moment." };
		}
		return { sent: true };
	}

	const code = String(form.get("code") ?? "").trim();
	if (!code) return { error: "Enter the 6-digit code." };

	const res = await verifyEmailOtp(DB, user.id, "verify", code);
	if (res !== "ok")
		return {
			error:
				res === "expired"
					? "That code expired. Send a new one."
					: res === "too_many_attempts"
						? "Too many attempts. Send a new code."
						: "That code isn’t valid.",
		};

	await markEmailVerified(DB, user.id);

	if (user.totp_enabled)
		return createPendingMfaSession(SESSION_SECRET, user.id, "/dashboard");
	return completeVerifySession(request, SESSION_SECRET, user.id, "/dashboard");
}

export default function VerifyEmail({ actionData, loaderData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";
	const err = actionData && "error" in actionData ? actionData.error : null;
	const sent = actionData && "sent" in actionData ? actionData.sent : false;

	return (
		<AuthShell back={{ to: "/auth", label: "Back to sign in" }}>
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
					Confirm your email
				</h1>
				<p className="mt-2 text-sm text-neutral-500">
					We sent a 6-digit code to {loaderData.email}. Enter it below to finish
					setting up your account.
				</p>

				<Form method="post" className="mt-6 space-y-4">
					<input type="hidden" name="intent" value="verify" />
					<OtpField autoFocus />
					{err && <p className="text-sm text-danger">{err}</p>}
					{sent && <p className="text-sm text-brand">New code sent.</p>}
					<Button type="submit" size="block" disabled={busy}>
						{busy ? "Verifying…" : "Verify email"}
					</Button>
				</Form>

				<Form method="post" className="mt-3">
					<input type="hidden" name="intent" value="resend" />
					<button
						type="submit"
						disabled={busy}
						className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
					>
						Resend code
					</button>
				</Form>
			</div>
		</AuthShell>
	);
}
