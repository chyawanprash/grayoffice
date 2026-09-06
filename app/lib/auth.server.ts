import { createCookieSessionStorage, redirect } from "react-router";

/* ---------------------------------------------------------------- passwords */

const ITERATIONS = 100_000;
const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
	return [...new Uint8Array(buf)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function pbkdf2(password: string, salt: BufferSource): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
		key,
		256,
	);
	return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const hash = await pbkdf2(password, salt);
	return `pbkdf2$${ITERATIONS}$${toHex(salt.buffer)}$${hash}`;
}

export async function verifyPassword(
	password: string,
	stored: string,
): Promise<boolean> {
	const [scheme, iter, saltHex, hash] = stored.split("$");
	if (scheme !== "pbkdf2" || Number(iter) !== ITERATIONS) return false;
	const salt = Uint8Array.from(
		saltHex.match(/.{2}/g)!.map((h) => parseInt(h, 16)),
	);
	const check = await pbkdf2(password, salt);
	// constant-time-ish compare
	if (check.length !== hash.length) return false;
	let diff = 0;
	for (let i = 0; i < check.length; i++)
		diff |= check.charCodeAt(i) ^ hash.charCodeAt(i);
	return diff === 0;
}

/* ----------------------------------------------------------------- sessions */

function storage(secret: string) {
	return createCookieSessionStorage({
		cookie: {
			name: "__go_session",
			httpOnly: true,
			path: "/",
			sameSite: "lax",
			secrets: [secret],
			secure: import.meta.env.PROD,
			maxAge: 60 * 60 * 24 * 30,
		},
	});
}

export async function createUserSession(
	secret: string,
	userId: string,
	redirectTo: string,
	headers?: HeadersInit,
) {
	const { getSession, commitSession } = storage(secret);
	const session = await getSession();
	session.set("userId", userId);
	const h = new Headers(headers);
	h.append("Set-Cookie", await commitSession(session));
	return redirect(redirectTo, { headers: h });
}

/* ---------------------------------------------------------- pending MFA step */

/**
 * The user passed the first factor (password or Google) but still owes a
 * second factor. Park their id in the session under a separate key so it does
 * NOT count as being signed in, and send them to /auth/mfa.
 */
export async function createPendingMfaSession(
	secret: string,
	userId: string,
	redirectTo: string,
) {
	const { getSession, commitSession } = storage(secret);
	const session = await getSession();
	session.set("pendingMfaUserId", userId);
	session.set("pendingMfaRedirect", redirectTo);
	return redirect("/auth/mfa", {
		headers: { "Set-Cookie": await commitSession(session) },
	});
}

export async function getPendingMfa(
	request: Request,
	secret: string,
): Promise<{ userId: string; redirectTo: string } | null> {
	const { getSession } = storage(secret);
	const session = await getSession(request.headers.get("Cookie"));
	const userId = session.get("pendingMfaUserId");
	if (typeof userId !== "string") return null;
	const redirectTo = session.get("pendingMfaRedirect");
	return {
		userId,
		redirectTo: typeof redirectTo === "string" ? redirectTo : "/dashboard",
	};
}

/** Promote a passed-MFA pending session into a real signed-in session. */
export async function completeMfaSession(
	request: Request,
	secret: string,
	userId: string,
	redirectTo: string,
) {
	const { getSession, commitSession } = storage(secret);
	const session = await getSession(request.headers.get("Cookie"));
	session.unset("pendingMfaUserId");
	session.unset("pendingMfaRedirect");
	session.set("userId", userId);
	return redirect(redirectTo, {
		headers: { "Set-Cookie": await commitSession(session) },
	});
}

/* -------------------------------------------------- pending email verification */

/**
 * The account exists but its email address is not confirmed yet. Park the id
 * under its own session key (NOT signed in) and send them to /auth/verify.
 */
export async function createPendingVerifySession(secret: string, userId: string) {
	const { getSession, commitSession } = storage(secret);
	const session = await getSession();
	session.set("pendingVerifyUserId", userId);
	return redirect("/auth/verify", {
		headers: { "Set-Cookie": await commitSession(session) },
	});
}

export async function getPendingVerifyUserId(
	request: Request,
	secret: string,
): Promise<string | null> {
	const { getSession } = storage(secret);
	const session = await getSession(request.headers.get("Cookie"));
	const userId = session.get("pendingVerifyUserId");
	return typeof userId === "string" ? userId : null;
}

/** Promote a verified pending session into a real signed-in session. */
export async function completeVerifySession(
	request: Request,
	secret: string,
	userId: string,
	redirectTo: string,
) {
	const { getSession, commitSession } = storage(secret);
	const session = await getSession(request.headers.get("Cookie"));
	session.unset("pendingVerifyUserId");
	session.set("userId", userId);
	return redirect(redirectTo, {
		headers: { "Set-Cookie": await commitSession(session) },
	});
}

