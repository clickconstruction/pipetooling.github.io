import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { EDGE_BOOT_BATCH, HEALTH_RPCS, edgeBootBatch, edgeBootReport, healthReading, healthRpcArgs, isBootError, isHealthVerb } from '../../../supabase/functions/_shared/devMcpHealth'

const MIGRATION = readFileSync('supabase/migrations/20260920232141_dev_health_rpcs.sql', 'utf8')

describe('devMcpHealth — the verbs and their RPCs', () => {
  it('names only RPCs the migration creates, each gated is_dev() and closed to anon', () => {
    for (const rpc of Object.values(HEALTH_RPCS)) {
      expect(MIGRATION).toContain(`CREATE OR REPLACE FUNCTION public.${rpc}(`)
      expect(MIGRATION).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION public\\.${rpc}\\([a-z]*\\) FROM PUBLIC, anon;`))
      expect(MIGRATION).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${rpc}\\([a-z]*\\) TO authenticated;`))
    }
    expect(MIGRATION.match(/IF NOT public\.is_dev\(\) THEN/g)).toHaveLength(Object.keys(HEALTH_RPCS).length)
    expect(MIGRATION.startsWith("SET lock_timeout = '3s';")).toBe(true)
  })

  it('knows its verbs and passes only whole numbers through', () => {
    expect(isHealthVerb('check_locks')).toBe(true)
    expect(isHealthVerb('check_edge_boot')).toBe(false) // probes the platform, not an RPC
    expect(isHealthVerb('toString')).toBe(false)
    expect(healthRpcArgs('check_sampler', { hours: 4.9 })).toEqual({ p_hours: 4 })
    expect(healthRpcArgs('check_sampler', { hours: '4; drop' })).toEqual({})
    expect(healthRpcArgs('check_migration_ledger', { n: 3 })).toEqual({ p_n: 3 })
    expect(healthRpcArgs('check_locks', { hours: 4 })).toEqual({})
  })
})

describe('devMcpHealth — the one-line readings', () => {
  it('reads a quiet sampler, a freeze window, and the early warning', () => {
    expect(healthReading('check_sampler', { hours: 24, samples: 1440, gaps_over_90s: [], slowest_sample: { sample_duration_ms: 31.2 }, samples_over_250ms: 0 }))
      .toBe('no gaps over 90 s in 24 h; slowest sample 31.2 ms.')
    expect(healthReading('check_sampler', { hours: 4, samples: 176, gaps_over_90s: [{ gap_seconds: 120 }, { gap_seconds: 599.8 }], slowest_sample: { sample_duration_ms: 3665 }, samples_over_250ms: 1 }))
      .toBe('2 gaps over 90 s in 4 h (longest 600 s) — each is a freeze window; 1 sample over 250 ms (slowest 3665 ms) — the early warning.')
    expect(healthReading('check_sampler', { hours: 24, samples: 0 })).toMatch(/monitor is not running/)
  })

  it('reads connections: the ceiling, lock waits, a stopped sampler', () => {
    expect(healthReading('check_connections', { sampled_at: 'x', total_conns: 34, max_connections: 100, pct_of_max: 34, sample_age_seconds: 32, by_state: [{ state: 'idle', wait_event_type: 'Client', conns: 31 }] }))
      .toBe('34 of 100 connections (34%).')
    const bad = healthReading('check_connections', { sampled_at: 'x', total_conns: 55, max_connections: 60, pct_of_max: 91.7, sample_age_seconds: 600, by_state: [{ state: 'active', wait_event_type: 'Lock', conns: 12 }] })
    expect(bad).toContain('near the ceiling')
    expect(bad).toContain('12 waiting on a lock — check_locks names the blocker')
    expect(bad).toContain('the sampler has stopped')
    expect(healthReading('check_connections', { sampled_at: null })).toMatch(/No connection sample yet/)
  })

  it('reads locks: none, and a pileup that names its blocker without telling anyone to kill it', () => {
    expect(healthReading('check_locks', { waiters: [], blockers: [], idle_in_transaction_over_60s: [] })).toBe('No lock waits right now.')
    expect(healthReading('check_locks', { waiters: [], blockers: [], idle_in_transaction_over_60s: [{ pid: 9 }] })).toBe('No lock waits right now. 1 transaction left open over 60 s.')
    expect(healthReading('check_locks', { waiters: [{ pid: 2 }, { pid: 3 }], blockers: [{ pid: 1, blocking: 2, xact_seconds: 412.5 }], idle_in_transaction_over_60s: [] }))
      .toBe('2 backends waiting on a lock, behind 1 blocker — pid 1 blocks 2, its transaction open 412.5 s. Read the runbook before terminating anything.')
  })

  it('reads the ledger tail and says where the authority is', () => {
    const reading = healthReading('check_migration_ledger', { applied: 623, newest_first: [{ version: '20260920232141', name: 'dev_health_rpcs' }] })
    expect(reading).toMatch(/^623 applied; newest 20260920232141 dev_health_rpcs\./)
    expect(reading).toContain('check:migration-drift')
    expect(healthReading('check_migration_ledger', { applied: 0, newest_first: [] })).toBe('The migration ledger is empty.')
  })

  it('survives a reply that is not the shape it expects', () => {
    for (const verb of Object.keys(HEALTH_RPCS)) {
      for (const body of [null, 'text', [], { waiters: 'no' }]) expect(typeof healthReading(verb as keyof typeof HEALTH_RPCS, body)).toBe('string')
    }
  })
})

