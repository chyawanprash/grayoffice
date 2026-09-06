/**
 * Tiny symmetric encryption for secrets stored in D1 (bot tokens, signing
 * secrets). AES-256-GCM with a key derived from SESSION_SECRET — no external
 * KMS, but the DB no longer holds plaintext credentials.
 *
 * ponytail: key = SHA-256(SESSION_SECRET). Rotating SESSION_SECRET invalidates
 * sealed values; move to a dedicated SECRETBOX_KEY + versioned envelope if that
 * becomes a problem.
 */
const enc = new TextEncoder();
const dec = new TextDecoder();

let keyPromise: Promise<CryptoKey> | null = null;
function getKey(secret: string): Promise<CryptoKey> {
	if (!keyPromise) {
		keyPromise = crypto.subtle
			.digest("SHA-256", enc.encode(secret))
			.then((raw) => crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]));
	}
	return keyPromise;
}

const b64 = (buf: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf.buffer : buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Encrypt a string. Returns `enc:v1:<base64(iv|ciphertext)>`. */
export async function seal(secret: string, plain: string | null | undefined): Promise<string | null> {
	if (!plain) return null;
	const key = await getKey(secret);
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
	const packed = new Uint8Array(iv.length + ct.byteLength);
	packed.set(iv);
	packed.set(new Uint8Array(ct), iv.length);
	return `enc:v1:${b64(packed)}`;
}

/** Decrypt a value from `seal`. Plaintext (no `enc:v1:` prefix) is passed through. */
export async function open(secret: string, value: string | null | undefined): Promise<string | null> {
	if (!value) return null;
	if (!value.startsWith("enc:v1:")) return value; // legacy / not sealed
	try {
		const packed = unb64(value.slice("enc:v1:".length));
		const key = await getKey(secret);
		const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, key, packed.slice(12));
		return dec.decode(pt);
	} catch {
		return null;
	}
}
