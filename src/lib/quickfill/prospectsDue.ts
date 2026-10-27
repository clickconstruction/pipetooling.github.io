/**
 * Prospects past their day (punch list #180, PR 3). The station's count read 268 at every one of its
 * marks for eight weeks: every active prospect, so it measured nothing, and the banner's question,
 * *did every prospect hear from us on time*, was answered by nobody. The thing itself is already in
 * the table: each prospect's `last_contact` (any touch: a call, a note, an email) and `warmth_count`,
 * and the callbacks the office promised (`prospect_callbacks.callback_date`). A prospect is **missed**
 * when a promised callback is past and nothing has touched them since, **past** when its last touch
 * (or, never touched, its arrival) is older than the days for its warmth, the owner's numbers, and
 * **on time** otherwise. The count is missed plus past, the Next line names the first, the
 * since-last-look line says what moved, and the Mark's note is written from the rows. Pure.
 */

export const PROSPECT_DAYS_SETTING_KEY = 'quickfill_prospect_days_v1'
export const PROSPECT_CALLBACK_LOOKBACK_DAYS = 90
export const PROSPECT_DAYS_MIN = 1
export const PROSPECT_DAYS_MAX = 365

/** How long a prospect may go without a touch at each warmth; 4 and up follow warmth 3. */
export type ProspectDays = { w3: number; w2: number; w1: number; w0: number }
export const PROSPECT_DAYS_DEFAULT: ProspectDays = { w3: 7, w2: 14, w1: 30, w0: 60 }

/** The setting as `app_settings.value_text` holds it: JSON `{ "w3": 7, "w2": 14, "w1": 30, "w0": 60 }`; a missing or bad field keeps its default. */
export function parseProspectDays(valueText: string | null | undefined): ProspectDays {
  const out: ProspectDays = { ...PROSPECT_DAYS_DEFAULT }
  if (!valueText) return out
  try {
    const raw = JSON.parse(valueText) as unknown
    if (raw == null || typeof raw !== 'object') return out
    for (const k of ['w3', 'w2', 'w1', 'w0'] as const) {
      const v = (raw as Record<string, unknown>)[k]
      const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
      if (Number.isFinite(n) && n >= PROSPECT_DAYS_MIN && n <= PROSPECT_DAYS_MAX) out[k] = Math.round(n)
    }
    return out
  } catch {
    return out
  }
}

export function serializeProspectDays(days: ProspectDays): string {
  return JSON.stringify({ w3: days.w3, w2: days.w2, w1: days.w1, w0: days.w0 })
}

export function daysForWarmth(days: ProspectDays, warmth: number | null | undefined): number {
  const w = warmth ?? 0
  if (w >= 3) return days.w3
  if (w === 2) return days.w2
  if (w === 1) return days.w1
  return days.w0
}

export type DueProspect = {
  id: string
  company_name: string | null
  contact_name: string | null
  warmth_count: number | null
  last_contact: string | null
  created_at: string | null
  prospect_fit_status: string | null
  converted_customer_id: string | null
}

export type DueCallback = { prospect_id: string; callback_date: string; title: string | null }

export type ProspectDueState = 'missed' | 'past' | 'ontime'

export type ProspectDueRow = {
  prospect: DueProspect
  state: ProspectDueState
  /** "Westlake Custom Homes · Dana Whitfield" */
  name: string
  warmth: number
  /** The days for this prospect's warmth. */
  dueDays: number
  /** Days since the last touch, or since it was added when never touched. */
  sinceDays: number | null
  neverTouched: boolean
  /** How many days past the day: past a callback, or past the due days. 0 on time. */
  overDays: number
  /** The missed callback, newest first when several. */
  callback: DueCallback | null
  /** The Last touch column's words. */
  words: string
}

export type ProspectDueInput = {
  prospects: ReadonlyArray<DueProspect>
  callbacks: ReadonlyArray<DueCallback>
  nowIso: string
  days: ProspectDays
}

const DAY_MS = 86_400_000

function daysBetween(fromIso: string | null, toIso: string): number | null {
  if (!fromIso) return null
  const a = Date.parse(fromIso)
  const b = Date.parse(toIso)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return Math.max(0, Math.floor((b - a) / DAY_MS))
}

