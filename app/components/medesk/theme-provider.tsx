/**
 * The theme system now lives in `~/components/theme` so it can be shared by the
 * marketing site, auth pages and dashboard. Re-exported here for the existing
 * medesk imports.
 */
export {
	ThemeProvider,
	ThemeToggle,
	useTheme,
	THEME_INIT_SCRIPT,
	THEME_STORAGE_KEY,
	type Theme,
} from "~/components/theme";
