import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Gray Office";

function totp(secretBase32: string, label: string): TOTP {
	return new TOTP({
		issuer: ISSUER,
		label,
		algorithm: "SHA1",
		digits: 6,
		period: 30,
		secret: Secret.fromBase32(secretBase32),
	});
}

/** Fresh base32 TOTP secret to hand to an authenticator app. */
export function newTotpSecret(): string {
	return new Secret({ size: 20 }).base32;
}

/** otpauth:// URI for QR enrollment. */
export function totpUri(secretBase32: string, email: string): string {
	return totp(secretBase32, email).toString();
}

/** Inline SVG QR code for the otpauth URI (safe to dangerouslySetInnerHTML). */
export function totpQrSvg(secretBase32: string, email: string): Promise<string> {
	return QRCode.toString(totpUri(secretBase32, email), {
		type: "svg",
		margin: 1,
		width: 200,
	});
}

/**
 * Verify a 6-digit token. `window: 1` tolerates one 30s step of clock drift
 * in either direction. Returns true on match.
 */
export function verifyTotp(
	secretBase32: string,
	token: string,
	email = "user",
): boolean {
	const clean = token.replace(/\s/g, "");
	if (!/^\d{6}$/.test(clean)) return false;
	const delta = totp(secretBase32, email).validate({ token: clean, window: 1 });
	return delta !== null;
}
