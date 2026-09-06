/**
 * Account data export. GET /settings/data streams a JSON file with everything
 * Gray Office stores about the signed-in user. Secrets (password hash, TOTP
 * secret, API keys, OTP/recovery hashes) are never included.
 */
import type { Route } from "./+types/settings.data";
import { findUserById, requireUserId } from "~/lib/auth.server";
import { countRecoveryCodes } from "~/lib/mfa.server";

const ts = (v: number | null | undefined) =>
	v ? new Date(v * 1000).toISOString() : null;

export async function loader({ request, context }: Route.LoaderArgs) {
	const { DB, SESSION_SECRET } = context.cloudflare.env;
	const userId = await requireUserId(request, SESSION_SECRET);
	const user = await findUserById(DB, userId);
	if (!user) throw new Response("Not found", { status: 404 });

	const meta = await DB.prepare("SELECT created_at FROM users WHERE id = ?")
		.bind(userId)
		.first<{ created_at: number }>();

	const otps = await DB.prepare(
		`SELECT purpose, expires_at, consumed_at, attempts, created_at
		 FROM email_otps WHERE user_id = ? ORDER BY created_at DESC`,
	)
		.bind(userId)
		.all<{
			purpose: string;
			expires_at: number;
			consumed_at: number | null;
			attempts: number;
			created_at: number;
		}>();

	const recovery = await DB.prepare(
		`SELECT used_at, created_at FROM mfa_recovery_codes WHERE user_id = ? ORDER BY created_at`,
	)
		.bind(userId)
		.all<{ used_at: number | null; created_at: number }>();

	// Payment integrations (0004). Table may not exist on older DBs.
	let paymentIntegrations: unknown[] = [];
	let paymentEvents: unknown[] = [];
	try {
		const pi = await DB.prepare(
			`SELECT provider, mode, connected_at, updated_at,
			        (api_key IS NOT NULL) AS has_api_key,
			        (api_secret IS NOT NULL) AS has_api_secret,
			        (webhook_secret IS NOT NULL) AS has_webhook_secret, extra
			 FROM payment_integrations WHERE user_id = ?`,
		)
			.bind(userId)
			.all();
		paymentIntegrations = (pi.results ?? []).map((r) => {
			const row = r as Record<string, unknown>;
			return {
				provider: row.provider,
				mode: row.mode,
				connected_at: ts(row.connected_at as number),
				updated_at: ts(row.updated_at as number),
				credentials_stored: {
					api_key: Boolean(row.has_api_key),
					api_secret: Boolean(row.has_api_secret),
					webhook_secret: Boolean(row.has_webhook_secret),
				},
				extra: row.extra ? safeJson(String(row.extra)) : null,
			};
		});

		const pe = await DB.prepare(
			`SELECT provider, type, summary, created_at
			 FROM payment_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 500`,
		)
			.bind(userId)
			.all();
		paymentEvents = (pe.results ?? []).map((r) => {
			const row = r as Record<string, unknown>;
			return {
				provider: row.provider,
				type: row.type,
				summary: row.summary,
				created_at: ts(row.created_at as number),
			};
		});
	} catch {
		// payments tables not present — leave arrays empty
	}

	const bundle = {
		exported_at: new Date().toISOString(),
		service: "Gray Office",
		profile: {
			id: user.id,
			email: user.email,
			name: user.name,
			avatar_url: user.avatar_url,
			email_verified: Boolean(user.email_verified),
			created_at: ts(meta?.created_at),
		},
		authentication: {
			password_set: Boolean(user.password_hash),
			google_linked: Boolean(user.google_id),
			two_factor_enabled: Boolean(user.totp_enabled),
			recovery_codes_remaining: await countRecoveryCodes(DB, userId),
		},
		email_otps: (otps.results ?? []).map((o) => ({
			purpose: o.purpose,
			attempts: o.attempts,
			expires_at: ts(o.expires_at),
			consumed_at: ts(o.consumed_at),
			created_at: ts(o.created_at),
		})),
		recovery_codes: (recovery.results ?? []).map((c) => ({
			used: Boolean(c.used_at),
			used_at: ts(c.used_at),
			created_at: ts(c.created_at),
		})),
		payment_integrations: paymentIntegrations,
		payment_events: paymentEvents,
	};

	const date = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(bundle, null, 2), {
		headers: {
			"content-type": "application/json; charset=utf-8",
			"content-disposition": `attachment; filename="gray-office-account-${date}.json"`,
			"cache-control": "no-store",
		},
	});
}

function safeJson(s: string): unknown {
	try {
		return JSON.parse(s);
	} catch {
		return s;
	}
}
