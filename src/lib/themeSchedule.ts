/** Time-of-day theme schedule with a manual override.
 *
 * The app is light from 4:00 to 20:00 local time and dark from 20:00 to 4:00.
 * A user can pin either theme from the gear menu; the override is stored in
 * localStorage (per device) and wins over the schedule until cleared.
 */

export type ThemeName = 'light' | 'dark'

export const DARK_START_HOUR = 20 // 8pm — dark begins
export const DARK_END_HOUR = 4 // 4am — light begins

export const THEME_OVERRIDE_STORAGE_KEY = 'themeOverride'

export function scheduledTheme(hour: number): ThemeName {
  return hour >= DARK_START_HOUR || hour < DARK_END_HOUR ? 'dark' : 'light'
}

export function resolveTheme(override: ThemeName | null, hour: number): ThemeName {
  return override ?? scheduledTheme(hour)
}

/** Validates a raw localStorage value; anything unexpected means "no override". */
export function parseThemeOverride(raw: string | null): ThemeName | null {
  return raw === 'light' || raw === 'dark' ? raw : null
}

/** Milliseconds from `now` to the next schedule boundary (4:00 or 20:00 local). */
export function msUntilNextThemeBoundary(now: Date): number {
  const next = new Date(now)
  next.setMinutes(0, 0, 0)
  const hour = now.getHours()
  if (hour < DARK_END_HOUR) {
    next.setHours(DARK_END_HOUR)
  } else if (hour < DARK_START_HOUR) {
    next.setHours(DARK_START_HOUR)
  } else {
    next.setDate(next.getDate() + 1)
    next.setHours(DARK_END_HOUR)
  }
  return Math.max(1, next.getTime() - now.getTime())
}
