import { describe, expect, it } from 'vitest'
import {
  NONCARD_QUEUE_WINDOW_DAYS,
  formatNoncardOutflowAmount,
  formatNoncardPostedDate,
  mercuryTxRowFromNoncardQueueRow,
  noncardKindLabel,
  noncardQueueTotalOutflow,
  noncardQueueWindowCutoffMs,
  parseNoncardAttributionQueueRows,
  splitNoncardQueueRowsByWindow,
  type NoncardAttributionQueueRow,
} from './noncardAttributionQueue'

const DAY_MS = 24 * 60 * 60 * 1000

function row(overrides: Partial<NoncardAttributionQueueRow> = {}): NoncardAttributionQueueRow {
  return {
    mercury_transaction_id: 'tx-1',
    posted_at: '2026-08-01T12:00:00.000Z',
    amount: -100,
    kind: 'externalTransfer',
    counterparty_name: 'ACME Plumbing Supply',
    external_memo: null,
    ...overrides,
  }
}

describe('parseNoncardAttributionQueueRows', () => {
  it('parses valid RPC rows and coerces string amounts', () => {
    const parsed = parseNoncardAttributionQueueRows([
      {
        mercury_transaction_id: 'a',
        posted_at: '2026-07-01T00:00:00Z',
        amount: '-1234.56',
        kind: 'externalTransfer',
        counterparty_name: 'Rent LLC',
        external_memo: 'August rent',
      },
    ])
    expect(parsed).toHaveLength(1)
    expect(parsed[0]!.amount).toBe(-1234.56)
    expect(parsed[0]!.counterparty_name).toBe('Rent LLC')
    expect(parsed[0]!.external_memo).toBe('August rent')
  })

  it('drops malformed entries and non-array payloads', () => {
    expect(parseNoncardAttributionQueueRows(null)).toEqual([])
    expect(parseNoncardAttributionQueueRows({})).toEqual([])
    expect(
      parseNoncardAttributionQueueRows([
        null,
        42,
        { mercury_transaction_id: 12, amount: -1 }, // non-string id
        { mercury_transaction_id: 'ok', amount: 'not-a-number' },
        { mercury_transaction_id: 'good', amount: -5 },
      ]),
    ).toEqual([
      {
        mercury_transaction_id: 'good',
        posted_at: null,
        amount: -5,
        kind: '',
        counterparty_name: null,
        external_memo: null,
      },
    ])
  })
})

describe('90-day window split', () => {
  // Fixed "now": 2026-08-02T15:30Z. UTC day start = 2026-08-02T00:00Z.
  const nowMs = Date.parse('2026-08-02T15:30:00.000Z')

  it('cutoff is UTC day start minus 89 days (window covers 90 calendar days)', () => {
    const cutoff = noncardQueueWindowCutoffMs(nowMs)
    expect(cutoff).toBe(Date.parse('2026-08-02T00:00:00.000Z') - 89 * DAY_MS)
    expect(NONCARD_QUEUE_WINDOW_DAYS).toBe(90)
  })

  it('splits newest-first rows preserving order; boundary day is recent', () => {
    const cutoffIso = new Date(noncardQueueWindowCutoffMs(nowMs)).toISOString()
    const justInside = row({ mercury_transaction_id: 'in', posted_at: cutoffIso })
    const justOutside = row({
      mercury_transaction_id: 'out',
      posted_at: new Date(noncardQueueWindowCutoffMs(nowMs) - 1).toISOString(),
    })
    const today = row({ mercury_transaction_id: 'today', posted_at: '2026-08-02T10:00:00.000Z' })
    const { recent, older } = splitNoncardQueueRowsByWindow([today, justInside, justOutside], nowMs)
    expect(recent.map((r) => r.mercury_transaction_id)).toEqual(['today', 'in'])
    expect(older.map((r) => r.mercury_transaction_id)).toEqual(['out'])
  })

  it('keeps rows with missing/unparseable posted_at in recent (never hidden)', () => {
    const { recent, older } = splitNoncardQueueRowsByWindow(
      [row({ posted_at: null }), row({ mercury_transaction_id: 'bad', posted_at: 'garbage' })],
      nowMs,
    )
    expect(recent).toHaveLength(2)
    expect(older).toHaveLength(0)
  })
})

describe('display formatting', () => {
  it('formats outflows as positive dollars', () => {
    expect(formatNoncardOutflowAmount(-1234.5)).toBe('$1,234.50')
    expect(formatNoncardOutflowAmount(-0.4)).toBe('$0.40')
  })

  it('totals absolute outflow with cent rounding', () => {
    expect(
      noncardQueueTotalOutflow([row({ amount: -0.1 }), row({ amount: -0.2 })]),
    ).toBe(0.3)
    expect(noncardQueueTotalOutflow([])).toBe(0)
  })

  it('labels kinds via the shared map, else splits camelCase', () => {
    expect(noncardKindLabel('debitCardTransaction')).toBe('Debit Card')
    expect(noncardKindLabel('externalTransfer')).toBe('External Transfer')
    expect(noncardKindLabel('check')).toBe('Check')
    expect(noncardKindLabel('')).toBe('—')
  })

  it('formats posted dates in the company calendar and tolerates bad input', () => {
    expect(formatNoncardPostedDate('2026-08-01T12:00:00.000Z')).toMatch(/Aug 1, 2026/)
    expect(formatNoncardPostedDate(null)).toBe('—')
    expect(formatNoncardPostedDate('garbage')).toBe('garbage')
  })
})

describe('mercuryTxRowFromNoncardQueueRow', () => {
  it('maps queue fields and fills placeholder columns for the allocations modal', () => {
    const tx = mercuryTxRowFromNoncardQueueRow(
      row({ mercury_transaction_id: 'tx-9', amount: -500, external_memo: 'memo' }),
    )
    expect(tx.id).toBe('tx-9')
    expect(tx.amount).toBe(-500)
    expect(tx.posted_at).toBe('2026-08-01T12:00:00.000Z')
    expect(tx.counterparty_name).toBe('ACME Plumbing Supply')
    expect(tx.external_memo).toBe('memo')
    expect(tx.kind).toBe('externalTransfer')
    expect(tx.currency).toBe('USD')
    expect(tx.duplicate_of_transaction_id).toBeNull()
    expect(tx.source).toBe('mercury')
  })

  it('falls back to a placeholder kind for empty kinds', () => {
    expect(mercuryTxRowFromNoncardQueueRow(row({ kind: '' })).kind).toBe('—')
  })
})
