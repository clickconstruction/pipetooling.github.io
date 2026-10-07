/** Main's own tests for the chart: the weekend mark, which the moved tests reach only through the working calendar (the schedule's PR 1a), and one company's work (G-13). */
import { describe, expect, it } from 'vitest'
import { NO_FILTERS, ganttBars, ganttCompanies, ganttCompanyBars, ganttCounts, ganttFilter, ganttGroups, isWeekend } from './gantt'
import { scheduleMeasures } from './schedule'
import { initialGcState } from './testState'

describe('the working calendar', () => {
  it('marks Saturday and Sunday, and no other day', () => {
    expect(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05'].map(isWeekend)).toEqual([false, true, true, false])
  })
})

/** Fair Oaks Shops, Building D: the made-up job being built, today Fri Oct 2 2026. */
function fairOaksBars() {
  const state = initialGcState()
  const project = state.projects.find((p) => p.name === 'Fair Oaks Shops, Building D')
  if (!project) throw new Error('the made-up data lost Fair Oaks D')
  const m = scheduleMeasures(state, project)
  return ganttBars(m.items, m.float, new Map(), state.today, true)
}

describe('one company’s work on the chart (G-13)', () => {
  it('lists the companies in By company’s order, the most late work first, with the city for inspections', () => {
    const bars = fairOaksBars()
    const companies = ganttCompanies(bars)
    expect(companies.map((c) => c.company)).toEqual(ganttGroups(bars, 'company').map((g) => g.key))
    expect(companies[0]).toEqual({ company: 'Pecan Valley Electric', bars: 5, late: 2 })
    expect(companies.find((c) => c.company === 'The city')).toEqual({ company: 'The city', bars: 3, late: 1 })
    expect(companies.reduce((n, c) => n + c.bars, 0)).toBe(bars.length)
  })

  it('shows only the company’s bars, and every bar with no company picked', () => {
    const bars = fairOaksBars()
    const theirs = ganttFilter(bars, NO_FILTERS, 'Pecan Valley Electric')
    expect(theirs).toHaveLength(5)
    expect(theirs.every((b) => b.item.company === 'Pecan Valley Electric')).toBe(true)
    expect(ganttFilter(bars, NO_FILTERS)).toEqual(bars)
    expect(ganttCompanyBars(bars)).toBe(bars)
  })

  it('combines with the pills: the company’s late work only', () => {
    const bars = fairOaksBars()
    const late = ganttFilter(bars, { ...NO_FILTERS, late: true }, 'Pecan Valley Electric')
    expect(late).toHaveLength(2)
    expect(late.every((b) => b.item.company === 'Pecan Valley Electric' && ['late', 'behind', 'failed'].includes(b.status))).toBe(true)
  })

  it('counts the pills within the company, and the whole job with none picked', () => {
    const bars = fairOaksBars()
    expect(ganttCounts(bars, 'Pecan Valley Electric')).toEqual({ critical: 0, late: 2, held: 0, soon: 3, moved: 0 })
    expect(ganttCounts(bars)).toEqual({ critical: 3, late: 5, held: 0, soon: 12, moved: 3 })
    for (const key of ['critical', 'late', 'held', 'soon', 'moved'] as const) {
      expect(ganttFilter(bars, { ...NO_FILTERS, [key]: true }, 'Summit Roofing').length).toBe(ganttCounts(bars, 'Summit Roofing')[key])
    }
  })

  it('a company with no bars on the chart shows none', () => {
    expect(ganttFilter(fairOaksBars(), NO_FILTERS, 'Nobody We Hired')).toEqual([])
  })
})
