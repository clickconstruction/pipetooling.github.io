import { describe, expect, it } from 'vitest'
import { findRetaggableNote, RETAG_NOTE_WINDOW_MS, withCalledProspect, withLastCall, lastCallByProspect } from './callLogState'

const NOW = Date.parse('2026-09-03T14:00:00Z')
const ME = 'me'
const note = (over: Partial<{ id: string; created_by: string; created_at: string | null; interaction_type: string }> = {}) => ({
  id: 'n1',
  created_by: ME,
  created_at: new Date(NOW - 60_000).toISOString(),
  interaction_type: 'user_comment',
  ...over,
})

describe('findRetaggableNote', () => {
  it('claims my fresh plain note', () => {
    expect(findRetaggableNote([note()], ME, NOW)?.id).toBe('n1')
  })

  it('returns null with no comments or no parseable timestamps', () => {
    expect(findRetaggableNote([], ME, NOW)).toBeNull()
    expect(findRetaggableNote([note({ created_at: null })], ME, NOW)).toBeNull()
    expect(findRetaggableNote([note({ created_at: 'garbage' })], ME, NOW)).toBeNull()
  })

  it('ignores order — the newest comment decides', () => {
    const older = note({ id: 'old', created_at: new Date(NOW - 5 * 60_000).toISOString(), interaction_type: 'answered' })
    const newer = note({ id: 'new' })
    expect(findRetaggableNote([older, newer], ME, NOW)?.id).toBe('new')
    expect(findRetaggableNote([newer, older], ME, NOW)?.id).toBe('new')
  })

  it('does not claim a note when an outcome was already logged after it', () => {
    const typed = note({ id: 'typed', created_at: new Date(NOW - 30_000).toISOString() })
    const logged = note({ id: 'logged', created_at: new Date(NOW - 10_000).toISOString(), interaction_type: 'didnt_answer' })
    expect(findRetaggableNote([typed, logged], ME, NOW)).toBeNull()
  })

  it("does not claim someone else's note", () => {
    expect(findRetaggableNote([note({ created_by: 'william' })], ME, NOW)).toBeNull()
  })

  it('does not claim a note older than the window', () => {
    const stale = note({ created_at: new Date(NOW - RETAG_NOTE_WINDOW_MS - 1).toISOString() })
    expect(findRetaggableNote([stale], ME, NOW)).toBeNull()
    const edge = note({ created_at: new Date(NOW - RETAG_NOTE_WINDOW_MS).toISOString() })
    expect(findRetaggableNote([edge], ME, NOW)?.id).toBe('n1')
  })
})

describe('withCalledProspect / withLastCall', () => {
  it('return new containers and leave the inputs alone', () => {
    const ids = new Set(['a'])
    const next = withCalledProspect(ids, 'b')
    expect([...next]).toEqual(['a', 'b'])
    expect(ids.has('b')).toBe(false)

    const map = { a: { interaction_type: 'answered', created_at: '2026-01-01T00:00:00Z' } }
    const entry = { interaction_type: 'didnt_answer', created_at: '2026-09-03T14:00:00Z' }
    const nextMap = withLastCall(map, 'b', entry)
    expect(nextMap.b).toEqual(entry)
    expect(nextMap.a).toBe(map.a)
    expect('b' in map).toBe(false)
  })
})

describe('lastCallByProspect', () => {
  it('keeps the first row a prospect has, which is its latest when the rows come newest first', () => {
    const rows = [
      { prospect_id: 'a', interaction_type: 'answered', created_at: '2026-10-03T00:00:00Z' },
      { prospect_id: 'b', interaction_type: 'didnt_answer', created_at: '2026-10-02T00:00:00Z' },
      { prospect_id: 'a', interaction_type: 'didnt_answer', created_at: '2026-10-01T00:00:00Z' },
    ]
    expect(lastCallByProspect(rows)).toEqual({
      a: { interaction_type: 'answered', created_at: '2026-10-03T00:00:00Z' },
      b: { interaction_type: 'didnt_answer', created_at: '2026-10-02T00:00:00Z' },
    })
  })
  it('carries a missing time as it is, and no rows as an empty map', () => {
    expect(lastCallByProspect([{ prospect_id: 'a', interaction_type: 'answered', created_at: null }])).toEqual({ a: { interaction_type: 'answered', created_at: null } })
    expect(lastCallByProspect([])).toEqual({})
  })
  it('keeps only the call facts, not the row', () => {
    expect(Object.keys(lastCallByProspect([{ prospect_id: 'a', interaction_type: 'answered', created_at: null }]).a ?? {})).toEqual(['interaction_type', 'created_at'])
  })
})
