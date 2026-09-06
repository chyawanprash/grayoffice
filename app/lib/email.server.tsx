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
		console.log(
			`[email:dev] to=${msg.to} subject=${JSON.stringify(msg.subject)}\n${msg.text ?? msg.html}`,
		);
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

export async function sendOtpEmail(
	env: MailEnv,
	to: string,
	code: string,
	purpose: OtpPurpose,
): Promise<void> {
	const subjects: Record<OtpPurpose, string> = {
		mfa: `${code} is your Gray Office sign-in code`,
		verify: `${code} — confirm your email`,
		reset: `${code} — reset your password`,
	};
	await sendEmail(env, {
		to,
		subject: subjects[purpose],
		html: renderHtml(<OtpEmail code={code} purpose={purpose} />),
		text: `Your Gray Office code is ${code}. It expires in 10 minutes.`,
	});
}
