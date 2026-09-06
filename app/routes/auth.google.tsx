import { redirect } from "react-router";
import type { Route } from "./+types/auth.google";
import { getUserId } from "~/lib/auth.server";
import { googleConfigured, startGoogleAuth } from "~/lib/google.server";

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	if (await getUserId(request, env.SESSION_SECRET)) throw redirect("/dashboard");
	if (!googleConfigured(env)) throw redirect("/auth");

	const url = new URL(request.url);
	const redirectTo = url.searchParams.get("redirectTo") ?? "/dashboard";
	const { url: authUrl, setCookie } = await startGoogleAuth(env, redirectTo);
	return redirect(authUrl, { headers: { "Set-Cookie": setCookie } });
}
