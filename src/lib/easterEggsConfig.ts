/**
 * Easter-egg targeting config (v2.2074) — pure parsing/matching for the
 * `easter_eggs_v1` app_settings key. Devs manage it from Settings → Easter
 * eggs; `EasterEggHost` reads it to decide who sees what, where. IO lives
 * with the callers; this module is testable without supabase.
 *
 * v2.3282: every number that used to be hard-coded is now per-egg config —
 * the visit (`tuning`: odds, play seconds, flee speed) and the ring game
 * (`catch`: hold, shots, sling power, gravity, aim preview, ring width).
 * Old rows without those blocks parse to the defaults, so nothing changes
 * for a config saved before this version until a dev moves a slider.
 */

import { eggSurfaceMatches, normalizeEggSurfaces } from './easterEggSurfaceTree'

/** The visit itself: how often, how long, how hard to catch. */
export type EasterEggTuning = {
  /** After the daily debut, each targeted-screen open appears 1-in-N. */
  oddsOneIn: number
  /** Seconds Floaty plays before drifting off (7 was the original spec). */
  playSec: number
  /** Multiplier on the kernel's flee acceleration + speed cap; 1 = the v2.2074 feel. */
  fleeScale: number
  /**
   * He gets faster through the day: this much is added to `fleeScale` by the
   * end of the company work window (6am → 6pm), rising linearly from 6am and
   * resetting every new day. 0 = steady all day.
   */
  fleeRampPerDay: number
}

/** The ring game (v2.3282): catch him, a ring appears, slingshot him through it. */
export type EasterEggCatch = {
  enabled: boolean
  /** Seconds he stays caught (waiting to be shot) before wriggling free. */
  holdSec: number
  /** Shots per catch; a miss brings him back until these run out. */
  shots: number
  /** Launch speed per pixel of pull (px/s per px). */
  power: number
  /** Gravity in px/s². */
  gravity: number
  /** How much of the flight path the dotted arc previews, in seconds; 0 = no arc. */
  aimPreviewSec: number
  /** Ring size multiplier (1 = 160px between the two collision points). */
  ringScale: number
}

export type EasterEggConfig = {
  key: string
  enabled: boolean
  targetUserIds: string[]
  surfaces: string[]
  tuning: EasterEggTuning
  catch: EasterEggCatch
}

/** One appearance roll per surface open (the v2.2079 default; per-egg since v2.3282). */
export const EASTER_EGG_APPEAR_ODDS = 1 / 15

/** Owner-tuned defaults from the 2026-09-11 prototype session. */
export const EASTER_EGG_TUNING_DEFAULTS: EasterEggTuning = { oddsOneIn: 15, playSec: 7, fleeScale: 0.7, fleeRampPerDay: 0.3 }
export const EASTER_EGG_CATCH_DEFAULTS: EasterEggCatch = {
  enabled: true,
  holdSec: 20,
  shots: 1,
  power: 9,
  gravity: 1500,
  aimPreviewSec: 0.8,
  ringScale: 1,
}

export type EasterEggKnob = {
  group: 'tuning' | 'catch'
  key: keyof EasterEggTuning | Exclude<keyof EasterEggCatch, 'enabled'>
  label: string
  min: number
  max: number
  step: number
  format: (v: number) => string
}

/** The sliders Settings renders, with the ranges parse clamps to. One list, one truth. */
export const EASTER_EGG_KNOBS: readonly EasterEggKnob[] = [
  { group: 'tuning', key: 'oddsOneIn', label: 'Appears 1 in', min: 1, max: 50, step: 1, format: (v) => (v === 1 ? 'every open' : String(v)) },
  { group: 'tuning', key: 'playSec', label: 'Plays for', min: 3, max: 30, step: 1, format: (v) => `${v}s` },
  { group: 'tuning', key: 'fleeScale', label: 'Flee speed', min: 0.3, max: 1, step: 0.05, format: (v) => `${v.toFixed(2)}×` },
  { group: 'tuning', key: 'fleeRampPerDay', label: 'Faster through the day', min: 0, max: 1, step: 0.05, format: (v) => (v === 0 ? 'steady' : `+${v.toFixed(2)}× by 6pm`) },
  { group: 'catch', key: 'holdSec', label: 'Holds after catch', min: 5, max: 60, step: 1, format: (v) => `${v}s` },
  { group: 'catch', key: 'shots', label: 'Shots per catch', min: 1, max: 5, step: 1, format: (v) => String(v) },
  { group: 'catch', key: 'power', label: 'Sling power', min: 5, max: 14, step: 0.5, format: (v) => v.toFixed(1) },
  { group: 'catch', key: 'gravity', label: 'Gravity', min: 600, max: 2600, step: 50, format: (v) => String(v) },
  { group: 'catch', key: 'aimPreviewSec', label: 'Aim preview', min: 0, max: 1.6, step: 0.1, format: (v) => (v === 0 ? 'none' : `${v.toFixed(1)}s`) },
  { group: 'catch', key: 'ringScale', label: 'Ring width', min: 0.7, max: 1.4, step: 0.05, format: (v) => `${v.toFixed(2)}×` },
]

