import { describe, expect, it } from 'vitest'
import { daysBetweenYmd } from './billedExpectedPay'
import { filingDeadlineForMonth, noticeDeadlineForMonth } from './lienDeadlines'
import { buildLienDeskQueue, type LienDeskItemRow, type LienNoticeMonthRow } from './lienDesk'
import { buildLienAffidavitQueue, type LienAffidavitRow } from './lienDeskAffidavits'
import { LIEN_DESK_STARTED_READ_DAYS, lienDeskKeepNoticeRows, lienDeskKeepRows } from './lienDeskStarted'
import { lienLateNoticeUntil, lienMissedNoticeStillGoes, lienNoticeFootHead } from './lienPaneSections'
import { buildLienTimeline, type LienTimelineInput } from './lienTimeline'
import { buildLienTimelineFromDesk } from './lienTimelineDesk'

/**
 * The notice pane and its path read the late window off one day (punch list #415).
 *
 * A sub job whose every notice window closed unsent can still send a late notice while the affidavit's own day is ahead
 * (v2.4708). Two readers on one pane said whether it could: the path (`buildLienTimeline`'s Next on the path) and the
 * desk's `lateUntil`, which the months card, the gates' fold and the footer read. The path dates the affidavit from the
 * windows' list when it holds the job, else from the last month of work. `lateUntil` read the list alone, and the desk
 * keeps a row only within thirty days of its day (`lienDeskKeepRows`). The day after the last notice window closes the
 * affidavit's day is 31 or 32 days off whenever its 15th falls on a weekend and moves to Monday, so on those days the
 * card said *lien right gone* over a path that said *Send the notice late*. This file holds the two to one day.
 *
 * Made-up job. The two readers' day filters are written here as their SQL has them (`list_lien_notice_months`,
 * `list_lien_affidavit_windows`); everything after is the desk's own kernels.
 */

