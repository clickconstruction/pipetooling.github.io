/**
 * Main's own tests for the weekly report as it goes (the Building lane's U2): the email's words from a
 * drafted report, and the newest send for each week. The draft itself (`weeklyReport`) reads Owner
 * Billing's late finish and moves with U7, so these build a report by hand.
 */
import { describe, expect, it } from 'vitest'
import { latestWeeklyReports, weeklyReportText, type WeeklyReport } from './buildingWeekly'
import { GC_COMPANY } from './company'
import { initialGcState } from './schedule/testState'
import type { GcProject, GcState, WeeklyReportSent } from './types'

const fairOaks = (s: GcState) => s.projects.find((p) => p.id === 'fairoaksd')!
const REPORT: WeeklyReport = {
  projectId: 'fairoaksd',
  weekOf: '2026-09-28',
  customer: null,
  to: { name: 'Dana Ruiz', first: 'Dana', email: 'dana@example.com' },
  architect: null,
  sections: [
    { key: 'glance', title: 'At a glance', lines: ['We finish Nov 20, 3 days ahead of the contract.'] },
    { key: 'week', title: 'This week', lines: ['Mon: 14 on site.', 'Thu: 16 on site. The roof membrane went down.'] },
    { key: 'next', title: 'Next week', lines: ['Roofing and HVAC on site.'] },
  ],
  logs: 4,
  missing: ['2026-09-30'],
  hints: {},
  nextTrades: ['Roofing', 'HVAC'],
  subject: 'Fair Oaks Shops, Building D: the week of Sep 28',
}

describe('the weekly report as the email says it', () => {
  it('writes the full report from the company, every section ticked', () => {
    const s = initialGcState()
    const { subject, body } = weeklyReportText(REPORT, fairOaks(s), { from: 'company', length: 'full', off: [], mine: '' }, null)
    expect(subject).toBe(REPORT.subject)
    expect(body.split('\n\n')).toEqual([
      'Hello Dana,',
      `Here is where ${fairOaks(s).name} stands this week.`,
      'At a glance\n- We finish Nov 20, 3 days ahead of the contract.',
      'This week\n- Mon: 14 on site.\n- Thu: 16 on site. The roof membrane went down.',
      'Next week\n- Roofing and HVAC on site.',
      'Reply to this email with any questions.',
      `Thank you,\n${GC_COMPANY.name}`,
    ])
  })

  it('writes the short one from me, with my own line and a section left out', () => {
    const s = initialGcState()
    const { body } = weeklyReportText(REPORT, fairOaks(s), { from: 'me', length: 'short', off: ['glance'], mine: 'The inspector comes back Monday' }, 'Rosa Treviño')
    expect(body.split('\n\n')).toEqual([
      'Hi Dana,',
      `Here's where ${fairOaks(s).name} stands this week. The inspector comes back Monday.`,
      'This week: 16 on site. The roof membrane went down. Next week: Roofing and HVAC are on site.',
      'If anything here raises a question, reply and it comes straight to me.',
      `Thanks,\nRosa Treviño\n${GC_COMPANY.name}`,
    ])
  })
})

describe('the newest send for each week', () => {
  it('keeps the newest of a resend, newest week first', () => {
    const s = initialGcState()
    const sent = (weekOf: string, sentOn: string, subject: string): WeeklyReportSent => ({ weekOf, sentOn, from: 'me', by: 'Rosa Treviño', to: 'Dana Ruiz', copiedArchitect: false, subject, body: 'The week.' })
    const job: GcProject = { ...fairOaks(s), weeklyReports: [sent('2026-09-21', '2026-09-25', 'first'), sent('2026-09-28', '2026-10-02', 'second'), sent('2026-09-28', '2026-10-02', 'second, fixed')] }
    expect(latestWeeklyReports(job).map((r) => [r.weekOf, r.subject])).toEqual([
      ['2026-09-28', 'second, fixed'],
      ['2026-09-21', 'first'],
    ])
    expect(latestWeeklyReports(fairOaks(s))).toEqual([])
  })
})
