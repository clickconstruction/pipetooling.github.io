import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../lib/supabase'
import { stripeModeInvokeBody } from '../lib/billingStripeModePref'
import { fetchJobWithDetailsById } from '../lib/fetchJobWithDetailsById'
import { stripeMemoBackfillKey, stripeMemoBackfillTargets } from '../lib/jobs/stripeMemoBackfill'
import { getAccessTokenForEdgeFunctions } from '../lib/supabaseAccessTokenForEdge'
import { stripeModeForBillingFromRole } from '../lib/voidStripeInvoiceForRevert'
import type { JobWithDetails } from '../types/jobWithDetails'
import type { UserRole } from './useAuth'

/**
 * The Job form's Stripe memo backfill (the Job form map's second pass, cut 3; out of `JobFormModal`, where it
 * was the form's first effect). On open, and whenever the set of bills that wait changes, it asks
 * `get-stripe-invoice-details` for each sent Stripe bill that still lacks its memo or footer, one after the
 * other, then reads the job again so the form shows them. Which bills wait is `lib/jobs/stripeMemoBackfill.ts`.
 */
export function useStripeMemoBackfill({
  editing,
  setEditing,
  authRole,
}: {
  editing: JobWithDetails | null
  setEditing: Dispatch<SetStateAction<JobWithDetails | null>>
  authRole: UserRole | null
}): void {
  const backfillKey = useMemo(() => stripeMemoBackfillKey(editing?.id, editing?.invoices), [editing?.id, editing?.invoices])

  useEffect(() => {
    if (!backfillKey || !editing?.id) return
    const jobId = editing.id
    const targets = stripeMemoBackfillTargets(editing.invoices)
    if (targets.length === 0) return

    let cancelled = false
    void (async () => {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token || cancelled) return
      for (const inv of targets) {
        if (cancelled) return
        await supabase.functions.invoke('get-stripe-invoice-details', {
          body: {
            jobs_ledger_invoice_id: inv.id,
            // A5: dev-gated pref — non-devs pinned live (the invoice row's own
            // mode wins server-side since A3 regardless).
            ...stripeModeInvokeBody(stripeModeForBillingFromRole(authRole)),
          },
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      if (cancelled) return
      const found = await fetchJobWithDetailsById(jobId)
      if (!cancelled && found) setEditing(found)
    })()

    return () => {
      cancelled = true
    }
    // Keyed on the set of bills that wait, as it was in the form: a re-read that changes nothing else must not ask again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backfillKey])
}
