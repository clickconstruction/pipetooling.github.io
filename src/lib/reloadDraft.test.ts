import { describe, expect, it } from 'vitest'
import { DRAFT_MAX_AGE_MS, clearDraft, draftStorageKey, readDraft, writeDraft } from './reloadDraft'

function memStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), size: () => m.size }
}

describe('reload drafts', () => {
  it('round-trips a value under a scoped key', () => {
    const s = memStorage()
    const key = draftStorageKey('sub-sheet-portal', 'job-1')
    expect(key).toBe('pipetooling-draft:sub-sheet-portal:job-1')
    expect(writeDraft(s, key, { stage: 'hold', reason: 'lien' }, 1_000)).toBe(true)
    expect(readDraft(s, key, 2_000)).toEqual({ stage: 'hold', reason: 'lien' })
    clearDraft(s, key)
    expect(readDraft(s, key, 3_000)).toBeNull()
  })
  it('a draft older than a day is dropped on read', () => {
    const s = memStorage()
    writeDraft(s, 'k', 'v', 0)
    expect(readDraft(s, 'k', DRAFT_MAX_AGE_MS + 1)).toBeNull()
    expect(s.size()).toBe(0)
  })
  it('malformed storage reads as nothing and is cleared; a refusing store is survived', () => {
    const s = memStorage()
    s.setItem('k', '{not json')
    expect(readDraft(s, 'k', 1)).toBeNull()
    s.setItem('k', JSON.stringify({ nope: 1 }))
    expect(readDraft(s, 'k', 1)).toBeNull()
    expect(s.size()).toBe(0)
    const broken = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('quota') }, removeItem: () => { throw new Error('x') } }
    expect(writeDraft(broken, 'k', 1, 1)).toBe(false)
    expect(readDraft(broken, 'k', 1)).toBeNull()
    expect(() => clearDraft(broken, 'k')).not.toThrow()
    expect(readDraft(null, 'k', 1)).toBeNull()
  })
})
