import { filterLienTimelineBook, lienGridRows, type LienBookShow, type LienTimelineBook, type LienTimelineBookRow } from '../jobs/lienTimelineBook'
import { workMonthShort } from '../jobs/forecastWorkMonths'
import { formatUsdNoCents } from '../jobs/jobFormatting'
import { addressLines } from '../bidDocuments/htmlDoc'
import { justiceCourtCap } from './jpVenue'

/**
 * How the firm's Lien grid reads on the portal (v2.4749, the owner's ask of
 * 2026-10-06): the address under the job, the property in words, the unpaid
 * total before its months, § 53.056 without the months whose window closed,
 * and a rail of GCs with each one's count and dollars in place of a select.
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
      kind: residential ? 'Residential' : 'Commercial',
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

/** The rows the grid shows: a GC's, the jobs with no GC, or all; due only or the whole book. */
export function filterLegalLienGrid(book: LienTimelineBook, opts: { gcId: string | null; show: LienBookShow }): LienTimelineBookRow[] {
  const inView = filterLienTimelineBook(book, { gcId: null, show: opts.show })
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
