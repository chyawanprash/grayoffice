import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { logout } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
	return logout(request, context.cloudflare.env.SESSION_SECRET);
}

export async function loader() {
	return redirect("/");
}
