/**
 * Which collections law firm an account belongs to, and why (punch list #144, PR 2, v2.5792).
 *
 * Venue for a collections suit is the county, and the firms cover counties (`legal_firm_counties`).
 * Each job's county comes from its property record when the record names one, else from where its
 * geocode falls on the county map, else from the county its address's city suggests, else nothing.
 * The firm is the one that covers that county. Across jobs in two firms' counties the firm of the
 * county holding the largest open balance is picked, the other offered as a switch. A released matter
 * keeps the firm it went to, whatever the counties say today. A county nobody covers yields no firm —
 * never a default (the owner's call, 2026-10-22) — with one bridge: while no county at all is colored
 * and one firm stands, that firm takes every account as it did before the map, and the words say so;
 * the first colored county ends the bridge. Pure; the desk reads the words from here.
 */
import { countyWords, type CountyAssignments } from './firmCounties'
import { formatLegalMoney } from './legalPacket'

export type VenueFrom = 'record' | 'point' | 'address' | 'none'

/** One job as the venue rule reads it. `county` is '' when nothing names one. */
export type VenueJob = { jobId: string; label: string; county: string; from: VenueFrom; balance: number }

export type FirmLike = { id: string; name: string; active?: boolean }

/** A county group: the jobs in it and what they owe together. */
export type VenueCounty = { county: string; from: VenueFrom; balance: number; jobLabels: string[]; firmId: string | null }

export type FirmForAccount<F extends FirmLike = FirmLike> =
  /** A released matter: the firm it went to (`firm` null only when its row is gone; `firmName` always reads). */
  | { kind: 'with'; firm: F | null; firmName: string; counties: VenueCounty[] }
  /**
   * The venue county's firm; `others` are the other firms with a claim, largest first: the first call of another
   * venue county (two-county accounts), and since v2.6227 a firm that also covers a venue county (`shared`).
   * `share` names the picked county's first call and the firms that also cover it, when more than one does.
   */
  | { kind: 'covered'; firm: F; county: VenueCounty; others: Array<{ firm: F; county: VenueCounty; shared?: boolean }>; switched: boolean; counties: VenueCounty[]; share?: { firstCall: F; also: F[] } }
  /** No county is colored yet and one firm stands: it takes every account, as before the map (the bridge). */
  | { kind: 'only_firm'; firm: F; counties: VenueCounty[] }
  /** The county is known and no firm covers it. */
  | { kind: 'uncovered'; county: VenueCounty; counties: VenueCounty[] }
  /** No job names a county. */
  | { kind: 'unknown'; counties: VenueCounty[] }
  /** No active firm at all. */
  | { kind: 'no_firms'; counties: VenueCounty[] }

export type FirmForAccountInput<F extends FirmLike = FirmLike> = {
  jobs: ReadonlyArray<VenueJob>
  /** `legal_matters.firm_id` while the matter is with the firm; null otherwise. */
  matterFirmId: string | null
  assignments: CountyAssignments
  /** Every firm row (the released firm may be retired); only active ones cover counties. */
  firms: ReadonlyArray<F>
  /** The office's switch on a two-county account: the firm id picked for this release. */
  override?: string | null
  /** county → the firms that also cover it (v2.6227, punch list #222); `assignments` holds each county's first call. */
  also?: ReadonlyMap<string, ReadonlyArray<string>>
}

/** The city between the street and `TX` in a one-line address, '' when the line has no such shape. */
export function cityOfAddress(address: string | null | undefined): string {
  const m = /,\s*([^,]+?)\s*,\s*(?:TX|Texas)\b/i.exec(address ?? '')
  return (m?.[1] ?? '').trim()
}

