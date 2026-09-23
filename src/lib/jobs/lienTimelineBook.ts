import { buildLienDeskQueue, LIEN_DESK_LEAD_DAYS, type LienDeskItemRow, type LienNoticeMonthRow, type LienNoticePolicy } from './lienDesk'
import { buildLienAffidavitQueue, type LienAffidavitRow } from './lienDeskAffidavits'
import type { JobLienFilingRow } from './lienDeadlines'
import { buildLienTimelineFromDesk, lienTimelineMonthsFromDesk } from './lienTimelineDesk'
import { lienDateWords, lienThirtyDayClock, type LienTimeline, type LienTimelineMonth } from './lienTimeline'
import { workMonthShort } from './forecastWorkMonths'
import { formatUsdNoCents } from './jobFormatting'

/**
 * The book (v2.3768, punch list #37 PR 2): every billed job with money open
 * and a lien month, each on its timeline — counsel's "move every job onto
 * that grid today", in the app. The desk's queue lists what is due inside 30
 * days; the book lists the whole path for every job, sorted by the next
 * date, and prints as the memo's grid per GC. Pure: the same kernels the
 * desk uses (`buildLienDeskQueue`, `buildLienAffidavitQueue`,
 * `buildLienTimelineFromDesk`), over a wider read of the same two RPCs.
 */

export interface LienBookJob {
  id: string
  /** `273 · Dudley (Lennox)` */
  label: string
  address: string
  gcId: string | null
  gcName: string
  /** '' | 'residential' | 'non_residential' */
  propertyKind: string
  homestead: boolean
  county: string
  /** The owner of record as the desk resolves it — the override on the job, else the property record. '' when none. */
  ownerName: string
  openBalance: number
  lastWorkDate: string | null
  isSub: boolean
  /** v2.3753's facts when the job carries them; the grid prints them, else a blank. */
  paymentBond?: string | null
  contractEndedOn?: string | null
}

export interface LienTimelineBookInput {
  rows: ReadonlyArray<LienNoticeMonthRow>
  affidavitRows: ReadonlyArray<LienAffidavitRow>
  items: ReadonlyArray<LienDeskItemRow>
  filingsByJob: Readonly<Record<string, ReadonlyArray<JobLienFilingRow>>>
  jobs: Readonly<Record<string, LienBookJob>>
  policyByCustomer: Readonly<Record<string, LienNoticePolicy>>
  todayYmd: string
}

/** due — something to do inside the desk's lead; later — the path runs, nothing to do yet; dead — every right gone and noted. */
export type LienBookLens = 'due' | 'later' | 'dead'

export interface LienTimelineBookRow {
  jobId: string
  job: LienBookJob
  timeline: LienTimeline
  months: LienTimelineMonth[]
  lens: LienBookLens
  /** The next step's date, '' when none — the sort key. */
  sortDate: string
}

export interface LienTimelineBook {
  rows: LienTimelineBookRow[]
  /** Every GC in the book with its row count, by name. */
  gcs: { id: string; name: string; count: number }[]
  counts: Record<LienBookLens | 'all', number>
}

function lensFor(t: LienTimeline): LienBookLens {
  const n = t.next
  if (n.kind === 'lien_gone') return n.aside ? 'due' : 'dead'
  if (n.kind === 'serve' || n.kind === 'release' || n.kind === 'retainage') return 'due'
  if (n.kind === 'notice' || n.kind === 'affidavit') return n.daysLeft != null && n.daysLeft <= LIEN_DESK_LEAD_DAYS ? 'due' : 'later'
  if (n.kind === 'suit') return t.steps.find((s) => s.kind === 'suit')?.state === 'due' ? 'due' : 'later'
  return 'later'
}

