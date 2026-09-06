import { Form, Link, redirect, useNavigation } from "react-router";
import { GoogleLogo } from "@phosphor-icons/react";
import { AuthShell } from "~/components/auth-shell";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/auth";
import {
	createPendingMfaSession,
	createPendingVerifySession,
	createUser,
	createUserSession,
	findUserByEmail,
	getUserId,
	verifyPassword,
} from "~/lib/auth.server";
import { createEmailOtp } from "~/lib/mfa.server";
import { sendOtpEmail } from "~/lib/email.server";
import { googleConfigured } from "~/lib/google.server";

export function meta() {
	return [{ title: "Sign in — Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { SESSION_SECRET } = context.cloudflare.env;
	if (await getUserId(request, SESSION_SECRET)) throw redirect("/dashboard");
	const url = new URL(request.url);
	return {
		google: googleConfigured(context.cloudflare.env),
		signup: url.pathname === "/sign-up" || url.searchParams.has("new"),
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const env = context.cloudflare.env;
	const { DB, SESSION_SECRET } = env;
	const form = await request.formData();
	const email = String(form.get("email") ?? "")
		.trim()
		.toLowerCase();
	const password = String(form.get("password") ?? "");

	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
		return { error: "Enter a valid email address." };
	if (password.length < 8)
		return { error: "Password must be at least 8 characters." };

	// Send an email verification code and park the account in a pending state.
	async function startVerification(userId: string) {
		const code = await createEmailOtp(DB, userId, "verify");
		try {
			await sendOtpEmail(env, email, code, "verify");
		} catch (err) {
			console.error("[auth] verification email failed", err);
		}
		return createPendingVerifySession(SESSION_SECRET, userId);
	}

	const existing = await findUserByEmail(DB, email);
	if (existing) {
		if (!existing.password_hash)
			return { error: "This account uses Google sign-in. Continue with Google." };
		if (!(await verifyPassword(password, existing.password_hash)))
			return { error: "Wrong email or password." };
		if (!existing.email_verified) return startVerification(existing.id);
		if (existing.totp_enabled)
			return createPendingMfaSession(SESSION_SECRET, existing.id, "/dashboard");
		return createUserSession(SESSION_SECRET, existing.id, "/dashboard");
	}

	const user = await createUser(DB, email, password);
	return startVerification(user.id);
}

export default function Auth({ actionData, loaderData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";
	const signup = loaderData?.signup ?? false;

	return (
		<AuthShell>
			<div>
					<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
						{signup ? "Create your Gray Office account" : "Sign in to Gray Office"}
					</h1>
					<p className="mt-2 text-sm text-neutral-500">
						{signup
							? "Enter your email and pick a password. We’ll email you a code to confirm your address."
							: "Enter your email and password."}{" "}
						{signup ? (
							<Link to="/sign-in" className="font-medium text-brand hover:underline">
								Already have an account?
							</Link>
						) : (
							<Link to="/sign-up" className="font-medium text-brand hover:underline">
								New here? Create an account.
							</Link>
						)}
					</p>

					{loaderData?.google && (
						<>
							<a
								href="/auth/google"
								className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-neutral-300 bg-surface text-sm font-medium text-neutral-800 transition-colors hover:bg-tint"
							>
								<GoogleLogo size={17} weight="bold" />{" "}
								{signup ? "Sign up with Google" : "Continue with Google"}
							</a>
							<div className="my-4 flex items-center gap-3 text-xs text-neutral-400">
								<span className="h-px flex-1 bg-neutral-200" />
								or
								<span className="h-px flex-1 bg-neutral-200" />
							</div>
						</>
					)}

					<Form method="post" className="mt-6 space-y-3">
						<label className="block text-sm font-medium text-neutral-700">
							Email
							<input
								type="email"
								name="email"
								required
								autoComplete="email"
								placeholder="you@company.com"
								className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
							/>
						</label>
						<label className="block text-sm font-medium text-neutral-700">
							<span className="flex items-center justify-between">
								Password
								{!signup && (
									<Link
										to="/auth/reset"
										className="text-xs font-normal text-brand hover:underline"
									>
										Forgot password?
									</Link>
								)}
							</span>
							<input
								type="password"
								name="password"
								required
								minLength={8}
								autoComplete={signup ? "new-password" : "current-password"}
								placeholder="At least 8 characters"
								className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
							/>
						</label>

						{actionData?.error && (
							<p className="text-sm text-danger">{actionData.error}</p>
						)}

						<Button type="submit" size="block" disabled={busy}>
							{busy
								? signup
									? "Creating account…"
									: "Signing in…"
								: signup
									? "Create account"
									: "Sign in"}
						</Button>
					</Form>

				<p className="mt-6 text-xs text-neutral-400">
					By continuing you agree to the Terms and Privacy Policy.
				</p>
			</div>
		</AuthShell>
	);
}
