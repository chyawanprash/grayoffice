import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { Route } from "./+types/root";
import { ThemeProvider, THEME_INIT_SCRIPT } from "~/components/theme";
import { ErrorScene, errorToScene } from "~/components/error-scene";
import { SiteNav, SiteFooter } from "~/components/brand";
import "./app.css";

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>Gray Office | the finance dashboard</title>
				<link rel="icon" href="/favicon.ico" sizes="32x32" />
				<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
				<link rel="manifest" href="/site.webmanifest" />
				<meta name="theme-color" content="#4F46E5" />
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<Meta />
				<Links />
			</head>
			<body>
				<ThemeProvider>{children}</ThemeProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export default function App() {
	return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	// Marketing chrome. `/dashboard/*` errors are caught by the dashboard
	// layout's own boundary (with the dashboard shell) before reaching here.
	return (
		<div className="flex min-h-svh flex-col bg-canvas">
			<SiteNav />
			<div className="flex flex-1 items-center py-10">
				<ErrorScene {...errorToScene(error)} compact homeTo="/" homeLabel="Back to site" />
			</div>
			<SiteFooter />
		</div>
	);
}
