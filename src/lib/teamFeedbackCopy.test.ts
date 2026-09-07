import { describe, expect, it } from 'vitest'
import { DEFAULT_MANAGER_LIKERT_PROMPTS, DEFAULT_PEER_LIKERT_PROMPTS, normalizeLikertPrompts } from './teamFeedbackCopy'

describe('normalizeLikertPrompts', () => {
  it('the shipped prompt sets are five non-empty questions each', () => {
    expect(DEFAULT_MANAGER_LIKERT_PROMPTS).toHaveLength(5)
    expect(DEFAULT_PEER_LIKERT_PROMPTS).toHaveLength(5)
    expect(normalizeLikertPrompts(DEFAULT_PEER_LIKERT_PROMPTS, DEFAULT_MANAGER_LIKERT_PROMPTS)).toEqual([...DEFAULT_PEER_LIKERT_PROMPTS])
  })
  it('accepts exactly five trimmed non-empty strings', () => {
    expect(normalizeLikertPrompts([' a ', 'b', 'c', 'd', 'e '], DEFAULT_PEER_LIKERT_PROMPTS)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('anything else falls back to a fresh copy of the defaults', () => {
    const fb = DEFAULT_PEER_LIKERT_PROMPTS
    for (const bad of [null, 'x', ['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd', 'e', 'f'], ['a', 'b', 'c', 'd', '  '], ['a', 'b', 'c', 'd', 5]]) {
      const out = normalizeLikertPrompts(bad, fb)
      expect(out).toEqual([...fb])
      expect(out).not.toBe(fb)
    }
  })
})