export function buildLienTimelineBook(input: LienTimelineBookInput): LienTimelineBook {
  const { todayYmd } = input
  const queue = buildLienDeskQueue(input.rows, input.items, input.policyByCustomer, todayYmd)
  const affidavits = buildLienAffidavitQueue(input.affidavitRows, input.items, todayYmd)
  const ids = new Set<string>()
  for (const r of input.rows) ids.add(r.job_id)
  for (const r of input.affidavitRows) ids.add(r.job_id)
  const rows: LienTimelineBookRow[] = []
  for (const jobId of ids) {
    const job = input.jobs[jobId]
    if (!job) continue
    const entry = queue.entries.find((e) => e.jobId === jobId) ?? null
    const affidavit = affidavits.entries.find((e) => e.jobId === jobId) ?? null
    const timeline = buildLienTimelineFromDesk(jobId, {
      rows: input.rows,
      items: input.items,
      filings: input.filingsByJob[jobId] ?? [],
      entry,
      affidavit,
      retainage: job.contractEndedOn ? { contractEndedOn: job.contractEndedOn, deadline: lienThirtyDayClock(job.contractEndedOn), noticed: false } : null,
      isSub: job.isSub,
      propertyKind: job.propertyKind,
      lastWorkDate: job.lastWorkDate,
      openBalance: job.openBalance,
      todayYmd,
    })
    rows.push({ jobId, job, timeline, months: lienTimelineMonthsFromDesk(jobId, input.rows, input.items, todayYmd), lens: lensFor(timeline), sortDate: timeline.next.date })
  }
  rows.sort((a, b) => {
    const da = a.sortDate || '9999-99-99'
    const db = b.sortDate || '9999-99-99'
    if (da !== db) return da < db ? -1 : 1
    return b.job.openBalance - a.job.openBalance
  })
  const gcMap = new Map<string, { id: string; name: string; count: number }>()
  for (const r of rows) {
    if (!r.job.gcId) continue
    const g = gcMap.get(r.job.gcId) ?? { id: r.job.gcId, name: r.job.gcName || 'GC', count: 0 }
    g.count += 1
    gcMap.set(r.job.gcId, g)
  }
  const gcs = [...gcMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  const counts = { due: 0, later: 0, dead: 0, all: rows.length }
  for (const r of rows) counts[r.lens] += 1
  return { rows, gcs, counts }
}

export type LienBookShow = 'due' | 'all'

export function filterLienTimelineBook(book: LienTimelineBook, opts: { gcId: string | null; show: LienBookShow }): LienTimelineBookRow[] {
  return book.rows.filter((r) => (opts.gcId ? r.job.gcId === opts.gcId : true) && (opts.show === 'all' ? true : r.lens === 'due'))
}

// ---------- the grid: counsel's columns, per GC ----------

export interface LienGridRow {
  job: string
  address: string
  owner: string
  kind: string
  lastOnSite: string
  unpaid: string
  notices: string
  affidavit: string
  bond: string
  paidOut: string
  reserved: string
  contractCompleted: string
}

function kindWords(job: LienBookJob): string {
  const k = job.propertyKind === 'residential' ? 'Res' : job.propertyKind ? 'Com' : 'Com?'
  return `${k} · ${job.homestead ? 'homestead' : '—'}`
}

export function lienGridRows(rows: ReadonlyArray<LienTimelineBookRow>, todayYmd: string): LienGridRow[] {
  return rows.map((r) => {
    const t = r.timeline
    const last = t.steps.find((s) => s.kind === 'last_work')
    const notices = t.steps
      .filter((s) => s.kind === 'notice' && s.monthKey)
      .map((s) => `${workMonthShort(s.monthKey!)}: ${s.dateWords}${s.state === 'missed' ? ' MISSED' : s.state === 'done' ? ' sent' : ''}`)
      .join(' · ')
    const aff = t.steps.find((s) => s.kind === 'affidavit')
    const affWords = aff ? `${aff.dateWords}${aff.state === 'blocked' ? ' — no notice, lien gone' : aff.state === 'missed' ? ' — MISSED' : ''}` : ''
    const openMonths = r.months.filter((m) => m.outcome !== 'sent').map((m) => workMonthShort(m.key))
    return {
      job: r.job.label,
      address: r.job.address,
      owner: r.job.ownerName,
      kind: kindWords(r.job),
      lastOnSite: last ? `${last.dateWords}${r.timeline.steps[0]?.words.startsWith('dated from') ? ' (created)' : ''}` : '',
      unpaid: `${openMonths.length ? openMonths.join(', ') + ' · ' : ''}${formatUsdNoCents(r.job.openBalance)}`,
      notices: r.job.isSub ? notices : 'none needed (with the owner)',
      affidavit: affWords,
      bond: r.job.paymentBond === 'yes' ? 'Y' : r.job.paymentBond === 'no' ? 'N' : '',
      paidOut: '',
      reserved: '',
      contractCompleted: r.job.contractEndedOn ? lienDateWords(r.job.contractEndedOn, todayYmd) : '',
    }
  })
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export const LIEN_GRID_COLUMNS: ReadonlyArray<{ key: keyof LienGridRow; label: string }> = [
  { key: 'job', label: 'Job' },
  { key: 'address', label: 'Address' },
  { key: 'owner', label: 'Owner of record' },
  { key: 'kind', label: 'Kind · homestead' },
  { key: 'lastOnSite', label: 'Last on site' },
  { key: 'unpaid', label: 'Unpaid months · $' },
  { key: 'notices', label: '§ 53.056 per month' },
  { key: 'affidavit', label: 'Affidavit by' },
  { key: 'bond', label: 'Bond' },
  { key: 'paidOut', label: 'Paid out to GC' },
  { key: 'reserved', label: '10 % reserved' },
  { key: 'contractCompleted', label: 'Contract completed' },
]

/** The printable grid (letter, landscape): one row per job, counsel's twelve columns, blanks where the app has no fact yet. */
export function lienGridHtml(rows: ReadonlyArray<LienTimelineBookRow>, opts: { title: string; todayYmd: string; companyName: string }): string {
  const grid = lienGridRows(rows, opts.todayYmd)
  const open = rows.reduce((s, r) => s + r.job.openBalance, 0)
  const head = LIEN_GRID_COLUMNS.map((c) => `<th>${esc(c.label)}</th>`).join('')
  const body = grid
    .map((g) => `<tr>${LIEN_GRID_COLUMNS.map((c) => `<td${g[c.key] ? '' : ' class="blank"'}>${g[c.key] ? esc(g[c.key]) : '—'}</td>`).join('')}</tr>`)
    .join('\n')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Lien grid — ${esc(opts.title)}</title>
<style>
  @page { size: letter landscape; margin: 0.5in; }
  body { font: 10.5px/1.35 -apple-system, "Segoe UI", system-ui, sans-serif; color: #111827; margin: 0; }
  h1 { font-size: 14px; margin: 0 0 2px; }
  p.lede { margin: 0 0 8px; color: #4B5563; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #CBD5E1; padding: 3px 5px; text-align: left; vertical-align: top; }
  th { background: #F3F4F6; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
  td.blank { color: #9CA3AF; }
  p.foot { margin: 8px 0 0; color: #6B7280; font-size: 9.5px; }
</style></head><body>
<h1>Lien grid — ${esc(opts.title)} · ${rows.length} ${rows.length === 1 ? 'job' : 'jobs'} · ${esc(formatUsdNoCents(open))} open</h1>
<p class="lede">${esc(opts.companyName)} · ${esc(lienDateWords(opts.todayYmd, opts.todayYmd))}, ${opts.todayYmd.slice(0, 4)}. Deadlines are per job and per work month (§ 53.056, § 53.052); weekends roll to the next business day. <i>Com?</i> is a property of unknown kind — commercial dates shown; a residential property is a month earlier.</p>
<table><thead><tr>${head}</tr></thead><tbody>
${body}
</tbody></table>
<p class="foot">Blank columns are facts the app does not hold for that job yet — payment bond, paid-out-to-GC, the 10 % reserved, the original contract’s completion (punch list #33); the office fills them by hand from the owner calls until then.</p>
</body></html>`
}
