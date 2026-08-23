import { describe, expect, it } from 'vitest'
import { PARTNER_NAV_FRESH_MS, parsePartnerNavCache, partnerNavStatusFromSummary } from './partnerNavStatus'
import type { PartnerSummary } from './partnerWeeks'

const base: PartnerSummary = {
  exists: true,
  partnership_id: 'p1',
  display_name: 'Bryan',
  balance: -1,
  modules: { weekly_statement: true, costing: true, profit_shares: true },
  current_week: { week_start: '2026-08-23', field_hours: 0, office_hours: 0, farm_hours: 0, gross_so_far: 0, pending_sessions: 0 },
  latest_statement: { pay_stub_id: 's1', period_start: '2026-08-09', period_end: '2026-08-15', partner_ack_at: null, company_ack_at: null },
  rates: { field: 50, estimating: 35, farm: 0 },
  pending_offsets: { count: 0, net: 0 },
}

describe('partnerNavStatusFromSummary', () => {
  it('partner with an unacknowledged statement → link + mark', () => {
    expect(partnerNavStatusFromSummary(base)).toEqual({ isPartner: true, awaitingSignOff: true })
  })
  it('acknowledged or no statement → link, no mark', () => {
    expect(partnerNavStatusFromSummary({ ...base, latest_statement: { ...base.latest_statement!, partner_ack_at: '2026-08-20T00:00:00Z' } }).awaitingSignOff).toBe(false)
    expect(partnerNavStatusFromSummary({ ...base, latest_statement: null }).awaitingSignOff).toBe(false)
  })
  it('non-partner or statements module off → nothing', () => {
    expect(partnerNavStatusFromSummary(null).isPartner).toBe(false)
    expect(partnerNavStatusFromSummary({ ...base, modules: { ...base.modules, weekly_statement: false } }).isPartner).toBe(false)
  })
})

describe('parsePartnerNavCache', () => {
  it('reads a fresh cache and rejects a stale or malformed one', () => {
    const now = 1_000_000
    expect(parsePartnerNavCache(JSON.stringify({ isPartner: true, awaitingSignOff: false, at: now - 1000 }), now)).toEqual({ isPartner: true, awaitingSignOff: false })
    expect(parsePartnerNavCache(JSON.stringify({ isPartner: true, awaitingSignOff: true, at: now - PARTNER_NAV_FRESH_MS - 1 }), now)).toBeNull()
    expect(parsePartnerNavCache('{not json', now)).toBeNull()
    expect(parsePartnerNavCache(null, now)).toBeNull()
  })
})
