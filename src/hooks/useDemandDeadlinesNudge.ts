import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { calendarYmdInAppTzFromIso } from '../utils/dateUtils'
import { demandLettersOverdue, type JobDemandLetterRow } from '../lib/jobs/demandLetterTracking'
import { loadZzTestJobIds } from '../lib/jobs/zzTestJobRows'

/**
 * Demand letters past their named deadline with money still open (v2.2640) —
 * the Needs You "deadline passed unpaid" watch. Three small queries (live sent
 * letters, covered invoice amounts, applied payments); null while loading,
 * zero on error so the card stays quiet.
 *
 * `hideZzTestJobs` (punch list #61, PR 3): a letter on a ZZ test job leaves the count, by the shared ids (the
 * letters carry no names). A demand deadline warns about real money, so a failed id read counts every letter
 * rather than none.
 */
export function useDemandDeadlinesNudge(
  enabled: boolean,
  hideZzTestJobs = false,
  userId?: string | null,
): {
  overdue: { count: number; total: number; jobIds: string[] } | null
} {
  const [overdue, setOverdue] = useState<{ count: number; total: number; jobIds: string[] } | null>(null)

  useEffect(() => {
    if (!enabled) {
      setOverdue(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const todayYmd = calendarYmdInAppTzFromIso(new Date().toISOString())
        const { data: letterRows, error } = await supabase
          .from('job_demand_letters')
          .select('*')
          .is('voided_at', null)
          .not('sent_at', 'is', null)
          .not('deadline_date', 'is', null)
          .lt('deadline_date', todayYmd)
        if (error) throw error
        const lettersRead = (letterRows ?? []) as JobDemandLetterRow[]
        const zzIds = hideZzTestJobs && lettersRead.length > 0 ? await loadZzTestJobIds(userId).catch(() => null) : null
        const letters = zzIds ? lettersRead.filter((l) => !zzIds.has(l.job_id)) : lettersRead
        if (cancelled) return
        if (letters.length === 0) {
          setOverdue({ count: 0, total: 0, jobIds: [] })
          return
        }
        const invoiceIds = [...new Set(letters.flatMap((r) => r.invoice_ids ?? []))]
        const amounts = new Map<string, number>()
        const applied = new Map<string, number>()
        if (invoiceIds.length > 0) {
          const [{ data: invRows, error: invErr }, { data: payRows, error: payErr }] = await Promise.all([
            supabase.from('jobs_ledger_invoices').select('id, amount').in('id', invoiceIds),
            supabase.from('jobs_ledger_payments').select('invoice_id, amount').in('invoice_id', invoiceIds),
          ])
          if (invErr) throw invErr
          if (payErr) throw payErr
          for (const r of (invRows ?? []) as { id: string; amount: number }[]) amounts.set(r.id, Number(r.amount ?? 0))
          for (const p of (payRows ?? []) as { invoice_id: string | null; amount: number }[]) {
            if (!p.invoice_id) continue
            applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
          }
        }
        if (cancelled) return
        setOverdue(demandLettersOverdue(letters, amounts, applied, todayYmd))
      } catch {
        if (!cancelled) setOverdue({ count: 0, total: 0, jobIds: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, hideZzTestJobs, userId])

  return { overdue }
}
