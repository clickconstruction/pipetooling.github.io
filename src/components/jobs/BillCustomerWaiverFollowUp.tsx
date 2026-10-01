import { useEffect, useState } from 'react'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { useAuth } from '../../hooks/useAuth'
import LienReleaseModal from './LienReleaseModal'

/**
 * The waiver that follows a bill (v2.4275): Bill Customer sent the bill with "send the lien waiver
 * with this bill" ticked, closed, and handed the job and the bill here. The job is re-read (the
 * bill is now `billed`), then the Release of Lien window opens on that bill — the form picked from
 * it, the leader's signature next, Send to the GC after. Mounted by BillCustomerModalProvider.
 */
export default function BillCustomerWaiverFollowUp({ jobId, invoiceId, onClose }: { jobId: string; invoiceId: string; onClose: () => void }) {
  const { profileName } = useAuth()
  const [job, setJob] = useState<JobWithDetails | null>(null)
  useEffect(() => {
    let cancelled = false
    void fetchJobWithDetailsById(jobId).then((found) => {
      if (cancelled) return
      if (found) setJob(found)
      else onClose()
    })
    return () => {
      cancelled = true
    }
  }, [jobId, onClose])
  if (!job) return null
  const invoice = (job.invoices ?? []).find((i) => i.id === invoiceId) ?? null
  return <LienReleaseModal open onClose={onClose} job={job} invoice={invoice} signerNameFallback={(profileName ?? '').trim()} />
}
