import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: { rpc: vi.fn() } }))

import { missingUserIds, userDisplayLabel } from './userDisplayNames'

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
