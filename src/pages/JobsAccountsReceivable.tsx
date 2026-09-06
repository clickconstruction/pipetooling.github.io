import { useCallback, useEffect, useMemo } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { hasInAppHistory } from '../lib/inAppHistory'
import { useAuth } from '../hooks/useAuth'
import { canRoleSeeArBankUnallocatedOrgNudge } from '../hooks/useArBankUnallocatedCount'
import { useJobsListCache } from '../contexts/JobsListCacheContext'
import BankPaymentsModal from '../components/jobs/BankPaymentsModal'
import { useJobFormModal } from '../contexts/JobFormModalContext'
import { buildJobsStagesBoardLists } from '../lib/jobsStagesBoard'

export default function JobsAccountsReceivable() {
  const { user, role: authRole, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const jobFormModal = useJobFormModal()
  // A way back (Tier-2 #17, J4-9): the page used to exit only to Jobs or the
  // Dashboard, so whoever arrived from Quickfill or a Needs You card lost their
  // place. When this tab has an in-app entry behind it, Back returns there;
  // a cold open (bookmark, pasted link) keeps the Jobs fallback.
  const canGoBack = hasInAppHistory(typeof window !== 'undefined' ? window.history.state : null, location.key)
  const goBack = useCallback(() => {
    if (canGoBack) navigate(-1)
    else navigate('/jobs?tab=stages')
  }, [canGoBack, navigate])
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

  // useAuth resolves `loading` before the users-row role fetch lands, so on a
  // cold load there's a window where user is set but role is still null —
  // bouncing then would redirect EVERY role (dev included) to the dashboard.
  // Wait for the role like ScheduleDispatch does; redirect only a known-
  // disallowed role.
  if (authRole == null) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
    )
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
          onClick={goBack}
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.875rem',
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {canGoBack ? '← Back' : 'Back to Jobs'}
        </button>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Accounts Receivable</h1>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: '0.75rem', fontSize: '0.875rem' }}>
          {canGoBack ? (
            <Link to="/jobs?tab=stages" style={{ color: 'var(--text-link)' }}>
              Jobs
            </Link>
          ) : null}
          <Link to="/dashboard" style={{ color: 'var(--text-link)' }}>
            Dashboard
          </Link>
        </span>
      </div>
      {jobsListError ? <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{jobsListError}</p> : null}
      <BankPaymentsModal
        open
        onClose={goBack}
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
