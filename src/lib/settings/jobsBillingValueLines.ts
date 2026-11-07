/**
 * The live value on a folded Billing and money card (punch list #261, PR 3; call 4, the owner's answer 2026-11-07):
 * each of the seven cards under the heading turns what it stores into one short line the fold header draws in place
 * of the static one while the card is folded — *$285 master with a helper · $185 a tech alone*, *18% over cost*,
 * *On*, *6 days before bill day*. The page reads the same `app_settings` keys each card reads (one select for the
 * cards the role sees) and the Job Book's line count, hands the rows here, and reads again when a card folds, so a
 * value saved inside the card is on its row the moment the card closes. Nothing here writes.
 */
import { APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME, APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY } from '../appSettingsKeys'
import { CREW_SHAPES, CREW_SHAPE_LOWER, MATERIALS_MARKUP_PCT_KEY, RATE_CARD_KEYS, rateCardFromSettings, type CrewShape } from '../charges/rateCard'
import { BILL_DAY_CUTOFF_KEY, cutoffOf } from '../gc/billDay/billDayIo'
import { GC_CARD_BILL_SETTING_KEY, gcCardBillOn } from '../../../supabase/functions/_shared/gcCardBill'
import type { JobsBillingSlug } from './jobsBillingGroups'

/** The default labor rate's row (`useSettingsJobsAdmin` reads and writes it by this key). */
export const DEFAULT_LABOR_RATE_KEY = 'default_labor_rate'

/** The cards that show a live value: the seven under Billing and money. */
export type JobsBillingValueSlug = 'rates' | 'markup' | 'trip-charges' | 'labor-rate' | 'job-book' | 'gc-card' | 'gc-cutoff'
export const JOBS_BILLING_VALUE_SLUGS: readonly JobsBillingValueSlug[] = ['rates', 'markup', 'trip-charges', 'labor-rate', 'job-book', 'gc-card', 'gc-cutoff']

/** The `app_settings` keys each card reads; the Job Book reads a table instead. */
export const JOBS_BILLING_VALUE_KEYS: Readonly<Record<JobsBillingValueSlug, readonly string[]>> = {
  rates: CREW_SHAPES.map((s) => RATE_CARD_KEYS[s]),
  markup: [MATERIALS_MARKUP_PCT_KEY],
  'trip-charges': [APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME, APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY],
  'labor-rate': [DEFAULT_LABOR_RATE_KEY],
  'job-book': [],
  'gc-card': [GC_CARD_BILL_SETTING_KEY],
  'gc-cutoff': [BILL_DAY_CUTOFF_KEY],
}

export function isJobsBillingValueSlug(slug: string): slug is JobsBillingValueSlug {
  return (JOBS_BILLING_VALUE_SLUGS as readonly string[]).includes(slug)
}

/** Pure: the keys one select reads for these cards, each once, in card order. */
export function jobsBillingValueKeysFor(slugs: ReadonlyArray<string>): string[] {
  const out: string[] = []
  for (const s of JOBS_BILLING_VALUE_SLUGS) {
    if (!slugs.includes(s)) continue
    for (const k of JOBS_BILLING_VALUE_KEYS[s]) if (!out.includes(k)) out.push(k)
  }
  return out
}

/** An `app_settings` row as the select returns it. */
export interface AppSettingValueRow {
  key: string
  value_num?: unknown
  value_text?: string | null
}

export interface JobsBillingValues {
  settings: ReadonlyArray<AppSettingValueRow>
  /** The Job Book's line count; null when it was not read (the role does not see the card, or the read failed). */
  jobBookLines: number | null
}

export type JobsBillingValueLines = Partial<Record<JobsBillingSlug, string>>

