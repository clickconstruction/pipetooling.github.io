import { useCallback, useEffect, useState } from 'react'
import StagesAlertJobListModal from '../jobs/StagesAlertJobListModal'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { useJobsListCache } from '../../contexts/JobsListCacheContext'
import { useToastContext } from '../../contexts/ToastContext'
import type { JobWithDetails } from '../../types/jobWithDetails'

const btnStyleBase = {
  padding: '0.5rem 0.85rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  borderRadius: 6,
  cursor: 'pointer' as const,
}

/** Jobs resolved 100% complete (report % / Edit Job % complete) with no Total Bill set.
 * Open list → click a job → Edit Job to fill in the Total Bill. */
export function QuickfillCompleteNoBillSection({
  completeNoBillJobs,
  jobsListBusy,
}: {
  completeNoBillJobs: JobWithDetails[]
  jobsListBusy: boolean
}) {
  const { runFetchJobs } = useJobsListCache()
  const jobFormModal = useJobFormModal()
  const { showToast } = useToastContext()
  const [listModalOpen, setListModalOpen] = useState(false)
  const [btnHover, setBtnHover] = useState(false)

  useEffect(() => {
    if (completeNoBillJobs.length === 0) {
      setListModalOpen(false)
    }
  }, [completeNoBillJobs.length])

  const openEditJobFromModal = useCallback(
    (jobId: string) => {
      if (jobsListBusy) {
        showToast('Please wait until jobs finish loading.', 'info')
        return
      }
      setListModalOpen(false)
      jobFormModal?.openEditJob(jobId, { onSaved: () => void runFetchJobs(null) })
    },
    [jobsListBusy, jobFormModal, showToast, runFetchJobs],
  )

  return (
    <>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#374151' }}>
        Jobs marked <strong>100% complete</strong> (latest field report %, or the Edit Job{' '}
        <strong>% complete</strong> field when no report has one) with no <strong>Total Bill</strong>{' '}
        set. Open a job to fill in the Total Bill so it can be billed.
      </p>
      {completeNoBillJobs.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setListModalOpen(true)}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            title="List complete jobs with no Total Bill"
            aria-label={`Complete jobs with no Total Bill: ${completeNoBillJobs.length} jobs. Open list.`}
            style={{
              ...btnStyleBase,
              border: `1px solid ${btnHover ? '#f87171' : '#fecaca'}`,
              background: '#fef2f2',
              color: btnHover ? '#991b1b' : '#b91c1c',
            }}
          >
            Open list ({completeNoBillJobs.length})
          </button>
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
          No complete jobs are missing a Total Bill.
        </p>
      )}
      <StagesAlertJobListModal
        open={listModalOpen}
        onClose={() => setListModalOpen(false)}
        jobs={completeNoBillJobs}
        onSelectJob={openEditJobFromModal}
        titleId="quickfill-complete-no-bill-modal-title"
        title="Complete jobs with no Total Bill"
        description="Jobs resolved 100% complete whose Total Bill is empty or $0. Open Edit Job and set the Job Total."
      />
    </>
  )
}
