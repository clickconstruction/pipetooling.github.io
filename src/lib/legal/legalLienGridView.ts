import { filterLienTimelineBook, lienGridRows, type LienBookShow, type LienTimelineBook, type LienTimelineBookRow } from '../jobs/lienTimelineBook'
import { workMonthShort } from '../jobs/forecastWorkMonths'
import { formatUsdNoCents } from '../jobs/jobFormatting'
import { addressLines } from '../bidDocuments/htmlDoc'
import { JUSTICE_COURT_LIMIT_WORDS, justiceCourtCap } from './jpVenue'

/**
 * How the firm's Lien grid reads on the portal (v2.4749, the owner's ask of
 * 2026-10-06): the address under the job, the property in words, the unpaid
 * total before its months, § 53.056 without the months whose window closed,
 * and a rail of GCs with each one's count and dollars in place of a select.
 * The same rail reads by court (v2.4825): each county, its justice precincts,
 * the jobs over the justice limit, and the bands the rows group under.
 * The memo's twelve-column print (`lienGridHtml`) is unchanged; this kernel
 * folds `lienGridRows` once more for the screen.
 */

export interface LegalLienGridNotice {
  /** `Jul` */
  month: string
  /** `Oct 15` — the deadline, or the day it went when `sent`. */
  date: string
  sent: boolean
}

export interface LegalLienGridCell {
  jobId: string
  job: string
  address: string
  /** The address as the cell draws it (v2.4753): the street, then the city, state, zip and anything after — `addressLines`, split at the first comma. */
  street: string
  cityLine: string
  owner: string
  /** `Commercial` | `Residential` */
  kind: string
  /** True when the office has not entered the kind — commercial dates are shown; the screen adds the red `?`. */
  kindUnknown: boolean
  /** `Homestead` | `No homestead` on a residential property; '' on a commercial one. */
  homestead: string
  lastOnSite: string
  /** The job's county from its property record, '' when none (v2.4764, the Court column). */
  county: string
  /** The justice precinct from the court map (v2.4771), '' until it names one; `2 or 3 — on the line` when it sits on a line. */
  precinct: string
  /** Within the $20,000 justice court limit. */
  withinJusticeLimit: boolean
  /** `$38,625` */
  total: string
  /** `Jun, Jul, Aug, Sep` — the unpaid months; '' when none. */
  months: string
  /** The live § 53.056 months only: a month whose window closed, or that was skipped on purpose, is left off. */
  notices: LegalLienGridNotice[]
  /** Words in place of the list — `none needed (with the owner)`; '' otherwise. */
  noticeNote: string
  /** True when the job has work months and none with a § 53.056 window still open or a notice sent — the screen shows a dash, not a `?`. */
  allClosed: boolean
  affidavit: string
  bond: string
  paidOut: string
  reserved: string
  contractCompleted: string
}

const NONE_NEEDED = 'none needed (with the owner)'

export function legalLienGridCells(rows: ReadonlyArray<LienTimelineBookRow>, todayYmd: string): LegalLienGridCell[] {
  const grid = lienGridRows(rows, todayYmd)
  return rows.map((r, i) => {
    const g = grid[i]!
    const kindKnown = r.job.propertyKind !== ''
    const residential = r.job.propertyKind === 'residential'
    const noticeSteps = r.timeline.steps.filter((s) => s.kind === 'notice' && s.monthKey)
    const notices: LegalLienGridNotice[] = noticeSteps
      .filter((s) => s.state !== 'missed')
      .map((s) => ({ month: workMonthShort(s.monthKey!), date: s.dateWords, sent: s.state === 'done' }))
    const openMonths = r.months.filter((m) => m.outcome !== 'sent').map((m) => workMonthShort(m.key))
    const [street = '', cityLine = ''] = addressLines(g.address)
    return {
      jobId: r.jobId,
      job: g.job,
      address: g.address,
      street,
      cityLine,
      owner: g.owner,
      // A kind not set dates as residential (v2.5031), so it reads Residential with `kindUnknown`.
      kind: residential || !kindKnown ? 'Residential' : 'Commercial',
      kindUnknown: !kindKnown,
      homestead: residential ? (r.job.homestead ? 'Homestead' : 'No homestead') : r.job.homestead ? 'Homestead' : '',
      lastOnSite: g.lastOnSite,
      county: r.job.county,
      precinct: r.job.precinctNote || r.job.precinct || '',
      withinJusticeLimit: justiceCourtCap(r.job.openBalance).within,
      total: formatUsdNoCents(r.job.openBalance),
      months: openMonths.join(', '),
      notices: r.job.isSub ? notices : [],
      noticeNote: r.job.isSub ? '' : NONE_NEEDED,
      // The timeline folds every-window-closed into one step with no month, so the months themselves say it.
      allClosed: r.job.isSub && r.months.length > 0 && notices.length === 0,
      affidavit: g.affidavit,
      bond: g.bond,
      paidOut: g.paidOut,
      reserved: g.reserved,
      contractCompleted: g.contractCompleted,
    }
  })
}

