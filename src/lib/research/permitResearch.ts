/**
 * Research (punch list #292): the permit ledger's words and rules. A city's building permits come
 * from `research_permits` (migration 20261109070000) with the plumber pairing and the newest verdict
 * already on each row; this file reads them for the screen. Four verdicts, a reason on each, one
 * press per row. Pure: no React, no Supabase.
 */
import type { UserRole } from '../../hooks/useAuth'
import { isOfficeRole } from '../doorRoles'

/** Who researches: the office and every estimator, the same set `user_can_research_permits()` names. */
export function canResearchPermits(role: UserRole | null): boolean {
  return role != null && (isOfficeRole(role) || role === 'estimator')
}

/** The cities with a feed today; a city is one row of this list until a second feed lands. */
export const DEFAULT_RESEARCH_CITY = 'San Antonio'
export const RESEARCH_CITIES: readonly string[] = [DEFAULT_RESEARCH_CITY]

export type PermitVerdict = 'look' | 'approach' | 'not_for_us' | 'taken'
export const PERMIT_VERDICTS: readonly PermitVerdict[] = ['approach', 'look', 'not_for_us', 'taken']

export const VERDICT_WORDS: Record<PermitVerdict, { press: string; chip: string; hint: string }> = {
  approach: { press: 'Approach them', chip: 'Approached', hint: 'Call who pulled it. A GC lead is made on the GCs deck.' },
  look: { press: 'Look into it', chip: 'Look into it', hint: 'Worth a closer read. It waits on the list with a day to look again.' },
  not_for_us: { press: 'Not for us', chip: 'Not for us', hint: 'Wrong trade, wrong size or wrong part of town.' },
  taken: { press: 'Already taken', chip: 'Already taken', hint: 'A plumber has it. The row leaves the list.' },
}

export function isPermitVerdict(value: unknown): value is PermitVerdict {
  return value === 'look' || value === 'approach' || value === 'not_for_us' || value === 'taken'
}

/** One ledger row, as `research_permits` returns it. */
export type ResearchPermitRow = {
  id: string
  city: string
  source: string
  permit_number: string
  permit_type: string
  stage: 'applied' | 'issued'
  residential: boolean
  work_type: string | null
  project_name: string | null
  address: string | null
  zip: string | null
  lat: number | null
  lng: number | null
  submitted_on: string | null
  issued_on: string | null
  filed_on: string | null
  declared_value: number | null
  area_sf: number | null
  contact: string | null
  plumber: string | null
  plumber_permit_on: string | null
  verdict: PermitVerdict | null
  verdict_reason: string | null
  verdict_look_again_on: string | null
  verdict_prospect_id: string | null
  verdict_by: string | null
  verdict_by_name: string | null
  verdict_at: string | null
}

/** What the list shows: the rows waiting on a look are the default; the rest are lenses on the same rows. */
export type ResearchShowing = 'waiting' | 'look' | 'approach' | 'not_for_us' | 'taken' | 'all'
export const RESEARCH_SHOWING_WORDS: Record<ResearchShowing, string> = {
  waiting: 'Waiting on a look',
  look: 'Look into it',
  approach: 'Approached',
  not_for_us: 'Not for us',
  taken: 'Already have a plumber',
  all: 'Everything',
}

/** How far back the list reads. */
export type ResearchWindow = 14 | 30 | 90
export const RESEARCH_WINDOWS: readonly ResearchWindow[] = [14, 30, 90]
export function windowWords(days: ResearchWindow): string {
  return `Filed in the last ${days} days`
}

/** The day a window starts from, as YYYY-MM-DD. */
export function windowSinceYmd(todayYmd: string, days: ResearchWindow): string {
  return ymdPlusDays(todayYmd, -days)
}

/** A plumbing permit sits on the row's number or address: named when it names someone other than the applicant, else on file unnamed. */
export function plumbingOnFile(row: Pick<ResearchPermitRow, 'plumber' | 'plumber_permit_on'>): boolean {
  return row.plumber != null || row.plumber_permit_on != null
}

