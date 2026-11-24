/**
 * The Legal desk and the firm's page count from the last day of work set by hand (punch list #335, Also seen).
 * They dated a job from its approved hours, else its last work date, else its bill, else its creation, so counsel's
 * page could show a later last day than the job's Lien window, which has counted from the hand day since v2.7193
 * (the owner's reading of 2026-11-13: the day set by hand counts). Every job, name and number here is made up.
 */
import { describe, expect, it } from 'vitest'
import { makeInvoice, makeJob } from '../../test/renderSmokeMocks'
import { buildLienTimelineFromWindow } from '../jobs/lienTimelineDesk'
import { lienLastWorkDay } from '../jobs/lienLastWorkDay'
import { buildLegalPacket, groupCollectionsByPayer, type LegalAccountSummary } from './legalPacket'
import { legalLastWorkBasis, legalLastWorkWords, legalTimelineLastWorkWords, workMonthsFromSessions } from './legalLienPaper'
import { MATTER_COUNSEL_SELECT, MATTER_JOB_COLUMNS, shapeMatterForCounsel } from './legalMatterShape'
import { sampleLegalPortalResponse } from '../../../supabase/functions/_shared/customerSampleFixtures'
import { buildMatterPacket, parseLegalPortalPayload, portalFeeModel } from './legalPortalPayload'

const TODAY = '2026-09-01'
const MADE = '2026-03-02T15:00:00Z'
const s = (jobId: string, day: string, approved = true) => ({ jobId, workDate: day, clockedInAt: `${day}T13:00:00Z`, clockedOutAt: `${day}T21:00:00Z`, hasGps: true, approved, disqualified: false })

describe('legalLastWorkBasis · the rule’s order', () => {
  it('1. the day set by hand comes first, with the reason it was saved with', () => {
    expect(legalLastWorkBasis([], { lien_last_work_on: '2026-06-18', lien_last_work_note: 'Crew pulled off the job that day', created_at: MADE })).toEqual({ ymd: '2026-06-18', source: 'hand', note: 'Crew pulled off the job that day', laterHoursDay: '' })
    // No reason on the row reads as none, never as a missing day.
    expect(legalLastWorkBasis([], { lien_last_work_on: '2026-06-18', created_at: MADE })).toEqual({ ymd: '2026-06-18', source: 'hand', note: '', laterHoursDay: '' })
  })

  it('2. approved hours only: the last approved clock day, as before', () => {
    expect(legalLastWorkBasis(['2026-05-14', '2026-05-29'], { last_work_date: '2026-06-30', created_at: MADE })).toEqual({ ymd: '2026-05-29', source: 'sessions' })
  })

  it('3. the last work date only, as before', () => {
    expect(legalLastWorkBasis([], { last_work_date: '2026-06-30', created_at: MADE })).toEqual({ ymd: '2026-06-30', source: 'last_work_date' })
  })

  it('4. a sent, unpaid bill only, then 5. the creation day only, then nothing, as before', () => {
    const bill = makeInvoice({ id: 'inv-1', amount: 900, status: 'billed', billed_at: '2026-04-20T15:00:00Z', sent_to_customer_at: '2026-04-20T15:05:00Z' })
    expect(legalLastWorkBasis([], { created_at: MADE, invoices: [bill] })).toEqual({ ymd: '2026-04-20', source: 'bill' })
    expect(legalLastWorkBasis([], { created_at: MADE })).toEqual({ ymd: '2026-03-02', source: 'created' })
    expect(legalLastWorkBasis([], {})).toEqual({ ymd: null, source: 'none' })
  })

  it('set by hand earlier than the hours: the hand day counts, and the later hours are said, not followed', () => {
    const got = legalLastWorkBasis(['2026-06-10', '2026-08-14'], { lien_last_work_on: '2026-06-18', lien_last_work_note: 'Punch work after it was warranty', last_work_date: '2026-08-14', created_at: MADE })
    expect(got).toEqual({ ymd: '2026-06-18', source: 'hand', note: 'Punch work after it was warranty', laterHoursDay: '2026-08-14' })
    // The ledger's last work date counts as later hours too, when the packet holds no session.
    expect(legalLastWorkBasis([], { lien_last_work_on: '2026-06-18', last_work_date: '2026-07-03' }).laterHoursDay).toBe('2026-07-03')
  })

  it('set by hand later than the hours: the hand day counts, and there are no later hours to say', () => {
    expect(legalLastWorkBasis(['2026-05-14', '2026-05-29'], { lien_last_work_on: '2026-07-22', lien_last_work_note: 'Final trim, not clocked', last_work_date: '2026-05-29', created_at: MADE })).toEqual({ ymd: '2026-07-22', source: 'hand', note: 'Final trim, not clocked', laterHoursDay: '' })
  })

  it('a hand day that is no real day is no hand day: the rest of the order stands', () => {
    expect(legalLastWorkBasis(['2026-05-29'], { lien_last_work_on: '', created_at: MADE })).toEqual({ ymd: '2026-05-29', source: 'sessions' })
    expect(legalLastWorkBasis(['2026-05-29'], { lien_last_work_on: null, created_at: MADE })).toEqual({ ymd: '2026-05-29', source: 'sessions' })
    expect(legalLastWorkBasis(['2026-05-29'], { lien_last_work_on: 'soon', created_at: MADE })).toEqual({ ymd: '2026-05-29', source: 'sessions' })
  })

  it('the order is the Lien window’s own: the same job reads the same day and source there', () => {
    const job = { lien_last_work_on: '2026-06-18', lien_last_work_note: 'Crew pulled off the job that day', last_work_date: '2026-08-14', created_at: MADE }
    expect(lienLastWorkDay(job)).toMatchObject({ day: '2026-06-18', source: 'hand', note: 'Crew pulled off the job that day' })
    expect(legalLastWorkBasis(['2026-08-14'], job)).toMatchObject({ ymd: '2026-06-18', source: 'hand', note: 'Crew pulled off the job that day' })
  })
})

