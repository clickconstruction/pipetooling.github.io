import { describe, expect, it } from 'vitest'
import { orderFollowUpProspects, queueAge, queueAgeLabel, readCallingOrderMode, indexAfterOtherRowLeft, insertColdest, queueAfterRemoval, queueWindowStart } from './callingOrder'

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

describe('queueAge (punch list #184 sweep B)', () => {
  const now = new Date('2026-08-25T12:00:00Z').getTime()
  const called = new Set(['c1'])
  const ago = (d: number) => new Date(now - d * 86_400_000).toISOString()

  it('keeps the words and gives them the PROSPECT_CALL_AGE state: amber at a week, red at a month', () => {
    expect(queueAge(p('c1', '2026-01-01', ago(6)), called, now)).toEqual({ label: 'called 6d ago', days: 6, state: 'fresh' })
    expect(queueAge(p('c1', '2026-01-01', ago(7)), called, now)).toEqual({ label: 'called 7d ago', days: 7, state: 'amber' })
    expect(queueAge(p('c1', '2026-01-01', ago(29)), called, now)).toEqual({ label: 'called 29d ago', days: 29, state: 'amber' })
    expect(queueAge(p('n1', '2026-01-01', ago(30)), called, now)).toEqual({ label: 'noted 30d ago', days: 30, state: 'red' })
    expect(queueAge(p('n2', ago(2), null), called, now)).toEqual({ label: 'added 2d ago', days: 2, state: 'fresh' })
  })

  it('a missing stamp reads the bare verb and stays fresh', () => {
    expect(queueAge(p('c1', '2026-01-01', null), called, now)).toEqual({ label: 'called', days: null, state: 'fresh' })
    expect(queueAge({ id: 'n3', created_at: null, last_contact: null }, called, now)).toEqual({ label: 'added', days: null, state: 'fresh' })
  })

  it('queueAgeLabel is its label', () => {
    const row = p('c1', '2026-01-01', ago(12))
    expect(queueAgeLabel(row, called, now)).toBe(queueAge(row, called, now).label)
  })
})

describe('queueAfterRemoval', () => {
  const q = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('the card under the pointer leaves, and the one that followed comes up', () => {
    expect(queueAfterRemoval(q, 1, 'b')).toEqual({ queue: [{ id: 'a' }, { id: 'c' }, { id: 'd' }], index: 1, nextId: 'c' })
  })

  it('the last card leaves, and the pointer steps back onto the new last card', () => {
    expect(queueAfterRemoval(q, 3, 'd')).toEqual({ queue: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], index: 2, nextId: 'c' })
  })

  it('the only card leaves, and the queue is empty with the pointer at the start', () => {
    expect(queueAfterRemoval([{ id: 'a' }], 0, 'a')).toEqual({ queue: [], index: 0, nextId: null })
  })

  it('an id that is not in the queue changes nothing', () => {
    expect(queueAfterRemoval(q, 2, 'zz')).toEqual({ queue: q, index: 2, nextId: 'c' })
  })

  it('a pointer past the end is pulled back onto the last card', () => {
    expect(queueAfterRemoval(q, 9, 'a')).toEqual({ queue: [{ id: 'b' }, { id: 'c' }, { id: 'd' }], index: 2, nextId: 'd' })
  })

  it('keeps the pointer where it was when a row before it leaves (the handlers only call it for the card, and this is why)', () => {
    // The card was c at 2; with a gone the pointer still says 2, which is d now.
    expect(queueAfterRemoval(q, 2, 'a').nextId).toBe('d')
  })

  it('does not change the list it was given', () => {
    const before = [...q]
    queueAfterRemoval(q, 0, 'a')
    expect(q).toEqual(before)
  })
})

describe('indexAfterOtherRowLeft', () => {
  const q = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

  it('a row before the card leaves, and the pointer steps back so the same card stays up', () => {
    expect(indexAfterOtherRowLeft(q, 2, 'a')).toBe(1)
    expect(indexAfterOtherRowLeft(q, 2, 'b')).toBe(1)
  })

  it('a row after the card leaves, and the pointer stays', () => {
    expect(indexAfterOtherRowLeft(q, 2, 'd')).toBe(2)
  })

  it('a row that was never in the queue leaves the pointer alone', () => {
    expect(indexAfterOtherRowLeft(q, 2, 'zz')).toBe(2)
  })

  it('together with queueAfterRemoval, the card under the pointer is the same one', () => {
    const index = 2
    const left = queueAfterRemoval(q, index, 'a')
    expect(left.queue[indexAfterOtherRowLeft(q, index, 'a')]).toEqual({ id: 'c' })
  })
})

describe('insertColdest', () => {
  const row = (id: string, last_contact: string | null, company_name: string | null = id) => ({ id, last_contact, company_name })

  it('puts a never-contacted row first', () => {
    const q = [row('old', '2026-01-01T00:00:00Z'), row('new', '2026-06-01T00:00:00Z')]
    expect(insertColdest(q, row('fresh', null)).map((r) => r.id)).toEqual(['fresh', 'old', 'new'])
  })

  it('slots a contacted row by its last contact, oldest first', () => {
    const q = [row('old', '2026-01-01T00:00:00Z'), row('new', '2026-06-01T00:00:00Z')]
    expect(insertColdest(q, row('mid', '2026-03-01T00:00:00Z')).map((r) => r.id)).toEqual(['old', 'mid', 'new'])
  })

  it('breaks a tie by company name, a missing name first', () => {
    const q = [row('b', null, 'Bravo'), row('d', null, 'Delta')]
    expect(insertColdest(q, row('c', null, 'Charlie')).map((r) => r.id)).toEqual(['b', 'c', 'd'])
    expect(insertColdest(q, row('n', null, null)).map((r) => r.id)).toEqual(['n', 'b', 'd'])
  })

  it('re-sorts the whole queue coldest first, whatever order it was in', () => {
    const q = [row('new', '2026-06-01T00:00:00Z'), row('old', '2026-01-01T00:00:00Z')]
    expect(insertColdest(q, row('mid', '2026-03-01T00:00:00Z')).map((r) => r.id)).toEqual(['old', 'mid', 'new'])
  })

  it('a row already in the queue changes nothing, and hands back the same list', () => {
    const q = [row('a', null), row('b', null)]
    expect(insertColdest(q, row('a', '2026-03-01T00:00:00Z'))).toBe(q)
  })
})

describe('queueWindowStart', () => {
  it('shows two rows above the card when there is room', () => {
    expect(queueWindowStart(5, 40, 12)).toBe(3)
  })
  it('starts at the first row near the top', () => {
    expect(queueWindowStart(0, 40, 12)).toBe(0)
    expect(queueWindowStart(1, 40, 12)).toBe(0)
    expect(queueWindowStart(2, 40, 12)).toBe(0)
  })
  it('near the end, keeps the last rows filling the peek', () => {
    expect(queueWindowStart(39, 40, 12)).toBe(28)
    expect(queueWindowStart(35, 40, 12)).toBe(28)
  })
  it('a queue shorter than the peek starts at the first row', () => {
    expect(queueWindowStart(3, 5, 12)).toBe(0)
    expect(queueWindowStart(0, 0, 15)).toBe(0)
  })
})
