import { useCallback, useEffect, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useJobsListCache } from '../../contexts/JobsListCacheContext'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { buildJobsStagesBoardLists } from '../../lib/jobsStagesBoard'
import BankPaymentsModal from '../jobs/BankPaymentsModal'

/**
 * The Needs You card's "Match deposits" action, in place (Tier-2 #17, J4-9).
 *
 * The card used to `navigate('/accounts-receivable')` — a standalone page
 * whose only exits were Back to Jobs / Dashboard, so the office lost its
 * Quickfill place every time. This is the v2.2751 `lien-unconditional`
 * pattern: the SAME Accounts Receivable window the page renders
 * (`BankPaymentsModal`, fed by the shared jobs cache exactly as
 * `JobsAccountsReceivable.tsx` feeds it), opened over the card instead.
 * Closing it lands you back where you were; the card refetches its
 * unallocated-deposits count in its `onClose`. Since v2.6096 (punch list #178)
 * the returned-check line opens the same window on its case (`initialDepositId`,
 * the page's `?check=<id>`), or on the list when several came back.
 */
export function DashboardArDepositsModal({ open, onClose, initialDepositId = null }: { open: boolean; onClose: () => void; /** A returned check's case to open on (v2.6096, punch list #178): the page's `?check=<id>`. */ initialDepositId?: string | null }) {
  const { user, role } = useAuth()
  const jobFormModal = useJobFormModal()
  const { jobs, jobsListLoading, runFetchJobs } = useJobsListCache()

  useEffect(() => {
    if (!open || !user?.id) return
    void runFetchJobs(null)
  }, [open, user?.id, runFetchJobs])

  const onApplied = useCallback(() => {
    void runFetchJobs(null)
  }, [runFetchJobs])

  const billedRows = useMemo(() => (open ? buildJobsStagesBoardLists(jobs, '').billedRows : []), [open, jobs])

  if (!open || !user?.id || role == null) return null

  return (
    <BankPaymentsModal
      open
      onClose={onClose}
      authUserId={user.id}
      authRole={role}
      billedRows={billedRows}
      billedTargetsLoading={jobsListLoading && billedRows.length === 0}
      onApplied={onApplied}
      initialDepositId={initialDepositId}
      onOpenEditJob={(jobId) => jobFormModal?.openEditJob(jobId, { onSaved: () => void runFetchJobs(null) })}
    />
  )
}
