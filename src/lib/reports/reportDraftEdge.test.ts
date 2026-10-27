import { describe, expect, it } from 'vitest'
import { DRAFT_SCHEMA, costCents, draftFromAnswer, draftUserMessage, readDraft, readDraftRequest, type DraftLineIn } from '../../../supabase/functions/_shared/reportDraft'
import { loadModelKey, modelRefusalWhy } from '../../../supabase/functions/_shared/modelKey'
import { parseDraft } from './voiceDraft'

/**
 * `report-draft`'s pure parts (punch list #186, item 1, v2.5916), held from the app's side: the request it reads, the
 * message the model gets, the answer it trusts, the cost it reports, the schema it asks for, and the key it finds.
 * Whitfield (1104) and its lines are the mock-up's made-up job.
 */

const LINES: DraftLineIn[] = [
  { id: 'f-rough', name: 'Rough In', pct: 35 },
  { id: 'f-top', name: 'Top Out', pct: null },
]

describe('readDraftRequest', () => {
  it('reads the words, the job, the lines and the fields, and refuses an empty or long note', () => {
    const ok = readDraftRequest({ transcript: '  rough-in is done ', lang: 'es-MX', jobName: 'Whitfield (1104)', lines: [{ id: 'f-rough', name: 'Rough In', pct: 35.4 }, { id: '', name: 'x' }, { id: 'f-top', name: 'Top Out', pct: 'no' }], fields: ['Notes', '', 7] })
    expect(ok).toEqual({
      ok: true,
      request: { transcript: 'rough-in is done', lang: 'es-MX', jobName: 'Whitfield (1104)', lines: [{ id: 'f-rough', name: 'Rough In', pct: 35 }, { id: 'f-top', name: 'Top Out', pct: null }], fields: ['Notes'] },
    })
    expect(readDraftRequest({ transcript: '   ' })).toEqual({ ok: false, why: 'Nothing was said.' })
    expect(readDraftRequest({ transcript: 'x'.repeat(4001) }).ok).toBe(false)
    expect(readDraftRequest(null).ok).toBe(false)
  })
})

describe('draftUserMessage', () => {
  it('names the job, each line with its number and id, the fields, the language and the words', () => {
    const msg = draftUserMessage({ transcript: 'rough-in is done', lang: 'en-US', jobName: 'Whitfield (1104)', lines: LINES, fields: ['Notes'] })
    expect(msg).toContain('Job: Whitfield (1104)')
    expect(msg).toContain('- id f-rough: Rough In (now at 35%)')
    expect(msg).toContain('- id f-top: Top Out (no percent yet)')
    expect(msg).toContain("The report's text fields: Notes")
    expect(msg).toContain('The phone heard the words as en-US.')
    expect(msg).toContain('"""rough-in is done"""')
  })
})

describe('readDraft and draftFromAnswer', () => {
  it('keeps only the request’s lines, once each, with whole numbers from 0 to 100', () => {
    const d = readDraft(
      { notes: { done: 'Rough-in is done.', parts: '', next: 'Top-out tomorrow.' }, lines: [{ id: 'f-rough', pct: 104.6, from: 'done' }, { id: 'f-rough', pct: 50, from: 'again' }, { id: 'f-nope', pct: 50, from: 'x' }], language: 'EN' },
      LINES,
    )
    expect(d).toEqual({ notes: { done: 'Rough-in is done.', parts: '', next: 'Top-out tomorrow.' }, lines: [{ id: 'f-rough', pct: 100, from: 'done' }], language: 'en' })
  })

  it('reads nothing from an empty draft, a draft that is not one, or text that is not JSON', () => {
    expect(readDraft({ notes: { done: '', parts: '', next: '' }, lines: [], language: 'en' }, LINES)).toBeNull()
    expect(readDraft({ lines: [] }, LINES)).toBeNull()
    expect(draftFromAnswer([{ type: 'text', text: 'not json' }], LINES)).toBeNull()
    expect(draftFromAnswer([{ type: 'thinking' }], LINES)).toBeNull()
    expect(draftFromAnswer([{ type: 'text', text: JSON.stringify({ notes: { done: 'Done.', parts: '', next: '' }, lines: [], language: 'en' }) }], LINES)?.notes.done).toBe('Done.')
  })

  it('answers what the app reads back the same', () => {
    const edge = readDraft({ notes: { done: 'Rough-in is done.', parts: 'two couplings', next: '' }, lines: [{ id: 'f-top', pct: 50, from: 'halfway' }], language: 'es' }, LINES)
    expect(parseDraft(JSON.parse(JSON.stringify(edge)))).toEqual(edge)
  })
})

describe('the cost and the schema', () => {
  it('prices a call at Opus 5.5’s rates in cents', () => {
    expect(costCents({ input_tokens: 1200, output_tokens: 200 })).toBe(0.88)
    expect(costCents(null)).toBe(0)
  })

  it('closes every object in the schema, as structured output asks', () => {
    const closed = (node: unknown): boolean => {
      if (!node || typeof node !== 'object') return true
      const o = node as Record<string, unknown>
      if (o.type === 'object' && o.additionalProperties !== false) return false
      return Object.values(o).every(closed)
    }
    expect(closed(DRAFT_SCHEMA)).toBe(true)
    expect(DRAFT_SCHEMA.required).toEqual(['notes', 'lines', 'language'])
  })
})

describe('loadModelKey', () => {
  const db = (answer: { data: unknown; error: { message: string } | null } | 'throws') => ({
    rpc: async () => {
      if (answer === 'throws') throw new Error('no function')
      return answer
    },
  })

  it('reads Vault first, then the environment, else none', async () => {
    expect(await loadModelKey(db({ data: ' sk-vault ', error: null }), () => 'sk-env', 'anthropic')).toEqual({ key: 'sk-vault', source: 'vault' })
    expect(await loadModelKey(db({ data: null, error: null }), (k) => (k === 'ANTHROPIC_API_KEY' ? 'sk-env' : undefined), 'anthropic')).toEqual({ key: 'sk-env', source: 'env' })
    expect(await loadModelKey(db('throws'), () => undefined, 'anthropic')).toEqual({ key: '', source: 'none' })
  })
})

describe('modelRefusalWhy (v2.5991)', () => {
  it('names Anthropic’s own type and message from the SDK’s error body', () => {
    const sdkError = { status: 400, error: { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }, message: '400 {...}' }
    expect(modelRefusalWhy(sdkError)).toEqual({ status: 400, why: 'invalid_request_error: Your credit balance is too low to access the Anthropic API.' })
  })

  it('falls back to the error’s own message, and never carries a key back', () => {
    expect(modelRefusalWhy(new Error('fetch failed'))).toEqual({ status: null, why: 'fetch failed' })
    expect(modelRefusalWhy({ status: 401, error: { error: { type: 'authentication_error', message: 'invalid x-api-key sk-ant-api03-SECRETSECRET' } } }).why).toBe('authentication_error: invalid x-api-key sk-ant-…')
    expect(modelRefusalWhy(undefined)).toEqual({ status: null, why: 'No reason was given.' })
  })
})