function dayWords(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/** Active: not marked can't reach or not a fit, and not converted into a customer. */
export function isActiveProspect(p: Pick<DueProspect, 'prospect_fit_status' | 'converted_customer_id'>): boolean {
  return p.prospect_fit_status !== 'cant_reach' && p.prospect_fit_status !== 'not_a_fit' && p.prospect_fit_status !== 'converted' && !p.converted_customer_id
}

export function prospectName(p: Pick<DueProspect, 'company_name' | 'contact_name'>): string {
  const company = (p.company_name ?? '').trim()
  const contact = (p.contact_name ?? '').trim()
  if (company && contact && company.toLowerCase() !== contact.toLowerCase()) return `${company} · ${contact}`
  return company || contact || 'Unknown prospect'
}

/** The rows for the active prospects: missed first, most over first; then past; then on time. */
export function prospectDueRows(input: ProspectDueInput): ProspectDueRow[] {
  const byProspect = new Map<string, DueCallback[]>()
  for (const c of input.callbacks) {
    const arr = byProspect.get(c.prospect_id) ?? []
    arr.push(c)
    byProspect.set(c.prospect_id, arr)
  }
  const rows: ProspectDueRow[] = []
  for (const p of input.prospects) {
    if (!isActiveProspect(p)) continue
    const warmth = p.warmth_count ?? 0
    const dueDays = daysForWarmth(input.days, warmth)
    const neverTouched = !p.last_contact
    const sinceDays = daysBetween(p.last_contact ?? p.created_at, input.nowIso)
    // A callback is missed when its day is past and nothing has touched the prospect since it.
    const missed = (byProspect.get(p.id) ?? [])
      .filter((c) => c.callback_date <= input.nowIso && (!p.last_contact || p.last_contact < c.callback_date))
      .sort((a, b) => b.callback_date.localeCompare(a.callback_date))
    const callback = missed[0] ?? null
    let state: ProspectDueState
    let overDays = 0
    let words: string
    const touch = neverTouched ? (sinceDays == null ? 'never touched' : `never touched · added ${sinceDays}d ago`) : `last touch ${sinceDays}d ago`
    if (callback) {
      state = 'missed'
      overDays = daysBetween(callback.callback_date, input.nowIso) ?? 0
      words = `promised ${dayWords(callback.callback_date)} · ${overDays} ${plural(overDays, 'day', 'days')} over · ${touch}`
    } else if (sinceDays != null && sinceDays > dueDays) {
      state = 'past'
      overDays = sinceDays - dueDays
      words = `${touch} · due every ${dueDays} days · ${overDays} ${plural(overDays, 'day', 'days')} over`
    } else {
      state = 'ontime'
      words = sinceDays == null ? touch : `${touch} · due every ${dueDays} days`
    }
    rows.push({ prospect: p, state, name: prospectName(p), warmth, dueDays, sinceDays, neverTouched, overDays, callback, words })
  }
  const order: Record<ProspectDueState, number> = { missed: 0, past: 1, ontime: 2 }
  return rows.sort((a, b) => order[a.state] - order[b.state] || b.overDays - a.overDays || b.warmth - a.warmth || a.name.localeCompare(b.name))
}

export type ProspectDueCounts = { missed: number; past: number; ontime: number; total: number; due: number }

export function prospectDueCounts(rows: ReadonlyArray<ProspectDueRow>): ProspectDueCounts {
  const c = { missed: 0, past: 0, ontime: 0 }
  for (const r of rows) c[r.state]++
  return { ...c, total: rows.length, due: c.missed + c.past }
}

/** The first prospect past its day and the verb. Null when every prospect is on time. */
export function prospectsNextLine(rows: ReadonlyArray<ProspectDueRow>): string | null {
  const r = rows.find((x) => x.state !== 'ontime')
  if (!r) return null
  if (r.state === 'missed' && r.callback) return `Call ${r.name} · promised ${dayWords(r.callback.callback_date)} · ${r.overDays} ${plural(r.overDays, 'day', 'days')} over`
  return `Call ${r.name} · warm ${r.warmth} · ${r.neverTouched ? 'never touched' : `${r.sinceDays}d since the last touch`} · ${r.overDays} ${plural(r.overDays, 'day', 'days')} over`
}

export type ProspectsSince = { newPast: number; touchedSince: number; words: string }

/** What moved since the last look: prospects that crossed past their day since, and prospects touched since. Null without a last look. */
export function prospectsSince(rows: ReadonlyArray<ProspectDueRow>, sinceIso: string | null, nowIso: string, whenWords: (iso: string) => string): ProspectsSince | null {
  if (!sinceIso) return null
  const daysSince = daysBetween(sinceIso, nowIso) ?? 0
  let newPast = 0
  let touchedSince = 0
  for (const r of rows) {
    if (r.state !== 'ontime' && r.overDays < daysSince + 1) newPast++
    if (r.prospect.last_contact && r.prospect.last_contact > sinceIso) touchedSince++
  }
  return { newPast, touchedSince, words: `Since the last look, ${whenWords(sinceIso)}` }
}

/** What the Mark saves when nobody typed. Null with no rows. */
export function prospectsMarkNote(rows: ReadonlyArray<ProspectDueRow>, days: ProspectDays, since: ProspectsSince | null): string | null {
  if (rows.length === 0) return null
  const c = prospectDueCounts(rows)
  const parts = [`${c.due} past their day`, `${c.missed} promised and missed`]
  const first = rows.find((r) => r.state !== 'ontime')
  if (first) parts.push(`oldest ${first.overDays}d over (${first.name}, warm ${first.warmth})`)
  parts.push(`${c.ontime} on time of ${c.total}`, `days per warmth ${days.w3} · ${days.w2} · ${days.w1} · ${days.w0}`)
  if (since) parts.push(`+${since.newPast} new past, ${since.touchedSince} touched since the last look`)
  return parts.join(' · ')
}
