import { describe, expect, it } from 'vitest'
import { DatabaseError } from '../utils/errorHandling'
import { chunkIds, fetchAllRows, fetchAllRowsChunkedIn } from './supabasePaging'

function pagedSource(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }))
  return (from: number, to: number) => Promise.resolve({ data: rows.slice(from, to + 1), error: null })
}

describe('fetchAllRows', () => {
  it('returns everything from a single short page', async () => {
    const rows = await fetchAllRows(pagedSource(3), 'test', 10)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({ id: 0 })
  })

  it('pages until a short page and preserves order', async () => {
    const rows = await fetchAllRows(pagedSource(25), 'test', 10)
    expect(rows).toHaveLength(25)
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 25 }, (_, i) => i))
  })

  it('issues a final request when the total is an exact page multiple', async () => {
    let calls = 0
    const src = pagedSource(20)
    const rows = await fetchAllRows((f, t) => {
      calls++
      return src(f, t)
    }, 'test', 10)
    expect(rows).toHaveLength(20)
    expect(calls).toBe(3) // 10 + 10 + empty page
  })

  it('treats null data as an empty page', async () => {
    const rows = await fetchAllRows(() => Promise.resolve({ data: null, error: null }), 'test', 10)
    expect(rows).toEqual([])
  })

  it('throws DatabaseError on a failed page instead of returning a partial set', async () => {
    const src = pagedSource(25)
    await expect(
      fetchAllRows((f, t) => (f === 0 ? src(f, t) : Promise.resolve({ data: null, error: { message: 'boom' } })), 'load stuff', 10),
    ).rejects.toThrowError(DatabaseError)
    await expect(
      fetchAllRows(() => Promise.resolve({ data: null, error: { message: 'boom' } }), 'load stuff', 10),
    ).rejects.toThrow(/Failed to load stuff: boom/)
  })
})

describe('chunkIds', () => {
  it('splits with a short tail and handles empty input', () => {
    expect(chunkIds([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunkIds([], 2)).toEqual([])
  })
})

describe('fetchAllRowsChunkedIn', () => {
  it('returns [] for empty ids without issuing a request', async () => {
    let calls = 0
    const rows = await fetchAllRowsChunkedIn(
      [] as number[],
      () => {
        calls++
        return Promise.resolve({ data: [], error: null })
      },
      'test',
    )
    expect(rows).toEqual([])
    expect(calls).toBe(0)
  })

  it('fetches every chunk and pages within a chunk', async () => {
    const ids = [1, 2, 3]
    // Each id yields 12 child rows; chunk size 2 → chunks [1,2] and [3].
    const childRows = (chunk: number[]) => chunk.flatMap((id) => Array.from({ length: 12 }, (_, i) => ({ id, i })))
    const rows = await fetchAllRowsChunkedIn(
      ids,
      (chunk, from, to) => Promise.resolve({ data: childRows(chunk).slice(from, to + 1), error: null }),
      'test',
      { chunkSize: 2, pageSize: 10 },
    )
    expect(rows).toHaveLength(36)
    expect(rows.filter((r) => r.id === 3)).toHaveLength(12)
  })

  it('propagates page errors', async () => {
    await expect(
      fetchAllRowsChunkedIn([1], () => Promise.resolve({ data: null, error: { message: 'nope' } }), 'child rows'),
    ).rejects.toThrow(/Failed to child rows: nope/)
  })
})
