import { describe, expect, it } from 'vitest'
import {
  controlTotals,
  dockRanking,
  needsYouStats,
  peopleBreakdown,
  quietPages,
  roleInFilter,
  topPages,
  weeklySeries,
  type UsageClickRow,
  type UsagePageRow,
  type UsageUserRow,
} from './usageDashboard'

const PAGES: UsagePageRow[] = [
  { role: 'dev', page: 'jobs:stages', minutes: 800, people: 2 },
  { role: 'assistant', page: 'jobs:stages', minutes: 200, people: 3 },
  { role: 'estimator', page: 'bids:bid-board', minutes: 500, people: 2 },
  { role: 'subcontractor', page: 'dashboard', minutes: 100, people: 5 },
  { role: 'dev', page: 'banking:ledger', minutes: 2, people: 1 },
]

describe('topPages', () => {
  it('aggregates across roles, sorts by minutes, scales bars to the leader', () => {
    const rows = topPages(PAGES, 'all', 10)
    expect(rows[0]).toEqual({ label: 'jobs:stages', value: 1000, people: 5, frac: 1 })
    expect(rows[1]?.label).toBe('bids:bid-board')
    expect(rows[1]?.frac).toBeCloseTo(0.5)
  })

  it('role filters slice the same rows', () => {
    expect(topPages(PAGES, 'estimators', 10).map((r) => r.label)).toEqual(['bids:bid-board'])
    expect(topPages(PAGES, 'field', 10).map((r) => r.label)).toEqual(['dashboard'])
    expect(roleInFilter('controller', 'office')).toBe(true)
  })
})

const CLICKS: UsageClickRow[] = [
  { role: 'dev', control: 'top-nav', target: '/jobs', clicks: 10, people: 2 },
  { role: 'assistant', control: 'top-nav', target: '/dashboard', clicks: 6, people: 3 },
  { role: 'dev', control: 'dock', target: '#dash-my-inbox', clicks: 4, people: 1 },
  { role: 'dev', control: 'dock', target: '#dash-billing', clicks: 7, people: 1 },
  { role: 'dev', control: 'needs-you', target: '#tally-self', clicks: 5, people: 1 },
  { role: 'dev', control: 'needs-you', target: '#skip', clicks: 2, people: 1 },
  { role: 'dev', control: 'needs-you', target: '#mode-walk', clicks: 3, people: 1 },
]

describe('click shaping', () => {
  it('controlTotals sums per control with friendly labels', () => {
    const rows = controlTotals(CLICKS)
    expect(rows[0]).toMatchObject({ label: 'top nav', value: 16, frac: 1 })
    expect(rows.find((r) => r.label === 'section dock')?.value).toBe(11)
  })

  it('dockRanking strips the #dash- prefix and sorts', () => {
    expect(dockRanking(CLICKS)).toEqual([
      { label: 'billing', clicks: 7 },
      { label: 'my inbox', clicks: 4 },
    ])
  })

  it('needsYouStats routes actions, skips, and mode switches', () => {
    const s = needsYouStats(CLICKS)
    expect(s.actions).toEqual([{ label: 'Open tally', clicks: 5 }])
    expect(s.skips).toBe(2)
    expect(s.modeSwitchesToWalk).toBe(3)
    expect(s.modeSwitchesToCards).toBe(0)
  })
})

describe('quietPages', () => {
  it('lists pages under the threshold, quietest first', () => {
    expect(quietPages(PAGES, 150)).toEqual([
      { page: 'banking:ledger', minutes: 2 },
      { page: 'dashboard', minutes: 100 },
    ])
  })
})

describe('weeklySeries', () => {
  it('totals views, takes the max-week entity floor, scales bars', () => {
    const s = weeklySeries(
      [
        { surface: 'portal', bucket: '2026-08-17', views: 4, entities: 3 },
        { surface: 'portal', bucket: '2026-08-24', views: 8, entities: 5 },
        { surface: 'estimate_accept', bucket: '2026-08-24', views: 99, entities: 9 },
      ],
      'portal',
    )
    expect(s.totalViews).toBe(12)
    expect(s.totalEntities).toBe(5)
    expect(s.weeks.map((w) => w.frac)).toEqual([0.5, 1])
  })
})

const USERS: UsageUserRow[] = [
  { user_name: 'Robert Douglas', role: 'dev', page: 'jobs:stages', minutes: 700, active_days: 20 },
  { user_name: 'Robert Douglas', role: 'dev', page: 'dashboard', minutes: 300, active_days: 22 },
  { user_name: 'Wendi P', role: 'estimator', page: 'bids:pricing', minutes: 400, active_days: 15 },
  { user_name: 'Marcus V', role: 'subcontractor', page: 'dashboard', minutes: 120, active_days: 18 },
]

describe('peopleBreakdown', () => {
  it('groups role → person → top pages, everything sorted, names with spaces intact', () => {
    const groups = peopleBreakdown(USERS, 5)
    expect(groups.map((g) => g.role)).toEqual(['dev', 'estimator', 'subcontractor'])
    const robert = groups[0]?.people[0]
    expect(robert?.name).toBe('Robert Douglas')
    expect(robert?.minutes).toBe(1000)
    expect(robert?.activeDays).toBe(22)
    expect(robert?.frac).toBe(1)
    expect(robert?.topPages[0]).toEqual({ page: 'jobs:stages', minutes: 700, frac: 1 })
    expect(groups[1]?.people[0]?.frac).toBeCloseTo(0.4)
  })

  it('caps each person at topPagesPerPerson pages', () => {
    const groups = peopleBreakdown(USERS, 1)
    expect(groups[0]?.people[0]?.topPages).toHaveLength(1)
  })
})
