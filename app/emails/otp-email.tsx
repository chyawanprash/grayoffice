import { CodeBlock, EmailLayout, Paragraph } from "./layout";

const COPY: Record<string, { heading: string; intro: string }> = {
	mfa: {
		heading: "Your sign-in code",
		intro: "Enter this code to finish signing in to Gray Office.",
	},
	verify: {
		heading: "Confirm your email",
		intro: "Enter this code to verify your email address.",
	},
	reset: {
		heading: "Reset your password",
		intro: "Enter this code to choose a new password.",
	},
};

export function OtpEmail({
	code,
	purpose = "mfa",
}: {
	code: string;
	purpose?: "mfa" | "verify" | "reset";
}) {
	const { heading, intro } = COPY[purpose] ?? COPY.mfa;
	return (
		<EmailLayout preview={`${code} is your Gray Office code`}>
			<h1 style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: 600 }}>
				{heading}
			</h1>
			<Paragraph>{intro}</Paragraph>
			<CodeBlock code={code} />
			<Paragraph>
				This code expires in 10 minutes. If you didn&rsquo;t request it, you can
				safely ignore this email.
			</Paragraph>
		</EmailLayout>
	);
}