// ---------- the rail ----------

/** The rail's id for the jobs with no GC — contracted with the owner. */
export const LEGAL_LIEN_NO_GC = '__no_gc__'

export interface LegalLienGridGc {
  /** '' for All GCs, `LEGAL_LIEN_NO_GC` for the jobs with no GC, else the GC's id. */
  id: string
  name: string
  /** Rows in the current view (Something due / All). */
  count: number
  /** Their open balance. */
  open: number
  kind: 'all' | 'gc' | 'none'
}

/** What the rail reads for one of its entries — `3 jobs`, `1 job`, `0 jobs`. */
export function legalLienGcCountWords(count: number): string {
  return `${count} ${count === 1 ? 'job' : 'jobs'}`
}

/** The rows the grid shows: a GC's, the jobs with no GC, or all; a county's or a court's (v2.4825); due only or the whole book. */
export function filterLegalLienGrid(book: LienTimelineBook, opts: { gcId: string | null; courtId?: string | null; show: LienBookShow }): LienTimelineBookRow[] {
  const inView = filterLienTimelineBook(book, { gcId: null, show: opts.show })
  const courtId = opts.courtId ?? ''
  if (courtId) return inView.filter((r) => legalLienCourtMatches(legalLienCourtOf(r.job), courtId))
  if (!opts.gcId) return inView
  if (opts.gcId === LEGAL_LIEN_NO_GC) return inView.filter((r) => !r.job.gcId)
  return inView.filter((r) => r.job.gcId === opts.gcId)
}

/**
 * The rail: All GCs first, then every GC with rows in view, largest open
 * balance first, then the jobs with no GC when any is in view. The counts
 * and dollars follow the view, so they foot with the grid beside them. An
 * entry with nothing in view is left off; the screen drops a choice that
 * left the rail back to All GCs, so the grid never sits empty under a name.
 */
export function legalLienGridGcs(book: LienTimelineBook, show: LienBookShow): LegalLienGridGc[] {
  const inView = filterLienTimelineBook(book, { gcId: null, show })
  const byGc = new Map<string, LegalLienGridGc>()
  for (const g of book.gcs) byGc.set(g.id, { id: g.id, name: g.name || 'GC', count: 0, open: 0, kind: 'gc' })
  const none: LegalLienGridGc = { id: LEGAL_LIEN_NO_GC, name: 'No GC · with the owner', count: 0, open: 0, kind: 'none' }
  const all: LegalLienGridGc = { id: '', name: 'All GCs', count: 0, open: 0, kind: 'all' }
  for (const r of inView) {
    all.count += 1
    all.open += r.job.openBalance
    const e = r.job.gcId ? byGc.get(r.job.gcId) : none
    if (!e) continue
    e.count += 1
    e.open += r.job.openBalance
  }
  const gcs = [...byGc.values()]
    .filter((g) => g.count > 0)
    .sort((a, b) => b.open - a.open || b.count - a.count || a.name.localeCompare(b.name))
  return [all, ...gcs, ...(none.count > 0 ? [none] : [])]
}

/** The rail shows a find box once it lists this many GCs. */
export const LEGAL_LIEN_RAIL_FIND_AT = 10

/** The entries a typed find keeps: All and the selected one always; the rest by name. */
export function findLegalLienGcs(entries: ReadonlyArray<LegalLienGridGc>, find: string, selectedId: string | null): LegalLienGridGc[] {
  const q = find.trim().toLowerCase()
  if (!q) return [...entries]
  return entries.filter((e) => e.kind === 'all' || e.id === selectedId || e.name.toLowerCase().includes(q))
}

// ---------- by court (v2.4825) ----------

/** The court rail's id for the jobs whose county is not on the property record. */
export const LEGAL_LIEN_NO_COUNTY = '__no_county__'