const addDays = (ymd: string, n: number): string => {
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const startedAffidavit = { id: 'i1', job_id: 'j1', kind: 'affidavit', status: 'drafted', voided_at: null, months: [], created_at: '2026-01-01T00:00:00Z' } as unknown as LienDeskItemRow

/** One job on one day, as the desk reads it: a sub job with one work month, nothing sent, the owner on file. */
function read(month: string, propertyKind: string, todayYmd: string, opts: { startedAffidavit?: boolean; filed?: boolean } = {}) {
  const noticeDay = noticeDeadlineForMonth(`${month}-01`, propertyKind)
  const affidavitDay = filingDeadlineForMonth(`${month}-01`, propertyKind)
  const noticeRow: LienNoticeMonthRow = { job_id: 'j1', work_month: month, approved_hours: 8, deadline: noticeDay, noticed: false, open_balance: 1000, customer_id: 'c1', gc_customer_id: 'g1', property_kind: propertyKind, has_owner: true, desk_item_id: null, desk_status: null, desk_months: null, month_source: 'hours' }
  const affidavitRow: LienAffidavitRow = { job_id: 'j1', last_month: month, deadline: affidavitDay, is_sub: true, noticed: false, filed: opts.filed === true, open_balance: 1000, customer_id: 'c1', gc_customer_id: 'g1', property_kind: propertyKind, has_owner: true, has_legal: true, homestead: false, desk_item_id: null, desk_status: null }
  const items = opts.startedAffidavit ? [startedAffidavit] : []
  const rows = lienDeskKeepNoticeRows([noticeRow], items, todayYmd)
  // The windows reader: a day no further than the read looks ahead, and no more than seven days past.
  const daysToAffidavit = daysBetweenYmd(todayYmd, affidavitDay) ?? 0
  const affidavitRowsRead = daysToAffidavit <= LIEN_DESK_STARTED_READ_DAYS && daysToAffidavit >= -7 ? [affidavitRow] : []
  const affidavitRows = lienDeskKeepRows(affidavitRowsRead, items, 'affidavit', todayYmd)
  const affidavits = buildLienAffidavitQueue(affidavitRows, items, todayYmd)
  const entry = buildLienDeskQueue(rows, items, {}, todayYmd).entries.find((e) => e.jobId === 'j1') ?? null
  const listed = affidavits.entries.find((e) => e.jobId === 'j1') ?? null
  const timeline = buildLienTimelineFromDesk('j1', { rows, items, filings: [], entry, affidavit: listed, isSub: true, propertyKind, lastWorkDate: `${month}-20`, openBalance: 1000, todayYmd })
  // As `LienDesk.tsx` hands it over: the list's word, and the kept row's own flag, since a paper filed with no desk item is on no pile.
  const lateUntil = lienLateNoticeUntil({ entry, affidavitDay: timeline.affidavitDay, affidavitFiled: listed?.pile === 'filed' || affidavitRows.some((r) => r.filed), todayYmd })
  return { noticeDay, affidavitDay, daysToAffidavit, entry, listed, timeline, lateUntil }
}

describe('the notice pane and its path read the late window off one day (punch list #415)', () => {
  it('the smallest case: the day after the notice window closes, with the affidavit’s day 31 days off and the windows’ list silent', () => {
    // A commercial job last worked in January 2027: the notice by Thursday Apr 15, the affidavit by Monday May 17 (May 15 is a Saturday).
    const day = read('2027-01', 'non_residential', '2027-04-16')
    expect(day).toMatchObject({ noticeDay: '2027-04-15', affidavitDay: '2027-05-17', daysToAffidavit: 31, listed: null })
    expect(day.entry).toMatchObject({ pile: 'missed', dueMonths: [], missedMonths: ['2027-01'] })
    // The path never lost the job: it dates the affidavit from the last month of work.
    expect(day.timeline.next).toMatchObject({ kind: 'late_notice', date: '2027-05-17' })
    expect(day.timeline.next.words).toBe('Send the Jan notice late, then file the affidavit — 31 days.')
    // The pane reads the same day, so the card offers the late notice and the footer is a draft's.
    expect(day.lateUntil).toBe('2027-05-17')
    expect(lienMissedNoticeStillGoes({ dueMonths: 0, lateUntil: day.lateUntil })).toBe(true)
    expect(lienNoticeFootHead({ pile: 'missed', signed: false, signerFirst: 'Dee', dueMonths: 0, lateUntil: day.lateUntil })).toEqual({ label: 'Sign and send', fact: 'Not signed yet' })
  })

  it('the days either side read as they always did', () => {
    // The last day of the window: a month is still due, so nothing is late yet.
    const lastDay = read('2027-01', 'non_residential', '2027-04-15')
    expect(lastDay.entry).toMatchObject({ pile: 'to_draft', dueMonths: ['2027-01'] })
    expect(lastDay.lateUntil).toBeNull()
    expect(lastDay.timeline.next.kind).toBe('notice')
    // Thirty days off: the windows' list holds the job again, and its day is the path's day.
    const listed = read('2027-01', 'non_residential', '2027-04-17')
    expect(listed.listed?.deadline).toBe('2027-05-17')
    expect(listed.lateUntil).toBe('2027-05-17')
    // The affidavit's own day still counts, and the day after it the lien right is gone on both.
    expect(read('2027-01', 'non_residential', '2027-05-17').lateUntil).toBe('2027-05-17')
    const past = read('2027-01', 'non_residential', '2027-05-18')
    expect(past.lateUntil).toBeNull()
    expect(past.timeline.next.kind).toBe('lien_gone')
    expect(lienNoticeFootHead({ pile: 'missed', signed: false, signerFirst: 'Dee', dueMonths: 0, lateUntil: past.lateUntil })).toEqual({ label: 'Window closed', fact: 'Nothing to sign' })
  })

  it('a job with a started affidavit paper is on the list whatever its day, and a filed affidavit ends the late window', () => {
    const started = read('2027-01', 'non_residential', '2027-04-16', { startedAffidavit: true })
    expect(started.listed?.deadline).toBe('2027-05-17')
    expect(started.lateUntil).toBe('2027-05-17')
    const filed = read('2027-01', 'non_residential', '2027-04-17', { filed: true })
    // A paper filed with no desk item is on no pile, and this made-up job carries no filing row for the path to read: the windows' row still says filed.
    expect(filed.listed).toBeNull()
    expect(filed.timeline.affidavitDay).toBe('2027-05-17')
    expect(filed.lateUntil).toBeNull()
  })

  it('every work month from 2025 to 2030, on each clock, every day from the notice day to two days past the affidavit’s: the pane is late exactly when the path is, to the same day', () => {
    let days = 0
    let listSilent = 0
    for (let y = 2025; y <= 2030; y++) {
      for (let m = 1; m <= 12; m++) {
        const month = `${y}-${String(m).padStart(2, '0')}`
        for (const kind of ['non_residential', 'residential', '']) {
          const from = addDays(noticeDeadlineForMonth(`${month}-01`, kind), 1)
          const to = addDays(filingDeadlineForMonth(`${month}-01`, kind), 2)
          for (let today = from; today <= to; today = addDays(today, 1)) {
            const r = read(month, kind, today)
            days += 1
            const pathLate = r.timeline.next.kind === 'late_notice' ? r.timeline.next.date : null
            if (pathLate && !r.listed) listSilent += 1
            if (r.lateUntil !== pathLate) throw new Error(`${month} ${kind || 'kind not set'} on ${today}: the pane reads ${r.lateUntil ?? 'gone'}, the path ${pathLate ?? r.timeline.next.kind}`)
          }
        }
      }
    }
    expect(days).toBeGreaterThan(6000)
    // The days the list alone would have called gone: the reason the pane takes its day from the path.
    expect(listSilent).toBeGreaterThan(0)
  })
})

describe('the path says its affidavit day (punch list #415)', () => {
  const input = (over: Partial<LienTimelineInput> = {}): LienTimelineInput => ({
    todayYmd: '2027-04-16',
    isSub: true,
    propertyKind: 'non_residential',
    lastMonth: '2027-01',
    lastMonthFromCreation: false,
    months: [{ key: '2027-01', deadline: '2027-04-15', fromCreation: false, outcome: 'missed', at: '' }],
    noticeState: 'to_draft',
    retainage: null,
    affidavit: null,
    originalContractCompletedOn: null,
    releasedAt: null,
    paid: false,
    ...over,
  })

  it('the last month’s own filing day when the windows do not list the job, the windows’ day when they do', () => {
    expect(buildLienTimeline(input()).affidavitDay).toBe('2027-05-17')
    expect(buildLienTimeline(input({ affidavit: { deadline: '2027-05-20', filedAt: null, servedAt: null } as LienTimelineInput['affidavit'] })).affidavitDay).toBe('2027-05-20')
  })

  it('none once an affidavit is filed, and none on a job no month dates', () => {
    expect(buildLienTimeline(input({ affidavit: { deadline: '2027-05-17', filedAt: '2027-05-03', servedAt: null } as LienTimelineInput['affidavit'] })).affidavitDay).toBe('')
    expect(buildLienTimeline(input({ lastMonth: '', months: [] })).affidavitDay).toBe('')
  })
})
