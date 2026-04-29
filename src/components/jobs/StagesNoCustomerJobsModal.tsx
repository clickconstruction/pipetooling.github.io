import StagesAlertJobListModal from './StagesAlertJobListModal'
import type { JobWithDetails } from '../../types/jobWithDetails'

type Props = {
  open: boolean
  onClose: () => void
  jobs: JobWithDetails[]
  onSelectJob: (jobId: string) => void
}

export default function StagesNoCustomerJobsModal({ open, onClose, jobs, onSelectJob }: Props) {
  return (
    <StagesAlertJobListModal
      open={open}
      onClose={onClose}
      jobs={jobs}
      onSelectJob={onSelectJob}
      titleId="stages-no-customer-modal-title"
      title="Jobs without a linked customer"
      description="Jobs in the current Stages search that have no customer linked. Open Edit Job to link or create one."
    />
  )
}