export async function getUserId(
	request: Request,
	secret: string,
): Promise<string | null> {
	const { getSession } = storage(secret);
	const session = await getSession(request.headers.get("Cookie"));
	const userId = session.get("userId");
	return typeof userId === "string" ? userId : null;
}

export async function requireUserId(
	request: Request,
	secret: string,
): Promise<string> {
	const userId = await getUserId(request, secret);
	if (!userId) throw redirect("/sign-in");
	return userId;
}

export async function logout(request: Request, secret: string) {
	const { getSession, destroySession } = storage(secret);
	const session = await getSession(request.headers.get("Cookie"));
	return redirect("/sign-in", {
		headers: { "Set-Cookie": await destroySession(session) },
	});
}

/* -------------------------------------------------------------------- users */

export type User = {
	id: string;
	email: string;
	password_hash: string | null;
	name: string | null;
	avatar_url: string | null;
	google_id: string | null;
	email_verified: number;
	totp_secret: string | null;
	totp_enabled: number;
};

const USER_COLS =
	"id, email, password_hash, name, avatar_url, google_id, email_verified, totp_secret, totp_enabled";

export async function findUserByEmail(
	db: D1Database,
	email: string,
): Promise<User | null> {
	return db
		.prepare(`SELECT ${USER_COLS} FROM users WHERE email = ?`)
		.bind(email)
		.first<User>();
}

export async function findUserByGoogleId(
	db: D1Database,
	googleId: string,
): Promise<User | null> {
	return db
		.prepare(`SELECT ${USER_COLS} FROM users WHERE google_id = ?`)
		.bind(googleId)
		.first<User>();
}

export async function findUserById(
	db: D1Database,
	id: string,
): Promise<User | null> {
	return db
		.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`)
		.bind(id)
		.first<User>();
}

export async function getUser(
	db: D1Database,
	id: string,
): Promise<{ id: string; email: string; name: string | null; totp_enabled: number } | null> {
	return db
		.prepare("SELECT id, email, name, totp_enabled FROM users WHERE id = ?")
		.bind(id)
		.first<{ id: string; email: string; name: string | null; totp_enabled: number }>();
}

/** Link a Google account to an existing user (verified-email auto-link). */
export async function linkGoogleAccount(
	db: D1Database,
	userId: string,
	googleId: string,
	profile: { name?: string; avatar_url?: string },
): Promise<void> {
	await db
		.prepare(
			"UPDATE users SET google_id = ?, email_verified = 1, name = COALESCE(name, ?), avatar_url = COALESCE(avatar_url, ?) WHERE id = ?",
		)
		.bind(googleId, profile.name ?? null, profile.avatar_url ?? null, userId)
		.run();
}

export async function createGoogleUser(
	db: D1Database,
	profile: { email: string; googleId: string; name?: string; avatar_url?: string },
): Promise<User> {
	const id = crypto.randomUUID();
	await db
		.prepare(
			"INSERT INTO users (id, email, google_id, email_verified, name, avatar_url) VALUES (?, ?, ?, 1, ?, ?)",
		)
		.bind(id, profile.email, profile.googleId, profile.name ?? null, profile.avatar_url ?? null)
		.run();
	return {
		id,
		email: profile.email,
		password_hash: null,
		name: profile.name ?? null,
		avatar_url: profile.avatar_url ?? null,
		google_id: profile.googleId,
		email_verified: 1,
		totp_secret: null,
		totp_enabled: 0,
	};
}

/* ------------------------------------------------------------------ TOTP flags */

export async function setTotpSecret(
	db: D1Database,
	userId: string,
	secret: string,
): Promise<void> {
	await db
		.prepare("UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?")
		.bind(secret, userId)
		.run();
}

export async function markEmailVerified(
	db: D1Database,
	userId: string,
): Promise<void> {
	await db
		.prepare("UPDATE users SET email_verified = 1 WHERE id = ?")
		.bind(userId)
		.run();
}

export async function enableTotp(db: D1Database, userId: string): Promise<void> {
	await db
		.prepare("UPDATE users SET totp_enabled = 1 WHERE id = ?")
		.bind(userId)
		.run();
}

export async function disableTotp(db: D1Database, userId: string): Promise<void> {
	await db
		.prepare(
			"UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?",
		)
		.bind(userId)
		.run();
	await db
		.prepare("DELETE FROM mfa_recovery_codes WHERE user_id = ?")
		.bind(userId)
		.run();
}

export async function createUser(
	db: D1Database,
	email: string,
	password: string,
): Promise<User> {
	const id = crypto.randomUUID();
	const password_hash = await hashPassword(password);
	await db
		.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
		.bind(id, email, password_hash)
		.run();
	return {
		id,
		email,
		password_hash,
		name: null,
		avatar_url: null,
		google_id: null,
		email_verified: 0,
		totp_secret: null,
		totp_enabled: 0,
	};
}
