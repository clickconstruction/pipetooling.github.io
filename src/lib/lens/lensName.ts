/**
 * The name the lens gives a frame (punch list #194): `pipetooling-lens:` and a JSON config of who,
 * the state and the theme. A browser keeps a window's name through its reloads and its own links,
 * so a frame named once stays sealed. Pure.
 */
import { LENS_ROLES, type LensRole } from './lensPeople'

export const LENS_NAME_PREFIX = 'pipetooling-lens:'

export const LENS_MOODS = ['full', 'empty', 'loading', 'slow', 'error', 'offline', 'training'] as const
export type LensMood = (typeof LENS_MOODS)[number]

export type LensTheme = 'light' | 'dark'

export type LensConfig = {
  /** The role whose invented person the frame is signed in as. */
  as: LensRole
  mood: LensMood
  theme: LensTheme
  /** Makes two names unique, so a new tab opened from a frame is its own window. */
  n?: string
}

export function formatLensName(cfg: LensConfig): string {
  return LENS_NAME_PREFIX + JSON.stringify(cfg)
}

/** The frame's config, or null for every window the lens did not name. */
export function parseLensName(name: string | null | undefined): LensConfig | null {
  if (typeof name !== 'string' || !name.startsWith(LENS_NAME_PREFIX)) return null
  let raw: unknown
  try {
    raw = JSON.parse(name.slice(LENS_NAME_PREFIX.length))
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const as = LENS_ROLES.find((r) => r === o.as)
  if (!as) return null
  const mood = LENS_MOODS.find((m) => m === o.mood) ?? 'full'
  const theme: LensTheme = o.theme === 'dark' ? 'dark' : 'light'
  const cfg: LensConfig = { as, mood, theme }
  if (typeof o.n === 'string') cfg.n = o.n
  return cfg
}
