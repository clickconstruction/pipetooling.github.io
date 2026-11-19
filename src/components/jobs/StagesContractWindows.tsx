import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobContractCoverage } from '../../lib/jobs/jobContractCoverage'
import { jobNumberLabel, streetOf } from '../../lib/jobs/jobContractCovers'
import JobContractModal from './JobContractModal'
import AddJobContractSheet from './AddJobContractSheet'
import JobsContractSweepModal from './JobsContractSweepModal'

/**
 * The Pipeline's three contract windows (the Stages map's step 24): the Contract window on one job, the sheet that adds
 * the GC's subcontract from a row's chip, and the contract sweep. Moved out of `JobsStagesTab`'s modal tail as they
 * were. Their open states stay in the tab, since the row chips, the phone chips, the command bar, the overview and the
 * `?contractSweep=1` link all open them; the tab mounts this where the three stood, rendered whether or not the board shows.
 */
export function StagesContractWindows({
  jobContractModalJob,
  setJobContractModalJob,
  gcPaperSheetJob,
  setGcPaperSheetJob,
  contractSweepOpen,
  setContractSweepOpen,
  jobs,
  jobContractCoverageByJobId,
  contractFloorCents,
  loadJobContractCoverage,
  loadJobs,
  openEdit,
  setStagesContractFilter,
}: {
  /** The job the Contract window is open on; null while it is shut. */
  jobContractModalJob: JobWithDetails | null
  setJobContractModalJob: (job: JobWithDetails | null) => void
  /** The job whose GC's subcontract the add sheet is adding; null while it is shut. */
  gcPaperSheetJob: JobWithDetails | null
  setGcPaperSheetJob: (job: JobWithDetails | null) => void
  contractSweepOpen: boolean
  setContractSweepOpen: (open: boolean) => void
  /** The board's jobs, which the sweep reads. */
  jobs: JobWithDetails[]
  jobContractCoverageByJobId: ReadonlyMap<string, JobContractCoverage>
  /** The contract floor, in cents, that the sweep holds a job to. */
  contractFloorCents: number
  /** Read the contracts on file again, after a window changes one. */
  loadJobContractCoverage: () => unknown
  /** Read the board's jobs again, after a window changes a job. */
  loadJobs: () => unknown
  openEdit: (job: JobWithDetails) => void
  /** The board's contract filter; the sweep's last press sets it to the jobs with nothing on file. */
  setStagesContractFilter: (filter: 'missing') => void
}) {
  return (
    <>
      <JobContractModal
        open={jobContractModalJob != null}
        onClose={() => setJobContractModalJob(null)}
        job={jobContractModalJob}
        onChanged={() => void loadJobContractCoverage()}
        onJobChanged={() => void loadJobs()}
        onEditJob={(j) => openEdit(j)}
        coverage={jobContractModalJob ? jobContractCoverageByJobId.get(jobContractModalJob.id) ?? null : null}
      />
      {gcPaperSheetJob ? (
        <AddJobContractSheet
          open
          mode="add"
          onClose={() => setGcPaperSheetJob(null)}
          onDone={() => {
            void loadJobContractCoverage()
            window.dispatchEvent(new Event('job-contract-changed'))
          }}
          anchorJob={{ id: gcPaperSheetJob.id, num: jobNumberLabel(gcPaperSheetJob), where: streetOf(gcPaperSheetJob.job_address) }}
          partyIds={[gcPaperSheetJob.gc_customer_id].filter((x): x is string => Boolean(x))}
          signerName={(gcPaperSheetJob.gcCustomer?.name ?? '').trim()}
          subtitle={`Job ${jobNumberLabel(gcPaperSheetJob)} · ${(gcPaperSheetJob.gcCustomer?.name ?? '').trim() || 'the GC'}'s subcontract`}
          onOpenContractWindow={() => {
            const j = gcPaperSheetJob
            setGcPaperSheetJob(null)
            setJobContractModalJob(j)
          }}
        />
      ) : null}
      <JobsContractSweepModal
        open={contractSweepOpen}
        onClose={() => setContractSweepOpen(false)}
        jobs={jobs}
        coverage={jobContractCoverageByJobId}
        floorCents={contractFloorCents}
        onEditJob={(j) => openEdit(j)}
        onSent={() => void loadJobContractCoverage()}
        onJobChanged={() => void loadJobs()}
        onFilterBoard={() => {
          setContractSweepOpen(false)
          setStagesContractFilter('missing')
        }}
      />
    </>
  )
}
