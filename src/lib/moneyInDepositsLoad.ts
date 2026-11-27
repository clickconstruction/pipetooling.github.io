import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

/**
 * Money in's deposits: the reads behind `moneyInDeposits.ts` (punch list #422). Each throws its reason. The
 * Dashboard's loader (`moneyInWeekLoad.ts`) and By day paid's (`billing/billsPaidIo.ts`) both call these, so
 * the two screens read the same rows and decide what fails soft for themselves.
 *
 * Deposits are read the way the Accounts Receivable window reads them: posted ones through its own list (the
 * org's deposit filter, closed-out and returned deposits left out, what is still unapplied), pending ones from
 * the table. The four office roles that open Accounts Receivable are the ones these answer.
 */
import { withSupabaseRetry } from '../utils/errorHandling'
import { BANKING_SORTING_CONFIG_VERSION, type BankingSortingConfigV1 } from './bankingSortingConfig'
import { moneyInDepositsReadFrom, type MoneyInDepositFilter, type MoneyInPendingDepositRow, type MoneyInPostedDepositRow, type MoneyInUnlinkedRow } from './moneyInDeposits'
import type { ArReturnCaseRow } from './jobs/arReturnCase'
import { BANK_CHECK_FACT_COLUMNS } from './jobs/checkCleared'

export async function rpcRows<T>(db: SupabaseClient<Database>, fn: string, args?: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await db.rpc(fn as never, (args ?? {}) as never)
  if (error) throw error
  return Array.isArray(data) ? (data as T[]) : []
}

/** The org's deposit filter as the kernel reads it. Null when the setting did not read: the bare rule then holds. */
export function moneyInDepositFilterOf(cfg: BankingSortingConfigV1 | null): MoneyInDepositFilter | null {
  return cfg ? { kinds: cfg.kinds, excludeCounterpartyContains: cfg.excludeCounterpartyContains, excludeNoteContains: cfg.excludeNoteContains } : null
}

const PENDING_DEPOSIT_COLUMNS = 'id, amount, kind, created_at, counterparty_name, note'

/**
 * Deposits still pending at the bank, newest first, each with what the bank says of a check: the number it read
 * and the day it names (punch list #437, piece 2, the columns `checkClearedIo.ts` reads off the same rows). A read
 * refused with those two is asked once more without them, so a seat that may not read them still gets its
 * deposits and Money in draws its own guess, as before.
 */
export async function readPendingDepositRows(db: SupabaseClient<Database>): Promise<MoneyInPendingDepositRow[]> {
  const ask = (columns: string) =>
    withSupabaseRetry(
      async () => db.from('mercury_transactions').select(columns).eq('status', 'pending').gt('amount', 0).order('created_at', { ascending: false }).limit(200),
      'money in pending deposits',
    )
  let rows: unknown
  try {
    rows = await ask(`${PENDING_DEPOSIT_COLUMNS}, ${BANK_CHECK_FACT_COLUMNS}`)
  } catch {
    rows = await ask(PENDING_DEPOSIT_COLUMNS)
  }
  return (rows ?? []) as MoneyInPendingDepositRow[]
}

/**
 * Posted deposits from a day on that still hold money not applied, by Accounts Receivable's own list and the
 * org's filter. The read never starts before the day that list itself starts (`moneyInDepositsReadFrom`): By day
 * paid opens any month, and a month from before the office began matching in the app holds deposits Accounts
 * Receivable does not list.
 */
export async function readPostedDepositRows(db: SupabaseClient<Database>, cfg: BankingSortingConfigV1 | null, sinceYmd: string): Promise<MoneyInPostedDepositRow[]> {
  return rpcRows<MoneyInPostedDepositRow>(db, 'list_mercury_transactions_for_bank_payments', {
    p_filter: cfg
      ? {
          v: BANKING_SORTING_CONFIG_VERSION,
          kinds: cfg.kinds,
          accountIds: cfg.accountIds,
          debitCardIds: cfg.debitCardIds,
          startDateYmd: moneyInDepositsReadFrom(sinceYmd, cfg.startDateYmd),
          excludeCounterpartyContains: cfg.excludeCounterpartyContains,
          excludeNoteContains: cfg.excludeNoteContains,
        }
      : { v: BANKING_SORTING_CONFIG_VERSION, startDateYmd: sinceYmd },
  })
}

/** Typed-in payments no deposit carries yet, with a day, from a day on. */
export async function readUnlinkedPaymentRows(db: SupabaseClient<Database>, sinceYmd: string): Promise<MoneyInUnlinkedRow[]> {
  return (await rpcRows<MoneyInUnlinkedRow>(db, 'list_unlinked_payments_for_bank_payments')).filter((r) => r.paid_on != null && r.paid_on.slice(0, 10) >= sinceYmd)
}

/** The open return cases, as the Accounts Receivable window lists them. */
export async function readOpenReturnCaseRows(db: SupabaseClient<Database>): Promise<ArReturnCaseRow[]> {
  return (await rpcRows<ArReturnCaseRow>(db, 'list_ar_return_cases', { p_include_closed: false })).filter((r) => r && typeof r.mercury_transaction_id === 'string' && r.closed_at == null)
}