describe('the words beside the day', () => {
  it('a hand day says so, gives its reason, and says later hours do not move it', () => {
    expect(legalLastWorkWords('2026-06-18', 'hand')).toBe('last day of work set by hand 2026-06-18')
    expect(legalLastWorkWords('2026-06-18', 'hand', { note: 'Crew pulled off the job that day' })).toBe('last day of work set by hand 2026-06-18, reason: Crew pulled off the job that day')
    expect(legalLastWorkWords('2026-06-18', 'hand', { note: 'Crew pulled off the job that day.', laterHoursDay: '2026-08-14' })).toBe('last day of work set by hand 2026-06-18, reason: Crew pulled off the job that day. Hours were approved after it, through 2026-08-14. They do not move it.')
    expect(legalLastWorkWords('2026-06-18', 'hand', { laterHoursDay: '2026-08-14' })).toBe('last day of work set by hand 2026-06-18. Hours were approved after it, through 2026-08-14. They do not move it.')
  })

  it('every other source reads word for word as it did', () => {
    expect(legalLastWorkWords('2026-05-29', 'sessions')).toBe('last approved clock day 2026-05-29')
    expect(legalLastWorkWords('2026-06-30', 'last_work_date')).toBe('last work date on the job 2026-06-30 (no approved clock session)')
    expect(legalLastWorkWords('2026-04-20', 'bill')).toBe("no work date on file: dated from the bill's month, 2026-04")
    expect(legalLastWorkWords('2026-03-02', 'created')).toBe("no work date on file: dated from the job's creation month, 2026-03")
    expect(legalLastWorkWords(null, 'none')).toBe('')
    // A reason or later hours handed with another source change nothing.
    expect(legalLastWorkWords('2026-05-29', 'sessions', { note: 'x', laterHoursDay: '2026-08-14' })).toBe('last approved clock day 2026-05-29')
  })
})

