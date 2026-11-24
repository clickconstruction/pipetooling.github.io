/**
 * The bank's check deposits, read for `checkCleared.ts` (punch list #437, piece 1): every check deposit of the
 * last sixty days, and any older one a payment is linked to. The office seats read the bank's rows under their
 * own row policies. A seat that may not gets none back, and a check then waits its seven days as before.
 */
import { supabase } from '../supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { ymdAddDays } from '../../utils/dateUtils'
import { BANK_CHECK_COLUMNS, BANK_CHECK_WINDOW_DAYS, bankCheckFromRow, type BankCheck, type BankCheckRow } from './checkCleared'

/** The bank's check deposits as of `todayYmd`. Throws when the read fails, so the screen can say why. */
export async function readBankChecks(todayYmd: string, linkedIds: ReadonlyArray<string | null | undefined> = []): Promise<BankCheck[]> {
  const since = `${ymdAddDays(todayYmd, -BANK_CHECK_WINDOW_DAYS)}T00:00:00Z`
  const recent = ((await withSupabaseRetry(
    () => supabase.from('mercury_transactions').select(BANK_CHECK_COLUMNS).eq('kind', 'checkDeposit').gt('amount', 0).is('duplicate_of_transaction_id', null).gte('created_at', since).order('created_at', { ascending: false }),
    'bank checks: recent',
  )) ?? []) as unknown as BankCheckRow[]
  const have = new Set(recent.map((r) => r.id))
  const more = [...new Set(linkedIds.filter((id): id is string => Boolean(id) && !have.has(id as string)))]
  const linked = more.length ? (((await withSupabaseRetry(() => supabase.from('mercury_transactions').select(BANK_CHECK_COLUMNS).in('id', more), 'bank checks: linked')) ?? []) as unknown as BankCheckRow[]) : []
  return [...recent, ...linked].map(bankCheckFromRow)
}
