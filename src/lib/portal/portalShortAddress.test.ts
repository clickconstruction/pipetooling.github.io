import { describe, expect, it, vi } from 'vitest'
// Deno edge module (supabase/functions/_shared) — the pure part and the wrapper over a fake client.
import {
  ensurePortalShortAddress,
  hasActiveMainLink,
  secureRandom,
  shortAddressCandidates,
} from '../../../supabase/functions/_shared/portalShortAddress'
import { isValidSlug, slugGuessabilityDetail } from './portalSlug'

/** A deterministic rng that walks the alphabet, so every tail differs. */
function walkingRng(): () => number {
  let n = 0
  return () => ((n++ * 7) % 32) / 32
}

describe('shortAddressCandidates', () => {
  it('is the customer’s name with a different random tail each time', () => {
    const out = shortAddressCandidates('Hartwell Homes', walkingRng())
    expect(out).toHaveLength(5)
    expect(new Set(out).size).toBe(5)
    for (const slug of out) {
      expect(slug).toMatch(/^hartwell-homes-[a-z2-9]{4}$/)
      expect(isValidSlug(slug)).toBe(true)
      expect(slugGuessabilityDetail(slug, 'hartwell-homes')).toEqual({ grade: 'hard', reason: 'has-tail' })
    }
  })

  it('a name a slug cannot keep gets "account" and two tails', () => {
    for (const name of ['', '&&', 'Al']) {
      const out = shortAddressCandidates(name, walkingRng())
      expect(out.length).toBeGreaterThan(0)
      for (const slug of out) expect(slug).toMatch(/^account-[a-z2-9]{4}-[a-z2-9]{4}$/)
    }
  })

  it('a very long name still yields a valid address', () => {
    for (const slug of shortAddressCandidates('x'.repeat(200), walkingRng())) expect(isValidSlug(slug)).toBe(true)
  })

  it('secureRandom stays in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const r = secureRandom()
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThan(1)
    }
  })
})

describe('hasActiveMainLink', () => {
  it('only a live main link counts', () => {
    expect(hasActiveMainLink([{ audience: 'all', token: 't', revoked_at: null }])).toBe(true)
    expect(hasActiveMainLink([{ audience: 'gc', token: 't', revoked_at: null }])).toBe(false)
    expect(hasActiveMainLink([{ audience: 'all', token: 't', revoked_at: '2026-09-01T00:00:00Z' }])).toBe(false)
    expect(hasActiveMainLink([{ audience: 'all', token: ' ', revoked_at: null }])).toBe(false)
    expect(hasActiveMainLink(null)).toBe(false)
  })
})

type Tables = {
  customer_portal_links: Array<{ customer_id: string; audience: string; token: string; revoked_at: string | null }>
  customer_portal_slugs: Array<{ customer_id: string; slug: string; created_by?: string | null; locked_at?: string | null }>
  customer_portal_slug_events: Array<{ customer_id: string; event: string; slug: string; created_by?: string | null }>
  customers: Array<{ id: string; name: string }>
  sub_portal_slugs: Array<{ slug: string }>
}

/** The few PostgREST calls the wrapper makes, over arrays; `failInsert` answers an insert with that error once per entry. */
function fakeAdmin(tables: Tables, opts: { failInsert?: Array<{ code: string }>; throwOn?: string } = {}) {
  const failures = [...(opts.failInsert ?? [])]
  const inserts: Array<{ table: string; rows: unknown }> = []
  const admin = {
    from(table: keyof Tables) {
      if (opts.throwOn === table) throw new Error('boom')
      const filters: Array<[string, unknown]> = []
      const rows = () => (tables[table] as Array<Record<string, unknown>>).filter((r) => filters.every(([k, v]) => (v === null ? r[k] == null : r[k] === v)))
      const query = {
        select: () => query,
        eq: (k: string, v: unknown) => (filters.push([k, v]), query),
        is: (k: string, v: unknown) => (filters.push([k, v]), query),
        maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
        then: (resolve: (v: { data: unknown[]; error: null }) => void) => resolve({ data: rows(), error: null }),
        insert: async (payload: Record<string, unknown> | Array<Record<string, unknown>>) => {
          inserts.push({ table, rows: payload })
          if (table === 'customer_portal_slugs') {
            const failure = failures.shift()
            if (failure) return { error: failure }
            const row = payload as { customer_id: string; slug: string }
            if (tables.customer_portal_slugs.some((r) => r.slug === row.slug || r.customer_id === row.customer_id)) return { error: { code: '23505' } }
          }
          ;(tables[table] as unknown[]).push(...(Array.isArray(payload) ? payload : [payload]))
          return { error: null }
        },
      }
      return query
    },
  }
  return { admin, inserts }
}