/** `precinct` a justice precinct the court map named · `line` a point on a line between precincts · `pending` the precinct not named yet · `over` over the justice limit. */
export type LegalLienCourtKind = 'precinct' | 'line' | 'pending' | 'over'

/** Where a job would be filed, as the court rail groups it. */
export interface LegalLienCourt {
  /** `court:hays|precinct|2` · `court:hays|over|` · `LEGAL_LIEN_NO_COUNTY`. */
  id: string
  /** `county:hays`; '' when the county is not on the record. */
  countyId: string
  /** `Hays`, without the word County; '' when not on the record. */
  county: string
  kind: LegalLienCourtKind | 'none'
  /** `2` · `2 or 3`; '' for the other kinds. */
  precinct: string
  /** The rail's words under the county: `Precinct 2` · `Over $20,000 · county court`. */
  name: string
  /** The words with the county, for a band, the summary line and the print. */
  title: string
  /** A phone chip's words, which carry the county: `Hays · Pct 2`. */
  short: string
}

/** `Hays County` and ` hays ` are one county: trimmed, without the word County. */
export function legalLienCountyName(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/\s+/g, ' ').replace(/\s+county$/i, '')
}

const ON_THE_LINE = /\s*[—–-]+\s*on the line\s*$/i

/**
 * A job's court: its county from the property record, then the justice precinct when the
 * balance is within the justice limit. A job over the limit cannot be filed in a justice court,
 * so it reads under its county as county or district court, never under a precinct.
 */
export function legalLienCourtOf(job: { county: string; precinct?: string; precinctNote?: string; openBalance: number }): LegalLienCourt {
  const county = legalLienCountyName(job.county)
  if (!county) {
    return { id: LEGAL_LIEN_NO_COUNTY, countyId: '', county: '', kind: 'none', precinct: '', name: 'County not on the record', title: 'County not on the record', short: 'No county' }
  }
  const key = county.toLowerCase()
  const at = (kind: LegalLienCourtKind, precinct: string, name: string, title: string, short: string): LegalLienCourt => ({ id: `court:${key}|${kind}|${precinct.toLowerCase()}`, countyId: `county:${key}`, county, kind, precinct, name, title, short })
  if (!justiceCourtCap(job.openBalance).within) {
    return at('over', '', `Over ${JUSTICE_COURT_LIMIT_WORDS} · county court`, `${county} County · over ${JUSTICE_COURT_LIMIT_WORDS}, county or district court`, `${county} · over ${JUSTICE_COURT_LIMIT_WORDS}`)
  }
  const note = (job.precinctNote ?? '').trim()
  if (note) {
    const p = note.replace(ON_THE_LINE, '').trim()
    return at('line', p, `Precinct ${p} · on the line`, `${county} County · Justice Court, Precinct ${p} · on the line`, `${county} · Pct ${p}, on the line`)
  }
  const p = (job.precinct ?? '').trim()
  if (p) return at('precinct', p, `Precinct ${p}`, `${county} County · Justice Court, Precinct ${p}`, `${county} · Pct ${p}`)
  return at('pending', '', 'Precinct not named yet', `${county} County · justice precinct not named yet`, `${county} · not named yet`)
}

/** A rail choice holds a job: All, the jobs with no county, a whole county, or one court. */
export function legalLienCourtMatches(court: LegalLienCourt, choice: string): boolean {
  if (!choice) return true
  if (choice === LEGAL_LIEN_NO_COUNTY) return court.kind === 'none'
  if (choice.startsWith('county:')) return court.countyId === choice
  return court.id === choice
}

export interface LegalLienGridCourt {
  /** '' for All courts, `county:<county>` for a county, a court's id, or `LEGAL_LIEN_NO_COUNTY`. */
  id: string
  kind: 'all' | 'county' | 'court' | 'none'
  /** A court's kind, for the red of a job over the limit. */
  courtKind?: LegalLienCourtKind
  name: string
  /** For the summary line and the print: `every court` · `Hays County` · a court's title. */
  title: string
  /** A phone chip's words. */
  short: string
  count: number
  open: number
}

const KIND_ORDER: Record<LegalLienCourtKind, number> = { precinct: 0, line: 1, pending: 2, over: 3 }

