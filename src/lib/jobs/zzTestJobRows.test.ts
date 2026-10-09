import { beforeEach, describe, expect, it, vi } from 'vitest'

// Punch list #61 (v2.5120): the shared ZZ read — its loose pattern, the kernel's re-check, and the one-minute cache.
type Step = { method: string; args: unknown[] }
const reads: Step[][] = []
let rows: unknown[] = []
let fail = false
vi.mock('../supabase', () => ({
  supabase: {
    from: () => {
      const steps: Step[] = []
      reads.push(steps)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'or', 'order', 'range']) {
        chain[m] = (...args: unknown[]) => {
          steps.push({ method: m, args })
          return chain
        }
      }
      chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        fail ? reject(new Error('down')) : resolve({ data: rows, error: null })
      return chain
    },
  },
}))
vi.mock('../../utils/errorHandling', () => ({
  withSupabaseRetry: async (op: () => Promise<{ data: unknown }>) => (await op()).data,
}))

const { fetchZzTestJobRows, invalidateZzTestJobRows, loadZzTestJobIds, loadZzTestJobRows, ZZ_TEST_JOB_ROWS_TTL_MS } = await import('./zzTestJobRows')

const row = (id: string, jobName: string, customerName: string | null) => ({ id, status: 'working', job_name: jobName, customer_name: customerName, customer_id: 'c1' })

beforeEach(() => {
  reads.length = 0
  fail = false
  rows = [
    row('Z', 'ZZ TEST working', 'Ann Lee'),
    row('S', '  zz test with spaces', 'Ann Lee'),
    row('Y', 'Hill Street remodel', 'ZZ Test Customer'),
    row('P', 'Marcos Pizza', 'Jazz Hall'),
  ]
  invalidateZzTestJobRows()
})

describe('fetchZzTestJobRows', () => {
  it('asks the server for any name containing zz, paged, and keeps only the ZZ ones', async () => {
    const out = await fetchZzTestJobRows()
    expect(reads[0]).toEqual([
      { method: 'select', args: ['id, status, job_name, customer_name, customer_id'] },
      { method: 'or', args: ['job_name.ilike.*zz*,customer_name.ilike.*zz*'] },
      { method: 'order', args: ['id'] },
      { method: 'range', args: [0, 999] },
    ])
    // A leading-space name is caught (the kernel trims); Pizza and Jazz come back and are dropped.
    expect(out.map((r) => r.id)).toEqual(['Z', 'S', 'Y'])
  })
})

describe('loadZzTestJobRows · the shared answer', () => {
  it('reads once per minute however many ask, and again after it lapses', async () => {
    const t = 1_000_000
    await loadZzTestJobRows(t)
    await loadZzTestJobRows(t + 1_000)
    expect(await loadZzTestJobIds(t + 2_000)).toEqual(new Set(['Z', 'S', 'Y']))
    expect(reads).toHaveLength(1)
    await loadZzTestJobRows(t + ZZ_TEST_JOB_ROWS_TTL_MS)
    expect(reads).toHaveLength(2)
  })

  it('reads again after the sweep forgets the answer', async () => {
    await loadZzTestJobRows(5)
    rows = [row('Z', 'ZZ TEST working', 'Ann Lee')]
    invalidateZzTestJobRows()
    expect(await loadZzTestJobIds(6)).toEqual(new Set(['Z']))
    expect(reads).toHaveLength(2)
  })

  it('a failed read is not kept: the next one asks again', async () => {
    fail = true
    await expect(loadZzTestJobRows(10)).rejects.toThrow('down')
    fail = false
    expect((await loadZzTestJobRows(11)).map((r) => r.id)).toEqual(['Z', 'S', 'Y'])
    expect(reads).toHaveLength(2)
  })
})