describe('devMcpHealth — check_edge_boot', () => {
  it('calls only a 503 that says BOOT_ERROR a boot failure', () => {
    expect(isBootError(503, '{"code":"BOOT_ERROR","message":"Function failed to start"}')).toBe(true)
    expect(isBootError(503, 'upstream overloaded')).toBe(false)
    expect(isBootError(200, 'BOOT_ERROR')).toBe(false)
  })

  it('reports all booting, and names the ones that do not', () => {
    const okProbe = (name: string) => ({ name, status: 200, bootError: false })
    expect(edgeBootReport([okProbe('a'), okProbe('b')])).toEqual({ reading: 'All 2 probed edge functions boot.', boot_errors: [], rate_limited: [], unreachable: [], probed: 2, total: 2, next_after: null })
    // a 401 / 405 still booted: it answered
    expect(edgeBootReport([{ name: 'a', status: 401, bootError: false }]).reading).toBe('All 1 probed edge functions boot.')
    const report = edgeBootReport([okProbe('a'), { name: 'void-x', status: 503, bootError: true }, { name: 'slow', status: null, bootError: false, error: 'timed out' }])
    expect(report.boot_errors).toEqual(['void-x'])
    expect(report.unreachable).toEqual([{ name: 'slow', error: 'timed out' }])
    expect(report.reading).toBe('1 function cannot boot: void-x — redeploy from a tree that bundles; 1 probe got no answer in time. 1 of 3 probed boot.')
  })

  it('never calls a rate-limited probe a dead function (found live: 60 answered, 63 were refused)', () => {
    const report = edgeBootReport([
      { name: 'a', status: 200, bootError: false },
      { name: 'plan-fetch', status: null, bootError: false, error: 'Rate limit exceeded for function. Retry after 59641ms.' },
      { name: 'twin-mcp', status: 429, bootError: false },
    ])
    expect(report.rate_limited).toEqual(['plan-fetch', 'twin-mcp'])
    expect(report.unreachable).toEqual([])
    expect(report.boot_errors).toEqual([])
    expect(report.reading).toContain('says nothing about those functions')
    expect(report.reading).toContain('1 of 3 probed boot')
  })

  it('probes in batches under the platform ceiling, with a cursor that ends', () => {
    expect(EDGE_BOOT_BATCH).toBeLessThan(60)
    const names = Array.from({ length: 123 }, (_, i) => `fn-${String(i).padStart(3, '0')}`).reverse() // unsorted on purpose
    const seen: string[] = []
    let after: string | null = null
    let calls = 0
    do {
      const { batch, nextAfter } = edgeBootBatch(names, after)
      expect(batch.length).toBeLessThanOrEqual(EDGE_BOOT_BATCH)
      seen.push(...batch)
      after = nextAfter
      calls++
    } while (after && calls < 10)
    expect(calls).toBe(3)
    expect(seen).toEqual([...names].sort()) // every function once, in name order
    expect(edgeBootBatch(names, 'zzz')).toEqual({ batch: [], nextAfter: null, remaining: 0 })
  })

  it('says which slice it probed and how to continue', () => {
    const probes = ['accept-contract', 'archive-user'].map((name) => ({ name, status: 200, bootError: false }))
    const report = edgeBootReport(probes, { total: 123, nextAfter: 'archive-user' })
    expect(report.reading).toBe('All 2 probed edge functions boot (accept-contract → archive-user, 2 of 123). More to probe: call again with after: "archive-user" — in about a minute, to stay under the rate limit.')
    expect(report.next_after).toBe('archive-user')
  })
})
