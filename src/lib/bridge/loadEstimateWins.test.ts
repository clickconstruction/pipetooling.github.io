import { describe, expect, it } from 'vitest'
import { makeProxyFakeSupabase } from '../../test/proxyFakeSupabase'
import { isZzEstimate, loadEstimatesSent } from './loadEstimateWins'

describe('isZzEstimate', () => {
  it('knows a test estimate by its customer’s name', () => {
    expect(isZzEstimate({ title: 'Kitchen repipe', customerName: 'ZZ Test Walk' })).toBe(true)
    expect(isZzEstimate({ title: 'Kitchen repipe', customerName: 'zz walk' })).toBe(true)
  })

  it('knows one by its title, with the usual opening taken off', () => {
    expect(isZzEstimate({ title: 'Estimate for ZZ Test Walk', customerName: null })).toBe(true)
    expect(isZzEstimate({ title: '  estimate for zz walk', customerName: '' })).toBe(true)
    expect(isZzEstimate({ title: 'ZZ quick test', customerName: 'Maple Homes' })).toBe(true)
  })

  it('leaves a real estimate alone', () => {
    expect(isZzEstimate({ title: 'Estimate for Maple Homes', customerName: 'Maple Homes' })).toBe(false)
    // ZZ is the start of the name, not a part of it.
    expect(isZzEstimate({ title: 'Estimate for Pizza Plaza', customerName: 'Pizza Plaza' })).toBe(false)
    expect(isZzEstimate({ title: null, customerName: null })).toBe(false)
  })
})

describe('loadEstimatesSent: a ZZ test estimate leaves the won rate (punch list #334, PR 3)', () => {
  // Made-up customers and dollars.
  const row = (id: string, title: string, customer: string | null, status = 'sent') => ({ id, estimate_number: 41, title, customers: customer == null ? null : { name: customer }, sent_at: '2026-10-05T15:00:00+00:00', status, total_cents: 240_000, doc_kind: 'estimate', customer_id: customer == null ? null : `c-${id}`, customer_email: null, for_address: '12 Elm St', acceptor_consented_at: null, updated_at: '2026-10-06T15:00:00+00:00' })
  const rows = {
    estimates: [row('real', 'Estimate for Maple Homes', 'Maple Homes', 'customer_accepted'), row('zzCustomer', 'Kitchen repipe', 'ZZ Test Walk', 'declined'), row('zzTitle', 'Estimate for ZZ Walk Press', null)],
  }

  it('leaves the ZZ test estimates out for the viewer who hides tests', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    const sent = await loadEstimatesSent(db, { leftOut: [], zzTestJobIds: new Set<string>() })
    expect(sent.map((e) => [e.status, e.usd])).toEqual([['customer_accepted', 2_400]])
    // Each estimate carries its own id, number and title, for a list that names it (PR 4).
    expect(sent.map((e) => [e.id, e.number, e.name])).toEqual([['real', 41, 'Estimate for Maple Homes']])
  })

  it('keeps them for a dev who shows tests, and when no switch is handed in', async () => {
    const { db } = makeProxyFakeSupabase(rows)
    expect((await loadEstimatesSent(db, { leftOut: [], zzTestJobIds: null })).length).toBe(3)
    expect((await loadEstimatesSent(db, { leftOut: [] })).length).toBe(3)
  })
})
