import { describe, expect, it } from 'vitest'
import { buildLienTimelineFromWindow, lienTimelineMonthsFromDesk } from './lienTimelineDesk'
import type { LienDeskItemRow, LienNoticeMonthRow } from './lienDesk'
import type { JobLienFilingRow } from './lienDeadlines'
import type { JobWorkMonths } from './forecastWorkMonths'

const TODAY = '2026-09-23'
const filing = (over: Partial<JobLienFilingRow>): JobLienFilingRow =>
  ({ id: 'f', job_id: 'j1', kind: 'notice_53_056', amount: 0, county: '', created_at: '2026-09-01T12:00:00Z', created_by: null, fields: {}, filed_at: '2026-09-01', invoice_ids: [], months_covered: [], recording_number: '', sends: [], serve_due: null, served_at: null, voided_at: null, ...over }) as JobLienFilingRow

const month = (key: string, due: string, daysLeft: number): JobWorkMonths['months'][number] => ({ key, label: key, weeks: [], people: ['M'], hours: 20, pendingHours: 0, dayCount: 3, hoursShare: 50, notice: { due, daysLeft, state: daysLeft < 0 ? 'closed' : 'open' } as never })

describe('buildLienTimelineFromWindow (v2.3781)', () => {
  it('reads the months from the forecast’s sessions and the sent ones from the notice filings; a closed month says only that the window closed', () => {
    const wm: JobWorkMonths = { jobId: 'j1', role: 'sub', propertyKind: 'non_residential', months: [month('2026-06', '2026-09-15', -8), month('2026-07', '2026-10-15', 22)], totalHours: 40, sessionCount: 6, pendingSessions: 0, lastMonthKey: '2026-07', affidavitDue: '2026-11-16' }
    const t = buildLienTimelineFromWindow({ workMonths: wm, filings: [filing({ months_covered: ['2026-07'] })], job: { id: 'j1', created_at: '2026-05-02T00:00:00Z', last_work_date: '2026-07-20' }, isSub: true, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY })
    const by = Object.fromEntries(t.steps.map((s) => [s.key, s]))
    expect(by['notice:2026-06']!.state).toBe('missed')
    expect(by['notice:2026-06']!.words).toBe('window closed')
    expect(by['notice:2026-07']!.state).toBe('done')
    expect(by['affidavit']!.date).toBe('2026-11-16')
    expect(t.next.kind).toBe('affidavit')
    expect(t.next.aside).toBe('')
  })
  it('a job with no sessions is dated from its creation month, and a filed affidavit runs the tail', () => {
    const t = buildLienTimelineFromWindow({ workMonths: null, filings: [], job: { id: 'j1', created_at: '2026-07-09T14:00:00Z', last_work_date: null }, isSub: true, propertyKind: '', openBalance: 4_100, todayYmd: TODAY })
    expect(t.steps[0]!.words).toBe('dated from the job’s creation · no clock hours')
    expect(t.steps.find((s) => s.kind === 'notice')?.date).toBe('2026-10-15')
    expect(t.kindUnknown).toBe(true)
    const filed = buildLienTimelineFromWindow({ workMonths: null, filings: [filing({ id: 'a', kind: 'affidavit', filed_at: '2026-07-14', served_at: '2026-07-16', recording_number: '2026-0412', county: 'Comal' })], job: { id: 'j1', created_at: '2026-01-05T00:00:00Z', last_work_date: '2026-03-28' }, isSub: true, propertyKind: 'non_residential', openBalance: 12_400, todayYmd: TODAY })
    expect(filed.steps.find((s) => s.kind === 'affidavit')?.dateWords).toBe('filed Jul 14')
    expect(filed.steps.find((s) => s.kind === 'suit')?.date).toBe('2027-07-15')
    expect(filed.next.kind).toBe('suit')
  })
})

describe('the demand letter through the window adapter (v2.3877)', () => {
  const letter = (over: Partial<import('./demandLetterTracking').JobDemandLetterRow> = {}) =>
    ({ id: 'd1', job_id: 'j1', amount: 8940, created_at: '2026-09-14T16:00:00Z', created_by: null, deadline_date: '2026-09-28', debtor_party: 'gc', exhibits: [], fields: {}, invoice_ids: ['i1'], recipient_address: '', recipient_email: '', recipient_name: 'Dudley Mason', sent_at: '2026-09-14T16:10:00Z', sent_method: 'certified', tracking_number: '', voided_at: null, ...over }) as import('./demandLetterTracking').JobDemandLetterRow
  it('folds the live sent letters, owing up to the job’s balance; a voided letter is dropped; no letters draws nothing', () => {
    const src = { workMonths: null, filings: [], job: { id: 'j1', created_at: '2026-06-09T14:00:00Z', last_work_date: '2026-07-30' }, isSub: true, propertyKind: 'non_residential', openBalance: 8_940, todayYmd: TODAY }
    const t = buildLienTimelineFromWindow({ ...src, demandLetters: [letter(), letter({ id: 'old', voided_at: '2026-09-15T00:00:00Z', sent_at: '2026-09-01T00:00:00Z' })] })
    expect(t.steps.find((s) => s.kind === 'demand')).toMatchObject({ state: 'due', dateWords: 'reply by Sep 28', move: 'gc' })
    expect(t.waitingOn?.who).toBe('gc')
    const paid = buildLienTimelineFromWindow({ ...src, openBalance: 0, demandLetters: [letter()] })
    expect(paid.steps.find((s) => s.kind === 'demand')).toMatchObject({ state: 'done', dateWords: 'paid' })
    expect(buildLienTimelineFromWindow(src).steps.some((s) => s.kind === 'demand')).toBe(false)
  })
})