/** The county groups of an account's jobs, largest balance first; a job with no county joins the '' group last. */
export function venueCounties(jobs: ReadonlyArray<VenueJob>, assignments: CountyAssignments): VenueCounty[] {
  const by = new Map<string, VenueCounty>()
  const rank: Record<VenueFrom, number> = { record: 3, point: 2, address: 1, none: 0 }
  for (const j of jobs) {
    const county = j.county.trim()
    const cur = by.get(county) ?? { county, from: county ? j.from : 'none', balance: 0, jobLabels: [], firmId: county ? assignments.get(county) ?? null : null }
    cur.balance += Math.max(0, j.balance)
    cur.jobLabels.push(j.label)
    if (county && rank[j.from] > rank[cur.from]) cur.from = j.from
    by.set(county, cur)
  }
  return [...by.values()].sort((a, b) => (a.county === '') === (b.county === '') ? b.balance - a.balance || a.county.localeCompare(b.county) : a.county === '' ? 1 : -1)
}

export function firmForAccount<F extends FirmLike>(input: FirmForAccountInput<F>): FirmForAccount<F> {
  const counties = venueCounties(input.jobs, input.assignments)
  const firmById = new Map(input.firms.map((f) => [f.id, f] as const))
  if (input.matterFirmId) {
    const firm = firmById.get(input.matterFirmId) ?? null
    return { kind: 'with', firm, firmName: firm?.name ?? 'the firm', counties }
  }
  const active = input.firms.filter((f) => f.active !== false)
  if (active.length === 0) return { kind: 'no_firms', counties }
  if (input.assignments.size === 0 && active.length === 1) return { kind: 'only_firm', firm: active[0]!, counties }
  const known = counties.filter((c) => c.county !== '')
  if (known.length === 0) return { kind: 'unknown', counties }
  const covered = known.filter((c) => c.firmId && firmById.has(c.firmId))
  if (covered.length === 0) return { kind: 'uncovered', county: known[0]!, counties }
  // One row per firm, the firm's largest county first; the largest overall leads.
  const perFirm: Array<{ firm: F; county: VenueCounty; shared?: boolean }> = []
  for (const c of covered) if (!perFirm.some((p) => p.firm.id === c.firmId)) perFirm.push({ firm: firmById.get(c.firmId!)!, county: c })
  // v2.6227: a firm that also covers a venue county may take the release too; it follows the first calls.
  for (const c of covered) {
    for (const id of input.also?.get(c.county) ?? []) {
      const f = firmById.get(id)
      if (f && f.active !== false && !perFirm.some((p) => p.firm.id === id)) perFirm.push({ firm: f, county: c, shared: true })
    }
  }
  const wanted = input.override ? perFirm.find((p) => p.firm.id === input.override) : undefined
  const pick = wanted ?? perFirm[0]!
  const firstCall = firmById.get(pick.county.firmId!) ?? null
  const sharers = (input.also?.get(pick.county.county) ?? []).map((id) => firmById.get(id)).filter((f): f is F => Boolean(f && f.active !== false))
  const share = firstCall && sharers.length ? { firstCall, also: sharers } : undefined
  return { kind: 'covered', firm: pick.firm, county: pick.county, others: perFirm.filter((p) => p !== pick), switched: Boolean(wanted && wanted !== perFirm[0]), counties, ...(share ? { share } : {}) }
}

/** The firm the release goes to and the fee model reads, or null. */
export function firmOf<F extends FirmLike>(r: FirmForAccount<F>): F | null {
  return r.kind === 'with' || r.kind === 'covered' || r.kind === 'only_firm' ? r.firm : null
}

function fromWords(from: VenueFrom): string {
  if (from === 'record') return 'from the property record'
  if (from === 'point') return 'from the job address'
  if (from === 'address') return 'by the job address, a guess from its city'
  return ''
}

/** `Bell and Hays`, `Bell, Hays and Travis`. */
function namesList(names: ReadonlyArray<string>): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * The picked county's sharing in a few words (v2.6227): ` · Snell also covers` when the pick is the first call,
 * ` · Alamo is first call` when the office switched to a firm that also covers the county; '' otherwise.
 */
function shareTail(r: Extract<FirmForAccount, { kind: 'covered' }>): string {
  if (!r.share) return ''
  if (r.share.firstCall.id === r.firm.id) {
    const names = r.share.also.map((f) => f.name)
    return ` · ${namesList(names)} also cover${names.length === 1 ? 's' : ''}`
  }
  return ` · ${r.share.firstCall.name} is first call`
}

