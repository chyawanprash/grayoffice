import { redirect } from "react-router";
import type { Route } from "./+types/auth.google.callback";
import {
	createGoogleUser,
	createPendingMfaSession,
	createUserSession,
	findUserByEmail,
	findUserByGoogleId,
	linkGoogleAccount,
} from "~/lib/auth.server";
import {
	clearOauthCookie,
	exchangeGoogleCode,
	googleConfigured,
	readOauthCookie,
} from "~/lib/google.server";

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const { DB, SESSION_SECRET } = env;
	if (!googleConfigured(env)) throw redirect("/auth");

	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const stored = await readOauthCookie(env, request);
	const clearCookie = await clearOauthCookie(env);

	const fail = (reason: string) =>
		redirect(`/auth?error=${encodeURIComponent(reason)}`, {
			headers: { "Set-Cookie": clearCookie },
		});

	if (url.searchParams.get("error")) throw fail("Google sign-in was cancelled.");
	if (!code || !state || !stored || state !== stored.state)
		throw fail("Google sign-in could not be verified. Try again.");

	let profile;
	try {
		profile = await exchangeGoogleCode(env, code);
	} catch {
		throw fail("Could not reach Google. Try again.");
	}
	if (!profile.email || !profile.email_verified)
		throw fail("Your Google account has no verified email.");

	const googleMeta = { name: profile.name, avatar_url: profile.picture };

	// 1. Already linked → sign in.
	let user = await findUserByGoogleId(DB, profile.sub);

	// 2. Existing account with the same verified email → auto-link.
	if (!user) {
		const byEmail = await findUserByEmail(DB, profile.email);
		if (byEmail) {
			await linkGoogleAccount(DB, byEmail.id, profile.sub, googleMeta);
			user = byEmail;
		}
	}

	// 3. Brand new user.
	if (!user) {
		user = await createGoogleUser(DB, {
			email: profile.email,
			googleId: profile.sub,
			...googleMeta,
		});
	}

	const headers = new Headers({ "Set-Cookie": clearCookie });

	if (user.totp_enabled) {
		return createPendingMfaSession(SESSION_SECRET, user.id, stored.redirectTo);
	}
	return createUserSession(SESSION_SECRET, user.id, stored.redirectTo, headers);
}
