import { isRouteErrorResponse, Link } from "react-router";

/**
 * Full-page error state. The illustrations (public/*.svg) are dark-outlined
 * spot art, so they sit on a fixed light panel that reads the same in both
 * themes.
 */
type Art = "lost" | "crash" | "generic";

const ART: Record<Art, { src: string; alt: string }> = {
	lost: { src: "/error-2.svg", alt: "" },
	crash: { src: "/system%20error.svg", alt: "" },
	generic: { src: "/Error.svg", alt: "" },
};

export type SceneProps = {
	code?: number | string;
	title: string;
	message: string;
	art?: Art;
	showReload?: boolean;
};

/** Map a route error (or any thrown value) to ErrorScene props. */
export function errorToScene(error: unknown): SceneProps {
	if (isRouteErrorResponse(error)) {
		if (error.status === 404)
			return {
				code: 404,
				art: "lost",
				title: "Page not found",
				message:
					"This page doesn't exist, or you don't have access to it. Check the address, or head back.",
			};
		if (error.status === 403)
			return {
				code: 403,
				art: "generic",
				title: "No access",
				message:
					"You're signed in, but this isn't something your account can open. Ask an admin if you think that's wrong.",
			};
		return {
			code: error.status,
			art: "crash",
			title: error.statusText || "Something broke",
			message:
				typeof error.data === "string" && error.data
					? error.data
					: "The server hit a problem handling that request. Try again in a moment.",
			showReload: true,
		};
	}
	return {
		code: 500,
		art: "crash",
		title: "Something broke",
		message:
			import.meta.env.DEV && error instanceof Error
				? error.message
				: "An unexpected error occurred. Reloading usually clears it; if not, it's on us and we're looking.",
		showReload: true,
	};
}

export function ErrorScene({
	code,
	title,
	message,
	art = "generic",
	showHome = true,
	showReload = false,
	compact = false,
	homeTo = "/dashboard",
	homeLabel = "Back to dashboard",
}: SceneProps & {
	showHome?: boolean;
	compact?: boolean;
	homeTo?: string;
	homeLabel?: string;
}) {
	const a = ART[art];
	return (
		<div
			className={`flex w-full flex-col items-center justify-center px-6 text-center ${
				compact ? "py-16" : "min-h-svh"
			}`}
		>
			<div className="grid place-items-center rounded-2xl bg-[#f6f4ff] p-8 shadow-[0_1px_2px_rgba(13,13,13,0.06),0_16px_40px_rgba(13,13,13,0.08)] dark:bg-[#f6f4ff]">
				<img src={a.src} alt={a.alt} aria-hidden className="h-28 w-auto sm:h-32" />
			</div>

			{code != null && (
				<div className="mt-6 font-mono text-[13px] font-medium tracking-wide text-muted-foreground tabular-nums">
					{code}
				</div>
			)}
			<h1 className="mt-2 text-2xl font-normal tracking-tight text-foreground">{title}</h1>
			<p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>

			<div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
				{showReload && (
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
					>
						Try again
					</button>
				)}
				{showHome && (
					<Link
						to={homeTo}
						className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium transition-colors ${
							showReload
								? "border border-border text-foreground hover:bg-muted"
								: "bg-brand text-white hover:bg-brand-hover"
						}`}
					>
						{homeLabel}
					</Link>
				)}
			</div>
		</div>
	);
}
