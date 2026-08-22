/**
 * Easter-egg targeting config (v2.2074) — pure parsing/matching for the
 * `easter_eggs_v1` app_settings key. Devs manage it from Settings → Easter
 * eggs; `EasterEggHost` reads it to decide who sees what, where. IO lives
 * with the callers; this module is testable without supabase.
 */

import { eggSurfaceMatches, normalizeEggSurfaces } from './easterEggSurfaceTree'

export type EasterEggConfig = {
  key: string
  enabled: boolean
  targetUserIds: string[]
  surfaces: string[]
}

/** One appearance roll per surface open. */
export const EASTER_EGG_APPEAR_ODDS = 1 / 15

/**
 * v2.2077: the first targeted-surface open of each company day is a guaranteed
 * visit (the daily debut); every later open that day rolls the 1-in-15 dice.
 * `lastDebutYmd` is the stored company-calendar day of the last debut.
 */
export function rollEggAppearance(
  lastDebutYmd: string | null,
  todayYmd: string,
  rand: () => number = Math.random,
): { appear: boolean; isDailyDebut: boolean } {
  if (todayYmd && lastDebutYmd !== todayYmd) return { appear: true, isDailyDebut: true }
  return { appear: rand() < EASTER_EGG_APPEAR_ODDS, isDailyDebut: false }
}

// Surfaces (v2.2082): any screen in the app, keyed per `easterEggSurfaceTree.ts`
// (`p:<path>` pages, `t:/bids:<tab>` Bids tabs; legacy `followup` normalizes).

/** The eggs that exist. Config rows are matched to these by key; unknown keys are dropped. */
export const EASTER_EGG_SPRITES: Record<string, { label: string; asset: string }> = {
  floaty: { label: 'Floaty', asset: '/easter-eggs/floaty.webp' },
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Tolerant parse of the app_settings JSON — garbage in, empty list out. */
export function parseEasterEggsSetting(text: string | null | undefined): EasterEggConfig[] {
  if (!text || !text.trim()) return []
  try {
    const parsed: unknown = JSON.parse(text)
    const eggs = (parsed as { eggs?: unknown })?.eggs
    if (!Array.isArray(eggs)) return []
    return eggs
      .filter((e): e is Record<string, unknown> => e != null && typeof e === 'object')
      .filter((e) => typeof e.key === 'string' && e.key in EASTER_EGG_SPRITES)
      .map((e) => ({
        key: e.key as string,
        enabled: e.enabled === true,
        targetUserIds: asStringArray(e.targetUserIds),
        surfaces: normalizeEggSurfaces(asStringArray(e.surfaces)),
      }))
  } catch {
    return []
  }
}

export function serializeEasterEggsSetting(eggs: EasterEggConfig[]): string {
  return JSON.stringify({ eggs })
}

/** True when this egg targets this user on this location. */
export function eggActiveFor(
  egg: EasterEggConfig,
  userId: string | null,
  pathname: string,
  tab: string | null,
): boolean {
  if (!egg.enabled || !userId) return false
  if (!egg.targetUserIds.includes(userId)) return false
  return egg.surfaces.some((s) => eggSurfaceMatches(s, pathname, tab))
}