describe('the packet counts from the hand day, as the job’s Lien window does', () => {
  const sessions = [s('j1', '2026-06-10'), s('j1', '2026-06-17'), s('j1', '2026-08-14')]
  const job = (over: Record<string, unknown> = {}) =>
    makeJob({ id: 'j1', created_at: MADE, hcp_number: '412', status: 'billed', customer_id: 'c1', customer_name: 'Made-up Homes', collections_at: '2026-08-25T15:00:00Z', last_work_date: '2026-08-14', invoices: [makeInvoice({ id: 'inv-j1', amount: 4_200, status: 'billed', billed_at: '2026-06-20T15:00:00Z', sent_to_customer_at: '2026-06-20T15:05:00Z' })], ...over })
  const packetFor = (j: ReturnType<typeof job>) => {
    const account = groupCollectionsByPayer([j], new Map(), TODAY)[0] as LegalAccountSummary
    return buildLegalPacket({ todayYmd: TODAY, account, customer: null, contacts: [], contactEntries: [], addresses: [], contracts: [], signedEstimates: [], demandLetters: [], lienFilings: [], promises: [], promiseOutcomes: [], chaseTouches: [], reports: [], clockSessions: sessions, threadNotes: [], users: [] })
  }
  /** The job's Lien window, from the same rows: the reading the packet has to match. */
  const windowFor = (j: ReturnType<typeof job>) =>
    buildLienTimelineFromWindow({ workMonths: workMonthsFromSessions('j1', sessions, { isSub: false, propertyKind: '' }), filings: [], job: { id: 'j1', created_at: j.created_at ?? null, last_work_date: j.last_work_date ?? null, lien_last_work_on: j.lien_last_work_on ?? null, invoices: j.invoices }, isSub: false, propertyKind: '', openBalance: 4_200, todayYmd: TODAY })
  const affidavitDay = (t: ReturnType<typeof windowFor>) => t.steps.find((x) => x.kind === 'affidavit')?.date ?? ''
  const lastWorkWords = (t: ReturnType<typeof windowFor>) => t.steps.find((x) => x.kind === 'last_work')?.words ?? ''

  it('with no hand day the packet reads the hours, as before', () => {
    const p = packetFor(job())
    expect(p.paper.lienClock[0]).toMatchObject({ lastWorkYmd: '2026-08-14', lastWorkSource: 'sessions' })
    expect(p.paper.timelines[0]).toMatchObject({ lastWorkYmd: '2026-08-14', lastWorkSource: 'sessions' })
    expect(legalTimelineLastWorkWords(p.paper.timelines[0]!)).toBe('last approved clock day 2026-08-14')
  })

  it('a hand day earlier than the hours: the clock line, the path and the words all count from it', () => {
    const j = job({ lien_last_work_on: '2026-06-18', lien_last_work_note: 'Punch work after it was warranty' })
    const p = packetFor(j)
    const before = packetFor(job())
    const win = windowFor(j)
    // The clock line: the hand day, and a filing day two months earlier than the hours gave.
    expect(p.paper.lienClock[0]).toMatchObject({ lastWorkYmd: '2026-06-18', lastWorkSource: 'hand' })
    expect(p.paper.lienClock[0]!.filingDeadline).toBe(affidavitDay(win))
    expect(p.paper.lienClock[0]!.filingDeadline < before.paper.lienClock[0]!.filingDeadline).toBe(true)
    expect(p.paper.lienClock[0]!.suitDeadline < before.paper.lienClock[0]!.suitDeadline).toBe(true)
    // Where each job stands: the same path the Lien window draws, step for step.
    const t = p.paper.timelines[0]!
    expect(t).toMatchObject({ lastWorkYmd: '2026-06-18', lastWorkSource: 'hand' })
    expect(t.timeline.steps.map((x) => [x.kind, x.date, x.words])).toEqual(win.steps.map((x) => [x.kind, x.date, x.words]))
    expect(affidavitDay(t.timeline)).toBe(affidavitDay(win))
    expect(lastWorkWords(t.timeline)).toBe('last day set by hand · later hours do not move it')
    expect(legalTimelineLastWorkWords(t)).toBe('last day of work set by hand 2026-06-18, reason: Punch work after it was warranty. Hours were approved after it, through 2026-08-14. They do not move it.')
    // The evidence table still reports the hours on record: a hand day is no clock session.
    expect(p.evidence[0]).toMatchObject({ firstWorkYmd: '2026-06-10', lastWorkYmd: '2026-08-14' })
  })

  it('a hand day later than the hours: the same, the other way', () => {
    const j = job({ lien_last_work_on: '2026-08-27', lien_last_work_note: 'Final trim, not clocked' })
    const p = packetFor(j)
    const before = packetFor(job())
    const win = windowFor(j)
    expect(p.paper.lienClock[0]).toMatchObject({ lastWorkYmd: '2026-08-27', lastWorkSource: 'hand' })
    expect(p.paper.lienClock[0]!.filingDeadline).toBe(affidavitDay(win))
    // August either way, so the month's days do not move; the day shown does.
    expect(p.paper.lienClock[0]!.filingDeadline).toBe(before.paper.lienClock[0]!.filingDeadline)
    const t = p.paper.timelines[0]!
    expect(t.timeline.steps.map((x) => [x.kind, x.date, x.words])).toEqual(win.steps.map((x) => [x.kind, x.date, x.words]))
    expect(lastWorkWords(t.timeline)).toBe('last day set by hand')
    expect(legalTimelineLastWorkWords(t)).toBe('last day of work set by hand 2026-08-27, reason: Final trim, not clocked')
  })
})

