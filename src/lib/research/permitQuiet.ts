/**
 * Permits: is a city's own source still publishing? (v2.7880) The nightly pull can run clean and
 * bring nothing, night after night, when the city's public map has stopped: New Braunfels's ended
 * on 2026-11-03 and the tab read as current. This file takes a city's newest permit day and what
 * `permit_pulls` shows of its last run and answers fresh, quiet or ours. Each city has its own
 * allowance, because San Antonio publishes a week at a time. Pure: no React, no Supabase.
 */
import { shortDay } from './permitResearch'
import { daysBetween } from './permitSkim'

/** A city that publishes daily is quiet once its newest permit day is more than this many days back. The Monday after Thanksgiving reaches 5 or 6. */
export const QUIET_AFTER_DAYS = 7
/** San Antonio publishes a week at a time on the weekend, so its newest day sits up to 9 days back by design; 10 leaves one late day. */
const QUIET_AFTER_DAYS_BY_CITY: Readonly<Record<string, number>> = { 'San Antonio': 10 }
/** The cities with an allowance of their own, for the test that holds each to the list the pull reads. */
export const CITIES_WITH_OWN_ALLOWANCE: readonly string[] = Object.keys(QUIET_AFTER_DAYS_BY_CITY)

/** How many days back a city's newest permit day may sit before the city reads as quiet. */
export function quietAfterDays(city: string): number {
  return QUIET_AFTER_DAYS_BY_CITY[city] ?? QUIET_AFTER_DAYS
}

/** The newest of the days a city's permits carry. A day after today is a city's typing slip and is never the newest. */
export function newestPermitDay(days: ReadonlyArray<string | null | undefined>, todayYmd: string): string | null {
  let newest: string | null = null
  for (const day of days) {
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayYmd) continue
    if (!newest || day > newest) newest = day
  }
  return newest
}

/** A city's last pull, as `loadLatestPull` folds it: the newest run's time and the first error among its feeds. */
export type CityPull = { ranAt: string | null; error: string | null }

/**
 * - `fresh`: the newest permit day is inside the city's allowance.
 * - `quiet`: it is past the allowance and our pull ran clean inside two days, so the silence is the city's.
 * - `ours`: it is past the allowance, and our pull stopped, never ran, has not run for two days or could not be read. The city's silence is not proven, and the Pulled line says what stopped.
 * - `unknown`: no permit day was read.
 */
export type CityQuiet = { state: 'fresh' | 'quiet' | 'ours' | 'unknown'; newestDay: string | null; daysBack: number | null }

/** A pull older than this cannot vouch for the city: the nightly run is a day apart. */
const PULL_VOUCHES_MS = 48 * 60 * 60 * 1000

export function cityQuiet(input: { city: string; newestDay: string | null; todayYmd: string; pull: CityPull | null; nowMs: number }): CityQuiet {
  const daysBack = daysBetween(input.newestDay, input.todayYmd)
  if (!input.newestDay || daysBack == null) return { state: 'unknown', newestDay: null, daysBack: null }
  const base = { newestDay: input.newestDay, daysBack }
  if (daysBack <= quietAfterDays(input.city)) return { state: 'fresh', ...base }
  const ranMs = input.pull?.ranAt ? Date.parse(input.pull.ranAt) : Number.NaN
  const vouches = input.pull != null && !input.pull.error && Number.isFinite(ranMs) && input.nowMs - ranMs <= PULL_VOUCHES_MS
  return { state: vouches ? 'quiet' : 'ours', ...base }
}

/**
 * A city's row in the picker: "Seguin · newest Nov 17", or "New Braunfels · quiet since Nov 3".
 * Before its day is read the row is the city's name alone. `short` is the phone's chip, which
 * names the day only for a quiet city so the chip stays narrow.
 */
export function cityPickerWords(city: string, quiet: CityQuiet | null | undefined, todayYmd: string, short = false): string {
  if (!quiet || quiet.state === 'unknown' || !quiet.newestDay) return city
  if (quiet.state === 'quiet') return `${city} · quiet since ${shortDay(quiet.newestDay, todayYmd)}`
  return short ? city : `${city} · newest ${shortDay(quiet.newestDay, todayYmd)}`
}

/** What the picker says on hover about the city on screen. */
export function cityPickerTitle(city: string, quiet: CityQuiet | null | undefined, todayYmd: string): string {
  if (quiet?.state === 'quiet' && quiet.newestDay) return `${city} has published nothing since ${shortDay(quiet.newestDay, todayYmd)}. Our pull ran and found nothing newer.`
  return 'Each city with its newest permit day'
}

/** Whether any city reads as quiet: the phone's chip widens for the longer words. */
export function isQuiet(quiet: CityQuiet | null | undefined): boolean {
  return quiet?.state === 'quiet'
}
