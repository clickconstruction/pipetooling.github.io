/**
 * Find a file on the Documents page's Search tab, with the one door a hit can need beyond Drive (punch list #377, PR 6):
 * a hit that is a signed job contract's Drive copy opens the Contract window on that record. The function sends the
 * record only to a role that reads `job_contracts`, so the door shows to those roles alone. Its own file, so the page
 * mounts one component and the box itself stays free of the Contract window.
 */
import { useState } from 'react'
import JobContractModal from '../jobs/JobContractModal'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import type { JobWithDetails } from '../../types/jobWithDetails'
import { FindAFile } from './FindAFile'

export function FindAFileSection() {
  const { showToast } = useToastContext()
  const [contractWindow, setContractWindow] = useState<{ job: JobWithDetails; recordId: string } | null>(null)

  const openContract = async (jobId: string, recordId: string) => {
    try {
      const job = await fetchJobWithDetailsById(jobId)
      if (!job) {
        showToast('Could not load the job for this contract', 'error')
        return
      }
      setContractWindow({ job, recordId })
    } catch (e) {
      showToast(formatErrorMessage(e, 'Could not load the job for this contract'), 'error')
    }
  }

  return (
    <>
      <FindAFile onOpenContract={(jobId, contractId) => void openContract(jobId, contractId)} />
      <JobContractModal open={contractWindow != null} onClose={() => setContractWindow(null)} job={contractWindow?.job ?? null} initialRecordId={contractWindow?.recordId ?? null} />
    </>
  )
}

export default FindAFileSection
