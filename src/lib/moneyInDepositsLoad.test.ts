import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import type { BankingSortingConfigV1 } from './bankingSortingConfig'
import { readPendingDepositRows, readPostedDepositRows } from './moneyInDepositsLoad'

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

describe('readPendingDepositRows', () => {
  type Answer = { data: unknown[] | null; error: { code: string; message: string } | null; status: number }
  /** A table that answers each read in turn and keeps the columns it was asked for. */
  function pendingDb(answers: Answer[]) {
    const selects: string[] = []
    const chain: Record<string, unknown> = {}
    for (const name of ['eq', 'gt', 'order']) chain[name] = () => chain
    chain.select = (columns: string) => {
      selects.push(columns)
      return chain
    }
    chain.limit = async () => answers.shift() ?? { data: [], error: null, status: 200 }
    return { db: { from: () => chain } as unknown as SupabaseClient<Database>, selects }
  }

  it('asks for what the bank says of a check beside the deposit: its number and the day the bank names', async () => {
    const row = { id: 'p1', amount: 4980, kind: 'checkDeposit', created_at: '2026-10-23T17:00:00Z', counterparty_name: null, note: null, check_number: '03310', bank_day: '2026-10-30T21:00:00Z' }
    const { db, selects } = pendingDb([{ data: [row], error: null, status: 200 }])
    expect(await readPendingDepositRows(db)).toEqual([row])
    expect(selects).toEqual(['id, amount, kind, created_at, counterparty_name, note, check_number:raw->>checkNumber, bank_day:raw->>estimatedDeliveryDate'])
  })

  it('asks once more without the bank’s two columns when that read is refused, so the deposits still draw', async () => {
    const row = { id: 'p1', amount: 4980, kind: 'checkDeposit', created_at: '2026-10-23T17:00:00Z', counterparty_name: null, note: null }
    const { db, selects } = pendingDb([{ data: null, error: { code: '42501', message: 'permission denied for column raw' }, status: 403 }, { data: [row], error: null, status: 200 }])
    expect(await readPendingDepositRows(db)).toEqual([row])
    expect(selects[1]).toBe('id, amount, kind, created_at, counterparty_name, note')
  })

  it('says why when the deposits themselves cannot be read', async () => {
    const refused = { data: null, error: { code: '42501', message: 'permission denied for table mercury_transactions' }, status: 403 }
    const { db } = pendingDb([refused, refused])
    await expect(readPendingDepositRows(db)).rejects.toBeTruthy()
  })
})
