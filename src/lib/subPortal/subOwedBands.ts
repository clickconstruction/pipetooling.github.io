import type { SubPortalLang } from './subPortalI18n'
import type { SubPortalSheet } from './subPortalPayload'

/**
 * The sub's *Owed to you* as rows under two bands, and the card's chip from the same rule (punch
 * list #217, field-2). Today the head's two caveat lines (`queuedNow` in `SubPortal.tsx`: every open
 * sheet whose payable-after is on or before the next run, at any stage) and the card's chip
 * (`isSubPortalSheetQueued`: stage *customer pay* and any payable-after, printing the run weekday
 * whatever the date) follow different rules, so a card can read *Queued for Friday* while its money
 * sits under *later*. This kernel is the one rule for both:
 *
 *   - a sheet with money open and a payable-after date on or before the next run is **in the next
 *     run**, whatever its stage (a progress payment promised mid-job is money on Friday too);
 *   - a sheet with a payable-after date after the next run, or with no next run on the calendar,
 *     is **later**, and its chip names its own day (*Queued for Dec 15*);
 *   - a sheet with money open and no date is **later** with no day: the stage sentence on its card
 *     says what stands between the sub and the money, and the chip stays the stage's.
 *
 * The rail's fourth dot keeps `subPortalRailStep`: the dots are the work's stages, and a promised
 * progress payment never jumps the rail ahead of the work. Pure: no React, no DOM.
 */

export type SubOwedSheet = Pick<SubPortalSheet, 'id' | 'jobNumber' | 'address' | 'stage' | 'open' | 'payableAfter'>

export type SubOwedBandKind = 'next_run' | 'later'

export type SubOwedPlace =
  | { band: 'next_run'; ymd: string }
  | { band: 'later'; ymd: string | null }
  | null

const YMD = /^\d{4}-\d{2}-\d{2}$/

function ymdOrNull(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  return YMD.test(t) ? t : null
}

/** Where one sheet's open money sits: the next run, later with or without a day, or nowhere (nothing open). */
export function subOwedPlace(sheet: Pick<SubOwedSheet, 'open' | 'payableAfter'>, nextRun: string | null): SubOwedPlace {
  if (!(sheet.open > 0.004)) return null
  const after = ymdOrNull(sheet.payableAfter)
  const run = ymdOrNull(nextRun)
  if (after && run && after <= run) return { band: 'next_run', ymd: run }
  return { band: 'later', ymd: after }
}

/** The card's chip from the same rule: the run's day, the sheet's own day, or none (the stage's chip stays). */
export type SubOwedChip = { kind: 'next_run'; ymd: string } | { kind: 'later'; ymd: string } | null

export function subOwedChip(sheet: Pick<SubOwedSheet, 'open' | 'payableAfter'>, nextRun: string | null): SubOwedChip {
  const place = subOwedPlace(sheet, nextRun)
  if (!place) return null
  if (place.band === 'next_run') return { kind: 'next_run', ymd: place.ymd }
  return place.ymd ? { kind: 'later', ymd: place.ymd } : null
}

export type SubOwedRow = {
  id: string
  /** *1321 Cedar Bend, building C* */
  jobWords: string
  amount: number
  /** The sheet's own payable-after day, for the Later band's line; null when it has none. */
  ymd: string | null
}

