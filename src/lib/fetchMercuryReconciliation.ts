import { supabase } from './supabase'
import type { ReconResult } from './mercuryReconciliation'

/**
 * Runs the `mercury-reconcile` edge function, which fetches Mercury statements +
 * live balances and compares them against the books. Returns the typed result.
 */
export async function fetchMercuryReconciliation(monthsBack: number): Promise<ReconResult> {
  const { data, error } = await supabase.functions.invoke('mercury-reconcile', { body: { monthsBack } })
  if (error) throw new Error(error.message)
  const body = data as (ReconResult & { error?: string }) | null
  if (!body) throw new Error('Empty response from reconciliation')
  if (typeof body.error === 'string') throw new Error(body.error)
  if (!body.ok) throw new Error('Reconciliation did not complete')
  return body
}
