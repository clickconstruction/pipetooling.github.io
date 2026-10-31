/**
 * Cases on the county map (punch list #144, PR 1b, v2.5758): the Legal desk's Collections
 * accounts placed at their job's geocode, with the county the venue falls in and where
 * each stands. Built once here so Settings' picker (faint dots, the contents card) and
 * the desk's Map lens (PR 3: pins, the legend's counts, the uncovered flag) read the same
 * answers and never disagree.
 *
 * The venue follows the job, not the customer (Burd & Assoc.'s office is in Amarillo, its
 * job is at Liberty Hill, Williamson County): the county is the property record's when
 * the record names one, else the county the geocode falls in. An account with several
 * jobs sits at its first job's address.
 */
import { effectiveJobLedgerNumber } from '../ledgerDisplayPrefixes'
import { normalizeAddressForGeocodeKey } from '../map/normalizeAddressForGeocode'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { matterIsClosed, matterIsWithFirm, type LegalMatterRow } from './legalMatters'
import { countyWords, type CountyAssignments } from './firmCounties'

/** Where an account stands on the desk, as the map colors it. */
export type LegalMapStand = 'eyes' | 'firm' | 'gave'
/** …plus `none`: not with the firm, in a county no firm covers (derived against the county map). */
export type LegalMapStandOrNone = LegalMapStand | 'none'

export type LegalMapCase = {
  /** Unique on the map: a payer given up on one job and still owing on another is two cases, as on the desk. */
  id: string
  /** The payer key, the desk's `?legal=` door. */
  key: string
  name: string
  balance: number
  /** `707 · 717 · 718` */
  jobLabels: string
  jobCount: number
  viaGc: boolean
  stand: LegalMapStand
  /** The firm the matter is with (`legal_matters.firm_id`) while `stand` is `firm`; null otherwise (v2.5784: the legend counts it for that firm). */
  firmId: string | null
  /** `needs a dev's eyes` · `with Snell since 10/06` · `given up on` */
  note: string
  lat: number | null
  lng: number | null
  county: string | null
  /** `record` when the property record named the county, `point` when the geocode did, null when neither. */
  countyFrom: 'record' | 'point' | null
}

type AccountJob = { id: string; hcp_number?: string | null; click_number?: string | number | null; job_address?: string | null; customer_address_id?: string | null }
export type MapAccount = { key: string; name: string; balance: number; viaGc: boolean; jobs: ReadonlyArray<AccountJob> }

export type ShapeMapCasesInput = {
  /** The desk's Collections accounts (not given up on). */
  accounts: ReadonlyArray<MapAccount>
  /** The accounts under Given up on (the job flag). */
  givenUp: ReadonlyArray<MapAccount>
  byPayerKey: ReadonlyMap<string, Pick<LegalMatterRow, 'stage' | 'closed_at' | 'firm_id' | 'released_at'>>
  firmNames: ReadonlyMap<string, string>
  /** By `normalizeAddressForGeocodeKey(job_address)`. */
  coords: ReadonlyMap<string, { lat: number; lng: number }>
  /** `customer_addresses.county` by its id, for the jobs' property records. */
  recordCounty: ReadonlyMap<string, string | null>
  /** Point-in-county over the county file. */
  countyOf: (lng: number, lat: number) => string | null
}

const n2 = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** `10/06` from an ISO instant, on the app's calendar. */
function mdOf(iso: string | null | undefined): string {
  if (!iso) return ''
  const ymd = calendarYmdInAppTzFromIso(iso)
  return ymd.length >= 10 ? `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}` : ''
}

/** Where an account stands: the job flag wins, then the matter; a closed matter is off the map. */
export function caseStand(matter: Pick<LegalMatterRow, 'stage' | 'closed_at'> | null | undefined, givenUp: boolean): LegalMapStand | 'closed' {
  if (givenUp) return 'gave'
  if (matterIsWithFirm(matter)) return 'firm'
  if (matterIsClosed(matter)) return 'closed'
  return 'eyes'
}

export function caseNote(stand: LegalMapStand, firmName: string | null, releasedAt: string | null | undefined): string {
  if (stand === 'gave') return 'given up on'
  if (stand === 'firm') {
    const since = mdOf(releasedAt)
    return `with ${firmName ?? 'the firm'}${since ? ` since ${since}` : ''}`
  }
  return 'needs a dev’s eyes'
}

