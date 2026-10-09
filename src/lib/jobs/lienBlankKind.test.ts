/**
 * A blank property kind reads residential — the earlier date — on every screen (v2.5031; the owner's call of
 * 2026-10-09, lien punch item K). One table: each reader asked for a date with the kind not set must give the
 * residential date, a month before the commercial one. A second table: each reader that draws a date for an
 * unset kind still says the kind is not set, and says the dates are the residential ones.
 */
import { describe, expect, it } from 'vitest'
import { computeJobLienClock, filingDeadlineForMonth, noticeDeadlineForMonth } from './lienDeadlines'
import { lienFilingDeadlineForMonth } from '../jobsDocuments/demandLetter'
import { buildJobWorkMonths } from './forecastWorkMonths'
import { affidavitMonthWordFor, buildGcOnNotice, type GcUnpaidMonthRow } from './gcOnNotice'
import { buildLienTimeline, LIEN_KIND_UNKNOWN_WORDS, type LienTimelineInput } from './lienTimeline'
import { buildLienTimelineFromWindow } from './lienTimelineDesk'
import { buildLienTimelineBook, lienGridRows } from './lienTimelineBook'
import { lienRulesJobFrom } from './lienRulesDates'
import { lienByForJob } from './lienPayRunway'
import { buildLienMonthGrid } from './lienMonthGrid'
import { lienSupplierHouseNotice } from './lienJobSuppliers'
import { propertyKindClockWords, propertyKindRuleWords } from './lienDeskGates'
import { propertyKindCell } from '../legal/legalProperty'
import type { LienNoticeMonthRow } from './lienDesk'

const TODAY = '2026-09-01'
const KINDS = { blank: '', residential: 'residential', commercial: 'non_residential' } as const
type Kind = (typeof KINDS)[keyof typeof KINDS]

function gcRow(kind: Kind): GcUnpaidMonthRow {
  return {
    job_id: 'j1', work_month: '2026-08', approved_hours: 8, deadline: noticeDeadlineForMonth('2026-08-01', kind), noticed: false, open_balance: 12_400,
    customer_id: 'c1', gc_customer_id: 'gc1', property_kind: kind, has_owner: true, desk_item_id: null, desk_status: null, desk_months: null,
    is_billed: true, job_status: 'billed', last_work_month: '2026-08',
  } as GcUnpaidMonthRow
}

function timelineInput(kind: Kind): LienTimelineInput {
  return {
    todayYmd: TODAY, isSub: true, propertyKind: kind, lastMonth: '2026-08', lastMonthFromCreation: false,
    months: [{ key: '2026-08', deadline: noticeDeadlineForMonth('2026-08-01', kind), fromCreation: false, outcome: 'open', at: '' }],
    noticeState: 'to_draft', retainage: null, affidavit: null, originalContractCompletedOn: null, releasedAt: null, paid: false,
  }
}

function bookRow(kind: Kind) {
  const row = { job_id: 'j1', work_month: '2026-08', approved_hours: 8, deadline: noticeDeadlineForMonth('2026-08-01', kind), noticed: false, open_balance: 12_400, customer_id: 'c1', gc_customer_id: 'gc1', property_kind: kind, has_owner: true, desk_item_id: null, desk_status: null, desk_months: null } as LienNoticeMonthRow
  const book = buildLienTimelineBook({
    rows: [row], affidavitRows: [], items: [], filingsByJob: {}, policyByCustomer: {}, todayYmd: TODAY,
    jobs: { j1: { id: 'j1', label: '651 · Palomino Trail', address: '233 Palomino Trail', gcId: 'gc1', gcName: 'Loberg Contracting', propertyKind: kind, homestead: false, county: 'Medina', ownerName: 'Garcia', openBalance: 12_400, lastWorkDate: '2026-08-20', isSub: true } },
  })
  return book.rows[0]!
}

