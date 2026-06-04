import { describe, expect, it } from 'vitest'
import {
  buildMercuryTxSearchHaystack,
  mercuryTxMatchesSearchQuery,
  type BankingMercurySearchNicknames,
  type MercuryTxRow,
} from './bankingMercurySearch'

const ctx: BankingMercurySearchNicknames = { nicknameByAccount: {}, nicknameByDebitCard: {} }

function row(over: Partial<MercuryTxRow> = {}): MercuryTxRow {
  return {
    amount: -12.34,
    counterparty_id: null,
    counterparty_name: 'Acme Supply',
    created_at: '2026-06-01T00:00:00Z',
    created_by: null,
    currency: 'USD',
    dashboard_link: null,
    duplicate_of_transaction_id: null,
    external_memo: null,
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'debitCard',
    manual_upload_id: null,
    mercury_account_id: '22222222-2222-2222-2222-222222222222',
    mercury_category: null,
    mercury_id: '33333333-3333-3333-3333-333333333333',
    note: null,
    posted_at: '2026-06-01T00:00:00Z',
    raw: null,
    source: 'mercury',
    status: 'sent',
    synced_at: '2026-06-01T00:00:00Z',
    ...over,
  }
}

describe('buildMercuryTxSearchHaystack — bankDescription', () => {
  it('does not include a bank-description term when none is passed', () => {
    const hay = buildMercuryTxSearchHaystack(row(), ctx)
    expect(hay).toContain('acme supply')
    expect(hay).not.toContain('quiktrip')
  })

  it('includes the bank description (lowercased) when passed', () => {
    const hay = buildMercuryTxSearchHaystack(row(), ctx, 'QUIKTRIP #1234 HOUSTON TX')
    expect(hay).toContain('quiktrip #1234 houston tx')
  })

  it('lets the search match on a bank-description-only token', () => {
    const hay = buildMercuryTxSearchHaystack(row(), ctx, 'POS PURCHASE HOMEDEPOT 8520')
    expect(mercuryTxMatchesSearchQuery(hay, 'homedepot')).toBe(true)
    // still matches existing fields too
    expect(mercuryTxMatchesSearchQuery(hay, 'acme')).toBe(true)
    expect(mercuryTxMatchesSearchQuery(hay, 'nope')).toBe(false)
  })

  it('ignores null / blank bank descriptions', () => {
    expect(buildMercuryTxSearchHaystack(row(), ctx, null)).toBe(buildMercuryTxSearchHaystack(row(), ctx))
    expect(buildMercuryTxSearchHaystack(row(), ctx, '   ')).toBe(buildMercuryTxSearchHaystack(row(), ctx))
  })
})