describe('what the function sends the firm', () => {
  it('the job’s columns carry the hand day and its reason, and never who set it', () => {
    expect(MATTER_JOB_COLUMNS).toEqual(expect.arrayContaining(['lien_last_work_on', 'lien_last_work_note']))
    expect(MATTER_JOB_COLUMNS).not.toEqual(expect.arrayContaining(['lien_last_work_set_by']))
    expect(MATTER_COUNSEL_SELECT.jobs.split(', ')).toEqual(expect.arrayContaining(['lien_last_work_on', 'lien_last_work_note']))
    const shaped = shapeMatterForCounsel({ jobs: [{ id: 'j1', lien_last_work_on: '2026-06-18', lien_last_work_note: 'Crew pulled off the job that day', lien_last_work_set_by: 'u-1', lien_last_work_set_at: '2026-07-01T15:00:00Z' }] }) as { jobs: Array<Record<string, unknown>> }
    expect(shaped.jobs[0]).toMatchObject({ lien_last_work_on: '2026-06-18', lien_last_work_note: 'Crew pulled off the job that day' })
    expect(shaped.jobs[0]).not.toHaveProperty('lien_last_work_set_by')
    expect(shaped.jobs[0]).not.toHaveProperty('lien_last_work_set_at')
  })

  // The firm's page end to end: the function's payload, parsed and built into the packet the page draws.
  type Row = Record<string, unknown>
  const company = { name: 'Made-up Plumbing', cityLine: 'Nowhere, TX', licenseLine: '', phone: '(512) 555-0100', email: 'office@example.com' }
  const PAGE_TODAY = '2026-10-05'
  /** The sample matter as the function sends it, its first job with a hand day (or as an older function sends it, with neither column). */
  const firmTimeline = (jobOver: Row | 'old function') => {
    const payload = sampleLegalPortalResponse(company, PAGE_TODAY) as { matters: Array<Row & { jobs: Row[] }> }
    const m = structuredClone(payload.matters[0]!)
    const jobId = m.jobs[0]!.id as string
    m.jobs = m.jobs.map((j, i) => (i === 0 && jobOver !== 'old function' ? { ...j, ...jobOver } : j))
    const shaped = shapeMatterForCounsel(m) as Row & { jobs: Row[] }
    if (jobOver === 'old function') for (const j of shaped.jobs) { delete j.lien_last_work_on; delete j.lien_last_work_note }
    const parsed = parseLegalPortalPayload({ ...payload, matters: [shaped] })!
    const packet = buildMatterPacket(parsed.matters[0]!, PAGE_TODAY, portalFeeModel(parsed))!
    return { t: packet.paper.timelines.find((x) => x.jobId === jobId)!, clock: packet.paper.lienClock.find((x) => x.jobId === jobId)! }
  }

  it('the firm’s page counts from the hand day the function sends, and says its reason', () => {
    const before = firmTimeline({})
    expect(before.t.lastWorkSource).toBe('sessions')
    const hoursDay = before.t.lastWorkYmd!
    // A made-up hand day a month before the sample's last approved hours.
    const hand = `${hoursDay.slice(0, 4)}-${String(Number(hoursDay.slice(5, 7)) - 1).padStart(2, '0')}-10`
    const { t, clock } = firmTimeline({ lien_last_work_on: hand, lien_last_work_note: 'Crew pulled off the job that day' })
    expect(t).toMatchObject({ lastWorkYmd: hand, lastWorkSource: 'hand', lastWorkHand: { note: 'Crew pulled off the job that day', laterHoursDay: hoursDay } })
    expect(clock).toMatchObject({ lastWorkYmd: hand, lastWorkSource: 'hand' })
    expect(legalTimelineLastWorkWords(t)).toBe(`last day of work set by hand ${hand}, reason: Crew pulled off the job that day. Hours were approved after it, through ${hoursDay}. They do not move it.`)
    expect(t.timeline.steps.find((x) => x.kind === 'last_work')?.words).toBe('last day set by hand · later hours do not move it')
  })

  it('a function not yet deployed sends neither column: the new page dates the job as it did, from its hours', () => {
    const before = firmTimeline({})
    const old = firmTimeline('old function')
    expect(old.t).toMatchObject({ lastWorkYmd: before.t.lastWorkYmd, lastWorkSource: 'sessions' })
    expect(old.t.lastWorkHand).toBeUndefined()
    expect(old.t.timeline.steps.map((x) => [x.kind, x.date, x.words])).toEqual(before.t.timeline.steps.map((x) => [x.kind, x.date, x.words]))
    expect(legalLastWorkBasis(['2026-08-14'], { last_work_date: '2026-08-14', created_at: MADE })).toEqual({ ymd: '2026-08-14', source: 'sessions' })
  })
})
