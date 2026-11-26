import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({ rpc: [] as Array<{ fn: string; args: unknown }>, answer: { data: { ok: true } as unknown, error: null as unknown } }))
vi.mock('../supabase', () => ({
  supabase: {
    rpc: (fn: string, args: unknown) => {
      calls.rpc.push({ fn, args })
      return Promise.resolve(calls.answer)
    },
  },
}))

import { deleteTestPortalLink } from './portalLinkDeleteIo'
import type { PortalLinkDeleteCandidate } from './portalLinkDelete'

const off: PortalLinkDeleteCandidate = { kind: 'link', linkId: 'l1', at: '2026-11-20T15:00:00Z', createdBy: null, audience: 'all', outcome: 'turned-off', revokedAt: '2026-11-21T15:00:00Z' }

describe('deleteTestPortalLink (punch list #443, row 11)', () => {
  beforeEach(() => {
    calls.rpc.length = 0
    calls.answer = { data: { ok: true }, error: null }
  })

  it('calls the one door with the link id, once', async () => {
    await deleteTestPortalLink(off, 'ZZ Test Portal Customer')
    expect(calls.rpc).toEqual([{ fn: 'delete_test_portal_link', args: { p_link_id: 'l1' } }])
  })

  it('runs the rule first and sends nothing when it refuses', async () => {
    await expect(deleteTestPortalLink({ ...off, outcome: 'active', revokedAt: null }, 'ZZ Test Portal Customer')).rejects.toThrow('Turn this link off first.')
    await expect(deleteTestPortalLink(off, 'Davenport Plumbing')).rejects.toThrow('Only a test customer’s link can be deleted.')
    expect(calls.rpc).toEqual([])
  })

  it('passes the function’s own refusal on in its words', async () => {
    calls.answer = { data: null, error: { message: '2 GC proposals name this link. It stays.', code: 'P0001' } }
    await expect(deleteTestPortalLink(off, 'ZZ Test Portal Customer')).rejects.toThrow('2 GC proposals name this link. It stays.')
    calls.answer = { data: { error: 'Only a developer can delete a portal link.' }, error: null }
    await expect(deleteTestPortalLink(off, 'ZZ Test Portal Customer')).rejects.toThrow('Only a developer can delete a portal link.')
  })
})
