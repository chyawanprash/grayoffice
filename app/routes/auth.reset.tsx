import { Form, Link, redirect, useNavigation } from "react-router";
import { AuthShell } from "~/components/auth-shell";
import { OtpField } from "~/components/otp-field";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/auth.reset";
import {
	findUserByEmail,
	getUserId,
	setPassword,
} from "~/lib/auth.server";
import {
	createEmailOtp,
	peekDevOtp,
	verifyEmailOtp,
} from "~/lib/mfa.server";
import { sendOtpEmail } from "~/lib/email.server";

export function meta() {
	return [{ title: "Reset password — Gray Office" }];
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function loader({ request, context }: Route.LoaderArgs) {
	if (await getUserId(request, context.cloudflare.env.SESSION_SECRET))
		throw redirect("/dashboard");
	return null;
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { DB } = env;
	const form = await request.formData();
	const intent = String(form.get("intent") ?? "");
	const email = String(form.get("email") ?? "").trim().toLowerCase();

	if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
	const user = await findUserByEmail(DB, email);

	if (intent === "request") {
		// Don't reveal whether the address has an account.
		if (user) {
			const code = await createEmailOtp(DB, user.id, "reset");
			try {
				await sendOtpEmail(env, email, code, "reset");
			} catch (err) {
				console.error("[reset] email failed", err);
			}
		}
		return {
			sent: true as const,
			email,
			devCode: user ? peekDevOtp(user.id, "reset") : undefined,
		};
	}

	if (intent === "reset") {
		const password = String(form.get("password") ?? "");
		if (password.length < 8)
			return { error: "Password must be at least 8 characters.", email, sent: true as const };
		const code = String(form.get("code") ?? "").trim();
		const res = user
			? await verifyEmailOtp(DB, user.id, "reset", code)
			: "invalid";
		if (res !== "ok")
			return {
				error:
					res === "expired"
						? "That code expired. Send a new one."
						: res === "too_many_attempts"
							? "Too many attempts. Send a new code."
							: "That code isn’t valid.",
				email,
				sent: true as const,
			};
		await setPassword(DB, user!.id, password);
		return redirect("/sign-in?reset=1");
	}

	return { error: "Unknown request." };
}

export default function ResetPassword({ actionData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";
	const sent = actionData && "sent" in actionData ? actionData.sent : false;
	const email = actionData && "email" in actionData ? actionData.email : "";
	const error = actionData && "error" in actionData ? actionData.error : null;
	const devCode =
		actionData && "devCode" in actionData ? actionData.devCode : undefined;

	return (
		<AuthShell back={{ to: "/sign-in", label: "Back to sign in" }}>
			<div>
				<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
					Reset your password
				</h1>
				<p className="mt-2 text-sm text-neutral-500">
					{sent
						? `If ${email} has an account, we sent it a 6-digit code. Enter it with your new password.`
						: "Enter your email and we’ll send a code to reset your password."}
				</p>

				{devCode && (
					<p className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
						Dev mode — your code is{" "}
						<span className="font-semibold tracking-wide">{devCode}</span>
					</p>
				)}
				{error && <p className="mt-4 text-sm text-danger">{error}</p>}

				{!sent ? (
					<Form method="post" className="mt-6 space-y-3">
						<input type="hidden" name="intent" value="request" />
						<input
							type="email"
							name="email"
							required
							autoComplete="email"
							placeholder="you@company.com"
							className="h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
						/>
						<Button type="submit" size="block" disabled={busy}>
							{busy ? "Sending…" : "Send code"}
						</Button>
					</Form>
				) : (
					<>
						<Form method="post" className="mt-6 space-y-4">
							<input type="hidden" name="intent" value="reset" />
							<input type="hidden" name="email" value={email} />
							<OtpField autoFocus />
							<input
								name="password"
								type="password"
								autoComplete="new-password"
								required
								minLength={8}
								placeholder="New password (min 8 characters)"
								className="h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
							/>
							<Button type="submit" size="block" disabled={busy}>
								{busy ? "Resetting…" : "Reset password"}
							</Button>
						</Form>
						<Form method="post" className="mt-3">
							<input type="hidden" name="intent" value="request" />
							<input type="hidden" name="email" value={email} />
							<button
								type="submit"
								disabled={busy}
								className="text-sm font-medium text-brand hover:underline disabled:opacity-50"
							>
								Resend code
							</button>
						</Form>
					</>
				)}

				<p className="mt-6 text-sm text-neutral-500">
					Remembered it?{" "}
					<Link to="/sign-in" className="font-medium text-brand hover:underline">
						Sign in
					</Link>
				</p>
			</div>
		</AuthShell>
	);
}
