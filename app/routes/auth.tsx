import { Form, Link, redirect, useNavigation } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import { Logo } from "~/components/brand";
import { Button } from "~/components/ui/button";
import type { Route } from "./+types/auth";
import {
	createUser,
	createUserSession,
	findUserByEmail,
	getUserId,
	verifyPassword,
} from "~/lib/auth.server";

export function meta() {
	return [{ title: "Sign in — Gray Office" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const { SESSION_SECRET } = context.cloudflare.env;
	if (await getUserId(request, SESSION_SECRET)) throw redirect("/dashboard");
	return null;
}

export async function action({ request, context }: Route.ActionArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const form = await request.formData();
	const email = String(form.get("email") ?? "")
		.trim()
		.toLowerCase();
	const password = String(form.get("password") ?? "");

	if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
		return { error: "Enter a valid email address." };
	if (password.length < 8)
		return { error: "Password must be at least 8 characters." };

	const existing = await findUserByEmail(DB, email);
	if (existing) {
		if (!(await verifyPassword(password, existing.password_hash)))
			return { error: "Wrong email or password." };
		return createUserSession(SESSION_SECRET, existing.id, "/dashboard");
	}

	const user = await createUser(DB, email, password);
	return createUserSession(SESSION_SECRET, user.id, "/dashboard");
}

export default function Auth({ actionData }: Route.ComponentProps) {
	const nav = useNavigation();
	const busy = nav.state !== "idle";

	return (
		<div className="flex min-h-screen w-full flex-col bg-surface text-neutral-950 lg:flex-row">
			{/* Brand panel */}
			<div className="relative flex min-h-[36vh] w-full flex-col justify-between overflow-hidden bg-brand p-8 md:p-12 lg:min-h-screen lg:w-1/2">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 opacity-[0.14]"
					style={{
						backgroundImage:
							"radial-gradient(circle, #fff 0.7px, transparent 0.7px)",
						backgroundSize: "22px 22px",
					}}
				/>
				<style>{`
					@keyframes auth-glare-a { 0%,100% { transform: translate3d(0,0,0) scale(1) } 33% { transform: translate3d(18%,22%,0) scale(1.18) } 66% { transform: translate3d(-12%,10%,0) scale(0.9) } }
					@keyframes auth-glare-b { 0%,100% { transform: translate3d(0,0,0) scale(1) } 50% { transform: translate3d(-24%,-18%,0) scale(1.25) } }
					@keyframes auth-glare-c { 0%,100% { transform: translate3d(0,0,0) scale(1.05) } 40% { transform: translate3d(16%,-14%,0) scale(0.85) } 75% { transform: translate3d(-8%,18%,0) scale(1.15) } }
					@media (prefers-reduced-motion: reduce) { .auth-glare { animation: none !important } }
				`}</style>
				<div
					aria-hidden
					className="auth-glare pointer-events-none absolute -left-32 -top-32 h-[30rem] w-[30rem] rounded-full bg-white/45 blur-3xl"
					style={{ animation: "auth-glare-a 9s ease-in-out infinite" }}
				/>
				<div
					aria-hidden
					className="auth-glare pointer-events-none absolute right-0 top-1/3 h-[22rem] w-[22rem] rounded-full bg-amber-200/35 blur-3xl"
					style={{ animation: "auth-glare-c 11s ease-in-out infinite" }}
				/>
				<div
					aria-hidden
					className="auth-glare pointer-events-none absolute bottom-0 left-1/4 h-[20rem] w-[20rem] rounded-full bg-yellow-100/25 blur-3xl"
					style={{ animation: "auth-glare-b 12s ease-in-out infinite" }}
				/>
				<div
					aria-hidden
					className="auth-glare pointer-events-none absolute -bottom-40 -right-24 h-[26rem] w-[26rem] rounded-full bg-black/20 blur-3xl"
					style={{ animation: "auth-glare-b 10s ease-in-out infinite" }}
				/>
				<div
					aria-hidden
					className="auth-glare pointer-events-none absolute -top-24 right-1/4 h-[24rem] w-[24rem] rounded-full bg-black/25 blur-3xl"
					style={{ animation: "auth-glare-c 13s ease-in-out infinite" }}
				/>

				<div className="relative z-10 flex items-center justify-between">
					<span className="text-lg font-semibold tracking-tight text-white">
						Gray Office
					</span>
					<Link
						to="/"
						className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
					>
						<ArrowLeft size={14} /> Back to site
					</Link>
				</div>

				<div className="relative z-10 mt-12 lg:mt-0">
					<h1 className="mb-4 max-w-md text-4xl font-medium leading-[1.1] tracking-tight text-white sm:text-5xl">
						Your finance back office, on autopilot.
					</h1>
					<p className="max-w-sm text-base leading-relaxed text-white/80 sm:text-lg">
						Close, reconcile, and report.
					</p>
				</div>
			</div>

			{/* Form panel */}
			<div className="flex w-full flex-col items-center justify-center p-6 sm:p-12 lg:w-1/2">
				<div className="w-full max-w-md">
					<Link to="/" className="mb-8 inline-flex lg:hidden">
						<Logo className="text-base" />
					</Link>

					<h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
						Sign in to Gray Office
					</h1>
					<p className="mt-2 text-sm text-neutral-500">
						Enter your email and password. New here? An account is created on
						your first sign in.
					</p>

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
							Password
							<input
								type="password"
								name="password"
								required
								minLength={8}
								autoComplete="current-password"
								placeholder="At least 8 characters"
								className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
							/>
						</label>

						{actionData?.error && (
							<p className="text-sm text-danger">{actionData.error}</p>
						)}

						<Button type="submit" size="block" disabled={busy}>
							{busy ? "Signing in…" : "Continue"}
						</Button>
					</Form>

					<p className="mt-6 text-xs text-neutral-400">
						By continuing you agree to the Terms and Privacy Policy.
					</p>
				</div>
			</div>
		</div>
	);
}
