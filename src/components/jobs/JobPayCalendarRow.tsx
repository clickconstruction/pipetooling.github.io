import { useOptionalAuth } from '../../hooks/useAuth'
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
 * For the office alone, the roles that set a calendar: nobody else can read one, and a row with
 * nothing in it would only puzzle. No row on a job that names nobody to bill.
 */
export default function JobPayCalendarRow({ job, labelIcon }: { job: JobWithDetails; labelIcon?: React.ReactNode }) {
  const role = useOptionalAuth()?.role ?? null
  const opener = usePayCalendarModal()
  const payer = theirPaperPayer(job)
  if (!opener || !payer || !isStagesOfficeRole(role)) return null
  return <JobFormFactRow label="Pay calendar" labelIcon={labelIcon} value={<PayCalendarLine payerId={payer.id} payerName={payer.name} job={payCalendarJobOf(job)} variant="row" />} />
}