/** The accounts as cases on the map, largest balance first. */
export function shapeMapCases(input: ShapeMapCasesInput): LegalMapCase[] {
  const out: LegalMapCase[] = []
  const one = (acc: MapAccount, givenUp: boolean) => {
    const matter = input.byPayerKey.get(acc.key) ?? null
    const stand = caseStand(matter, givenUp)
    if (stand === 'closed') return
    const first = acc.jobs[0]
    const address = (first?.job_address ?? '').trim()
    const pt = address ? input.coords.get(normalizeAddressForGeocodeKey(address)) ?? null : null
    const record = first?.customer_address_id ? (input.recordCounty.get(first.customer_address_id) ?? '').trim() : ''
    const point = pt ? input.countyOf(pt.lng, pt.lat) : null
    const county = record || point || null
    const firmName = matter?.firm_id ? input.firmNames.get(matter.firm_id) ?? null : null
    out.push({
      id: `${acc.key}|${givenUp ? 'gave' : 'live'}`,
      key: acc.key,
      name: acc.name,
      balance: n2(acc.balance),
      jobLabels: acc.jobs.map((j) => effectiveJobLedgerNumber(j.hcp_number ?? null, j.click_number == null ? null : String(j.click_number)) || '—').join(' · '),
      jobCount: acc.jobs.length,
      viaGc: acc.viaGc,
      stand,
      firmId: stand === 'firm' ? matter?.firm_id ?? null : null,
      note: caseNote(stand, firmName, matter?.released_at),
      lat: pt?.lat ?? null,
      lng: pt?.lng ?? null,
      county,
      countyFrom: record ? 'record' : point ? 'point' : null,
    })
  }
  for (const acc of input.accounts) one(acc, false)
  for (const acc of input.givenUp) one(acc, true)
  return out.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
}

/**
 * A case not with the firm, in a county no firm covers, is `none`: the desk cannot release it. While no county is
 * colored and one firm stands (the bridge, `bridgeFirmId`), that firm takes every account, so no case is `none`
 * (v2.6233, punch list #222: the Map's red flag said the desk could not release accounts it could).
 */
export function effectiveStand(c: Pick<LegalMapCase, 'stand' | 'county'>, assignments: CountyAssignments, bridgeFirmId: string | null = null): LegalMapStandOrNone {
  if (c.stand === 'firm') return 'firm'
  if (bridgeFirmId) return c.stand
  return c.county && assignments.has(c.county) ? c.stand : 'none'
}

/** The bridge's firm: the one firm that stands while no county is colored for any firm, else null (`firmForAccount`'s `only_firm`). */
export function bridgeFirmOf(assignments: CountyAssignments, activeFirms: ReadonlyArray<{ id: string }>): string | null {
  return assignments.size === 0 && activeFirms.length === 1 ? activeFirms[0]!.id : null
}

/** Over the Map while the bridge stands, in place of the red flag. */
export function bridgeMapWords(firmName: string): string {
  return `${firmName} takes every account today, by default. No county is colored yet. The first county colored for any firm ends that.`
}

/** Theme tokens for each stand's dot. Saturated status colors, as the status dots elsewhere. */
export const STAND_COLOR: Record<LegalMapStandOrNone, string> = {
  eyes: 'var(--text-amber-700)',
  firm: 'var(--text-green-600)',
  gave: 'var(--text-muted)',
  none: 'var(--text-red-600)',
}

export const STAND_WORDS: Record<LegalMapStandOrNone, string> = {
  eyes: 'Needs a dev’s eyes',
  firm: 'With the firm',
  gave: 'Given up on',
  none: 'No firm covers it',
}

/** The cases in a county, largest first. */
export function casesInCounty(cases: ReadonlyArray<LegalMapCase>, county: string | null): LegalMapCase[] {
  if (!county) return []
  return cases.filter((c) => c.county === county)
}

const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export type CountyCardFacts = {
  title: string
  firmName: string | null
  countLine: string
  rows: Array<{ case: LegalMapCase; stand: LegalMapStandOrNone; color: string; money: string }>
  emptyLine: string | null
}

