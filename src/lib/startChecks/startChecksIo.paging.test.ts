/**
 * Before we start (punch list #382, audit): the six tables behind a list are read whole. The stand-in below answers
 * as PostgREST does: a read with no range is cut at 1,000 rows with no error, oldest first, so the newest are lost.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = { id: string; job_id: string; created_at: string }

const MAX_ROWS = 1000

const bed = vi.hoisted(() => ({
  tables: new Map<string, Array<{ id: string; job_id: string; created_at: string }>>(),
  inLists: [] as Array<{ table: string; ids: string[] }>,
  ranges: [] as Array<{ table: string; from: number; to: number }>,
  failTable: null as string | null,
}))

vi.mock('../supabase', () => ({
  supabase: {
    from: (table: string) => {
      let ids: string[] | null = null
      let range: [number, number] | null = null
      const answer = () => {
        if (bed.failTable === table) return { data: null, error: { message: 'permission denied for table', code: '42501' }, status: 403 }
        const all = (bed.tables.get(table) ?? [])
          .filter((r) => ids === null || ids.includes(r.job_id))
          .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        const cut = range ? all.slice(range[0], range[1] + 1) : all
        return { data: cut.slice(0, MAX_ROWS), error: null, status: 200 }
      }
      const q = {
        select: () => q,
        order: () => q,
        in: (_col: string, list: string[]) => {
          ids = [...list]
          bed.inLists.push({ table, ids })
          return q
        },
        range: (from: number, to: number) => {
          range = [from, to]
          bed.ranges.push({ table, from, to })
          return q
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(answer()).then(resolve, reject),
      }
      return q
    },
  },
}))

import { readStartCheckRows } from './startChecksIo'

const stamp = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 1000).toISOString()
const pad = (n: number) => String(n).padStart(5, '0')
const sorted = (rows: readonly Row[]) => rows.every((r, i) => i === 0 || rows[i - 1]!.created_at < r.created_at || (rows[i - 1]!.created_at === r.created_at && rows[i - 1]!.id < r.id))

beforeEach(() => {
  bed.tables.clear()
  bed.inLists.length = 0
  bed.ranges.length = 0
  bed.failTable = null
})

describe('readStartCheckRows', () => {
  it('reads past 1,000 rows of a table, the newest included', async () => {
    const bullets: Row[] = []
    for (let n = 0; n < 1001; n++) bullets.push({ id: `b-${pad(n)}`, job_id: `job-${n % 90}`, created_at: stamp(n) })
    // Stored out of order: the read's order is the read's, not the table's.
    bed.tables.set('start_check_bullets', [...bullets].reverse())
    const jobIds = Array.from({ length: 90 }, (_, n) => `job-${n}`)

    const rows = await readStartCheckRows(jobIds)

    expect(rows.bullets).toHaveLength(1001)
    expect(rows.bullets.at(-1)!.id).toBe('b-01000')
    expect(rows.bullets.map((b) => b.id)).toEqual(bullets.map((b) => b.id))
    expect(bed.ranges.filter((r) => r.table === 'start_check_bullets')).toEqual([
      { table: 'start_check_bullets', from: 0, to: 999 },
      { table: 'start_check_bullets', from: 1000, to: 1999 },
    ])
  })

  it('asks for a long list of jobs in pieces and puts the rows back in order', async () => {
    const jobIds = Array.from({ length: 160 }, (_, n) => `job-${pad(n)}`)
    // The last job's yes is the oldest row and the first job's the newest, so two pieces interleave.
    const marks: Row[] = jobIds.map((job_id, n) => ({ id: `m-${pad(n)}`, job_id, created_at: stamp(160 - n) }))
    marks.push({ id: 'm-tie-b', job_id: jobIds[159]!, created_at: stamp(500) }, { id: 'm-tie-a', job_id: jobIds[0]!, created_at: stamp(500) })
    bed.tables.set('start_check_marks', marks)

    const rows = await readStartCheckRows(jobIds)

    const lists = bed.inLists.filter((l) => l.table === 'start_check_marks').map((l) => l.ids)
    expect(lists.length).toBeGreaterThan(1)
    expect(Math.max(...lists.map((l) => l.length))).toBeLessThanOrEqual(150)
    expect(lists.flat().sort()).toEqual([...jobIds].sort())
    expect(rows.marks).toHaveLength(162)
    expect(sorted(rows.marks as unknown as Row[])).toBe(true)
    expect(rows.marks.slice(-2).map((m) => m.id)).toEqual(['m-tie-a', 'm-tie-b'])
  })

  it('throws when a table cannot be read', async () => {
    bed.failTable = 'start_check_asks'
    await expect(readStartCheckRows(['job-1'])).rejects.toThrow(/read the asks/)
  })

  it('reads nothing for no jobs', async () => {
    const rows = await readStartCheckRows([])
    expect(rows).toEqual({ bullets: [], marks: [], asks: [], theirDays: [], decisions: [], arrivals: [] })
    expect(bed.inLists).toHaveLength(0)
  })
})
