import { useEffect, useState } from 'react'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { noticeInvoiceDocs, unpaidBilledInvoices, type NoticeInvoiceDoc } from '../../lib/jobs/noticeInvoiceEnclosure'
import { fetchStripeInvoiceFacts } from '../../lib/stripeInvoiceFacts'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import { payPageRows } from '../../lib/jobs/lienNoticePayPage'
import { buildPayPageAssets } from '../../lib/jobs/lienNoticePayPageAssets'
import type { LienRunPay } from '../../lib/jobs/lienRunPacket'

/**
 * What the run's notices enclose, read once a job: the unpaid bills behind each notice (v2.3437, § 53.056(a-3)) and the
 * pay codes on them (v2.3758). Lifted whole out of the run window (punch list #362, step 6) so the window and the
 * checklist's one print read the same enclosures the same way: a notice prints the same pages from either.
 *
 * `read` turns true once both are in. Until then a paper would go without its bills, so a caller that prints waits on
 * it. A job whose read fails goes without its invoice, as before: the statute only permits the enclosure.
 *
 * `notices` is the effect's own input, so a caller hands in a list that keeps its identity while the jobs are the
 * same. With `on` false nothing is read.
 */
export function useLienRunEnclosures(
  notices: ReadonlyArray<{ jobId: string }>,
  stripeMode: BillingStripeModePref,
  on = true,
): { invoiceDocsByJob: Record<string, NoticeInvoiceDoc[]>; payByJob: Record<string, LienRunPay>; read: boolean } {
  const [invoiceDocsByJob, setInvoiceDocsByJob] = useState<Record<string, NoticeInvoiceDoc[]>>({})
  const [payByJob, setPayByJob] = useState<Record<string, LienRunPay>>({})
  // The bills and pay codes read once (v2.5073): until then a courtesy PDF would go without them, so its preview waits.
  const [read, setRead] = useState(false)
  useEffect(() => {
    if (!on) return
    let cancelled = false
    const jobIds = Array.from(new Set(notices.map((n) => n.jobId)))
    void (async () => {
      const next: Record<string, NoticeInvoiceDoc[]> = {}
      await Promise.all(
        jobIds.map(async (id) => {
          try {
            const job = await fetchJobWithDetailsById(id)
            if (!job) return
            // Stripe's own number and due day on each enclosed bill (v2.4852); without an answer the app's document prints.
            const facts = await fetchStripeInvoiceFacts(unpaidBilledInvoices(job).filter((i) => (i.stripe_invoice_id ?? '').trim()).map((i) => i.id), stripeMode)
            next[id] = noticeInvoiceDocs(job, facts)
          } catch {
            // the notice goes without its invoice; the statute only permits the enclosure
          }
        }),
      )
      if (!cancelled) setInvoiceDocsByJob(next)
      // The pay page's codes (v2.3758): one per Stripe bill, built once the bills are known.
      const pay: Record<string, LienRunPay> = {}
      await Promise.all(
        Object.entries(next).map(async ([id, docs]) => {
          const rows = payPageRows(docs)
          pay[id] = { rows, assets: rows.some((r) => r.payable) ? await buildPayPageAssets(rows).catch(() => ({})) : {} }
        }),
      )
      if (!cancelled) {
        setPayByJob(pay)
        setRead(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [notices, stripeMode, on])
  return { invoiceDocsByJob, payByJob, read }
}
