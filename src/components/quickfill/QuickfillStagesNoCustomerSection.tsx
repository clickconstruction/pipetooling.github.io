import { useCallback, useEffect, useState } from 'react'
import StagesAlertJobListModal from '../jobs/StagesAlertJobListModal'
import StagesNoCustomerJobsModal from '../jobs/StagesNoCustomerJobsModal'
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

export function QuickfillStagesNoCustomerSection({
  jobsWithoutCustomer,
  workingJobsWithoutPictures,
  jobsListBusy,
}: {
  jobsWithoutCustomer: JobWithDetails[]
  workingJobsWithoutPictures: JobWithDetails[]
  jobsListBusy: boolean
}) {
  const { runFetchJobs } = useJobsListCache()
  const jobFormModal = useJobFormModal()
  const { showToast } = useToastContext()
  const [noCustomerModalOpen, setNoCustomerModalOpen] = useState(false)
  const [noCustomerBtnHover, setNoCustomerBtnHover] = useState(false)
  const [picturesModalOpen, setPicturesModalOpen] = useState(false)
  const [picturesBtnHover, setPicturesBtnHover] = useState(false)

  useEffect(() => {
    if (jobsWithoutCustomer.length === 0) {
      setNoCustomerModalOpen(false)
    }
  }, [jobsWithoutCustomer.length])

  useEffect(() => {
    if (workingJobsWithoutPictures.length === 0) {
      setPicturesModalOpen(false)
    }
  }, [workingJobsWithoutPictures.length])

  const openEditJobFromModal = useCallback(
    (jobId: string) => {
      if (jobsListBusy) {
        showToast('Please wait until jobs finish loading.', 'info')
        return
      }
      setNoCustomerModalOpen(false)
      setPicturesModalOpen(false)
      jobFormModal?.openEditJob(jobId, { onSaved: () => void runFetchJobs(null) })
    },
    [jobsListBusy, jobFormModal, showToast, runFetchJobs],
  )

  return (
    <>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#374151' }}>
        Same data as Jobs → Stages with an empty search: jobs missing a <strong>linked customer</strong>, and{' '}
        <strong>working</strong> jobs with no <strong>Job Pictures</strong> link. Open a job to fix either.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {jobsWithoutCustomer.length > 0 ? (
          <button
            type="button"
            onClick={() => setNoCustomerModalOpen(true)}
            onMouseEnter={() => setNoCustomerBtnHover(true)}
            onMouseLeave={() => setNoCustomerBtnHover(false)}
            title="List jobs missing a linked customer"
            aria-label={`No linked customer: ${jobsWithoutCustomer.length} jobs. Open list.`}
            style={{
              ...btnStyleBase,
              border: `1px solid ${noCustomerBtnHover ? '#f87171' : '#fecaca'}`,
              background: '#fef2f2',
              color: noCustomerBtnHover ? '#991b1b' : '#b91c1c',
            }}
          >
            Open list ({jobsWithoutCustomer.length})
          </button>
        ) : null}
        {workingJobsWithoutPictures.length > 0 ? (
          <button
            type="button"
            onClick={() => setPicturesModalOpen(true)}
            onMouseEnter={() => setPicturesBtnHover(true)}
            onMouseLeave={() => setPicturesBtnHover(false)}
            title="List working jobs missing Job Pictures link"
            aria-label={`Working jobs with no job pictures link: ${workingJobsWithoutPictures.length} jobs. Open list.`}
            style={{
              ...btnStyleBase,
              border: `1px solid ${picturesBtnHover ? '#f87171' : '#fecaca'}`,
              background: '#fef2f2',
              color: picturesBtnHover ? '#991b1b' : '#b91c1c',
            }}
          >
            No job pictures ({workingJobsWithoutPictures.length})
          </button>
        ) : null}
      </div>
      <StagesNoCustomerJobsModal
        open={noCustomerModalOpen}
        onClose={() => setNoCustomerModalOpen(false)}
        jobs={jobsWithoutCustomer}
        onSelectJob={openEditJobFromModal}
      />
      <StagesAlertJobListModal
        open={picturesModalOpen}
        onClose={() => setPicturesModalOpen(false)}
        jobs={workingJobsWithoutPictures}
        onSelectJob={openEditJobFromModal}
        titleId="stages-no-job-pictures-quickfill-modal-title"
        title="Working jobs without Job Pictures"
        description="Working jobs in the current Stages search with no Job Pictures URL set. Open Edit Job to add a link."
      />
    </>
  )
}