export type SubOwedBands = {
  total: number
  /** Null when no pay-run day is on the calendar; then everything is later. */
  nextRun: { ymd: string; rows: SubOwedRow[]; sum: number } | null
  later: { rows: SubOwedRow[]; sum: number }
  /** The head's total less the rows: money the server counts on no open sheet; 0 when they agree. */
  unplaced: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100

export function subOwedJobWords(sheet: Pick<SubOwedSheet, 'jobNumber' | 'address'>, fallback: string): string {
  const num = (sheet.jobNumber ?? '').trim()
  const addr = (sheet.address ?? '').trim()
  if (num && addr) return `${num} ${addr}`
  return num || addr || fallback
}

/** The head as its rows: the next run's band in payable-after order, then the later band, dated first and undated last. */
export function subOwedBands(sheets: ReadonlyArray<SubOwedSheet>, nextRun: string | null, totalOpen: number, fallbackJobWords = 'Work order'): SubOwedBands {
  const run = ymdOrNull(nextRun)
  const nextRows: Array<SubOwedRow & { sort: string }> = []
  const laterRows: Array<SubOwedRow & { sort: string }> = []
  for (const s of sheets) {
    const place = subOwedPlace(s, run)
    if (!place) continue
    const row = { id: s.id, jobWords: subOwedJobWords(s, fallbackJobWords), amount: round2(s.open), ymd: ymdOrNull(s.payableAfter), sort: `${ymdOrNull(s.payableAfter) ?? '9999-99-99'}|${s.jobNumber ?? ''}|${s.id}` }
    if (place.band === 'next_run') nextRows.push(row)
    else laterRows.push(row)
  }
  const byDay = (a: { sort: string }, b: { sort: string }) => a.sort.localeCompare(b.sort)
  nextRows.sort(byDay)
  laterRows.sort(byDay)
  const strip = ({ sort: _sort, ...row }: SubOwedRow & { sort: string }): SubOwedRow => row
  const next = nextRows.map(strip)
  const later = laterRows.map(strip)
  const nextSum = round2(next.reduce((s, r) => s + r.amount, 0))
  const laterSum = round2(later.reduce((s, r) => s + r.amount, 0))
  const total = round2(Math.max(0, totalOpen))
  return {
    total,
    nextRun: run ? { ymd: run, rows: next, sum: nextSum } : null,
    later: { rows: later, sum: laterSum },
    unplaced: round2(Math.max(0, total - nextSum - laterSum)),
  }
}

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** *Oct 31* / *31 oct*; with the weekday, *Fri Oct 31* / *vie 31 oct*. A day, never an instant. */
export function subOwedDayWords(ymd: string | null | undefined, lang: SubPortalLang, opts: { weekday?: boolean } = {}): string {
  const t = ymdOrNull(ymd)
  if (!t) return ''
  const m = Number(t.slice(5, 7))
  const d = Number(t.slice(8, 10))
  if (!(m >= 1 && m <= 12)) return ''
  const date = new Date(`${t}T12:00:00`)
  const wd = opts.weekday && !Number.isNaN(date.getTime()) ? (lang === 'es' ? WEEKDAY_ES : WEEKDAY_EN)[date.getDay()] ?? '' : ''
  const md = lang === 'es' ? `${d} ${MONTH_ES[m - 1]}` : `${MONTH_EN[m - 1]} ${d}`
  return wd ? `${wd} ${md}` : md
}

/** `?shape=1` on the portal draws the bands for anyone with the link; `?sbs=1` draws today's head over them (the sample token or a dev). */
export const SUB_OWED_SHAPE_PARAM = 'shape'
export type SubOwedView = 'today' | 'shape' | 'both'

/** The flag the office's own page carries, for *Show me on their portal* to pass along; null for neither. */
export function subOwedShapeFlagFromSearch(search: string): 'shape' | 'sbs' | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  if (q.get('sbs') === '1') return 'sbs'
  if (q.get(SUB_OWED_SHAPE_PARAM) === '1') return 'shape'
  return null
}

/** Appends `shape=1` or `sbs=1` to a portal URL, keeping any hash where it was. */
export function withSubOwedShape(url: string, flag: 'shape' | 'sbs' | null): string {
  if (!url || !flag) return url
  const hashAt = url.indexOf('#')
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url
  const hash = hashAt >= 0 ? url.slice(hashAt) : ''
  const pair = `${flag === 'sbs' ? 'sbs' : SUB_OWED_SHAPE_PARAM}=1`
  return `${base}${base.includes('?') ? '&' : '?'}${pair}${hash}`
}
