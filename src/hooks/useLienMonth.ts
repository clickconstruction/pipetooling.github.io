import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { withSupabaseRetry } from '../utils/errorHandling'
import { todayYmdInAppTz } from '../utils/dateUtils'
import { effectiveJobLedgerNumber } from '../lib/ledgerDisplayPrefixes'
import { parsePromisedPayDatesRpc, type PromisedPayDate } from '../lib/jobs/billedExpectedPay'
import { courtesyByJobFrom } from '../lib/jobs/lienCourtesyDesk'
import { buildLienMonth, type LienMonth } from '../lib/jobs/lienMonthRhythm'
import { useLienDeskData } from './useLienDeskData'

/**
 * The lien month for the Dashboard's card (punch list #235, PR 3): the same five zones the Lien desk
 * draws, over the desk's light read plus the three small reads the light book leaves out and the
 * month needs — the payments behind the sent notices (a payment pauses a reminder, v2.6611), the
 * promised pay dates (the pause's end) and the filed affidavits waiting on their copies — so the
 * card and the desk never disagree. One read per visit; nothing written.
 */

type Extra = {
  /** The data object the extra reads were made for: a new book reads again. */
  forKey: string
  paymentsByJob: Record<string, Array<{ amount: number; paidOn: string | null }>>
  promisesByJob: Record<string, PromisedPayDate>
  filingsByJob: Record<string, Array<{ kind: string; filed_at: string | null; served_at: string | null; voided_at: string | null; serve_due: string | null; job_id: string }>>
}

export function useLienMonth(enabled: boolean, hideZzTestJobs: boolean): { month: LienMonth | null; loading: boolean } {
  const todayYmd = todayYmdInAppTz()
  const { data, loading } = useLienDeskData(enabled, todayYmd, { light: true, hideZzTestJobs })
  const [extra, setExtra] = useState<Extra | null>(null)
  const key = data ? `${data.items.length}:${data.queue.entries.length}:${data.affidavits.entries.length}:${todayYmd}` : ''

  useEffect(() => {
    if (!data || !enabled) return
    let cancelled = false
    const jobIds = new Set(Object.keys(data.jobsById))
    const sentJobIds = [...new Set(data.items.filter((i) => i.status === 'sent').map((i) => i.job_id))]
    void (async () => {
      const [paid, promisesRaw, filings] = await Promise.all([
        sentJobIds.length ? withSupabaseRetry(() => supabase.from('jobs_ledger_payments').select('job_id, amount, paid_on').in('job_id', sentJobIds), 'lien month: payments behind the sent notices').catch(() => null) : Promise.resolve(null),
        withSupabaseRetry(() => supabase.rpc('list_job_promised_pay_dates' as never), 'lien month: promises').catch(() => null),
        withSupabaseRetry(() => supabase.from('job_lien_filings').select('job_id, kind, filed_at, served_at, voided_at, serve_due').eq('kind', 'affidavit').is('voided_at', null).not('filed_at', 'is', null), 'lien month: filed affidavits').catch(() => null),
      ])
      if (cancelled) return
      const paymentsByJob: Extra['paymentsByJob'] = {}
      for (const p of (paid ?? []) as Array<{ job_id: string; amount: number | null; paid_on: string | null }>) (paymentsByJob[p.job_id] ??= []).push({ amount: Number(p.amount) || 0, paidOn: p.paid_on ? String(p.paid_on).slice(0, 10) : null })
      for (const list of Object.values(paymentsByJob)) list.sort((a, b) => ((a.paidOn ?? '') < (b.paidOn ?? '') ? -1 : 1))
      const filingsByJob: Extra['filingsByJob'] = {}
      for (const f of (filings ?? []) as Extra['filingsByJob'][string]) if (jobIds.has(f.job_id)) (filingsByJob[f.job_id] ??= []).push(f)
      setExtra({ forKey: key, paymentsByJob, promisesByJob: parsePromisedPayDatesRpc(promisesRaw) ?? {}, filingsByJob })
    })()
    return () => {
      cancelled = true
    }
    // The key names the book the reads are for; the data object itself changes identity on every read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled])

  const month = useMemo(() => {
    if (!data || !enabled) return null
    const have = extra && extra.forKey === key ? extra : null
    const courtesyByJob = courtesyByJobFrom({
      todayYmd,
      letterTwoByJob: data.letterTwoByJob,
      items: data.items,
      entries: data.queue.entries,
      jobsById: data.jobsById,
      addressesById: data.addressesById,
      affidavits: data.affidavits.entries,
      filingsByJob: have?.filingsByJob ?? {},
      paymentsByJob: have?.paymentsByJob,
      promisesByJob: have?.promisesByJob,
    })
    const serveDue = Object.values(have?.filingsByJob ?? {})
      .flat()
      .filter((f) => f.filed_at && !f.served_at && f.serve_due)
      .map((f) => ({ jobId: f.job_id }))
    return buildLienMonth({
      todayYmd,
      notices: data.queue.entries,
      affidavits: data.affidavits.entries,
      courtesyByJob,
      serveDue,
      jobTitle: (jobId) => {
        const j = data.jobsById[jobId]
        if (!j) return jobId.slice(0, 8)
        const number = effectiveJobLedgerNumber(j.hcp_number, j.click_number) || '—'
        const name = (j.job_name ?? '').trim()
        return name ? `${number} · ${name}` : number
      },
    })
  }, [data, enabled, extra, key, todayYmd])

  return { month, loading }
}
