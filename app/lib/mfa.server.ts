/**
 * MFA support: one-time recovery codes and short-lived email OTPs.
 * Codes are stored SHA-256 hashed; they are low-value only for a few minutes
 * (email) or single-use (recovery), so a fast hash is acceptable here.
 */

const enc = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

/* --------------------------------------------------------------- recovery */

const RECOVERY_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomCode(len: number): string {
	const bytes = crypto.getRandomValues(new Uint8Array(len));
	return [...bytes]
		.map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length])
		.join("");
}

/** Generate a fresh set of recovery codes, replacing any existing ones. */
export async function regenerateRecoveryCodes(
	db: D1Database,
	userId: string,
	count = 10,
): Promise<string[]> {
	await db
		.prepare("DELETE FROM mfa_recovery_codes WHERE user_id = ?")
		.bind(userId)
		.run();

	const codes: string[] = [];
	const stmts: D1PreparedStatement[] = [];
	for (let i = 0; i < count; i++) {
		const code = `${randomCode(5)}-${randomCode(5)}`;
		codes.push(code);
		stmts.push(
			db
				.prepare(
					"INSERT INTO mfa_recovery_codes (id, user_id, code_hash) VALUES (?, ?, ?)",
				)
				.bind(crypto.randomUUID(), userId, await sha256Hex(code)),
		);
	}
	await db.batch(stmts);
	return codes;
}

/** Consume a recovery code. Returns true if it was valid and unused. */
export async function useRecoveryCode(
	db: D1Database,
	userId: string,
	input: string,
): Promise<boolean> {
	const hash = await sha256Hex(input.trim().toLowerCase());
	const row = await db
		.prepare(
			"SELECT id FROM mfa_recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL",
		)
		.bind(userId, hash)
		.first<{ id: string }>();
	if (!row) return false;
	await db
		.prepare("UPDATE mfa_recovery_codes SET used_at = unixepoch() WHERE id = ?")
		.bind(row.id)
		.run();
	return true;
}

export async function countRecoveryCodes(
	db: D1Database,
	userId: string,
): Promise<number> {
	const row = await db
		.prepare(
			"SELECT COUNT(*) AS n FROM mfa_recovery_codes WHERE user_id = ? AND used_at IS NULL",
		)
		.bind(userId)
		.first<{ n: number }>();
	return row?.n ?? 0;
}

/* -------------------------------------------------------------- email OTP */

export type OtpPurpose = "mfa" | "verify" | "reset";

const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 5;

/** Create a 6-digit code, store its hash, and return the plaintext to email. */
export async function createEmailOtp(
	db: D1Database,
	userId: string,
	purpose: OtpPurpose,
): Promise<string> {
	// Invalidate outstanding codes for this purpose.
	await db
		.prepare(
			"DELETE FROM email_otps WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL",
		)
		.bind(userId, purpose)
		.run();

	const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
	await db
		.prepare(
			"INSERT INTO email_otps (id, user_id, purpose, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)",
		)
		.bind(
			crypto.randomUUID(),
			userId,
			purpose,
			await sha256Hex(code),
			Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS,
		)
		.run();
	return code;
}

export type OtpResult = "ok" | "invalid" | "expired" | "too_many_attempts";

/** Verify and consume an email OTP. */
export async function verifyEmailOtp(
	db: D1Database,
	userId: string,
	purpose: OtpPurpose,
	input: string,
): Promise<OtpResult> {
	const row = await db
		.prepare(
			"SELECT id, code_hash, expires_at, attempts FROM email_otps WHERE user_id = ? AND purpose = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1",
		)
		.bind(userId, purpose)
		.first<{ id: string; code_hash: string; expires_at: number; attempts: number }>();

	if (!row) return "invalid";
	if (row.attempts >= OTP_MAX_ATTEMPTS) return "too_many_attempts";
	if (row.expires_at < Math.floor(Date.now() / 1000)) return "expired";

	const matches = timingSafeEqual(
		row.code_hash,
		await sha256Hex(input.replace(/\s/g, "")),
	);

	if (!matches) {
		await db
			.prepare("UPDATE email_otps SET attempts = attempts + 1 WHERE id = ?")
			.bind(row.id)
			.run();
		return "invalid";
	}

	await db
		.prepare("UPDATE email_otps SET consumed_at = unixepoch() WHERE id = ?")
		.bind(row.id)
		.run();
	return "ok";
}
