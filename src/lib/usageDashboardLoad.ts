/**
 * Settings → Usage loader (journey-map J21-N1). The tab's four `usage_*` RPCs return row
 * arrays; `withSupabaseRetry` unwraps the Supabase envelope (`{ data, error }`) itself and
 * returns `result.data`. The original loader unwrapped `.data` INSIDE the callback and returned
 * the rows — so the wrapper then read `.data` of an array (`undefined`) and `?? []` blanked
 * every panel to "Nothing recorded" against 200-OK, row-bearing responses.
 *
 * The rule, kept here where it can be tested: hand the wrapper the raw envelope, let it unwrap
 * once. `null` means "this reader failed" (the tab distinguishes a failed RPC from an empty one).
 */
import { withSupabaseRetry, type RetryOptions, type SupabaseClientResult } from '../utils/errorHandling'

export type UsageRpc = (fn: string, args: { p_days: number }) => PromiseLike<SupabaseClientResult<unknown>>

export async function loadUsageRows<T>(rpc: UsageRpc, fn: string, days: number, retry: RetryOptions = {}): Promise<T[] | null> {
  try {
    const rows = await withSupabaseRetry(() => rpc(fn, { p_days: days }), fn, retry)
    return (Array.isArray(rows) ? rows : []) as T[]
  } catch {
    return null
  }
}