/** The contents card for one county: its firm, its cases and their dollars. */
export function countyCardFacts(county: string, cases: ReadonlyArray<LegalMapCase>, assignments: CountyAssignments, firmNames: ReadonlyMap<string, string>, bridgeFirmId: string | null = null): CountyCardFacts {
  const here = casesInCounty(cases, county)
  const firmId = assignments.get(county) ?? bridgeFirmId
  const total = here.reduce((s, c) => s + c.balance, 0)
  return {
    title: countyWords(county),
    firmName: firmId ? firmNames.get(firmId) ?? null : null,
    countLine: `${here.length} ${here.length === 1 ? 'case' : 'cases'}${here.length ? ` · ${money(total)} open` : ''}`,
    rows: here.map((c) => {
      const stand = effectiveStand(c, assignments, bridgeFirmId)
      return { case: c, stand, color: STAND_COLOR[stand], money: money(c.balance) }
    }),
    emptyLine: here.length ? null : `No case in ${countyWords(county)}.`,
  }
}

export type LegendCount = { firmId: string | null; name: string; count: number; dollars: number; moneyWords: string }

/**
 * Who covers what, with each firm's cases and dollars; `No firm covers it` last (the lens's legend, PR 3). A case
 * with a firm counts for that firm whatever the counties say today (v2.5784); the rest count for the firm of
 * their county; a firm no longer active counts as none.
 */
export function legendCounts(cases: ReadonlyArray<LegalMapCase>, assignments: CountyAssignments, firms: ReadonlyArray<{ id: string; name: string }>, bridgeFirmId: string | null = null): LegendCount[] {
  const by = new Map<string | null, { count: number; dollars: number }>()
  for (const f of firms) by.set(f.id, { count: 0, dollars: 0 })
  by.set(null, { count: 0, dollars: 0 })
  for (const c of cases) {
    const firmId = c.firmId ?? (c.county ? assignments.get(c.county) ?? bridgeFirmId : bridgeFirmId)
    const slot = by.get(firmId) ?? by.get(null)!
    slot.count += 1
    slot.dollars += c.balance
  }
  return [...firms.map((f) => ({ firmId: f.id as string | null, name: f.name })), { firmId: null, name: 'No firm covers it' }].map((f) => {
    const slot = by.get(f.firmId) ?? { count: 0, dollars: 0 }
    return { ...f, count: slot.count, dollars: slot.dollars, moneyWords: money(slot.dollars) }
  })
}

/** The counties of the cases no firm covers, sorted, once each (the legend's last row, v2.5784). */
export function uncoveredCounties(cases: ReadonlyArray<LegalMapCase>, assignments: CountyAssignments, bridgeFirmId: string | null = null): string[] {
  const out = new Set<string>()
  for (const c of cases) if (effectiveStand(c, assignments, bridgeFirmId) === 'none' && c.county) out.add(c.county)
  return [...out].sort()
}

/** The desk with no account in Collections, the good state: the Map's summary and the Accounts list say it the same (punch list #184, sweep C). */
export const LEGAL_NOTHING_IN_COLLECTIONS = 'Nothing is in Collections.'

/** Over the lens: `8 accounts · 10 jobs · $26,462.01 open`, or `Nothing is in Collections.` */
export function lensSummaryWords(cases: ReadonlyArray<LegalMapCase>): string {
  if (cases.length === 0) return LEGAL_NOTHING_IN_COLLECTIONS
  const jobs = cases.reduce((s, c) => s + c.jobCount, 0)
  const open = cases.reduce((s, c) => s + c.balance, 0)
  return `${cases.length} ${cases.length === 1 ? 'account' : 'accounts'} · ${jobs} ${jobs === 1 ? 'job' : 'jobs'} · ${money(open)} open`
}

/** The flag above the lens: `2 cases in a county no firm covers · Burd & Assoc. (Williamson) · …`, or null. */
export function uncoveredWords(cases: ReadonlyArray<LegalMapCase>, assignments: CountyAssignments, bridgeFirmId: string | null = null): string | null {
  const off = cases.filter((c) => effectiveStand(c, assignments, bridgeFirmId) === 'none')
  if (off.length === 0) return null
  const names = off.map((c) => `${c.name} (${c.county ?? 'off the map'})`).join(' · ')
  return `${off.length} ${off.length === 1 ? 'case' : 'cases'} in a county no firm covers · ${names}. Color the county for a firm, or the desk cannot release ${off.length === 1 ? 'it' : 'them'}.`
}
