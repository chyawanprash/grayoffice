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
) {
	const { getSession, commitSession } = storage(secret);
	const session = await getSession();
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
	if (!userId) throw redirect("/auth");
	return userId;
}

export async function logout(request: Request, secret: string) {
	const { getSession, destroySession } = storage(secret);
	const session = await getSession(request.headers.get("Cookie"));
	return redirect("/auth", {
		headers: { "Set-Cookie": await destroySession(session) },
	});
}

/* -------------------------------------------------------------------- users */

export type User = { id: string; email: string; password_hash: string };

export async function findUserByEmail(
	db: D1Database,
	email: string,
): Promise<User | null> {
	return db
		.prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
		.bind(email)
		.first<User>();
}

export async function getUser(
	db: D1Database,
	id: string,
): Promise<{ id: string; email: string } | null> {
	return db
		.prepare("SELECT id, email FROM users WHERE id = ?")
		.bind(id)
		.first<{ id: string; email: string }>();
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
	return { id, email, password_hash };
}