function precinctNumber(p: string): number {
  const n = Number.parseInt(p, 10)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

function compareCourts(a: LegalLienCourt, b: LegalLienCourt): number {
  if (a.kind === 'none' || b.kind === 'none') return a.kind === b.kind ? 0 : a.kind === 'none' ? 1 : -1
  return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || precinctNumber(a.precinct) - precinctNumber(b.precinct) || a.precinct.localeCompare(b.precinct)
}

type CourtGroup = { court: LegalLienCourt; rows: LienTimelineBookRow[]; open: number }
type CountyGroup = { countyId: string; county: string; courts: CourtGroup[]; count: number; open: number }

/** The rows by county, then by court: counties by their dollars, largest first, courts in precinct order; no county last. */
function groupByCourt(rows: ReadonlyArray<LienTimelineBookRow>): { counties: CountyGroup[]; none: CourtGroup | null } {
  const counties = new Map<string, CountyGroup>()
  let none: CourtGroup | null = null
  for (const r of rows) {
    const court = legalLienCourtOf(r.job)
    if (court.kind === 'none') {
      none ??= { court, rows: [], open: 0 }
      none.rows.push(r)
      none.open += r.job.openBalance
      continue
    }
    let c = counties.get(court.countyId)
    if (!c) {
      c = { countyId: court.countyId, county: court.county, courts: [], count: 0, open: 0 }
      counties.set(court.countyId, c)
    }
    c.count += 1
    c.open += r.job.openBalance
    let g = c.courts.find((x) => x.court.id === court.id)
    if (!g) {
      g = { court, rows: [], open: 0 }
      c.courts.push(g)
    }
    g.rows.push(r)
    g.open += r.job.openBalance
  }
  const sorted = [...counties.values()].sort((a, b) => b.open - a.open || b.count - a.count || a.county.localeCompare(b.county))
  for (const c of sorted) c.courts.sort((a, b) => compareCourts(a.court, b.court))
  return { counties: sorted, none }
}

/**
 * The rail by court: All courts, then each county with its total and, under it, its courts;
 * the jobs with no county last. The counts follow the view, like the GCs' rail, and an entry
 * with nothing in view is left off.
 */
export function legalLienGridCourts(book: LienTimelineBook, show: LienBookShow): LegalLienGridCourt[] {
  const inView = filterLienTimelineBook(book, { gcId: null, show })
  const { counties, none } = groupByCourt(inView)
  const out: LegalLienGridCourt[] = [{ id: '', kind: 'all', name: 'All courts', title: 'every court', short: 'All courts', count: inView.length, open: inView.reduce((sum, r) => sum + r.job.openBalance, 0) }]
  for (const c of counties) {
    out.push({ id: c.countyId, kind: 'county', name: `${c.county} County`, title: `${c.county} County`, short: c.county, count: c.count, open: c.open })
    for (const g of c.courts) out.push({ id: g.court.id, kind: 'court', courtKind: g.court.kind === 'none' ? undefined : g.court.kind, name: g.court.name, title: g.court.title, short: g.court.short, count: g.rows.length, open: g.open })
  }
  if (none) out.push({ id: LEGAL_LIEN_NO_COUNTY, kind: 'none', name: none.court.name, title: none.court.title, short: none.court.short, count: none.rows.length, open: none.open })
  return out
}

export interface LegalLienCourtSection {
  id: string
  kind: LegalLienCourtKind | 'none'
  /** `Hays County · Justice Court, Precinct 2` */
  title: string
  rows: LienTimelineBookRow[]
  open: number
}

/** The rows in the rail's order, one section per court; the screen bands them when there is more than one. */
export function legalLienCourtSections(rows: ReadonlyArray<LienTimelineBookRow>): LegalLienCourtSection[] {
  const { counties, none } = groupByCourt(rows)
  const groups = [...counties.flatMap((c) => c.courts), ...(none ? [none] : [])]
  return groups.map((g) => ({ id: g.court.id, kind: g.court.kind, title: g.court.title, rows: g.rows, open: g.open }))
}

/** A band's line: `Hays County · Justice Court, Precinct 2 · 2 jobs · $18,450`. */
export function legalLienSectionWords(section: Pick<LegalLienCourtSection, 'title' | 'rows' | 'open'>): string {
  return `${section.title} · ${legalLienGcCountWords(section.rows.length)} · ${formatUsdNoCents(section.open)}`
}

/** The entries a typed find keeps on the court rail: All and the selected one always; the rest by their full words. */
export function findLegalLienCourts(entries: ReadonlyArray<LegalLienGridCourt>, find: string, selectedId: string | null): LegalLienGridCourt[] {
  const q = find.trim().toLowerCase()
  if (!q) return [...entries]
  return entries.filter((e) => e.kind === 'all' || e.id === selectedId || e.title.toLowerCase().includes(q))
}
