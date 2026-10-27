import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import {
  MODEL_KEYS_COST,
  MODEL_KEYS_INTRO,
  MODEL_KEYS_WHERE,
  MODEL_KEY_TEST_HELP,
  keyTestWords,
  maskedModelKeyWords,
  modelKeyProblem,
  parseKeyTest,
  parseModelKeyStatus,
} from './modelKeys'

describe('the Model keys card’s words and answers', () => {
  it('reads the status as the function answers it, never more than the last four', () => {
    const s = parseModelKeyStatus({ set: true, source: 'vault', last4: '4f2a', saved_at: '2026-10-27T20:02:00Z', saved_by: 'Robert' })
    expect(maskedModelKeyWords(s)).toBe('Key ending in 4f2a is saved.')
    expect(maskedModelKeyWords(parseModelKeyStatus({ set: true, source: 'env' }))).toBe('A key is set on the server. Paste one here to use yours instead.')
    expect(maskedModelKeyWords(parseModelKeyStatus(null))).toBe('No key yet.')
  })

  it('refuses a pasted key that cannot be one before it is sent', () => {
    expect(modelKeyProblem('')).toBe('Paste the key first.')
    expect(modelKeyProblem('sk-ant with space')).toBe('The key has a space in it. Paste it again.')
    expect(modelKeyProblem('short')).toBe('That is too short to be a key.')
    expect(modelKeyProblem('sk-ant-made-up-key-0000-4f2a')).toBeNull()
  })

  it('reads a test, and says what it found (v2.5991)', () => {
    const ok = parseKeyTest({ ok: true, test: { ok: true, model: 'claude-opus-5-5', seconds: 1.4 } })
    expect(ok).toEqual({ ok: true, model: 'claude-opus-5-5', seconds: 1.4 })
    expect(keyTestWords(ok!)).toBe('The key works. Claude answered in 1.4 seconds.')
    const refused = parseKeyTest({ ok: true, test: { ok: false, status: 400, why: 'invalid_request_error: Your credit balance is too low.' } })
    expect(keyTestWords(refused!)).toBe('Anthropic refused it. invalid_request_error: Your credit balance is too low.')
    expect(parseKeyTest({ ok: true, test: { ok: false } })).toEqual({ ok: false, why: 'Anthropic gave no reason.' })
    expect(parseKeyTest({ ok: true })).toBeNull()
  })

  it('keeps the card’s own sentences to the plain-words rule', () => {
    for (const w of [MODEL_KEYS_INTRO, MODEL_KEYS_WHERE, MODEL_KEYS_COST, MODEL_KEY_TEST_HELP, keyTestWords({ ok: true, model: 'm', seconds: 1.4 })]) {
      expect(plainWordsFailures(w)).toEqual([])
    }
  })
})
