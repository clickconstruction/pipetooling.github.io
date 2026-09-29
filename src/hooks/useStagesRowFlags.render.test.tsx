// @vitest-environment jsdom
/**
 * The row-flag lookups behind Stages' job rows (punch list #46 row 2, the Stages map's step 3):
 * sent demand letters, contract coverage, live hazmat fees and lien releases. A table-aware
 * supabase stub records each read and its filters; a failing table answers with an error or throws.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { useDemandOutJobIds, useHazmatAndReleaseJobIds, useJobContractCoverage } from './useStagesRowFlags'
import type { JobForCoverage } from '../lib/jobs/jobContractCoverage'

type Row = Record<string, unknown>

const db = vi.hoisted(() => ({
  tables: {} as Record<string, Row[]>,
  refusing: new Set<string>(),
  throwing: new Set<string>(),
  reads: [] as Array<{ table: string; filters: string[] }>,
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const read = { table, filters: [] as string[] }
      const builder: Record<string, unknown> = {
        select: () => builder,
        is: (col: string, v: unknown) => (read.filters.push(`${col} is ${String(v)}`), builder),
        not: (col: string, op: string, v: unknown) => (read.filters.push(`${col} not ${op} ${String(v)}`), builder),
        eq: (col: string, v: unknown) => (read.filters.push(`${col} = ${String(v)}`), builder),
        then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => {
          db.reads.push(read)
          if (db.throwing.has(table)) return Promise.reject(new Error(`${table} exploded`)).then(ok, bad)
          if (db.refusing.has(table)) return Promise.resolve({ data: null, error: { message: `${table} refused`, code: '42501' } }).then(ok, bad)
          return Promise.resolve({ data: db.tables[table] ?? [], error: null }).then(ok, bad)
        },
      }
      return builder
    },
  },
}))

const readsOf = (table: string) => db.reads.filter((r) => r.table === table)

beforeEach(() => {
  db.tables = {}
  db.refusing.clear()
  db.throwing.clear()
  db.reads = []
})
afterEach(cleanup)

describe('useDemandOutJobIds', () => {
  it('reads live sent letters for every role and keys them by job', async () => {
    db.tables.job_demand_letters = [{ job_id: 'j1' }, { job_id: 'j2' }, { job_id: 'j1' }]
    const { result } = renderHook(() => useDemandOutJobIds())
    await waitFor(() => expect(result.current.demandOutJobIds.size).toBe(2))
    expect([...result.current.demandOutJobIds].sort()).toEqual(['j1', 'j2'])
    expect(readsOf('job_demand_letters')[0]?.filters).toEqual(['voided_at is null', 'sent_at not is null'])
  })

  it('a thrown read leaves the set as it was; the reloader re-reads', async () => {
    db.tables.job_demand_letters = [{ job_id: 'j1' }]
    const { result } = renderHook(() => useDemandOutJobIds())
    await waitFor(() => expect(result.current.demandOutJobIds.has('j1')).toBe(true))
    db.throwing.add('job_demand_letters')
    await act(async () => {
      await expect(result.current.loadDemandOutJobIds()).resolves.toBeUndefined()
    })
    expect(result.current.demandOutJobIds.has('j1')).toBe(true)
    expect(readsOf('job_demand_letters')).toHaveLength(2)
  })
})

const JOBS: JobForCoverage[] = [
  { id: 'j1', bid_id: null },
  { id: 'j2', bid_id: null },
]

const SIGNED_CONTRACT = {
  id: 'c1', job_id: 'j1', status: 'signed', revision: 1, recipient_email: 'a@b.co', sent_at: '2026-09-01T00:00:00Z', last_sent_at: null,
  view_count: 1, signed_at: '2026-09-02T00:00:00Z', signer_printed_name: 'Pat', signer_mode: 'remote', voided_at: null, signed_document_url: null,
}

describe('useJobContractCoverage', () => {
  it('office: reads contracts and accepted estimates and folds them per job', async () => {
    db.tables.job_contracts = [SIGNED_CONTRACT]
    const { result } = renderHook(() => useJobContractCoverage(JOBS, true))
    await waitFor(() => expect(result.current.jobContractCoverageByJobId.get('j1')?.kind).toBe('signed'))
    expect(result.current.jobContractCoverageByJobId.get('j2')?.kind).not.toBe('signed')
    expect(readsOf('job_contracts')[0]?.filters).toEqual(['voided_at is null'])
    expect(readsOf('estimates')[0]?.filters).toEqual(['status = customer_accepted', 'acceptor_consented_at not is null'])
  })

  it('a role without the gate reads nothing — the map still has a row per job', async () => {
    db.tables.job_contracts = [SIGNED_CONTRACT]
    const { result } = renderHook(() => useJobContractCoverage(JOBS, false))
    await act(async () => {
      await result.current.loadJobContractCoverage()
    })
    expect(db.reads).toEqual([])
    expect(result.current.jobContractCoverageByJobId.get('j1')?.kind).not.toBe('signed')
  })

  it('re-reads on the job-contract-changed window event', async () => {
    const { result } = renderHook(() => useJobContractCoverage(JOBS, true))
    await waitFor(() => expect(readsOf('job_contracts')).toHaveLength(1))
    db.tables.job_contracts = [SIGNED_CONTRACT]
    await act(async () => {
      window.dispatchEvent(new Event('job-contract-changed'))
    })
    await waitFor(() => expect(result.current.jobContractCoverageByJobId.get('j1')?.kind).toBe('signed'))
    expect(readsOf('job_contracts')).toHaveLength(2)
  })

  it('a refused contracts read keeps the old contracts while the estimates still land', async () => {
    db.tables.job_contracts = [SIGNED_CONTRACT]
    const { result } = renderHook(() => useJobContractCoverage(JOBS, true))
    await waitFor(() => expect(result.current.jobContractCoverageByJobId.get('j1')?.kind).toBe('signed'))
    db.refusing.add('job_contracts')
    await act(async () => {
      await result.current.loadJobContractCoverage()
    })
    expect(readsOf('estimates')).toHaveLength(2)
    expect(result.current.jobContractCoverageByJobId.get('j1')?.kind).toBe('signed')
  })

  it('stops listening on unmount', async () => {
    const { unmount } = renderHook(() => useJobContractCoverage(JOBS, true))
    await waitFor(() => expect(readsOf('job_contracts')).toHaveLength(1))
    unmount()
    window.dispatchEvent(new Event('job-contract-changed'))
    expect(readsOf('job_contracts')).toHaveLength(1)
  })
})

describe('useHazmatAndReleaseJobIds', () => {
  it('office: reads live hazmat fees, then live releases', async () => {
    db.tables.job_hazmat_incidents = [{ job_id: 'j1' }]
    db.tables.job_lien_releases = [{ job_id: 'j2' }]
    const { result } = renderHook(() => useHazmatAndReleaseJobIds(true))
    await waitFor(() => expect(result.current.lienReleaseJobIds.has('j2')).toBe(true))
    expect(result.current.hazmatFeeJobIds.has('j1')).toBe(true)
    expect(db.reads.map((r) => r.table)).toEqual(['job_hazmat_incidents', 'job_lien_releases'])
    expect(db.reads.every((r) => r.filters.join() === 'voided_at is null')).toBe(true)
  })

  it('without the gate reads nothing and both sets stay empty', async () => {
    const { result } = renderHook(() => useHazmatAndReleaseJobIds(false))
    await act(async () => {
      await result.current.loadHazmatFeeJobIds()
      await result.current.loadLienReleaseJobIds()
    })
    expect(db.reads).toEqual([])
    expect(result.current.hazmatFeeJobIds.size).toBe(0)
    expect(result.current.lienReleaseJobIds.size).toBe(0)
  })

  it('each reloader re-reads only its own table; a refused read empties that set (data null)', async () => {
    db.tables.job_hazmat_incidents = [{ job_id: 'j1' }]
    db.tables.job_lien_releases = [{ job_id: 'j2' }]
    const { result } = renderHook(() => useHazmatAndReleaseJobIds(true))
    await waitFor(() => expect(result.current.lienReleaseJobIds.size).toBe(1))
    db.refusing.add('job_hazmat_incidents')
    await act(async () => {
      await result.current.loadHazmatFeeJobIds()
    })
    expect(readsOf('job_hazmat_incidents')).toHaveLength(2)
    expect(readsOf('job_lien_releases')).toHaveLength(1)
    expect(result.current.hazmatFeeJobIds.size).toBe(0)
    expect(result.current.lienReleaseJobIds.has('j2')).toBe(true)
  })
})