/** A row has a plumber when a plumbing permit sits on its number or address, or the office said so. */
export function rowHasPlumber(row: Pick<ResearchPermitRow, 'plumber' | 'plumber_permit_on' | 'verdict'>): boolean {
  return plumbingOnFile(row) || row.verdict === 'taken'
}

/** Which lens a row sits on: a row with no verdict and no plumbing permit waits; a plumbing permit on the feed is taken even with no verdict. */
export function rowLens(row: Pick<ResearchPermitRow, 'plumber' | 'plumber_permit_on' | 'verdict'>): Exclude<ResearchShowing, 'all'> {
  if (row.verdict) return row.verdict
  return plumbingOnFile(row) ? 'taken' : 'waiting'
}

/** The Plumber cell's words: the plumber's name, or the permit on file with no name, or none yet. */
export function plumberWords(row: Pick<ResearchPermitRow, 'plumber' | 'plumber_permit_on'>): { kind: 'named' | 'unnamed' | 'none'; chip: string; under: string | null } {
  if (row.plumber) return { kind: 'named', chip: row.plumber, under: `plumbing permit ${shortDay(row.plumber_permit_on)}` }
  if (row.plumber_permit_on) return { kind: 'unnamed', chip: 'on file, no plumber named', under: `pulled under the applicant's own name, ${shortDay(row.plumber_permit_on)}` }
  return { kind: 'none', chip: 'none yet', under: null }
}

export function rowsShowing(rows: readonly ResearchPermitRow[], showing: ResearchShowing): ResearchPermitRow[] {
  if (showing === 'all') return [...rows]
  return rows.filter((r) => rowLens(r) === showing)
}

/** The counts under the filters, by lens. */
export function lensCounts(rows: readonly ResearchPermitRow[]): Record<Exclude<ResearchShowing, 'all'>, number> {
  const out = { waiting: 0, look: 0, approach: 0, not_for_us: 0, taken: 0 }
  for (const r of rows) out[rowLens(r)]++
  return out
}

/** Rows filed after the day the reader last looked, for the New since you looked count. */
export function newSinceLooked(rows: readonly ResearchPermitRow[], lastLookedYmd: string | null): number {
  if (!lastLookedYmd) return rows.length
  return rows.filter((r) => (r.filed_on ?? '') > lastLookedYmd).length
}

const usd0 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/** "$1.4M", "$420k", "$9,500" — the declared value short enough for a cell. */
export function shortMoney(value: number | null): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`
  if (value >= 10_000) return `$${Math.round(value / 1000)}k`
  return usd0.format(value)
}

/** "6,200 sq ft" or null. */
export function sqFtWords(areaSf: number | null): string | null {
  if (areaSf == null || !Number.isFinite(areaSf) || areaSf < 50) return null
  return `${Math.round(areaSf).toLocaleString('en-US')} sq ft`
}

/** The Work cell: the kind, the size, then the money and the feed's project name on the second line. */
export function workWords(row: Pick<ResearchPermitRow, 'work_type' | 'area_sf' | 'declared_value' | 'project_name'>): { main: string; detail: string } {
  const main = [row.work_type ?? 'Permit', sqFtWords(row.area_sf)].filter(Boolean).join(' · ')
  const money = shortMoney(row.declared_value)
  const name = row.project_name && !/^Building No:/i.test(row.project_name) ? row.project_name : null
  const detail = [money ? `${money} declared` : 'value not declared', name].filter(Boolean).join(' · ')
  return { main, detail }
}

/** "Nov 8" from a YYYY-MM-DD. */
export function shortDay(ymd: string | null): string {
  if (!ymd) return '—'
  const d = new Date(`${ymd}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** The Pulled line: "Pulled 6:10 AM · 14 new since Thursday" and the lens counts. */
export function pulledWords(input: { ranAt: string | null; error: string | null; newCount: number; lastLookedYmd: string | null; counts: ReturnType<typeof lensCounts> }): string {
  const parts: string[] = []
  if (input.ranAt) {
    const when = new Date(input.ranAt)
    const sameDay = when.toDateString() === new Date().toDateString()
    const t = when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    parts.push(sameDay ? `Pulled ${t}` : `Pulled ${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${t}`)
    if (input.error) parts.push(`the last pull stopped: ${input.error}`)
  } else {
    parts.push('Not pulled yet')
  }
  parts.push(input.lastLookedYmd ? `${input.newCount} new since you looked` : `${input.newCount} filed in the window`)
  const c = input.counts
  parts.push(`${c.waiting} wait on a look`, `${c.approach} approached`, `${c.look} to look into`, `${c.not_for_us} not for us`, `${c.taken} already have a plumber`)
  return parts.join(' · ')
}