/** Each reader's date for an August job (or an August invoice), as a YYYY-MM-DD. */
const DATE_READERS: ReadonlyArray<{ reader: string; date: (kind: Kind) => string }> = [
  { reader: 'lienDeadlines · the notice', date: (k) => noticeDeadlineForMonth('2026-08-01', k) },
  { reader: 'lienDeadlines · the affidavit', date: (k) => filingDeadlineForMonth('2026-08-01', k) },
  { reader: 'the Lien window’s clock', date: (k) => computeJobLienClock({ lastWorkYmd: '2026-08-20', propertyKind: k, isSub: true }).noticeDeadline },
  { reader: 'the demand letter', date: (k) => lienFilingDeadlineForMonth('2026-08-20', k) },
  { reader: 'the Forecast panel', date: (k) => buildJobWorkMonths([{ jobId: 'j1', userId: 'u1', workDate: '2026-08-20', clockedInAt: '2026-08-20T13:00:00Z', clockedOutAt: '2026-08-20T21:00:00Z', approved: true }], { jobId: 'j1', isSub: true, propertyKind: k, noticedMonths: new Set() }, { u1: 'Tristen' }, TODAY)!.affidavitDue },
  { reader: 'the GC run', date: (k) => buildGcOnNotice([gcRow(k)], [], () => 'on_file', TODAY).jobs[0]!.affidavitBy },
  { reader: 'the timeline (Lien window, desk strip)', date: (k) => buildLienTimeline(timelineInput(k)).steps.find((s) => s.kind === 'affidavit')!.date },
  { reader: 'the desk’s Timeline tab', date: (k) => buildLienTimelineFromWindow({ workMonths: null, filings: [], job: { id: 'j1', created_at: '2026-08-04T14:00:00Z', last_work_date: null }, isSub: true, propertyKind: k, openBalance: 4_100, todayYmd: TODAY }).steps.find((s) => s.kind === 'notice')!.date },
  { reader: 'the timeline book', date: (k) => bookRow(k).timeline.steps.find((s) => s.kind === 'affidavit')!.date },
  { reader: '§ Rules', date: (k) => lienRulesJobFrom({ label: 'J1', propertyKind: k, isSub: true, months: [{ key: '2026-08' }], earliestDeadline: null }, TODAY).lienDue },
  { reader: 'the runway (Calendar, Pipeline)', date: (k) => lienByForJob('2026-08-20', k).ymd },
  // A desk month with no deadline of its own falls back on the kernel.
  { reader: 'the desk’s month grid', date: (k) => buildLienMonthGrid({ jobId: 'j1', months: [{ key: '2026-08', approvedHours: 10, deadline: '', daysLeft: 0, noticed: false, fromCreation: false }], items: [], filings: [], checked: new Set(['2026-08']), thisItem: null, thisPile: 'to_draft', propertyKind: k, todayYmd: TODAY }).rows.find((r) => r.month === '2026-08')?.window.deadline ?? '' },
  { reader: 'a supply house’s window', date: (k) => {
    const n = lienSupplierHouseNotice({ unpaidMonths: ['2026-08'], word: null }, k, TODAY)
    return n.kind === 'open' ? n.ymd : ''
  } },
]

describe('a blank property kind dates as residential on every reader (v2.5031)', () => {
  it.each(DATE_READERS)('$reader', ({ date }) => {
    const blank = date(KINDS.blank)
    expect(blank).not.toBe('')
    expect(blank).toBe(date(KINDS.residential))
    expect(blank < date(KINDS.commercial)).toBe(true)
  })

  it('the run’s letter names the residential month too, whatever its tone', () => {
    expect(affidavitMonthWordFor('')).toBe(affidavitMonthWordFor('residential'))
    expect(affidavitMonthWordFor('non_residential')).toBe('fourth')
  })
})

/** Each reader's words for an unset kind: it still asks for the kind, and names the dates it shows. */
const WARNING_READERS: ReadonlyArray<{ reader: string; words: () => string }> = [
  { reader: 'the timeline’s note (Lien window, desk strip)', words: () => (buildLienTimeline(timelineInput('')).kindUnknown ? LIEN_KIND_UNKNOWN_WORDS : '') },
  { reader: 'the desk’s gate 3', words: () => propertyKindClockWords('', 'Medina') },
  { reader: 'the desk’s gate 3 rule line', words: () => propertyKindRuleWords('') },
  { reader: 'the legal packet’s kind cell', words: () => propertyKindCell('') },
  { reader: 'the timeline book’s kind column', words: () => (lienGridRows([bookRow('')], TODAY)[0]!.kind.startsWith('Res?') ? 'kind not set · residential dates' : '') },
  { reader: 'the runway', words: () => (lienByForJob('2026-08-20', '').kindAssumed ? 'kind not set · residential assumed' : '') },
]

describe('every reader still asks for the kind while it is not set (v2.5031)', () => {
  it.each(WARNING_READERS)('$reader', ({ words }) => {
    const w = words()
    expect(w).toMatch(/not set|unknown|Set the kind/i)
    expect(w).toMatch(/residential/i)
  })
})
