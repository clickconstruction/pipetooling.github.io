import { describe, expect, it } from 'vitest'
import { HEARTBEAT_STEPS, heartbeatDetailWords, heartbeatHeldWords, heartbeatWords, normalizeHeartbeatProgress } from '../../../supabase/functions/_shared/twinHeartbeat'
import { plainWordsFailures } from '../plainWords'

describe('normalizeHeartbeatProgress', () => {
  it('keeps the known keys, trims and caps the strings, validates the step', () => {
    const p = normalizeHeartbeatProgress({ step: 'Reading', read: '  12 of 31 sheets ', wrote: 'x'.repeat(300), next: 'P-601', extra: 'dropped', waiting_on: '' })
    expect(p).toEqual({ step: 'reading', read: '12 of 31 sheets', wrote: 'x'.repeat(200), next: 'P-601' })
  })
  it('accepts a step written with a space or a dash, drops an unknown one', () => {
    expect(normalizeHeartbeatProgress({ step: 'picked up' })?.step).toBe('picked_up')
    expect(normalizeHeartbeatProgress({ step: 'STG-3' })).toBeNull()
  })
  it('nothing usable is null, so the column stays null', () => {
    expect(normalizeHeartbeatProgress(null)).toBeNull()
    expect(normalizeHeartbeatProgress('reading')).toBeNull()
    expect(normalizeHeartbeatProgress({ rounds: 0 })).toBeNull()
    expect(normalizeHeartbeatProgress({ rounds: 3.7 })).toEqual({ rounds: 3 })
  })
  it('a round’s check-in (v2.5753): ready and nothing keep a zero, held keeps bid, project and why, capped', () => {
    expect(normalizeHeartbeatProgress({ ready: 0, nothing: 0 })).toEqual({ ready: 0, nothing: 0 })
    expect(normalizeHeartbeatProgress({ ready: -1, nothing: 'x' })).toBeNull()
    const held = normalizeHeartbeatProgress({ held: [{ bid: ' b516 ', project: 'Take 5', why: ' Made over 30 days ago and nobody asked. ' }, { bid: 'b1' }, 'junk', { bid: 'b2', why: 'x'.repeat(200) }] })
    expect(held).toEqual({ held: [{ bid: 'b516', project: 'Take 5', why: 'Made over 30 days ago and nobody asked.' }, { bid: 'b2', why: 'x'.repeat(120) }] })
    const many = normalizeHeartbeatProgress({ held: Array.from({ length: 20 }, (_, i) => ({ bid: `b${i}`, why: 'Not a plumbing bid.' })) })
    expect(many?.held?.length).toBe(12)
    expect(normalizeHeartbeatProgress({ held: [] })).toBeNull()
  })
})

describe('heartbeatHeldWords', () => {
  it('names each bid the round passed over and why, one plain sentence each', () => {
    const words = heartbeatHeldWords({ ready: 0, held: [{ bid: 'b516', project: 'TAKE 5 N LAMAR', why: 'Made over 30 days ago and nobody asked.' }, { bid: 'b519', why: 'Not a plumbing bid.' }] })
    expect(words).toBe('Passed over 2 bids. b516 TAKE 5 N LAMAR, made over 30 days ago and nobody asked. b519, not a plumbing bid.')
    expect(plainWordsFailures(words)).toEqual([])
    expect(heartbeatHeldWords({ held: [{ bid: 'b1', why: 'Left to a person.' }] })).toBe('Passed over 1 bid. b1, left to a person.')
  })
  it('nothing held, nothing said', () => {
    expect(heartbeatHeldWords({ ready: 3 })).toBe('')
    expect(heartbeatHeldWords(null)).toBe('')
  })
})

describe('heartbeatWords', () => {
  it('the step and the inside count', () => {
    expect(heartbeatWords({ step: 'reading', read: '12 of 31 sheets' }, 'working')).toBe('Reading the sheets, 12 of 31 sheets.')
    expect(heartbeatWords({ step: 'counting' }, 'working')).toBe('Counting.')
    expect(heartbeatWords(null, 'working')).toBe('Working.')
  })
  it('blocked, done and idle', () => {
    expect(heartbeatWords({ waiting_on: 'you: the plans.' }, 'blocked')).toBe('Waiting on you: the plans.')
    expect(heartbeatWords(null, 'blocked')).toBe('Blocked.')
    expect(heartbeatWords({ step: 'sealed' }, 'done')).toBe('Done.')
    expect(heartbeatWords({ rounds: 1 }, 'idle')).toBe('Nothing to do.')
    expect(heartbeatWords({ rounds: 88 }, 'idle')).toBe('Nothing to do. 88 rounds found nothing.')
  })
  it('the detail: wrote and next', () => {
    expect(heartbeatDetailWords({ wrote: 'two notes on my copy', next: 'the fixture schedule on P-601.' })).toBe('Wrote: two notes on my copy. Next: the fixture schedule on P-601.')
    expect(heartbeatDetailWords(null)).toBe('')
  })
  it('every step word passes the plain-words rules', () => {
    for (const step of HEARTBEAT_STEPS) {
      expect(plainWordsFailures(heartbeatWords({ step, read: '12 of 31 sheets' }, 'working'))).toEqual([])
    }
    expect(plainWordsFailures(heartbeatWords({ rounds: 88 }, 'idle'))).toEqual([])
  })
})
