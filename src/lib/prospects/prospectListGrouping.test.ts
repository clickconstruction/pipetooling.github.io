import { describe, expect, it } from 'vitest'
import {
  filterProspectsForList,
  groupProspectsForList,
  lastTouchLabel,
  LIST_SECTIONS_DEFAULT_OPEN,
  LIST_SECTION_ORDER,
  type ListGroupableProspect,
} from './prospectListGrouping'

const NOW = new Date('2026-08-28T12:00:00Z').getTime()

function daysAgo(n: number): string {
  return new Date(NOW - n * 86_400_000).toISOString()
}

function prospect(overrides: Partial<ListGroupableProspect> & { id: string }): ListGroupableProspect {
  return {
    company_name: null,
    contact_name: null,
    phone_number: null,
    email: null,
    prospect_fit_status: null,
    last_contact: null,
    created_at: daysAgo(200),
    ...overrides,
  }
}

describe('filterProspectsForList', () => {
  const rows = [
    prospect({ id: 'a', company_name: 'Drymalla Construction', contact_name: 'Sarah', phone_number: '979-732-5731', email: 'sarah@drymalla.com' }),
    prospect({ id: 'b', company_name: 'Capco', contact_name: null, phone_number: '(210) 493-9992', email: null }),
  ]

  it('returns everything for a blank query', () => {
    expect(filterProspectsForList(rows, '  ')).toHaveLength(2)
  })

  it('matches company, contact, phone, and email case-insensitively', () => {
    expect(filterProspectsForList(rows, 'DRYM').map((p) => p.id)).toEqual(['a'])
    expect(filterProspectsForList(rows, 'sarah@').map((p) => p.id)).toEqual(['a'])
    expect(filterProspectsForList(rows, '493-9992').map((p) => p.id)).toEqual(['b'])
    expect(filterProspectsForList(rows, 'nobody')).toHaveLength(0)
  })
})

describe('groupProspectsForList', () => {
  it('routes terminal statuses to their sections regardless of call history', () => {
    const rows = [
      prospect({ id: 'conv', prospect_fit_status: 'converted', last_contact: daysAgo(1) }),
      prospect({ id: 'cr', prospect_fit_status: 'cant_reach' }),
      prospect({ id: 'naf', prospect_fit_status: 'not_a_fit' }),
    ]
    const g = groupProspectsForList(rows, new Set(['conv']), NOW)
    expect(g.converted.map((p) => p.id)).toEqual(['conv'])
    expect(g.cant_reach.map((p) => p.id)).toEqual(['cr'])
    expect(g.not_a_fit.map((p) => p.id)).toEqual(['naf'])
    expect(g.never_called).toHaveLength(0)
  })

  it('keeps a noted-but-never-called prospect in never_called', () => {
    const rows = [prospect({ id: 'a', last_contact: daysAgo(2) })]
    const g = groupProspectsForList(rows, new Set(), NOW)
    expect(g.never_called.map((p) => p.id)).toEqual(['a'])
    expect(g.recent).toHaveLength(0)
  })

  it('buckets called prospects by last_contact age: <30 recent, 30–89 going cold, 90+ cold', () => {
    const rows = [
      prospect({ id: 'r', last_contact: daysAgo(29) }),
      prospect({ id: 'g1', last_contact: daysAgo(30) }),
      prospect({ id: 'g2', last_contact: daysAgo(89) }),
      prospect({ id: 'c', last_contact: daysAgo(90) }),
    ]
    const g = groupProspectsForList(rows, new Set(['r', 'g1', 'g2', 'c']), NOW)
    expect(g.recent.map((p) => p.id)).toEqual(['r'])
    expect(g.going_cold.map((p) => p.id).sort()).toEqual(['g1', 'g2'])
    expect(g.cold.map((p) => p.id)).toEqual(['c'])
  })

  it('sends a called prospect with no last_contact to cold', () => {
    const rows = [prospect({ id: 'x', last_contact: null })]
    const g = groupProspectsForList(rows, new Set(['x']), NOW)
    expect(g.cold.map((p) => p.id)).toEqual(['x'])
  })

  it('sorts never_called oldest entry first and the rest newest touch first', () => {
    const rows = [
      prospect({ id: 'new', created_at: daysAgo(10) }),
      prospect({ id: 'old', created_at: daysAgo(300) }),
      prospect({ id: 'r1', last_contact: daysAgo(5) }),
      prospect({ id: 'r2', last_contact: daysAgo(1) }),
    ]
    const g = groupProspectsForList(rows, new Set(['r1', 'r2']), NOW)
    expect(g.never_called.map((p) => p.id)).toEqual(['old', 'new'])
    expect(g.recent.map((p) => p.id)).toEqual(['r2', 'r1'])
  })

  it('covers every section key in the render order constant', () => {
    const g = groupProspectsForList([], new Set(), NOW)
    for (const key of LIST_SECTION_ORDER) expect(g[key]).toEqual([])
    expect(LIST_SECTION_ORDER).toHaveLength(Object.keys(g).length)
  })

  it('default-open set only names real sections', () => {
    for (const key of LIST_SECTIONS_DEFAULT_OPEN) expect(LIST_SECTION_ORDER).toContain(key)
  })
})

describe('lastTouchLabel', () => {
  it('uses the call outcome when the prospect has been called', () => {
    expect(lastTouchLabel(prospect({ id: 'a' }), { interaction_type: 'answered', created_at: daysAgo(3) }, NOW)).toBe('answered 3d ago')
    expect(lastTouchLabel(prospect({ id: 'a' }), { interaction_type: 'didnt_answer', created_at: daysAgo(0) }, NOW)).toBe("didn't answer today")
    expect(lastTouchLabel(prospect({ id: 'a' }), { interaction_type: 'didnt_answer', created_at: daysAgo(1) }, NOW)).toBe("didn't answer 1d ago")
  })

  it('falls back to noted, then added', () => {
    expect(lastTouchLabel(prospect({ id: 'a', last_contact: daysAgo(12) }), undefined, NOW)).toBe('noted 12d ago')
    expect(lastTouchLabel(prospect({ id: 'a', created_at: daysAgo(182) }), undefined, NOW)).toBe('added 182d ago')
  })
})
