import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { Moon, Sun } from "lucide-react";

export type Theme = "dark" | "light" | "system";

export const THEME_STORAGE_KEY = "grayoffice-theme";

/**
 * Inline, render-blocking script. Runs in <head> before first paint so the
 * correct `.dark` / `.light` class is on <html> and there is no flash of the
 * wrong theme (and no hydration mismatch).
 *
 * Default is LIGHT and the OS preference is ignored — dark only when the user
 * has explicitly toggled it (stored as "dark").
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
	THEME_STORAGE_KEY,
)};var d=localStorage.getItem(k)==='dark';var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(d?'dark':'light');e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

type ThemeProviderState = {
	theme: Theme;
	resolvedTheme: "dark" | "light";
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | null>(null);

function applyTheme(theme: "dark" | "light") {
	if (typeof document === "undefined") return;
	const root = document.documentElement;
	root.classList.remove("light", "dark");
	root.classList.add(theme);
	root.style.colorScheme = theme;
}

export function ThemeProvider({
	children,
	defaultTheme = "light",
	storageKey = THEME_STORAGE_KEY,
}: {
	children: ReactNode;
	defaultTheme?: Theme;
	storageKey?: string;
}) {
	const [theme, setThemeState] = useState<Theme>(() => {
		if (typeof localStorage === "undefined") return defaultTheme;
		return (localStorage.getItem(storageKey) as Theme | null) ?? defaultTheme;
	});
	// Light by default, OS preference ignored — dark only when explicitly chosen.
	const resolvedTheme: "dark" | "light" = theme === "dark" ? "dark" : "light";

	useEffect(() => {
		applyTheme(resolvedTheme);
	}, [resolvedTheme]);

	const setTheme = useCallback(
		(next: Theme) => {
			try {
				localStorage.setItem(storageKey, next);
			} catch {}
			setThemeState(next);
		},
		[storageKey],
	);

	const toggleTheme = useCallback(() => {
		setTheme(resolvedTheme === "dark" ? "light" : "dark");
	}, [resolvedTheme, setTheme]);

	const value = useMemo(
		() => ({ theme, resolvedTheme, setTheme, toggleTheme }),
		[theme, resolvedTheme, setTheme, toggleTheme],
	);

	return (
		<ThemeProviderContext.Provider value={value}>
			{children}
		</ThemeProviderContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeProviderContext);
	if (!context) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}

/**
 * Live `.dark` state read straight off <html>. The theme init script stamps the
 * class before hydration, so this is correct on the first client paint - unlike
 * `useTheme().resolvedTheme`, which is SSR-seeded to "light" and left visual
 * components rendering their light variant in dark mode.
 *
 * Returns `null` until mounted (SSR / first paint); callers that render theme-
 * dependent visuals should treat `null` as "not yet known".
 */
export function useIsDark(): boolean | null {
	// Read the class in the initializer so the FIRST client render is already
	// correct - no null->value transition that would retear effects keyed on it.
	const [dark, setDark] = useState<boolean | null>(() =>
		typeof document === "undefined"
			? null
			: document.documentElement.classList.contains("dark"),
	);
	useEffect(() => {
		const el = document.documentElement;
		const sync = () => setDark(el.classList.contains("dark"));
		sync();
		const mo = new MutationObserver(sync);
		mo.observe(el, { attributes: true, attributeFilter: ["class"] });
		return () => mo.disconnect();
	}, []);
	return dark;
}

/** Icon button that flips light <-> dark (light is the default). */
export function ThemeToggle({
	className = "",
	bordered = true,
}: {
	className?: string;
	bordered?: boolean;
}) {
	const { resolvedTheme, toggleTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);

	// Until mounted, render a stable placeholder to avoid hydration mismatch.
	const icon = !mounted ? (
		<Moon className="size-4" />
	) : resolvedTheme === "dark" ? (
		<Sun className="size-4" />
	) : (
		<Moon className="size-4" />
	);

	const label = !mounted
		? "Toggle theme"
		: resolvedTheme === "dark"
			? "Switch to light theme"
			: "Switch to dark theme";

	return (
		<button
			type="button"
			onClick={toggleTheme}
			aria-label={label}
			title={label}
			className={
				"inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none " +
				(bordered ? "border border-border bg-transparent " : "bg-transparent ") +
				className
			}
		>
			{icon}
		</button>
	);
}
