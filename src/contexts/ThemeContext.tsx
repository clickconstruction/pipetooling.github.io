/** App theme (light/dark) driven by the time-of-day schedule in
 * [`themeSchedule`](../lib/themeSchedule.ts), with a per-device manual override
 * persisted in localStorage. Stamps `data-theme` on <html>, which the CSS
 * design tokens in index.css key off. Cross-tab changes sync via the
 * `storage` event; the schedule re-evaluates itself at each 4:00/20:00
 * boundary and when the tab becomes visible again. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  THEME_OVERRIDE_STORAGE_KEY,
  msUntilNextThemeBoundary,
  parseThemeOverride,
  resolveTheme,
  type ThemeName,
} from '../lib/themeSchedule'

type ThemeContextValue = {
  /** The theme currently applied to the document. */
  theme: ThemeName
  /** Non-null when the user has pinned a theme from the gear menu. */
  override: ThemeName | null
  /** Pin a theme, or pass null to return to the time-of-day schedule. */
  setOverride: (next: ThemeName | null) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredOverride(): ThemeName | null {
  try {
    return parseThemeOverride(localStorage.getItem(THEME_OVERRIDE_STORAGE_KEY))
  } catch {
    return null
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [override, setOverrideState] = useState<ThemeName | null>(readStoredOverride)
  const [scheduleTick, setScheduleTick] = useState(0)

  const theme = resolveTheme(override, new Date().getHours())
  // scheduleTick only exists to re-render across 4:00/20:00 boundaries.
  void scheduleTick

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // Printing is always light: printed/PDF output must not depend on the
  // viewer's theme (estimates, team summary, reports).
  useEffect(() => {
    const before = () => {
      document.documentElement.dataset.theme = 'light'
    }
    const after = () => {
      document.documentElement.dataset.theme = theme
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [theme])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const arm = () => {
      timer = setTimeout(() => {
        setScheduleTick((t) => t + 1)
        arm()
      }, msUntilNextThemeBoundary(new Date()))
    }
    arm()
    const onVisible = () => {
      if (document.visibilityState === 'visible') setScheduleTick((t) => t + 1)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_OVERRIDE_STORAGE_KEY) setOverrideState(parseThemeOverride(e.newValue))
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('storage', onStorage)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  const setOverride = useCallback((next: ThemeName | null) => {
    setOverrideState(next)
    try {
      if (next === null) localStorage.removeItem(THEME_OVERRIDE_STORAGE_KEY)
      else localStorage.setItem(THEME_OVERRIDE_STORAGE_KEY, next)
    } catch {
      /* private browsing etc. — theme still applies for this tab */
    }
  }, [])

  return <ThemeContext.Provider value={{ theme, override, setOverride }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx == null) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