/** The venue line's last part for a shared county, or null: `Alamo is first call · Snell also covers it`, or `Snell picked by hand · Alamo is first call`. */
function shareLine(r: Extract<FirmForAccount, { kind: 'covered' }>): string | null {
  if (!r.share) return null
  if (r.share.firstCall.id === r.firm.id) {
    const names = r.share.also.map((f) => f.name)
    return `${r.firm.name} is first call · ${namesList(names)} also cover${names.length === 1 ? 's' : ''} it`
  }
  return `${r.firm.name} picked by hand · ${r.share.firstCall.name} is first call`
}

/** The header's firm segment: the main words, the quiet tail, and whether it is amber. */
export function firmSegmentWords(r: FirmForAccount): { main: string; tail: string; amber: boolean } {
  switch (r.kind) {
    case 'with':
      return { main: r.firmName, tail: '', amber: false }
    case 'covered': {
      const where = `· ${countyWords(r.county.county)}${r.county.from === 'address' ? ', by the address' : ''}`
      return { main: r.firm.name, tail: `${where}${shareTail(r)}`, amber: false }
    }
    case 'only_firm':
      return { main: r.firm.name, tail: '· no counties colored yet', amber: false }
    case 'uncovered':
      return { main: `No firm covers ${countyWords(r.county.county)}`, tail: '', amber: true }
    case 'unknown':
      return { main: 'County unknown', tail: '', amber: true }
    default:
      return { main: 'No firm yet', tail: '', amber: true }
  }
}

/** The switch segment on a two-county account: `⇄ Snell instead`, one per other firm. */
export function switchWords(other: { firm: { name: string }; county: VenueCounty }): string {
  return `⇄ ${other.firm.name} instead`
}

/** The line under the account's address: where the county came from and who covers it. Null for a released matter. */
export function venueLineWords(r: FirmForAccount): string | null {
  const known = r.counties.filter((c) => c.county !== '')
  if (r.kind === 'with') return null
  if (r.kind === 'unknown') return 'Venue · county unknown. No property record names one, and the job address does not place it.'
  if (r.kind === 'no_firms') return known.length ? `Venue · ${known.map((c) => countyWords(c.county)).join(' and ')}, ${fromWords(known[0]!.from)}. No firm is set up yet.` : 'Venue · county unknown. No firm is set up yet.'
  if (r.kind === 'uncovered') return `Venue · ${countyWords(r.county.county)}, ${fromWords(r.county.from)} · no firm covers it`
  if (r.kind === 'only_firm') {
    const where = known.length ? `${known.map((c) => countyWords(c.county)).join(' and ')}, ${fromWords(known[0]!.from)}` : 'county unknown'
    return `Venue · ${where} · no counties are colored yet, so ${r.firm.name} takes every account`
  }
  if (known.length <= 1) return `Venue · ${countyWords(r.county.county)}, ${fromWords(r.county.from)} · ${shareLine(r) ?? `${r.firm.name} covers it`}`
  const parts = known.map((c) => `${countyWords(c.county)} (${formatLegalMoney(c.balance)})`).join(' and ')
  const lead = known[0]!
  const picked = r.switched ? `${r.firm.name} picked by hand for ${countyWords(r.county.county)}` : `${countyWords(lead.county)} holds the largest open balance, so ${r.firm.name} takes it`
  return `Venue · ${parts} · ${picked}`
}

/** Why Mark attorney ready is off, or null when the release can go. */
export function releaseHoldWords(r: FirmForAccount): string | null {
  if (r.kind === 'uncovered') return `No firm covers ${countyWords(r.county.county)}. Color the county for a firm under Firms, then release.`
  if (r.kind === 'unknown') return 'No county on this account. Link the job to its property record, then release.'
  if (r.kind === 'no_firms') return 'No firm is set up yet.'
  return null
}
