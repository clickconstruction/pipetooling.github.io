import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useOptionalAuth } from '../../hooks/useAuth'
import { loadDraftPayTermsForBid, type DraftPayTermsOffer } from '../../lib/jobs/draftPayTermsIo'
import { usePayCalendarModal } from '../../contexts/PayCalendarModalContext'
import { isStagesOfficeRole } from '../../lib/jobs/stagesRoleGates'
import { payCalendarJobOf } from '../../lib/jobs/payCalendarJob'
import { theirPaperPayer } from '../../lib/jobs/theirPaperPayer'
import type { JobWithDetails } from '../../types/jobWithDetails'
import PayCalendarLine from '../customers/PayCalendarLine'
import { JobFormFactRow } from './JobFormFactRow'

/**
 * The job window's **Pay calendar** row (punch list #341, PR 1): whose calendar this job reads,
 * and the door into its own. *Follows Larkfield Construction · In by month end, paid the 10th*,
 * *This job's own · In by the 25th, paid the 30th*, *No pay calendar on this job*, or *Set a pay
 * calendar…*. The press opens the Pay calendar window on this job, where **Only <job>** sets it
 * apart from its payer. The payer is whoever the job's bills go to (`theirPaperPayer`).
 *
 * A job opened from a won bid whose estimator read the GC's pay terms (punch list #323) carries
 * them here until the office answers: *From Dana Whitfield's draft · … · Check and use*.
 *
 * For the office alone, the roles that set a calendar: nobody else can read one, and a row with
 * nothing in it would only puzzle. No row on a job that names nobody to bill.
 */
export default function JobPayCalendarRow({ job, labelIcon }: { job: JobWithDetails; labelIcon?: React.ReactNode }) {
  const role = useOptionalAuth()?.role ?? null
  const opener = usePayCalendarModal()
  const payer = theirPaperPayer(job)
  const shows = !!opener && !!payer && isStagesOfficeRole(role)
  const bidId = shows ? (job.bid_id ?? null) : null
  const [offer, setOffer] = useState<DraftPayTermsOffer | null>(null)
  useEffect(() => {
    setOffer(null)
    if (!bidId) return
    let live = true
    void loadDraftPayTermsForBid(supabase, bidId).then((found) => {
      if (live) setOffer(found)
    })
    return () => {
      live = false
    }
  }, [bidId])
  if (!opener || !payer || !isStagesOfficeRole(role)) return null
  return <JobFormFactRow label="Pay calendar" labelIcon={labelIcon} value={<PayCalendarLine payerId={payer.id} payerName={payer.name} job={payCalendarJobOf(job)} variant="row" offer={offer} />} />
}