describe('an evening instant keeps its day on the timeline (v2.4468)', () => {
  // 00:30 UTC is 7:30 pm CDT (6:30 pm CST in winter) the evening before.
  it('dates a job with no sessions from its creation month in the company calendar, as list_lien_notice_months does', () => {
    const fromCreation = (created_at: string) => buildLienTimelineFromWindow({ workMonths: null, filings: [], job: { id: 'j1', created_at, last_work_date: null }, isSub: true, propertyKind: 'non_residential', openBalance: 4_100, todayYmd: TODAY }).steps.find((s) => s.kind === 'notice')
    expect(fromCreation('2026-10-01T00:30:00Z')).toMatchObject({ key: 'notice:2026-09', date: '2026-12-15' })
    expect(fromCreation('2026-12-01T00:30:00+00:00')?.key).toBe('notice:2026-11')
    expect(fromCreation('2026-10-01T12:00:00Z')?.key).toBe('notice:2026-10')
  })

  it('reads a notice and a release with no filed day by the day their rows were made', () => {
    const wm: JobWorkMonths = { jobId: 'j1', role: 'sub', propertyKind: 'non_residential', months: [month('2026-07', '2026-10-15', 22)], totalHours: 20, sessionCount: 3, pendingSessions: 0, lastMonthKey: '2026-07', affidavitDue: '2026-11-16' }
    const job = { id: 'j1', created_at: '2026-06-09T14:00:00Z', last_work_date: '2026-07-20' }
    const notice = filing({ id: 'n', months_covered: ['2026-07'], filed_at: null, created_at: '2026-09-16T00:30:00Z' })
    const t = buildLienTimelineFromWindow({ workMonths: wm, filings: [notice], job, isSub: true, propertyKind: 'non_residential', openBalance: 5_000, todayYmd: TODAY })
    expect(t.steps.find((s) => s.key === 'notice:2026-07')?.words).toBe('sent Sep 15')
    const affidavit = filing({ id: 'a', kind: 'affidavit', filed_at: '2026-07-14', served_at: '2026-07-16' })
    const release = filing({ id: 'r', kind: 'release_of_record', filed_at: null, created_at: '2026-12-02T00:30:00Z' })
    const released = buildLienTimelineFromWindow({ workMonths: wm, filings: [notice, affidavit, release], job, isSub: true, propertyKind: 'non_residential', openBalance: 0, todayYmd: '2026-12-10' })
    expect(released.steps.find((s) => s.kind === 'release')?.dateWords).toBe('released Dec 1')
    expect(released.next.words).toBe('Released Dec 1 — the clock stopped.')
  })

  it('reads the desk’s sent, skipped and noted stamps by the Central day', () => {
    const row = { job_id: 'j1', work_month: '2026-07', approved_hours: 20, deadline: '2026-10-15', noticed: true, open_balance: 5_000, customer_id: 'gc', gc_customer_id: 'gc', property_kind: 'non_residential', has_owner: true, desk_item_id: null, desk_status: null, desk_months: null } as LienNoticeMonthRow
    const sent = { id: 'i', job_id: 'j1', kind: 'notice_53_056', status: 'sent', months: ['2026-07'], fields: {}, voided_at: null, created_at: '2026-09-10T15:00:00Z', updated_at: '2026-09-16T00:30:00Z', sent_at: '2026-09-16T00:30:00Z' } as unknown as LienDeskItemRow
    expect(lienTimelineMonthsFromDesk('j1', [row], [sent], TODAY)).toEqual([{ key: '2026-07', deadline: '2026-10-15', fromCreation: false, outcome: 'sent', at: '2026-09-15' }])
    const noted = { ...sent, status: 'missed', months: ['2026-06'], sent_at: null, fields: { notice: {}, gcEmail: '', windowClosed: { name: 'Taunya', at: '2026-12-02T00:30:00Z' } } } as unknown as LienDeskItemRow
    expect(lienTimelineMonthsFromDesk('j1', [], [noted], TODAY, 'non_residential')).toMatchObject([{ key: '2026-06', outcome: 'missed', at: '2026-12-01' }])
    const noon = { ...sent, sent_at: '2026-09-16T12:00:00Z' } as LienDeskItemRow
    expect(lienTimelineMonthsFromDesk('j1', [row], [noon], TODAY)[0]!.at).toBe('2026-09-16')
  })
})
