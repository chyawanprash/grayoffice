import { createCookie } from "react-router";

type GoogleEnv = {
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	APP_URL?: string;
	SESSION_SECRET: string;
};

export function googleConfigured(env: GoogleEnv): boolean {
	return Boolean(
		env.GOOGLE_CLIENT_ID &&
			env.GOOGLE_CLIENT_SECRET &&
			!env.GOOGLE_CLIENT_ID.startsWith("your-google"),
	);
}

function redirectUri(env: GoogleEnv): string {
	const base = (env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
	return `${base}/auth/google/callback`;
}

/** Short-lived signed cookie holding the CSRF state + post-login destination. */
function oauthCookie(secret: string) {
	return createCookie("__go_oauth", {
		httpOnly: true,
		path: "/",
		sameSite: "lax",
		secure: import.meta.env.PROD,
		maxAge: 60 * 10,
		secrets: [secret],
	});
}

export async function startGoogleAuth(
	env: GoogleEnv,
	redirectTo: string,
): Promise<{ url: string; setCookie: string }> {
	const state = crypto.randomUUID();
	const params = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID!,
		redirect_uri: redirectUri(env),
		response_type: "code",
		scope: "openid email profile",
		state,
		prompt: "select_account",
	});
	return {
		url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
		setCookie: await oauthCookie(env.SESSION_SECRET).serialize({ state, redirectTo }),
	};
}

export async function readOauthCookie(
	env: GoogleEnv,
	request: Request,
): Promise<{ state: string; redirectTo: string } | null> {
	const value = await oauthCookie(env.SESSION_SECRET).parse(
		request.headers.get("Cookie"),
	);
	if (!value || typeof value.state !== "string") return null;
	return { state: value.state, redirectTo: value.redirectTo || "/dashboard" };
}

export async function clearOauthCookie(env: GoogleEnv): Promise<string> {
	return oauthCookie(env.SESSION_SECRET).serialize("", { maxAge: 0 });
}

export type GoogleProfile = {
	sub: string;
	email: string;
	email_verified: boolean;
	name?: string;
	picture?: string;
};

export async function exchangeGoogleCode(
	env: GoogleEnv,
	code: string,
): Promise<GoogleProfile> {
	const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code,
			client_id: env.GOOGLE_CLIENT_ID!,
			client_secret: env.GOOGLE_CLIENT_SECRET!,
			redirect_uri: redirectUri(env),
			grant_type: "authorization_code",
		}),
	});
	if (!tokenRes.ok) {
		throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
	}
	const { access_token } = (await tokenRes.json()) as { access_token: string };

	const profileRes = await fetch(
		"https://openidconnect.googleapis.com/v1/userinfo",
		{ headers: { Authorization: `Bearer ${access_token}` } },
	);
	if (!profileRes.ok) {
		throw new Error(`Google userinfo failed: ${await profileRes.text()}`);
	}
	const p = (await profileRes.json()) as Record<string, unknown>;
	return {
		sub: String(p.sub),
		email: String(p.email ?? "").toLowerCase(),
		email_verified: p.email_verified === true || p.email_verified === "true",
		name: typeof p.name === "string" ? p.name : undefined,
		picture: typeof p.picture === "string" ? p.picture : undefined,
	};
}
