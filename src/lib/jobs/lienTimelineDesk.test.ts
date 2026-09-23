import { describe, expect, it } from 'vitest'
import { buildLienTimelineFromWindow } from './lienTimelineDesk'
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
