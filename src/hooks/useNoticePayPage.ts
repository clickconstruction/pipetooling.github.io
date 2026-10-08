import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchJobWithDetailsById } from '../lib/fetchJobWithDetailsById'
import { noticeInvoiceDocs } from '../lib/jobs/noticeInvoiceEnclosure'
import { fetchStripeInvoiceFacts } from '../lib/stripeInvoiceFacts'
import { getBillingStripeModePref } from '../lib/billingStripeModePref'
import { payPageRows, type PayPageAssets, type PayPageRow } from '../lib/jobs/lienNoticePayPage'
import { buildPayPageAssets } from '../lib/jobs/lienNoticePayPageAssets'
import { lienClaimBills, type LienClaimBill } from '../lib/jobs/lienClaimBills'
import type { JobWithDetails } from '../types/jobWithDetails'

/**
 * The pay page's rows and codes for one job, for a preview (punch list #35, PR 3): the Lien
 * desk pane and the GC-run preview show the page the run will print. The job is fetched once
 * per id and kept for the life of the component, so walking ‹ › through a run's previews never
 * refetches; only the SVG is built (a preview has no PDF). The desk's own hook loads no bills,
 * and the run modal does this fetch itself when it opens — one request per job, either way.
 *
 * The same read carries the bills behind the claim (v2.4969, `bills`, paid ones too) and the job
 * as read, so the desk can bill the rest from its own pane; `refresh()` drops the job's cached
 * read and reads again — the desk calls it once a bill has gone.
 */
export type NoticePayPage = { rows: PayPageRow[]; assets: PayPageAssets; bills: LienClaimBill[]; job: JobWithDetails | null; loading: boolean; refresh: () => void }

const NOOP = () => {}
const EMPTY: NoticePayPage = { rows: [], assets: {}, bills: [], job: null, loading: false, refresh: NOOP }

type Loaded = { rows: PayPageRow[]; assets: PayPageAssets; bills: LienClaimBill[]; job: JobWithDetails | null }

export async function loadNoticePayPage(jobId: string): Promise<Loaded> {
  const job = await fetchJobWithDetailsById(jobId)
  // Stripe's own number for each hosted bill (v2.4852), so the pay page names the bill the customer saw — the paid ones
  // too (v2.4969), so the bills behind the claim read the same number the customer paid.
  const facts = job ? await fetchStripeInvoiceFacts((job.invoices ?? []).filter((i) => (i.status === 'billed' || i.status === 'paid') && (i.stripe_invoice_id ?? '').trim()).map((i) => i.id), getBillingStripeModePref()) : {}
  const rows = job ? payPageRows(noticeInvoiceDocs(job, facts)) : []
  const assets = rows.some((r) => r.payable) ? await buildPayPageAssets(rows, { png: false }).catch(() => ({})) : {}
  const bills = job ? lienClaimBills(job, facts) : []
  return { rows, assets, bills, job }
}

export function useNoticePayPage(jobId: string | null, enabled: boolean = true): NoticePayPage {
  const cache = useRef(new Map<string, Promise<Loaded>>())
  const [state, setState] = useState<{ jobId: string | null; page: Omit<NoticePayPage, 'refresh'> }>({ jobId: null, page: EMPTY })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!enabled || !jobId) return
    let live = true
    let p = cache.current.get(jobId)
    if (!p) {
      p = loadNoticePayPage(jobId)
      cache.current.set(jobId, p)
    }
    setState({ jobId, page: { rows: [], assets: {}, bills: [], job: null, loading: true } })
    p.then(
      (r) => {
        if (live) setState({ jobId, page: { ...r, loading: false } })
      },
      () => {
        cache.current.delete(jobId)
        if (live) setState({ jobId, page: EMPTY })
      },
    )
    return () => {
      live = false
    }
  }, [jobId, enabled, tick])

  const refresh = useCallback(() => {
    if (jobId) cache.current.delete(jobId)
    setTick((t) => t + 1)
  }, [jobId])

  return useMemo(() => (enabled && jobId && state.jobId === jobId ? { ...state.page, refresh } : { ...EMPTY, refresh }), [enabled, jobId, state, refresh])
}
