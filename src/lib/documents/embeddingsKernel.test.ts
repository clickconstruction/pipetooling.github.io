import { describe, expect, it } from 'vitest'
import { CHUNKS_PER_FILE_MAX, chunksCut, chunksCutNote, chunkText, EMBED_DIM, EMBED_KEY_HEADER, EMBED_KEY_SECRET, EMBED_MODEL, EMBED_READ_MS, embedDue, embedEndpoint, embedReadAnswer, embedRequestBody, embedStateWords } from '../../../supabase/functions/_shared/embeddingsKernel'

/** Search by meaning (punch list #240, PR 4): the chunks, the request, the answer and the refusal, when a file is tried again. */
describe('embeddingsKernel', () => {
  it('cuts a text into overlapping chunks on a space, caps them, and answers nothing for an empty text', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(words, { size: 500, overlap: 100 })
    expect(chunks.length).toBeGreaterThan(5)
    expect(chunks[0]!.chunk_no).toBe(0)
    expect(chunks.every((c) => c.text.length <= 500)).toBe(true)
    // The overlap: the second chunk starts inside the first.
    expect(chunks[0]!.text.endsWith(chunks[1]!.text.slice(0, 20))).toBe(false)
    expect(words.indexOf(chunks[1]!.text)).toBeLessThan(chunks[0]!.text.length)
    expect(chunks.map((c) => c.chunk_no)).toEqual(chunks.map((_, i) => i))
    expect(chunkText('   \n ')).toEqual([])
    expect(chunkText('one short line')).toEqual([{ chunk_no: 0, text: 'one short line' }])
    expect(chunkText('x'.repeat(CHUNKS_PER_FILE_MAX * 4000), { size: 1000, overlap: 0 })).toHaveLength(CHUNKS_PER_FILE_MAX)
  })

  it('builds the endpoint with no key in it (the key rides in a header) and one batch request with the task and the dimension', () => {
    expect(embedEndpoint()).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents')
    expect(embedEndpoint()).not.toContain('key')
    expect(EMBED_KEY_HEADER).toBe('x-goog-api-key')
    expect(EMBED_READ_MS).toBe(20_000)
    const body = embedRequestBody(['one', 'two'], 'RETRIEVAL_DOCUMENT') as { requests: { model: string; content: { parts: { text: string }[] }; taskType: string; outputDimensionality: number }[] }
    expect(body.requests).toHaveLength(2)
    expect(body.requests[0]).toEqual({ model: 'models/gemini-embedding-001', content: { parts: [{ text: 'one' }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: EMBED_DIM })
    expect(embedRequestBody(['q'], 'RETRIEVAL_QUERY').requests).toMatchObject([{ taskType: 'RETRIEVAL_QUERY' }])
  })

  it('opens every chunk after the first on a word, and says when the chunks stop short of the text', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`).join(' ')
    const chunks = chunkText(words, { size: 500, overlap: 100 })
    expect(chunks.length).toBeGreaterThan(2)
    for (const c of chunks) expect(c.text).toMatch(/^word\d+/)
    expect(chunksCut(words, chunks)).toBe(false)
    const cut = chunkText(words, { size: 500, overlap: 100, max: 2 })
    expect(chunksCut(words, cut)).toBe(true)
    expect(chunksCutNote(2)).toContain('first 2 chunks')
    expect(chunksCut('', [])).toBe(false)
  })

  it('reads one vector per text of the right size, and a refusal in the provider’s own words', () => {
    const v = Array.from({ length: EMBED_DIM }, (_, i) => i / EMBED_DIM)
    expect(embedReadAnswer(200, { embeddings: [{ values: v }, { values: v }] }, 2)).toEqual({ ok: true, vectors: [v, v] })
    expect(embedReadAnswer(200, { embeddings: [{ values: v }] }, 2)).toEqual({ ok: false, error: 'Gemini answered 1 embeddings for 2 texts.' })
    expect(embedReadAnswer(200, { embeddings: [{ values: [1, 2, 3] }] }, 1)).toEqual({ ok: false, error: `Gemini answered a vector of 3 numbers; the table takes ${EMBED_DIM}.` })
    expect(embedReadAnswer(400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } }, 1)).toEqual({ ok: false, error: 'Gemini answered INVALID_ARGUMENT: API key not valid. Please pass a valid API key.' })
    expect(embedReadAnswer(503, 'overloaded', 1)).toEqual({ ok: false, error: 'Gemini answered HTTP 503: overloaded' })
  })

  it('embeds a row never embedded or indexed since, tries a refused one again after a day, and leaves a current one alone', () => {
    const now = new Date('2026-11-02T12:00:00Z')
    expect(embedDue({ embedded_at: null, indexed_at: '2026-11-02T04:00:00Z', embed_tried_at: null }, now)).toBe(true)
    expect(embedDue({ embedded_at: '2026-11-02T04:01:00Z', indexed_at: '2026-11-02T04:00:00Z', embed_tried_at: null }, now)).toBe(false)
    expect(embedDue({ embedded_at: '2026-11-01T04:01:00Z', indexed_at: '2026-11-02T04:00:00Z', embed_tried_at: null }, now)).toBe(true)
    expect(embedDue({ embedded_at: null, indexed_at: '2026-11-02T04:00:00Z', embed_tried_at: '2026-11-02T08:00:00Z' }, now)).toBe(false)
    expect(embedDue({ embedded_at: null, indexed_at: '2026-11-02T04:00:00Z', embed_tried_at: '2026-10-31T08:00:00Z' }, now)).toBe(true)
    expect(embedStateWords(false)).toContain(EMBED_KEY_SECRET)
    expect(embedStateWords(true)).toContain(EMBED_MODEL)
  })
})