/** What the office may choose about the company on the permit when it makes the lead. */
export type PermitLeadRole = 'gc' | 'owner' | 'architect'
export const PERMIT_LEAD_ROLE_WORDS: Record<PermitLeadRole, string> = { gc: 'A GC', owner: 'The owner', architect: 'An architect or engineer' }

/** The GC lead and the job the Approach press makes from a permit. */
export function leadFromPermit(
  row: Pick<ResearchPermitRow, 'contact' | 'address' | 'city' | 'zip' | 'permit_number' | 'permit_type' | 'work_type' | 'area_sf' | 'declared_value' | 'project_name' | 'filed_on' | 'stage'>,
  role: PermitLeadRole,
  by: { userId: string; masterUserId: string },
): { prospect: Record<string, unknown>; job: Record<string, unknown>; companyName: string } {
  const companyName = (row.contact ?? '').trim() || 'Who pulled the permit'
  const address = [row.address, row.city, row.zip].filter(Boolean).join(', ')
  const work = workWords(row)
  const note = `From the permit ledger: ${row.permit_type} ${row.permit_number}, ${row.stage} ${row.filed_on ?? ''}. ${work.main}. ${work.detail}.`
  return {
    companyName,
    prospect: {
      kind: 'gc_lead',
      master_user_id: by.masterUserId,
      created_by: by.userId,
      warmth_count: 0,
      company_name: companyName,
      contact_name: null,
      address,
      notes: note,
      source: 'A permit',
      company_role: role,
      trades: [],
      max_miles: null,
    },
    job: {
      name: [work.main, row.address].filter(Boolean).join(' at '),
      address,
      sq_ft: row.area_sf != null && row.area_sf >= 50 ? Math.round(row.area_sf) : null,
      note,
      status: 'open',
    },
  }
}

/** The reason a verdict needs; empty words are refused before any write. */
export function verdictHold(reason: string): string | null {
  return reason.trim().length === 0 ? 'Say why in a line. The next estimator reads it.' : null
}

/** A day plus some days, as YYYY-MM-DD. */
export function ymdPlusDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The look-again default: two weeks out. */
export function defaultLookAgainYmd(todayYmd: string): string {
  return ymdPlusDays(todayYmd, 14)
}

/** The door into the GC lead a verdict made. */
export function leadDoor(prospectId: string): string {
  return `/prospects?tab=follow-up&kind=gc-leads&prospect_id=${encodeURIComponent(prospectId)}`
}

/** The last-looked mark, one per reader per city, in the browser. */
export function lastLookedKey(userId: string, city: string): string {
  return `research:lastLooked:${userId}:${city}`
}

/**
 * The names a permit's contact might be known by: the whole string and each comma part, as keys
 * the database's `research_name_key` makes (lower-case letters and digits, the LLC/Inc/Co suffixes
 * dropped). "Milton G. Ramirez, Synergy Construction, LLC" → the person, the company, and both.
 */
export function nameKey(name: string | null | undefined): string | null {
  const lowered = (name ?? '').toLowerCase()
  const stripped = lowered.replace(/\b(llc|l\.l\.c\.|inc|inc\.|co|co\.|corp|corp\.|ltd|ltd\.|llp|pllc|company|incorporated)\b/g, '')
  const key = stripped.replace(/[^a-z0-9]+/g, '')
  return key === '' ? null : key
}

export function contactKeys(contact: string | null | undefined): string[] {
  const raw = (contact ?? '').trim()
  if (raw === '') return []
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean)
  const keys = new Set<string>()
  const whole = nameKey(raw)
  if (whole) keys.add(whole)
  for (const p of parts) {
    const k = nameKey(p)
    if (k && k.length >= 3) keys.add(k)
  }
  return [...keys]
}

