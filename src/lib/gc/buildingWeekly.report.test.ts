// GC mode, the real build, the Building lane's U7a: weeklyReport's tests, moved from the prototype (branch spike/gc-mode,
// gcBuildingWeekly.test.ts). Its fourth, "only for a job being built, and only from Friday", is main's already, in
// buildingWeekly.test.ts since U2.
import { describe, expect, it } from 'vitest'
import { weeklyReport, weeklyReportText } from './buildingWeekly'
import { initialGcState } from './schedule/testState'
import type { GcState } from './types'

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
})
