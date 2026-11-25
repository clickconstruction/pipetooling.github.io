import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }))

import { missingUserIds, NAMELESS_PERSON, toldName, userDisplayLabel, withArchivedIds, withPlainNames } from './userDisplayNames'

describe('userDisplayLabel', () => {
  it('marks archived users and stubs missing names', () => {
    expect(userDisplayLabel({ id: 'x', name: 'Mario', archived: true })).toBe('Mario (archived)')
    expect(userDisplayLabel({ id: 'x', name: 'Malachi', archived: false })).toBe('Malachi')
    expect(userDisplayLabel({ id: 'a07d8bfe-894e', name: ' ', archived: true })).toBe('a07d8bfe (archived)')
  })
})

describe('missingUserIds', () => {
  it('returns deduped ids not in the known set, skipping blanks', () => {
    const known = new Set(['u1'])
    expect(missingUserIds(['u1', 'u2', 'u2', '', 'u3'], known)).toEqual(['u2', 'u3'])
    expect(missingUserIds([], known)).toEqual([])
  })
})

describe('withPlainNames', () => {
  it('adds each row as a plain name, and a row with no name reads Someone', () => {
    const known = { u1: 'Imani' }
    const next = withPlainNames(known, [
      { id: 'u2', name: ' Dana ' },
      { id: 'u3', name: '  ' },
    ])
    expect(next).toEqual({ u1: 'Imani', u2: 'Dana', u3: NAMELESS_PERSON })
    expect(NAMELESS_PERSON).toBe('Someone')
    // the map handed in is left as it was
    expect(known).toEqual({ u1: 'Imani' })
  })

  it('no rows leaves the names as they were', () => {
    expect(withPlainNames({ u1: 'Imani' }, [])).toEqual({ u1: 'Imani' })
  })
})

describe('withArchivedIds', () => {
  it('adds the people who have left, and hands the same set back when nobody is added', () => {
    const known: ReadonlySet<string> = new Set(['u1'])
    expect(withArchivedIds(known, [{ id: 'u2', archived: false }])).toBe(known)
    expect(withArchivedIds(known, [{ id: 'u1', archived: true }])).toBe(known)
    const next = withArchivedIds(known, [
      { id: 'u2', archived: false },
      { id: 'u3', archived: true },
    ])
    expect([...next]).toEqual(['u1', 'u3'])
    expect([...known]).toEqual(['u1'])
  })
})

describe('toldName', () => {
  const names = { u1: 'Imani', u2: 'Dana' }
  it('names the person who is told', () => {
    expect(toldName('u1', names, new Set())).toBe('Imani')
  })
  it('names nobody for no one, for a name not read yet, or for a person who has left', () => {
    expect(toldName(null, names, new Set())).toBeNull()
    expect(toldName('u9', names, new Set())).toBeNull()
    expect(toldName('u2', names, new Set(['u2']))).toBeNull()
  })
})
