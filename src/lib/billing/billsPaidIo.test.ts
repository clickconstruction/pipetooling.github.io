/**
 * By day paid's best-effort read of the bank deposits on no bill (`readDepositsOnNoBill`): what it answers when a
 * read fails, and that it never names a deposit it could not filter. Every id, day and amount is made up.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const io = vi.hoisted(() => ({
  outcome: 'row' as 'row' | 'no-row' | 'error',
  posted: [] as unknown[],
  unlinked: [] as unknown[],
  postedFails: false,
  unlinkedFails: false,
  softFails: false,
  postedAsks: [] as Array<{ cfg: unknown; since: string }>,
  unlinkedAsks: [] as string[],
}))
vi.mock('../supabase', () => ({ supabase: {} }))
vi.mock('../bankingSortingConfig', () => ({
  fetchBankPaymentsSortingConfigFromAppSettings: async () => ({ config: { v: 1, kinds: [], accountIds: [], debitCardIds: [], startDateYmd: '2026-04-01', excludeCounterpartyContains: [], excludeNoteContains: [] }, outcome: io.outcome }),
}))
vi.mock('../moneyInDepositsLoad', () => ({
  moneyInDepositFilterOf: () => null,
  readPostedDepositRows: async (_db: unknown, cfg: unknown, since: string) => {
    io.postedAsks.push({ cfg, since })
    if (io.postedFails) throw new Error('refused')
    return io.posted
  },
  readUnlinkedPaymentRows: async (_db: unknown, since: string) => {
    io.unlinkedAsks.push(since)
    if (io.unlinkedFails) throw new Error('refused')
    return io.unlinked
  },
  readPendingDepositRows: async () => {
    if (io.softFails) throw new Error('refused')
    return []
  },
  readOpenReturnCaseRows: async () => {
    if (io.softFails) throw new Error('refused')
    return []
  },
}))

import { readDepositsOnNoBill } from './billsPaidIo'

const TODAY = '2026-11-24'
const deposit = (id: string, postedAt: string, amount: number) => ({ mercury_transaction_id: id, amount, posted_at: postedAt, counterparty_name: 'JUNIPER HILL', note: null, kind: 'checkDeposit', remaining_available: amount, returned: false })

beforeEach(() => {
  io.outcome = 'row'
  io.posted = []
  io.unlinked = []
  io.postedFails = false
  io.unlinkedFails = false
  io.softFails = false
  io.postedAsks = []
  io.unlinkedAsks = []
})

describe('readDepositsOnNoBill', () => {
  it('answers the deposits on no bill by day, leaving out one a typed-in payment carries', async () => {
    io.posted = [deposit('m1', '2026-11-23T17:00:00.000Z', 640), deposit('m2', '2026-11-23T18:00:00.000Z', 900)]
    io.unlinked = [{ payment_id: 'u1', job_id: 'j1', amount: 900, paid_on: '2026-11-20', payment_type: 'Check', reference_number: '4471', job_name: 'Cedar Ridge Lot 4' }]
    const answer = await readDepositsOnNoBill({ from: '2026-11-01' }, TODAY)
    expect(answer.state).toBe('read')
    if (answer.state !== 'read') return
    expect([...answer.days]).toEqual([['2026-11-23', { deposits: 1, usd: 640 }]])
  })

  it('answers unread when the org’s deposit setting did not read, and asks the bank for nothing', async () => {
    // Without the setting there is no filter and no start date: a count would name deposits Accounts Receivable hides.
    io.outcome = 'error'
    io.posted = [deposit('m1', '2026-03-16T17:00:00.000Z', 640)]
    expect(await readDepositsOnNoBill({ from: '2026-03-01' }, TODAY)).toEqual({ state: 'unread' })
    expect(io.postedAsks).toEqual([])
  })

  it('answers unread when the posted deposits or the typed-in payments do not read', async () => {
    io.postedFails = true
    expect(await readDepositsOnNoBill({ from: '2026-11-01' }, TODAY)).toEqual({ state: 'unread' })
    io.postedFails = false
    io.unlinkedFails = true
    expect(await readDepositsOnNoBill({ from: '2026-11-01' }, TODAY)).toEqual({ state: 'unread' })
  })

  it('still answers when the pending deposits and the return cases do not read', async () => {
    io.softFails = true
    io.posted = [deposit('m1', '2026-11-23T17:00:00.000Z', 640)]
    const answer = await readDepositsOnNoBill({ from: '2026-11-01' }, TODAY)
    expect(answer.state).toBe('read')
  })

  it('reads from the month’s first day when that is before where Money in starts, and typed-in payments thirty days before it', async () => {
    await readDepositsOnNoBill({ from: '2026-09-01' }, TODAY)
    expect(io.postedAsks[0]?.since).toBe('2026-09-01')
    expect(io.unlinkedAsks[0]).toBe('2026-08-02')
  })
})
