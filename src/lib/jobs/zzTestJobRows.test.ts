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
  it('asks the server for ZZ at the start or after one character, paged, and keeps only the ZZ ones', async () => {
    const out = await fetchZzTestJobRows()
    expect(reads[0]).toEqual([
      { method: 'select', args: ['id, status, job_name, customer_name, customer_id'] },
      { method: 'or', args: ['job_name.ilike.zz*,job_name.ilike._zz*,customer_name.ilike.zz*,customer_name.ilike._zz*'] },
      { method: 'order', args: ['id'] },
      { method: 'range', args: [0, 999] },
    ])
    // A leading-space name is caught (the kernel trims); a stray server hit (here Pizza) is dropped.
    expect(out.map((r) => r.id)).toEqual(['Z', 'S', 'Y'])
  })
})

describe('loadZzTestJobRows · the shared answer', () => {
  it('reads once per minute however many ask, and again after it lapses', async () => {
    const t = 1_000_000
    await loadZzTestJobRows('u-dev', t)
    await loadZzTestJobRows('u-dev', t + 1_000)
    expect(await loadZzTestJobIds('u-dev', t + 2_000)).toEqual(new Set(['Z', 'S', 'Y']))
    expect(reads).toHaveLength(1)
    await loadZzTestJobRows('u-dev', t + ZZ_TEST_JOB_ROWS_TTL_MS)
    expect(reads).toHaveLength(2)
  })

  it('keeps one answer per user: View as, Exit and sign-out each read again (review on #5241)', async () => {
    await loadZzTestJobRows('u-dev', 100)
    await loadZzTestJobRows('u-sample-assistant', 101)
    await loadZzTestJobRows('u-dev', 102)
    await loadZzTestJobRows(null, 103)
    expect(reads).toHaveLength(4)
  })

  it('reads again after the sweep forgets the answer', async () => {
    await loadZzTestJobRows('u-dev', 5)
    rows = [row('Z', 'ZZ TEST working', 'Ann Lee')]
    invalidateZzTestJobRows()
    expect(await loadZzTestJobIds('u-dev', 6)).toEqual(new Set(['Z']))
    expect(reads).toHaveLength(2)
  })

  it('a failed read is not kept: the next one asks again', async () => {
    fail = true
    await expect(loadZzTestJobRows('u-dev', 10)).rejects.toThrow('down')
    fail = false
    expect((await loadZzTestJobRows('u-dev', 11)).map((r) => r.id)).toEqual(['Z', 'S', 'Y'])
    expect(reads).toHaveLength(2)
  })
})
