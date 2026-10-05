/**
 * GC mode — design spike: the weekly report to the customer (gcBuildingWeekly.ts, the reducer's
 * sendWeeklyReport). Fair Oaks D's week of Sep 28: three logs (none Wednesday), a failed service
 * inspection checked again today, dry-in late, the panel boards held up, the finish on the
 * contract's day.
 */
import { describe, expect, it } from 'vitest'
import { gcReducer, initialGcState, weeklyReport, weeklyReportReady, weeklyReportSent, weeklyReportText, type GcState } from './gcModel'

const fairOaks = (s: GcState) => {
  const p = s.projects.find((x) => x.id === 'fairoaksd')
  if (!p) throw new Error('no Fair Oaks D')
  return p
}

describe('the weekly report', () => {
  it("draws Fair Oaks D's week from its records, section by section", () => {
    const s = initialGcState()
    const r = weeklyReport(s, fairOaks(s))
    expect(r.weekOf).toBe('2026-09-28')
    expect(r.to).toMatchObject({ name: 'Elena Marchetti', first: 'Elena' })
    expect(r.missing).toEqual(['2026-09-30'])
    const by = Object.fromEntries(r.sections.map((x) => [x.key, x.lines]))
    expect(by.glance).toEqual([
      'Finish: about Fri Dec 11. Your contract says Dec 11, so there are no days to spare.',
      '72% of the work is done. 76% was planned by now, so we are 3 days behind.',
      'Next: Rough-in inspection, Tue Oct 13.',
    ])
    expect(by.week).toEqual([
      'Mon: Membrane down on the east half. Canopy steel set.',
      'Tue: Membrane started on the west half.',
      "Thu: West half membrane half down. Ductwork in bay 4. Cibolo's rep walked bays 1 and 2.",
      '15 to 18 people a day on site, from 5 trades.',
    ])
    expect(by.inspections).toEqual(['The electrical service inspection did not pass Monday: the main bonding jumper is missing at the service panel. The city checks it again today.'])
    expect(by.watching).toContain('Dry-in is 7 days behind.')
    expect(by.watching).toContain('Electrical: Panel boards are two weeks out.')
    expect(by.next).toEqual(['Roofing: TPO membrane, roof curbs.', 'Electrical: lighting.', 'Plumbing: top out.', 'HVAC: ductwork.'])
  })

  it("names a trade's company only when asked", () => {
    const s = initialGcState()
    const watching = weeklyReport(s, fairOaks(s), undefined, true).sections.find((x) => x.key === 'watching')?.lines ?? []
    expect(watching).toContain('Pecan Valley Electric: Panel boards are two weeks out.')
  })

  it('reads from me, short, without a section; never our costs', () => {
    const s = initialGcState()
    const r = weeklyReport(s, fairOaks(s))
    const full = weeklyReportText(r, fairOaks(s), { from: 'me', length: 'full', off: ['watching'], mine: 'Thanks for walking bays 1 and 2 with us Thursday' }, 'Robert Douglas').body
    expect(full).toMatch(/^Hi Elena,\n\nHere's where Fair Oaks Shops, Building D stands this week\. Thanks for walking bays 1 and 2 with us Thursday\./)
    expect(full).not.toContain('What we are watching')
    expect(full).toMatch(/Thanks,\nRobert Douglas\nClick Construction$/)
    expect(full).not.toMatch(/\$\d/)
    const short = weeklyReportText(r, fairOaks(s), { from: 'company', length: 'short', off: [], mine: '' }, null).body
    expect(short).toContain('Next week: Roofing, Electrical, Plumbing and HVAC are on site.')
    expect(short).toMatch(/^Hello Elena,/)
  })

  it('is ready Friday; sending keeps it for their portal, notes it on the customer, and a resend replaces it', () => {
    let s = initialGcState()
    expect(weeklyReportReady(s, fairOaks(s))).toBe(true)
    const send = (body: string) => gcReducer(s, { type: 'sendWeeklyReport', projectId: 'fairoaksd', weekOf: '2026-09-28', from: 'me', by: 'Robert Douglas', copyArchitect: false, subject: 'Fair Oaks Shops, Building D · week of Sep 28', body })
    s = send('First go.')
    expect(weeklyReportSent(fairOaks(s), '2026-09-28')).toMatchObject({ sentOn: '2026-10-02', to: 'Elena Marchetti', by: 'Robert Douglas', body: 'First go.' })
    expect(weeklyReportReady(s, fairOaks(s))).toBe(false)
    expect(s.customers.find((c) => c.id === fairOaks(s).customerId)?.contacts[0]?.note).toBe('Weekly report for the week of Sep 28 on Fair Oaks Shops, Building D sent to Elena Marchetti.')
    s = send('Second go.')
    expect(fairOaks(s).weeklyReports?.map((r) => r.body)).toEqual(['Second go.'])
  })

  it('only for a job being built, and only from Friday', () => {
    const s = initialGcState()
    const helotes = s.projects.find((p) => p.id === 'helotes')
    if (!helotes) throw new Error('no Helotes')
    expect(weeklyReportReady(s, helotes)).toBe(false)
    expect(weeklyReportReady({ ...s, today: '2026-10-01' }, fairOaks(s))).toBe(false)
  })
})
