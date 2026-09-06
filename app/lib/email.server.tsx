import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OtpEmail } from "~/emails/otp-email";
import type { OtpPurpose } from "./mfa.server";

type MailEnv = { RESEND_API_KEY?: string; RESEND_FROM?: string };

function renderHtml(element: ReactElement): string {
	return `<!doctype html>${renderToStaticMarkup(element)}`;
}

/**
 * Send an email via Resend. In dev (no API key configured) the message is
 * logged to the console instead of sent, so local flows still work.
 */
export async function sendEmail(
	env: MailEnv,
	msg: { to: string; subject: string; html: string; text?: string },
): Promise<void> {
	const from = env.RESEND_FROM ?? "Gray Office <onboarding@resend.dev>";

	if (!env.RESEND_API_KEY || env.RESEND_API_KEY.startsWith("re_your")) {
		// No API key: nothing is sent. OTP codes surface on the verify/MFA screen
		// in dev (see peekDevOtp); other mail is simply skipped locally.
		return;
	}

	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
	});

	if (!res.ok) {
		throw new Error(`Resend failed (${res.status}): ${await res.text()}`);
	}
}

export async function sendInviteEmail(
	env: MailEnv,
	to: string,
	orgName: string,
	inviterName: string,
	acceptUrl: string,
): Promise<void> {
	await sendEmail(env, {
		to,
		subject: `${inviterName} invited you to ${orgName} on Gray Office`,
		html: renderHtml(
			<html>
				<body style={{ fontFamily: "system-ui, sans-serif", color: "#1a1a1a" }}>
					<p>
						{inviterName} has invited you to join <strong>{orgName}</strong> on
						Gray Office, the finance operations workspace.
					</p>
					<p>
						<a
							href={acceptUrl}
							style={{
								display: "inline-block",
								padding: "10px 18px",
								background: "#4f46e5",
								color: "#fff",
								borderRadius: 8,
								textDecoration: "none",
							}}
						>
							Accept invitation
						</a>
					</p>
					<p style={{ color: "#666", fontSize: 13 }}>
						Or open this link: {acceptUrl}
						<br />
						This invitation expires in 7 days.
					</p>
				</body>
			</html>,
		),
		text: `${inviterName} invited you to join ${orgName} on Gray Office. Accept: ${acceptUrl} (expires in 7 days)`,
	});
}

export async function sendOtpEmail(
	env: MailEnv,
	to: string,
	code: string,
	purpose: OtpPurpose,
): Promise<void> {
	const subjects: Record<OtpPurpose, string> = {
		mfa: `${code} is your Gray Office sign-in code`,
		verify: `${code} - confirm your email`,
		reset: `${code} - reset your password`,
	};
	await sendEmail(env, {
		to,
		subject: subjects[purpose],
		html: renderHtml(<OtpEmail code={code} purpose={purpose} />),
		text: `Your Gray Office code is ${code}. It expires in 10 minutes.`,
	});
}
