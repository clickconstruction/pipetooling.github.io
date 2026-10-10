import { describe, expect, it } from 'vitest'
import { latestWeeklyReports, weeklyReportSent } from './buildingWeekly'
import { initialGcState } from './schedule/testState'
import { weeklyReportInsert, weeklyReportRetryRow, weeklyReportWent, withWeeklyReports, type WeeklyReportRow, type WeeklyReportSend } from './weeklyReportRows'

const row = (over: Partial<WeeklyReportRow>): WeeklyReportRow => ({
  id: 'wr-1',
  project_id: 'fairoaksd',
  week_of: '2026-09-28',
  sent_on: '2026-10-02',
  sent_from: 'me',
  by_name: 'Rosa',
  to_words: 'Elena at Cibolo Creek Partners',
  copied_architect: false,
  subject: 'Fair Oaks · week of Sep 28',
  body: 'Hi Elena,\n\nIt went well.',
  email_send_log_id: null,
  created_at: '2026-10-02T20:00:00Z',
  ...over,
})

const send: WeeklyReportSend = {
  projectId: 'fairoaksd',
  weekOf: '2026-09-28',
  from: 'company',
  by: 'Click Construction',
  to: 'Elena at Cibolo Creek Partners',
  copyArchitect: true,
  subject: ' Fair Oaks · week of Sep 28 ',
  body: ' Hello Elena,\n\nIt went well. ',
}

describe('a weekly report row', () => {
  it('went when it is from me, or from the company once its email went', () => {
    expect(weeklyReportWent(row({}))).toBe(true)
    expect(weeklyReportWent(row({ sent_from: 'company' }))).toBe(false)
    expect(weeklyReportWent(row({ sent_from: 'company', email_send_log_id: 'log-1' }))).toBe(true)
  })

  it('is kept as the window sends it, the copy only from the company and the words trimmed', () => {
    expect(weeklyReportInsert(send, '2026-10-02')).toEqual({
      project_id: 'fairoaksd',
      week_of: '2026-09-28',
      sent_on: '2026-10-02',
      sent_from: 'company',
      by_name: 'Click Construction',
      to_words: 'Elena at Cibolo Creek Partners',
      copied_architect: true,
      subject: 'Fair Oaks · week of Sep 28',
      body: 'Hello Elena,\n\nIt went well.',
    })
    expect(weeklyReportInsert({ ...send, from: 'me', by: ' ' }, '2026-10-02')).toMatchObject({ sent_from: 'me', copied_architect: false, by_name: 'Click Construction' })
  })
})

describe('withWeeklyReports', () => {
  it('lays the sent ones over the job, oldest first, and leaves out a company send whose email did not go', () => {
    const rows = [
      row({ id: 'wr-2', created_at: '2026-10-02T21:00:00Z', sent_from: 'company', email_send_log_id: 'log-2', subject: 'Second' }),
      row({ id: 'wr-1', created_at: '2026-10-02T20:00:00Z', subject: 'First' }),
      row({ id: 'wr-3', created_at: '2026-10-02T22:00:00Z', sent_from: 'company', subject: 'Not sent' }),
      row({ id: 'wr-4', week_of: '2026-09-21', created_at: '2026-09-25T20:00:00Z', subject: 'Last week' }),
    ]
    const fairOaks = withWeeklyReports(initialGcState(), rows).projects.find((p) => p.id === 'fairoaksd')!
    expect(fairOaks.weeklyReports?.map((r) => r.subject)).toEqual(['Last week', 'First', 'Second'])
    expect(weeklyReportSent(fairOaks, '2026-09-28')).toMatchObject({ subject: 'Second', from: 'company', by: 'Rosa' })
    expect(latestWeeklyReports(fairOaks).map((r) => r.subject)).toEqual(['Second', 'Last week'])
  })

  it('returns the same state when nothing went', () => {
    const base = initialGcState()
    expect(withWeeklyReports(base, [row({ sent_from: 'company' })])).toBe(base)
  })
})

describe('weeklyReportRetryRow', () => {
  it('goes again on the newest company row not sent with the same words and copy, never on another', () => {
    const pending = row({ id: 'wr-p', sent_from: 'company', copied_architect: true, subject: 'Fair Oaks · week of Sep 28', body: 'Hello Elena,\n\nIt went well.', created_at: '2026-10-02T21:00:00Z' })
    const older = { ...pending, id: 'wr-o', created_at: '2026-10-02T20:00:00Z' }
    expect(weeklyReportRetryRow([older, pending], send)?.id).toBe('wr-p')
    expect(weeklyReportRetryRow([{ ...pending, email_send_log_id: 'log-1' }], send)).toBeNull()
    expect(weeklyReportRetryRow([{ ...pending, body: 'Other words' }], send)).toBeNull()
    expect(weeklyReportRetryRow([{ ...pending, copied_architect: false }], send)).toBeNull()
    expect(weeklyReportRetryRow([{ ...pending, sent_from: 'me' }], send)).toBeNull()
  })
})