/** `$285`, `$92.50`, `$1,250`: whole dollars bare, cents only when there are some. */
export function moneyWords(n: number): string {
  const cents = Math.round(n * 100)
  const whole = cents % 100 === 0
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`
}

function numOf(rows: ReadonlyArray<AppSettingValueRow>, key: string): number | null {
  const r = rows.find((x) => x.key === key)
  if (!r) return null
  const v = r.value_num
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

/** The two rows the owner reads first; when either is blank the first rows set, in the card's order, stand in. */
const HEADLINE_SHAPES: readonly CrewShape[] = ['master_helper', 'tech_alone']

/** `$285 master with a helper · $185 a tech alone`; `No rate set yet` when the card is blank. */
export function ratesValueLine(rows: ReadonlyArray<AppSettingValueRow>): string {
  const card = rateCardFromSettings(rows.map((r) => ({ key: r.key, value_num: r.value_num })))
  const set = CREW_SHAPES.filter((s) => card.rates[s] != null)
  if (set.length === 0) return 'No rate set yet'
  const headline = HEADLINE_SHAPES.filter((s) => card.rates[s] != null)
  const shown = headline.length === 2 ? headline : [...headline, ...set.filter((s) => !headline.includes(s))].slice(0, 2)
  return shown.map((s) => `${moneyWords(card.rates[s]!)} ${CREW_SHAPE_LOWER[s]}`).join(' · ')
}

/** `18% over cost`; `At cost, no markup set` while blank (a charges paper then carries materials at cost). */
export function markupValueLine(rows: ReadonlyArray<AppSettingValueRow>): string {
  const n = numOf(rows, MATERIALS_MARKUP_PCT_KEY)
  if (n == null || n < 0) return 'At cost, no markup set'
  return `${Number(n.toFixed(2)).toLocaleString('en-US')}% over cost`
}

/** `$95 client not home · $75 site not ready`; a blank amount is left out; `No amount set` when both are. */
export function tripChargesValueLine(rows: ReadonlyArray<AppSettingValueRow>): string {
  const parts: string[] = []
  const home = numOf(rows, APP_SETTINGS_KEY_TRIP_CHARGE_CLIENT_NOT_HOME)
  const site = numOf(rows, APP_SETTINGS_KEY_TRIP_CHARGE_SITE_NOT_READY)
  if (home != null && home > 0) parts.push(`${moneyWords(home)} client not home`)
  if (site != null && site > 0) parts.push(`${moneyWords(site)} site not ready`)
  return parts.length ? parts.join(' · ') : 'No amount set'
}

/** `$75 an hour`; `No default` while blank (the office types the rate on each new labor job). */
export function laborRateValueLine(rows: ReadonlyArray<AppSettingValueRow>): string {
  const n = numOf(rows, DEFAULT_LABOR_RATE_KEY)
  return n != null && n > 0 ? `${moneyWords(n)} an hour` : 'No default'
}

/** `14 line items`, `1 line item`, `No line items yet`. */
export function jobBookValueLine(lines: number): string {
  if (lines <= 0) return 'No line items yet'
  return `${lines.toLocaleString('en-US')} line ${lines === 1 ? 'item' : 'items'}`
}

/** `On` or `Off`, as the switch reads its row: only 'true' is on. */
export function gcCardValueLine(rows: ReadonlyArray<AppSettingValueRow>): string {
  return gcCardBillOn(rows.find((r) => r.key === GC_CARD_BILL_SETTING_KEY)?.value_text ?? null) ? 'On' : 'Off'
}

/** `6 days before bill day`; a missing row reads the default, as Bill day does. */
export function gcCutoffValueLine(rows: ReadonlyArray<AppSettingValueRow>): string {
  const r = rows.find((x) => x.key === BILL_DAY_CUTOFF_KEY)
  const v = r?.value_num
  const days = cutoffOf(typeof v === 'number' || typeof v === 'string' ? v : null)
  return `${days} days before bill day`
}

/**
 * Pure: one line per card from what was read, for the cards named (every money card by default). A card whose
 * read is not in hand gets no line, and the fold header keeps the static one.
 */
export function jobsBillingValueLines(values: JobsBillingValues, slugs: ReadonlyArray<string> = JOBS_BILLING_VALUE_SLUGS): JobsBillingValueLines {
  const out: JobsBillingValueLines = {}
  const rows = values.settings
  for (const s of JOBS_BILLING_VALUE_SLUGS) {
    if (!slugs.includes(s)) continue
    switch (s) {
      case 'rates':
        out.rates = ratesValueLine(rows)
        break
      case 'markup':
        out.markup = markupValueLine(rows)
        break
      case 'trip-charges':
        out['trip-charges'] = tripChargesValueLine(rows)
        break
      case 'labor-rate':
        out['labor-rate'] = laborRateValueLine(rows)
        break
      case 'job-book':
        if (values.jobBookLines != null) out['job-book'] = jobBookValueLine(values.jobBookLines)
        break
      case 'gc-card':
        out['gc-card'] = gcCardValueLine(rows)
        break
      case 'gc-cutoff':
        out['gc-cutoff'] = gcCutoffValueLine(rows)
        break
    }
  }
  return out
}