/** One row of `research_contact_history`. */
export type ContactHistory = { key: string; bids: number; won: number; last_bid_on: string | null; on_deck: boolean }

export type HintTone = 'warm' | 'cold' | 'new' | 'seen'
export type Hint = { tone: HintTone; word: string; detail: string }

/** The hint beside who pulled it, from every key the contact matched folded together. Never the verdict. */
export function hintFor(contact: string | null | undefined, history: ReadonlyMap<string, ContactHistory>): Hint {
  const keys = contactKeys(contact)
  let bids = 0
  let won = 0
  let onDeck = false
  let last: string | null = null
  const seenIds = new Set<string>()
  for (const k of keys) {
    const h = history.get(k)
    if (!h || seenIds.has(k)) continue
    seenIds.add(k)
    bids = Math.max(bids, h.bids)
    won = Math.max(won, h.won)
    onDeck = onDeck || h.on_deck
    if (h.last_bid_on && (!last || h.last_bid_on > last)) last = h.last_bid_on
  }
  const deck = onDeck ? ' · on the GCs deck' : ''
  if (won > 0) return { tone: 'warm', word: 'warm', detail: `we won ${won} of ${bids} bids with this name${deck}` }
  if (bids >= 3) return { tone: 'cold', word: 'cold', detail: `${bids} bids priced, nothing won${deck}` }
  if (bids > 0) return { tone: 'seen', word: 'seen', detail: `${bids} bid${bids === 1 ? '' : 's'} priced, none won yet${deck}` }
  if (onDeck) return { tone: 'seen', word: 'on the deck', detail: 'an open GC lead of this name is on the GCs deck' }
  return { tone: 'new', word: 'new name', detail: 'no bid to this name in our history' }
}

/** Who wins what: the plumbers the window's taken rows name, most first. */
export function plumberTally(rows: readonly ResearchPermitRow[], top = 8): Array<{ plumber: string; jobs: number }> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    if (!r.plumber) continue
    counts.set(r.plumber, (counts.get(r.plumber) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([plumber, jobs]) => ({ plumber, jobs }))
    .sort((a, b) => b.jobs - a.jobs || a.plumber.localeCompare(b.plumber))
    .slice(0, top)
}

/** A pin's fill by lens: the ledger's own four colours. */
export const LENS_PIN_COLOR: Record<Exclude<ResearchShowing, 'all'>, string> = {
  waiting: '#2563eb',
  look: '#1e40af',
  approach: '#16a34a',
  not_for_us: '#6b7280',
  taken: '#9ca3af',
}

/** The rows the map can place: a point on them, on the lens shown. */
export function researchPins(rows: readonly ResearchPermitRow[]): Array<{ id: string; lat: number; lng: number; color: string; title: string }> {
  const out: Array<{ id: string; lat: number; lng: number; color: string; title: string }> = []
  for (const r of rows) {
    if (r.lat == null || r.lng == null) continue
    out.push({ id: r.id, lat: r.lat, lng: r.lng, color: LENS_PIN_COLOR[rowLens(r)], title: `${r.address ?? r.permit_number} · ${workWords(r).main}` })
  }
  return out
}

/** The site in Google Maps, for the estimator's look before a call. */
export function mapsDoor(row: Pick<ResearchPermitRow, 'address' | 'city' | 'zip'>): string | null {
  if (!row.address) return null
  const q = [row.address, row.city, 'TX', row.zip].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** The declared-value floor: a small permit is noise on the estimator's list; one with no value declared stays, since remodels seldom declare one. */
export type ValueFloor = 0 | 25_000 | 100_000 | 500_000
export const VALUE_FLOORS: readonly ValueFloor[] = [0, 25_000, 100_000, 500_000]
export const DEFAULT_VALUE_FLOOR: ValueFloor = 25_000
export function valueFloorWords(floor: ValueFloor): string {
  if (floor === 0) return 'Any value'
  return `${shortMoney(floor)} and up, or not declared`
}
export function rowsAboveFloor(rows: readonly ResearchPermitRow[], floor: ValueFloor): ResearchPermitRow[] {
  if (floor === 0) return [...rows]
  return rows.filter((r) => r.declared_value == null || r.declared_value >= floor)
}
