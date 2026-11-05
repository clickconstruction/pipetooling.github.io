/**
 * Employment stints as the readers draw them (punch list #256 PR 5, v2.6526). `employment_stints`
 * (v2.6481) keeps every stretch a person worked; the roster row's pair is the current stint, so
 * tenure counts from the day back (the owner's call 1). This kernel turns the rows into the desk's
 * lines (every stint with the away gaps between), the one-line "before:" the HR and Employment tabs
 * add after the tenure, and the question the salary clamp asks: was this day inside any stint?
 */

import { awayWords, longDate } from './bringBack'

export type Stint = { start_date: string | null; end_date: string | null }

export type StintRow = {
  kind: 'stint' | 'away'
  from: string | null
  /** Null is the open stint: "present". */
  to: string | null
  /** "this stint", "2 years 8 months", "away 3 years". */
  words: string
  current: boolean
}

function parseYmd(ymd: string | null | undefined): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((ymd ?? '').trim())
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

function wholeMonths(fromYmd: string, toYmd: string): number | null {
  const a = parseYmd(fromYmd)
  const b = parseYmd(toYmd)
  if (!a || !b) return null
  let months = (b.y - a.y) * 12 + (b.m - a.m)
  if (b.d < a.d) months -= 1
  return months
}

/** The HR tab's tenure chip: "7m", "2y 8m"; empty for a missing or future start. */
export function tenureLabel(startYmd: string | null, todayYmd: string): string {
  if (!startYmd) return ''
  const [sy, sm] = startYmd.split('-').map(Number)
  const [ty, tm] = todayYmd.split('-').map(Number)
  if (!sy || !sm || !ty || !tm) return ''
  const months = (ty - sy) * 12 + (tm - sm)
  if (months < 0) return ''
  if (months < 12) return `${months}m`
  return `${Math.floor(months / 12)}y ${months % 12}m`
}

/** "2 years 8 months", "11 months", "under a month": the length of a closed stint. */
export function spanWords(fromYmd: string, toYmd: string): string {
  const months = wholeMonths(fromYmd, toYmd)
  if (months == null || months < 1) return 'under a month'
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts: string[] = []
  if (y > 0) parts.push(`${y} year${y === 1 ? '' : 's'}`)
  if (m > 0) parts.push(`${m} month${m === 1 ? '' : 's'}`)
  return parts.join(' ')
}

/** Oldest first, a stint with no start before any dated one. */
export function sortStints<T extends Stint>(stints: readonly T[]): T[] {
  return [...stints].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? '') || (a.end_date ?? '9999').localeCompare(b.end_date ?? '9999'))
}

function dayAfter(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function dayBefore(ymd: string): string {
  const d = new Date(ymd + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * The desk's Employment lines, newest first: the open stint as "this stint", each closed stint with its
 * length, and between two stints the away gap. One stint draws nothing: the pair's own line already says it.
 */
export function stintRows(stints: readonly Stint[], todayYmd: string): StintRow[] {
  const sorted = sortStints(stints).filter((s) => s.start_date || s.end_date)
  if (sorted.length < 2) return []
  const out: StintRow[] = []
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i]!
    const open = s.end_date == null
    out.push({
      kind: 'stint',
      from: s.start_date,
      to: s.end_date,
      words: open ? 'this stint' : s.start_date ? spanWords(s.start_date, s.end_date as string) : 'ended',
      current: i === sorted.length - 1,
    })
    const next = sorted[i + 1]
    if (next && s.end_date && next.start_date) {
      const gapFrom = dayAfter(s.end_date)
      const gapTo = dayBefore(next.start_date)
      if (gapTo >= gapFrom) out.push({ kind: 'away', from: gapFrom, to: gapTo, words: `away ${awayWords(s.end_date, next.start_date)}`, current: false })
    }
  }
  void todayYmd
  return out.reverse()
}

/** "Mar 4, 2024 → Nov 3, 2026" / "Nov 4, 2026 → present". */
export function stintRange(row: Pick<StintRow, 'from' | 'to'>): string {
  const from = row.from ? longDate(row.from) : 'no start date'
  const to = row.to ? longDate(row.to) : 'present'
  return `${from} → ${to}`
}

/** After the tenure on the HR and Employment tabs: "before: Mar 4, 2024 to Nov 3, 2026, and Jan 2, 2020 to Jun 30, 2021"; null with one stint. */
export function earlierStintsLine(stints: readonly Stint[]): string | null {
  const sorted = sortStints(stints).filter((s) => s.start_date || s.end_date)
  if (sorted.length < 2) return null
  const earlier = sorted.slice(0, -1).map((s) => `${s.start_date ? longDate(s.start_date) : '?'} to ${s.end_date ? longDate(s.end_date) : '?'}`)
  return `before: ${earlier.join(', and ')}`
}

/** The salary clamp's question: inside any stint (a stint with no start reaches back, no end reaches forward). */
export function inAnyStint(ymd: string, stints: readonly Stint[]): boolean {
  return stints.some((s) => (s.start_date == null || ymd >= s.start_date) && (s.end_date == null || ymd <= s.end_date))
}
