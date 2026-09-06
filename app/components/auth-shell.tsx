import { Link } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import { Logo } from "~/components/brand";

/**
 * Two-panel auth layout: animated brand panel on the left, form on the right.
 * Shared by /sign-in, /sign-up, /auth/verify and /auth/mfa so the OTP steps
 * look identical to sign-in.
 */
export function AuthShell({
	children,
	back = { to: "/", label: "Back to site" },
}: {
	children: React.ReactNode;
	back?: { to: string; label: string };
}) {
	return (
		<div className="relative flex min-h-screen w-full flex-col bg-surface text-foreground lg:flex-row">
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
					<span className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
						<img
							src="/logo.svg"
							alt=""
							width={28}
							height={28}
							className="size-7 rounded-lg ring-1 ring-white/20"
						/>
						Gray Office
					</span>
					<Link
						to={back.to}
						className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
					>
						<ArrowLeft size={14} /> {back.label}
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
					{children}
				</div>
			</div>
		</div>
	);
}
