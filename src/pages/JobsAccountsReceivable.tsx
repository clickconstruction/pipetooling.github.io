import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { canRoleUseArBankCount } from '../hooks/useArBankUnallocatedCount'
import BankPaymentsModal from '../components/jobs/BankPaymentsModal'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { fetchJobsLedgerWithDetailsForStages } from '../lib/fetchJobsLedgerWithDetailsForStages'
import { buildJobsStagesBoardLists } from '../lib/jobsStagesBoard'
import type { JobWithDetails } from '../types/jobWithDetails'

export default function JobsAccountsReceivable() {
  const { user, role: authRole, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const jobFormModal = useJobFormModal()
  const [jobs, setJobs] = useState<JobWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setFetchError(null)
    const result = await fetchJobsLedgerWithDetailsForStages({ customerFilter: null })
    if (!result.ok) {
      setFetchError(result.error)
      setJobs([])
      setLoading(false)
      return
    }
    setJobs(result.jobs)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) return
    void loadJobs()
  }, [authLoading, user?.id, loadJobs])

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

  if (!canRoleUseArBankCount(authRole)) {
    return <Navigate to="/dashboard" replace />
  }

  if (authRole === 'primary') {
    return <Navigate to="/jobs?tab=reports" replace />
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
      {fetchError ? <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{fetchError}</p> : null}
      <BankPaymentsModal
        open
        onClose={() => navigate('/jobs?tab=stages')}
        authUserId={user.id}
        authRole={authRole}
        billedRows={bankPaymentsModalBilledRows}
        billedTargetsLoading={loading && bankPaymentsModalBilledRows.length === 0}
        onApplied={loadJobs}
        onOpenEditJob={(jobId) =>
          jobFormModal?.openEditJob(jobId, { onSaved: () => void loadJobs() })
        }
      />
    </div>
  )
}
