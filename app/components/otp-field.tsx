import { useEffect, useRef, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "~/components/ui/input-otp";

/**
 * 6-digit numeric code entry for the email-verify / MFA flows. Renders a hidden
 * `code` input so it submits inside a plain <Form method="post">.
 *
 * Focuses itself on mount, and any digit typed on the page lands here.
 */
export function OtpField({
	length = 6,
	autoFocus = true,
}: {
	length?: number;
	autoFocus?: boolean;
}) {
	const [value, setValue] = useState("");
	const wrap = useRef<HTMLDivElement>(null);

	const focusInput = () =>
		wrap.current?.querySelector<HTMLInputElement>("input[data-input-otp]")?.focus();

	useEffect(() => {
		if (autoFocus) focusInput();
	}, [autoFocus]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			const el = document.activeElement;
			if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
			if (/^\d$/.test(e.key)) focusInput();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, []);

	return (
		<div ref={wrap} onPointerDown={focusInput}>
			<input type="hidden" name="code" value={value} />
			<InputOTP
				maxLength={length}
				value={value}
				onChange={setValue}
				pattern={REGEXP_ONLY_DIGITS}
				inputMode="numeric"
				containerClassName="justify-center"
			>
				<InputOTPGroup className="gap-2">
					{Array.from({ length }).map((_, i) => (
						<InputOTPSlot
							key={i}
							index={i}
							className="h-12 w-11 rounded-lg border text-lg data-[active=true]:border-brand data-[active=true]:ring-2 data-[active=true]:ring-brand/20"
						/>
					))}
				</InputOTPGroup>
			</InputOTP>
		</div>
	);
}
