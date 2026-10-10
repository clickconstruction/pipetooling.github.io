/**
 * GC mode — design spike: the weekly report to the customer (gcBuildingWeekly.ts, the reducer's
 * sendWeeklyReport). Fair Oaks D's week of Sep 28: three logs (none Wednesday), a failed service
 * inspection checked again today, dry-in late, the panel boards held up, the finish on the
 * contract's day. What moved to main (weeklyReport, U7a #5263) is tested there, in
 * src/lib/gc/buildingWeekly.report.test.ts and buildingWeekly.test.ts.
 */
import { describe, expect, it } from 'vitest'
import { customerMessages, gcReducer, initialGcState, latestWeeklyReports, weeklyReportReady, weeklyReportSent, type GcState } from './gcModel'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

describe('the weekly report', () => {
  it('is ready Friday; sending keeps it for their portal, notes it on the customer, and a resend is a second email that replaces it in the portal', () => {
    let s = initialGcState()
    expect(weeklyReportReady(s, fairOaks(s))).toBe(true)
    const send = (body: string) => gcReducer(s, { type: 'sendWeeklyReport', projectId: 'fairoaksd', weekOf: '2026-09-28', from: 'me', by: 'Robert Douglas', copyArchitect: false, subject: 'Fair Oaks Shops, Building D · week of Sep 28', body })
    s = send('First go.')
    expect(weeklyReportSent(fairOaks(s), '2026-09-28')).toMatchObject({ sentOn: '2026-10-02', to: 'Elena Marchetti', by: 'Robert Douglas', body: 'First go.' })
    expect(weeklyReportReady(s, fairOaks(s))).toBe(false)
    expect(s.customers.find((c) => c.id === fairOaks(s).customerId)?.contacts[0]?.note).toBe('Weekly report for the week of Sep 28 on Fair Oaks Shops, Building D sent to Elena Marchetti.')
    s = send('Second go.')
    // Both emails are kept (their messages list each); the portal and the card read the newest.
    expect(fairOaks(s).weeklyReports?.map((r) => r.body)).toEqual(['First go.', 'Second go.'])
    expect(weeklyReportSent(fairOaks(s), '2026-09-28')?.body).toBe('Second go.')
    expect(latestWeeklyReports(fairOaks(s)).map((r) => r.body)).toEqual(['Second go.'])
    expect(customerMessages(s, fairOaks(s)).filter((m) => m.kind === 'weekly').map((m) => m.lines[0])).toEqual(['Second go.', 'First go.'])
  })
})
