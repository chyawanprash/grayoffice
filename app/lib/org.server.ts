/**
 * Organizations. Every user belongs to one or more orgs via `memberships`;
 * the active org is kept on the session (`activeOrgId`, see auth.server.ts).
 * App data (payments, bank, knowledge base) scopes to `org_id`.
 */
import { redirect } from "react-router";
import { getActiveOrgId, getPendingInvite, requireUserId } from "./auth.server";
import { sendInviteEmail } from "./email.server";

export type Role = "owner" | "admin" | "member";

export type Org = { id: string; name: string; slug: string; created_by: string };
export type Member = {
	user_id: string;
	role: Role;
	email: string;
	name: string | null;
	created_at: number;
};

function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 40) || "org"
	);
}

const enc = new TextEncoder();
async function sha256Hex(input: string): Promise<string> {
	const d = await crypto.subtle.digest("SHA-256", enc.encode(input));
	return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* -------------------------------------------------------------------- CRUD */

export async function createOrg(
	db: D1Database,
	userId: string,
	name: string,
): Promise<Org> {
	const id = crypto.randomUUID();
	const base = slugify(name);
	let slug = base;
	for (let i = 2; await db.prepare("SELECT 1 FROM organizations WHERE slug = ?").bind(slug).first(); i++)
		slug = `${base}-${i}`;

	await db.batch([
		db
			.prepare("INSERT INTO organizations (id, name, slug, created_by) VALUES (?, ?, ?, ?)")
			.bind(id, name.trim().slice(0, 80), slug, userId),
		db
			.prepare("INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, 'owner')")
			.bind(id, userId),
	]);
	return { id, name: name.trim().slice(0, 80), slug, created_by: userId };
}

export async function listOrgsForUser(
	db: D1Database,
	userId: string,
): Promise<(Org & { role: Role })[]> {
	const { results } = await db
		.prepare(
			`SELECT o.id, o.name, o.slug, o.created_by, m.role
			 FROM memberships m JOIN organizations o ON o.id = m.org_id
			 WHERE m.user_id = ? ORDER BY o.created_at`,
		)
		.bind(userId)
		.all<Org & { role: Role }>();
	return results ?? [];
}

export async function getMembership(
	db: D1Database,
	orgId: string,
	userId: string,
): Promise<{ role: Role } | null> {
	return db
		.prepare("SELECT role FROM memberships WHERE org_id = ? AND user_id = ?")
		.bind(orgId, userId)
		.first<{ role: Role }>();
}

export async function listMembers(db: D1Database, orgId: string): Promise<Member[]> {
	const { results } = await db
		.prepare(
			`SELECT m.user_id, m.role, m.created_at, u.email, u.name
			 FROM memberships m JOIN users u ON u.id = m.user_id
			 WHERE m.org_id = ? ORDER BY m.created_at`,
		)
		.bind(orgId)
		.all<Member>();
	return results ?? [];
}

export async function renameOrg(db: D1Database, orgId: string, name: string): Promise<void> {
	await db
		.prepare("UPDATE organizations SET name = ? WHERE id = ?")
		.bind(name.trim().slice(0, 80), orgId)
		.run();
}

export async function leaveOrg(db: D1Database, orgId: string, userId: string): Promise<void> {
	await db
		.prepare("DELETE FROM memberships WHERE org_id = ? AND user_id = ?")
		.bind(orgId, userId)
		.run();
}

/* ----------------------------------------------------------------- invites */

export type PendingInvite = {
	id: string;
	email: string;
	role: Role;
	created_at: number;
	expires_at: number;
};

export async function listPendingInvites(
	db: D1Database,
	orgId: string,
): Promise<PendingInvite[]> {
	const { results } = await db
		.prepare(
			`SELECT id, email, role, created_at, expires_at FROM org_invites
			 WHERE org_id = ? AND accepted_at IS NULL AND expires_at > unixepoch()
			 ORDER BY created_at DESC`,
		)
		.bind(orgId)
		.all<PendingInvite>();
	return results ?? [];
}

/** Create an invite and email it. Returns the accept URL (also handy for dev). */
export async function createInvite(
	db: D1Database,
	env: Env,
	orgId: string,
	orgName: string,
	inviterName: string,
	email: string,
	role: Role = "member",
): Promise<string> {
	const clean = email.trim().toLowerCase();
	const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
	const id = crypto.randomUUID();
	const expires = Math.floor(Date.now() / 1000) + 7 * 86400;
	await db
		.prepare(
			`INSERT INTO org_invites (id, org_id, email, role, token_hash, invited_by, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(id, orgId, clean, role, await sha256Hex(token), inviterName, expires)
		.run();

	const acceptUrl = `${(env.APP_URL ?? "").replace(/\/$/, "")}/invite/${token}`;
	try {
		await sendInviteEmail(env, clean, orgName, inviterName, acceptUrl);
	} catch (err) {
		console.error("[org] invite email failed", err);
	}
	return acceptUrl;
}

/** Look up a valid invite by its raw token. */
export async function findInvite(
	db: D1Database,
	token: string,
): Promise<{ id: string; org_id: string; email: string; role: Role; orgName: string } | null> {
	const row = await db
		.prepare(
			`SELECT i.id, i.org_id, i.email, i.role, o.name AS orgName
			 FROM org_invites i JOIN organizations o ON o.id = i.org_id
			 WHERE i.token_hash = ? AND i.accepted_at IS NULL AND i.expires_at > unixepoch()`,
		)
		.bind(await sha256Hex(token))
		.first<{ id: string; org_id: string; email: string; role: Role; orgName: string }>();
	return row ?? null;
}

/** Accept an invite for the signed-in user. Returns the org id joined. */
export async function acceptInvite(
	db: D1Database,
	token: string,
	userId: string,
): Promise<string | null> {
	const invite = await findInvite(db, token);
	if (!invite) return null;
	await db.batch([
		db
			.prepare(
				"INSERT OR IGNORE INTO memberships (org_id, user_id, role) VALUES (?, ?, ?)",
			)
			.bind(invite.org_id, userId, invite.role),
		db
			.prepare("UPDATE org_invites SET accepted_at = unixepoch() WHERE id = ?")
			.bind(invite.id),
	]);
	return invite.org_id;
}

/* ------------------------------------------------------------- requireOrg */

export type OrgContext = { orgId: string; role: Role; org: Org };

/**
 * The signed-in user's active org. Falls back to their first membership.
 * Redirects to /onboarding when they have no org yet.
 */
export async function requireOrg(request: Request, env: Env): Promise<OrgContext> {
	const userId = await requireUserId(request, env.SESSION_SECRET);
	let orgs = await listOrgsForUser(env.DB, userId);

	if (orgs.length === 0) {
		// A pending invite (opened while signed out) auto-joins here.
		const token = await getPendingInvite(request, env.SESSION_SECRET);
		if (token && (await acceptInvite(env.DB, token, userId)))
			orgs = await listOrgsForUser(env.DB, userId);
	}
	if (orgs.length === 0) throw redirect("/onboarding");

	const activeId = await getActiveOrgId(request, env.SESSION_SECRET);
	const active = orgs.find((o) => o.id === activeId) ?? orgs[0];
	return {
		orgId: active.id,
		role: active.role,
		org: { id: active.id, name: active.name, slug: active.slug, created_by: active.created_by },
	};
}
