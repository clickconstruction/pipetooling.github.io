import { useCallback, useEffect, useMemo } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { canRoleSeeArBankUnallocatedOrgNudge } from '../hooks/useArBankUnallocatedCount'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import BankPaymentsModal from '../components/jobs/BankPaymentsModal'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { buildJobsStagesBoardLists } from '../lib/jobsStagesBoard'

export default function JobsAccountsReceivable() {
  const { user, role: authRole, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const jobFormModal = useJobFormModal()
  const { jobs, jobsListLoading, jobsListError, runFetchJobs } = useJobsListCache()

  const onApplied = useCallback(() => {
    void runFetchJobs(null)
  }, [runFetchJobs])

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) return
    void runFetchJobs(null)
  }, [authLoading, user?.id, runFetchJobs])

  const bankPaymentsModalBilledRows = useMemo(
    () => buildJobsStagesBoardLists(jobs, '').billedRows,
    [jobs],
  )

  if (authLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
    )
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  if (!canRoleSeeArBankUnallocatedOrgNudge(authRole)) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div style={{ padding: '1rem', maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/jobs?tab=stages')}
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.875rem',
            border: '1px solid #d1d5db',
            background: 'white',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Back to Jobs
        </button>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Accounts Receivable</h1>
        <Link to="/dashboard" style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#2563eb' }}>
          Dashboard
        </Link>
      </div>
      {jobsListError ? <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{jobsListError}</p> : null}
      <BankPaymentsModal
        open
        onClose={() => navigate('/jobs?tab=stages')}
        authUserId={user.id}
        authRole={authRole}
        billedRows={bankPaymentsModalBilledRows}
        billedTargetsLoading={jobsListLoading && bankPaymentsModalBilledRows.length === 0}
        onApplied={onApplied}
        onOpenEditJob={(jobId) =>
          jobFormModal?.openEditJob(jobId, { onSaved: () => void runFetchJobs(null) })
        }
      />
    </div>
  )
}
