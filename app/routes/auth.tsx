import { useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "@phosphor-icons/react";
import { Logo } from "~/components/brand";

export function meta() {
	return [{ title: "Sign in — grayoffice" }];
}

const OTP_LEN = 6;

function OtpInput({
	value,
	onChange,
}: {
	value: string;
	onChange: (v: string) => void;
}) {
	const refs = useRef<(HTMLInputElement | null)[]>([]);

	const setChar = (i: number, char: string) => {
		const next = value.split("");
		next[i] = char;
		onChange(next.join("").slice(0, OTP_LEN));
		if (char && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
	};

	return (
		<div className="flex justify-between gap-2">
			{Array.from({ length: OTP_LEN }).map((_, i) => (
				<input
					key={i}
					ref={(el) => {
						refs.current[i] = el;
					}}
					inputMode="numeric"
					maxLength={1}
					value={value[i] ?? ""}
					onChange={(e) => setChar(i, e.target.value.replace(/\D/g, ""))}
					onKeyDown={(e) => {
						if (e.key === "Backspace" && !value[i] && i > 0)
							refs.current[i - 1]?.focus();
					}}
					onPaste={(e) => {
						e.preventDefault();
						const digits = e.clipboardData
							.getData("text")
							.replace(/\D/g, "")
							.slice(0, OTP_LEN);
						if (digits) onChange(digits);
					}}
					className="h-12 w-full rounded-lg border border-neutral-300 bg-surface text-center text-lg font-medium text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
				/>
			))}
		</div>
	);
}

export default function Auth() {
	const [step, setStep] = useState<"email" | "otp">("email");
	const [email, setEmail] = useState("");
	const [otp, setOtp] = useState("");

	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-canvas px-6 py-12">
			<div
				aria-hidden
				className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"
			/>
			<div className="relative w-full max-w-sm">
				<Link to="/" className="mb-8 flex justify-center">
					<Logo className="text-base" />
				</Link>

				<div className="rounded-2xl border border-neutral-200 bg-surface p-7 shadow-sm">
					{step === "email" ? (
						<>
							<h1 className="text-lg font-semibold text-neutral-900">
								Sign in to grayoffice
							</h1>
							<p className="mt-1 text-sm text-neutral-500">
								Use your work email to continue.
							</p>

							<button
								type="button"
								className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg border border-neutral-300 bg-surface px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-tint"
							>
								<GoogleMark />
								Continue with Google
							</button>

							<div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
								<span className="h-px flex-1 bg-neutral-200" />
								or
								<span className="h-px flex-1 bg-neutral-200" />
							</div>

							<form
								onSubmit={(e) => {
									e.preventDefault();
									if (email) setStep("otp");
								}}
								className="space-y-3"
							>
								<label className="block text-sm font-medium text-neutral-700">
									Work email
									<input
										type="email"
										required
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										placeholder="you@company.com"
										className="mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-surface px-3 text-sm text-neutral-900 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
									/>
								</label>
								<button
									type="submit"
									className="h-10 w-full rounded-lg bg-brand text-sm font-medium text-white ring-1 ring-brand transition-colors hover:bg-brand-hover"
								>
									Continue with email
								</button>
							</form>
						</>
					) : (
						<>
							<button
								type="button"
								onClick={() => setStep("email")}
								className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 transition-colors hover:text-neutral-900"
							>
								<ArrowLeft size={14} /> Back
							</button>
							<h1 className="text-lg font-semibold text-neutral-900">
								Enter your code
							</h1>
							<p className="mt-1 text-sm text-neutral-500">
								We sent a 6-digit code to{" "}
								<span className="font-medium text-neutral-700">{email}</span>.
							</p>

							<div className="mt-6">
								<OtpInput value={otp} onChange={setOtp} />
							</div>

							<button
								type="button"
								disabled={otp.length < OTP_LEN}
								className="mt-6 h-10 w-full rounded-lg bg-brand text-sm font-medium text-white ring-1 ring-brand transition-colors hover:bg-brand-hover disabled:opacity-40"
							>
								Verify & continue
							</button>
							<button
								type="button"
								className="mt-3 w-full text-center text-sm text-neutral-500 transition-colors hover:text-neutral-900"
							>
								Resend code
							</button>
						</>
					)}
				</div>

				<p className="mt-6 text-center text-xs text-neutral-400">
					By continuing you agree to the Terms and Privacy Policy.
				</p>
			</div>
		</div>
	);
}

function GoogleMark() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
			<path
				fill="#4285F4"
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
			/>
			<path
				fill="#34A853"
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
			/>
			<path
				fill="#FBBC05"
				d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z"
			/>
			<path
				fill="#EA4335"
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.67 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
			/>
		</svg>
	);
}
