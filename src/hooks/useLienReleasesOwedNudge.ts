import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  computeLienUnconditionalOwed,
  liveLienReleases,
  type JobLienReleaseRow,
} from '../lib/jobs/lienReleaseTracking'

/**
 * Cleared payments behind conditional lien releases (v2.2582): counts the
 * conditional releases whose money has landed but whose unconditional
 * follow-up hasn't been issued — the Needs You card's "issue the release"
 * nudge. Two small queries (live releases, then payments on the covered bill
 * lines); null while loading, 0 on error so the card stays quiet.
 */
export function useLienReleasesOwedNudge(enabled: boolean): {
  owed: { count: number; total: number; jobIds: string[] } | null
} {
  const [owed, setOwed] = useState<{ count: number; total: number; jobIds: string[] } | null>(null)

  useEffect(() => {
    if (!enabled) {
      setOwed(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const { data: releaseRows, error } = await supabase
          .from('job_lien_releases')
          .select('*')
          .is('voided_at', null)
        if (error) throw error
        if (cancelled) return
        const releases = liveLienReleases((releaseRows ?? []) as JobLienReleaseRow[])
        const invoiceIds = [...new Set(releases.flatMap((r) => r.invoice_ids ?? []))]
        const applied = new Map<string, number>()
        if (invoiceIds.length > 0) {
          const { data: payRows, error: payError } = await supabase
            .from('jobs_ledger_payments')
            .select('invoice_id, amount')
            .in('invoice_id', invoiceIds)
          if (payError) throw payError
          for (const p of (payRows ?? []) as { invoice_id: string | null; amount: number }[]) {
            if (!p.invoice_id) continue
            applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
          }
        }
        if (cancelled) return
        setOwed(computeLienUnconditionalOwed(releases, applied))
      } catch {
        if (!cancelled) setOwed({ count: 0, total: 0, jobIds: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled])

  return { owed }
}
