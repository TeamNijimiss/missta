import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useSyncExternalStore, type PropsWithChildren } from 'react';
import { loadSettings, saveSettings, subscribeSettings, type ThemeMode } from '@/lib/storage/settings';

type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getThemeMode(): ThemeMode {
  return loadSettings().themeMode;
}

function setThemeMode(themeMode: ThemeMode): void {
  // Read persisted settings so changing the theme cannot save an unfinished settings form.
  saveSettings({ ...loadSettings(), themeMode });
}

function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  return mode === 'auto' ? (prefersDark ? 'dark' : 'light') : mode;
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const themeMode = useSyncExternalStore(subscribeSettings, getThemeMode, () => 'auto' as const);
  const mediaQuery = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)'), []);
  const subscribeSystemTheme = useCallback((listener: () => void) => {
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, [mediaQuery]);
  const getSystemTheme = useCallback(() => mediaQuery.matches, [mediaQuery]);
  const prefersDark = useSyncExternalStore(subscribeSystemTheme, getSystemTheme, () => false);
  const resolvedTheme = resolveTheme(themeMode, prefersDark);

  const toggleTheme = useCallback(() => {
    const currentTheme = resolveTheme(getThemeMode(), mediaQuery.matches);
    setThemeMode(currentTheme === 'dark' ? 'light' : 'dark');
  }, [mediaQuery]);

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? '#0f1115' : '#f2f3f5');
  }, [resolvedTheme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented || event.repeat || event.isComposing || event.keyCode === 229 ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        event.key.toLowerCase() !== 'd'
      ) {
        return;
      }

      const target = event.target;
      if (target instanceof Element && (
        target.closest('input, textarea, select, [role="textbox"]') ||
        (target instanceof HTMLElement && target.isContentEditable)
      )) {
        return;
      }

      event.preventDefault();
      toggleTheme();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleTheme]);

  const value = useMemo(() => ({ themeMode, resolvedTheme, setThemeMode, toggleTheme }), [themeMode, resolvedTheme, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return theme;
}
