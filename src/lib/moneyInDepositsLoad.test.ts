import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import type { BankingSortingConfigV1 } from './bankingSortingConfig'
import { readPostedDepositRows } from './moneyInDepositsLoad'

// A database that answers nothing and keeps what it was asked. Made-up ids throughout.
function fakeDb() {
  const asks: Array<{ fn: string; args: { p_filter?: { startDateYmd?: string; kinds?: string[] } } }> = []
  const db = {
    rpc: async (fn: string, args: { p_filter?: { startDateYmd?: string; kinds?: string[] } }) => {
      asks.push({ fn, args })
      return { data: [], error: null }
    },
  } as unknown as SupabaseClient<Database>
  return { db, asks }
}

const cfg: BankingSortingConfigV1 = { v: 1, kinds: ['checkDeposit'], accountIds: ['acct-1'], debitCardIds: [], startDateYmd: '2026-04-01', excludeCounterpartyContains: ['owner draw'], excludeNoteContains: [] }

describe('readPostedDepositRows', () => {
  it('asks Accounts Receivable’s own list, with the org’s filter', async () => {
    const { db, asks } = fakeDb()
    await readPostedDepositRows(db, cfg, '2026-11-10')
    expect(asks[0]?.fn).toBe('list_mercury_transactions_for_bank_payments')
    expect(asks[0]?.args.p_filter).toMatchObject({ kinds: ['checkDeposit'], accountIds: ['acct-1'], excludeCounterpartyContains: ['owner draw'], startDateYmd: '2026-11-10' })
  })

  it('never asks for a deposit from before the day Accounts Receivable starts its list', async () => {
    // By day paid opened on a month before the office began matching deposits in the app. Accounts Receivable
    // lists none of that month's deposits, so the line must name none of them.
    const { db, asks } = fakeDb()
    await readPostedDepositRows(db, cfg, '2026-03-01')
    expect(asks[0]?.args.p_filter?.startDateYmd).toBe('2026-04-01')
  })

  it('asks from the day it was given when the org’s setting did not read', async () => {
    const { db, asks } = fakeDb()
    await readPostedDepositRows(db, null, '2026-03-01')
    expect(asks[0]?.args.p_filter).toEqual({ v: 1, startDateYmd: '2026-03-01' })
  })
})