/**
 * v2.2077: the first targeted-surface open of each company day is a guaranteed
 * visit (the daily debut); every later open that day rolls the dice.
 * `lastDebutYmd` is the stored company-calendar day of the last debut.
 * `odds` is the per-egg probability (v2.3282); the default is the old 1-in-15.
 */
export function rollEggAppearance(
  lastDebutYmd: string | null,
  todayYmd: string,
  rand: () => number = Math.random,
  odds: number = EASTER_EGG_APPEAR_ODDS,
): { appear: boolean; isDailyDebut: boolean } {
  if (todayYmd && lastDebutYmd !== todayYmd) return { appear: true, isDailyDebut: true }
  return { appear: rand() < odds, isDailyDebut: false }
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

function knobFor(key: EasterEggKnob['key']): EasterEggKnob {
  return EASTER_EGG_KNOBS.find((k) => k.key === key)!
}

/** A finite number inside the knob's range, snapped to its step; anything else → the default. */
export function clampKnob(key: EasterEggKnob['key'], v: unknown, fallback: number): number {
  const k = knobFor(key)
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  const clamped = Math.min(k.max, Math.max(k.min, v))
  const snapped = Math.round((clamped - k.min) / k.step) * k.step + k.min
  return Number(snapped.toFixed(4))
}

function parseTuning(v: unknown): EasterEggTuning {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const d = EASTER_EGG_TUNING_DEFAULTS
  return {
    oddsOneIn: clampKnob('oddsOneIn', o.oddsOneIn, d.oddsOneIn),
    playSec: clampKnob('playSec', o.playSec, d.playSec),
    fleeScale: clampKnob('fleeScale', o.fleeScale, d.fleeScale),
    fleeRampPerDay: clampKnob('fleeRampPerDay', o.fleeRampPerDay, d.fleeRampPerDay),
  }
}

/** The company work window the day-ramp runs across (minutes into the company day). */
export const EGG_RAMP_START_MIN = 6 * 60
export const EGG_RAMP_END_MIN = 18 * 60
/** Hard ceiling on the effective flee multiplier, whatever the sliders say. */
export const EGG_FLEE_MAX = 1.8

/**
 * v2.3282: his flee speed for this visit — the base slider plus the day ramp,
 * linear from 6am (nothing added) to 6pm (all of `fleeRampPerDay` added),
 * flat outside that window. A new company day starts him slow again.
 */
export function fleeScaleAtMinute(tuning: Pick<EasterEggTuning, 'fleeScale' | 'fleeRampPerDay'>, minutesIntoDay: number): number {
  const span = EGG_RAMP_END_MIN - EGG_RAMP_START_MIN
  const progress = Math.min(1, Math.max(0, (minutesIntoDay - EGG_RAMP_START_MIN) / span))
  return Math.min(EGG_FLEE_MAX, tuning.fleeScale + tuning.fleeRampPerDay * progress)
}

function parseCatch(v: unknown): EasterEggCatch {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const d = EASTER_EGG_CATCH_DEFAULTS
  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : d.enabled,
    holdSec: clampKnob('holdSec', o.holdSec, d.holdSec),
    shots: clampKnob('shots', o.shots, d.shots),
    power: clampKnob('power', o.power, d.power),
    gravity: clampKnob('gravity', o.gravity, d.gravity),
    aimPreviewSec: clampKnob('aimPreviewSec', o.aimPreviewSec, d.aimPreviewSec),
    ringScale: clampKnob('ringScale', o.ringScale, d.ringScale),
  }
}

/** A config row with every block filled in — what a fresh egg card starts from. */
export function defaultEasterEggConfig(key: string): EasterEggConfig {
  return { key, enabled: false, targetUserIds: [], surfaces: [], tuning: { ...EASTER_EGG_TUNING_DEFAULTS }, catch: { ...EASTER_EGG_CATCH_DEFAULTS } }
}

/** Tolerant parse of the app_settings JSON — garbage in, empty list out; missing blocks → defaults. */
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
        tuning: parseTuning(e.tuning),
        catch: parseCatch(e.catch),
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
