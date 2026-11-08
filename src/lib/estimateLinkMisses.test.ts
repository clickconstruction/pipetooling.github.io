import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ESTIMATE_LINK_MISS_LIMIT,
  estimateLinkMissDecision,
  estimateLinkSource,
  recordEstimateLinkMiss,
  sha256Hex,
  type EstimateMissClient,
} from '../../supabase/functions/_shared/estimateLinkMisses'

const headers = (fwd?: string) => ({ get: (name: string) => (name === 'x-forwarded-for' ? fwd ?? null : null) })

/** A client whose `estimate_link_miss` counts per source hash, or fails. */
function fake(fail = false): EstimateMissClient & { calls: Array<Record<string, unknown>> } {
  const counts = new Map<string, number>()
  const calls: Array<Record<string, unknown>> = []
  return {
    calls,
    rpc(fn, args) {
      calls.push({ fn, ...args })
      if (fail) return Promise.resolve({ data: null, error: { message: 'function public.estimate_link_miss(text) does not exist' } })
      const key = String(args.p_source_hash)
      const n = (counts.get(key) ?? 0) + 1
      counts.set(key, n)
      return Promise.resolve({ data: n, error: null })
    },
  }
}

describe('the guard on guessing an estimate link (#281 PR 2)', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => { vi.restoreAllMocks() })

  it('locks on the 21st miss in the hour, not the 20th; a count that does not read is none', () => {
    expect(ESTIMATE_LINK_MISS_LIMIT).toBe(20)
    expect(estimateLinkMissDecision(20)).toEqual({ misses: 20, locked: false })
    expect(estimateLinkMissDecision(21)).toEqual({ misses: 21, locked: true })
    expect(estimateLinkMissDecision(1)).toEqual({ misses: 1, locked: false })
    expect(estimateLinkMissDecision(null)).toEqual({ misses: 0, locked: false })
    expect(estimateLinkMissDecision('21')).toEqual({ misses: 0, locked: false })
    expect(estimateLinkMissDecision(Number.NaN)).toEqual({ misses: 0, locked: false })
  })

  it('the source is the first hop of x-forwarded-for, else none', () => {
    expect(estimateLinkSource(headers('203.0.113.9, 10.0.0.1'))).toBe('203.0.113.9')
    expect(estimateLinkSource(headers(' 203.0.113.9 '))).toBe('203.0.113.9')
    expect(estimateLinkSource(headers())).toBe('none')
    expect(estimateLinkSource(headers(''))).toBe('none')
  })

  it('hashes as the lookup does: SHA-256 in lowercase hex', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('counts the miss against the hashed source, never the address, and locks past the limit', async () => {
    const admin = fake()
    const req = { headers: headers('203.0.113.9') }
    let last = await recordEstimateLinkMiss(admin, req, 'get-estimate-for-customer')
    expect(last).toEqual({ misses: 1, locked: false })
    for (let i = 2; i <= 20; i++) last = await recordEstimateLinkMiss(admin, req, 'get-estimate-for-customer')
    expect(last).toEqual({ misses: 20, locked: false })
    expect(await recordEstimateLinkMiss(admin, req, 'get-estimate-for-customer')).toEqual({ misses: 21, locked: true })
    expect(admin.calls[0]?.fn).toBe('estimate_link_miss')
    expect(admin.calls[0]?.p_source_hash).toBe(await sha256Hex('203.0.113.9'))
    expect(JSON.stringify(admin.calls)).not.toContain('203.0.113.9')
    // Another source starts at one.
    expect(await recordEstimateLinkMiss(admin, { headers: headers('198.51.100.4') }, 'accept-estimate')).toEqual({ misses: 1, locked: false })
  })

  it('a bump that fails is no lock, so the function answers its 404 as before', async () => {
    expect(await recordEstimateLinkMiss(fake(true), { headers: headers('203.0.113.9') }, 'accept-estimate')).toEqual({ misses: 0, locked: false })
    const throwing: EstimateMissClient = { rpc: () => { throw new Error('lost signal') } }
    expect(await recordEstimateLinkMiss(throwing, { headers: headers() }, 'log-estimate-option-view')).toEqual({ misses: 0, locked: false })
  })
})