const CUSTOMER = 'c-1'
const tables = (over: Partial<Tables> = {}): Tables => ({
  customer_portal_links: [{ customer_id: CUSTOMER, audience: 'all', token: 'tok', revoked_at: null }],
  customer_portal_slugs: [],
  customer_portal_slug_events: [],
  customers: [{ id: CUSTOMER, name: 'Hartwell Homes' }],
  sub_portal_slugs: [],
  ...over,
})

describe('ensurePortalShortAddress', () => {
  it('returns the saved address and writes nothing', async () => {
    const t = tables({ customer_portal_slugs: [{ customer_id: CUSTOMER, slug: 'hartwell' }] })
    const { admin, inserts } = fakeAdmin(t)
    expect(await ensurePortalShortAddress(admin, CUSTOMER, 'u-1')).toBe('hartwell')
    expect(inserts).toEqual([])
  })

  it('assigns name + tail, locked, with its two history rows, in the sender’s name', async () => {
    const t = tables()
    const { admin } = fakeAdmin(t)
    const slug = await ensurePortalShortAddress(admin, CUSTOMER, 'u-1')
    expect(slug).toMatch(/^hartwell-homes-[a-z2-9]{4}$/)
    expect(t.customer_portal_slugs).toHaveLength(1)
    expect(t.customer_portal_slugs[0]).toMatchObject({ customer_id: CUSTOMER, slug, created_by: 'u-1' })
    expect(typeof t.customer_portal_slugs[0]?.locked_at).toBe('string')
    expect(t.customer_portal_slug_events.map((e) => [e.event, e.slug, e.created_by])).toEqual([
      ['created', slug, 'u-1'],
      ['locked', slug, 'u-1'],
    ])
  })

  it('assigns nothing without a live main link — no portal, a revoked one, or only a GC link', async () => {
    for (const links of [[], [{ customer_id: CUSTOMER, audience: 'gc', token: 'tok', revoked_at: null }]]) {
      const t = tables({ customer_portal_links: links })
      const { admin, inserts } = fakeAdmin(t)
      expect(await ensurePortalShortAddress(admin, CUSTOMER, 'u-1')).toBeNull()
      expect(inserts).toEqual([])
    }
    const revoked = tables({ customer_portal_links: [{ customer_id: CUSTOMER, audience: 'all', token: 'tok', revoked_at: '2026-09-01T00:00:00Z' }] })
    expect(await ensurePortalShortAddress(fakeAdmin(revoked).admin, CUSTOMER, 'u-1')).toBeNull()
  })

  it('tries the next tail when an address is taken', async () => {
    const t = tables()
    const { admin, inserts } = fakeAdmin(t, { failInsert: [{ code: '23505' }, { code: '23505' }] })
    const slug = await ensurePortalShortAddress(admin, CUSTOMER, 'u-1')
    expect(slug).toMatch(/^hartwell-homes-/)
    expect(inserts.filter((i) => i.table === 'customer_portal_slugs')).toHaveLength(3)
    expect(t.customer_portal_slugs).toHaveLength(1)
  })

  it('takes the address another send assigned a moment ago', async () => {
    const t = tables()
    const { admin } = fakeAdmin(t)
    const original = admin.from.bind(admin)
    let raced = false
    admin.from = ((table: keyof Tables) => {
      const q = original(table)
      if (table === 'customer_portal_slugs') {
        const insert = q.insert
        q.insert = async (payload) => {
          if (!raced) {
            raced = true
            t.customer_portal_slugs.push({ customer_id: CUSTOMER, slug: 'hartwell-homes-race' })
          }
          return insert(payload)
        }
      }
      return q
    }) as typeof admin.from
    expect(await ensurePortalShortAddress(admin, CUSTOMER, 'u-1')).toBe('hartwell-homes-race')
    expect(t.customer_portal_slug_events).toEqual([])
  })

  it('skips an address a sub already has', async () => {
    const t = tables()
    const { admin } = fakeAdmin(t)
    const original = admin.from.bind(admin)
    let first = true
    admin.from = ((table: keyof Tables) => {
      const q = original(table)
      if (table === 'sub_portal_slugs' && first) {
        first = false
        q.maybeSingle = async () => ({ data: { slug: 'taken' }, error: null })
      }
      return q
    }) as typeof admin.from
    const slug = await ensurePortalShortAddress(admin, CUSTOMER, 'u-1')
    expect(slug).toMatch(/^hartwell-homes-/)
    expect(t.customer_portal_slugs).toHaveLength(1)
  })

  it('gives up quietly on any other write error, and on a thrown one', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const t = tables()
    expect(await ensurePortalShortAddress(fakeAdmin(t, { failInsert: [{ code: '42501' }] }).admin, CUSTOMER, 'u-1')).toBeNull()
    expect(t.customer_portal_slugs).toEqual([])
    expect(await ensurePortalShortAddress(fakeAdmin(tables(), { throwOn: 'customers' }).admin, CUSTOMER, 'u-1')).toBeNull()
    expect(logged).toHaveBeenCalledTimes(2)
    logged.mockRestore()
  })
})
