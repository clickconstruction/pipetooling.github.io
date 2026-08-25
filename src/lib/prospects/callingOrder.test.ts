import { describe, expect, it } from 'vitest'
import { orderFollowUpProspects, queueAgeLabel, readCallingOrderMode } from './callingOrder'

const p = (id: string, created_at: string, last_contact: string | null = null) => ({ id, created_at, last_contact })

describe('readCallingOrderMode', () => {
  it('defaults to coldest for anything unknown', () => {
    expect(readCallingOrderMode(null)).toBe('coldest')
    expect(readCallingOrderMode('')).toBe('coldest')
    expect(readCallingOrderMode('garbage')).toBe('coldest')
  })
  it('accepts never_called_first', () => {
    expect(readCallingOrderMode('never_called_first')).toBe('never_called_first')
  })
})

describe('orderFollowUpProspects', () => {
  const coldestFirst = [
    p('old-called', '2025-01-01'),
    p('never-b', '2026-03-01'),
    p('mid-called', '2025-06-01'),
    p('never-a', '2026-01-01'),
  ]
  const calledIds = new Set(['old-called', 'mid-called'])

  it('coldest mode keeps the given order, as a copy', () => {
    const out = orderFollowUpProspects(coldestFirst, calledIds, 'coldest')
    expect(out.map((x) => x.id)).toEqual(['old-called', 'never-b', 'mid-called', 'never-a'])
    expect(out).not.toBe(coldestFirst)
  })

  it('never_called_first leads with never-called by oldest entry, then the rest in given order', () => {
    const out = orderFollowUpProspects(coldestFirst, calledIds, 'never_called_first')
    expect(out.map((x) => x.id)).toEqual(['never-a', 'never-b', 'old-called', 'mid-called'])
  })

  it('handles all-called and all-never lists', () => {
    expect(orderFollowUpProspects(coldestFirst, new Set(coldestFirst.map((x) => x.id)), 'never_called_first').map((x) => x.id)).toEqual([
      'old-called',
      'never-b',
      'mid-called',
      'never-a',
    ])
    expect(orderFollowUpProspects(coldestFirst, new Set(), 'never_called_first').map((x) => x.id)).toEqual([
      'old-called',
      'never-a',
      'never-b',
      'mid-called',
    ].sort((a, b) => {
      const byId = Object.fromEntries(coldestFirst.map((x) => [x.id, x.created_at]))
      return byId[a]!.localeCompare(byId[b]!)
    }))
  })
})

describe('queueAgeLabel', () => {
  const now = new Date('2026-08-25T12:00:00Z').getTime()
  const called = new Set(['c1'])

  it('called prospects report last_contact age', () => {
    expect(queueAgeLabel(p('c1', '2026-01-01', '2026-08-20T12:00:00Z'), called, now)).toBe('called 5d ago')
  })
  it('never-called with a note reports noted age', () => {
    expect(queueAgeLabel(p('n1', '2026-01-01', '2026-02-26T12:00:00Z'), called, now)).toBe('noted 180d ago')
  })
  it('never-touched reports added age from created_at', () => {
    expect(queueAgeLabel(p('n2', '2026-08-23T12:00:00Z', null), called, now)).toBe('added 2d ago')
  })
})
