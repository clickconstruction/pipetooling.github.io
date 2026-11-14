/**
 * People → Subs → Ledger (punch list #347, PR 3): the Subs Ledger from Jobs, opened on **By sub**.
 *
 * The roster says what we owe each sub as one figure. This is the money behind it: what was paid to each person
 * in a period, and a name opens their statement. The statement's foot is held against the roster's own Balance
 * due, handed in by the tab.
 *
 * It loads the sheets, their payments and their traces through the Jobs page's own hook, read only, and only
 * while this view is open. A sheet opens on Jobs → Subs → Pay, where its payments are edited.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSubLaborLedger } from '../../hooks/useSubLaborLedger'
import { SubPaymentsLedger, type LedgerGrouping } from '../jobs/SubPaymentsLedger'

export function PeopleSubsLedger({ balanceDueByPersonId, sub, onSubChange }: { balanceDueByPersonId: ReadonlyMap<string, number>; sub: string | null; onSubChange: (sub: string | null) => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [by, setBy] = useState<LedgerGrouping>('sub')
  const { profileName } = useAuth()
  const { laborJobs, laborJobsLoading, laborJobsLoadedOnce, laborJobNamesByJobId, laborJobAssigneesByJobId, loadLaborJobs, setSubPaymentChecked } = useSubLaborLedger({ authUserId: user?.id, authUserName: profileName, setError })

  useEffect(() => {
    if (user?.id) void loadLaborJobs()
    // `loadLaborJobs` is made new on every render: the signed-in person is what the read depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return (
    <div data-people-subs-ledger>
      <SubPaymentsLedger
        error={error}
        laborJobs={laborJobs}
        laborJobsLoading={laborJobsLoading || !laborJobsLoadedOnce}
        laborJobNamesByJobId={laborJobNamesByJobId}
        laborJobAssigneesByJobId={laborJobAssigneesByJobId}
        onOpenSheet={(job) => navigate(`/jobs?tab=subs&view=pay&editLabor=${encodeURIComponent(job.id)}`)}
        onOpenPay={() => navigate('/jobs?tab=subs&view=pay')}
        by={by}
        onByChange={setBy}
        sub={sub}
        onSubChange={onSubChange}
        balanceDueByPersonId={balanceDueByPersonId}
        onSetChecked={setSubPaymentChecked}
      />
    </div>
  )
}

export default PeopleSubsLedger
