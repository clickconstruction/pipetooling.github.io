import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import DetailJobModal, {
  type DetailJobModalAssignedJobRow,
  type DetailJobScheduleContext,
} from '../components/jobs/DetailJobModal'
import { useAuth } from '../hooks/useAuth'
import type { JobWithDetails } from '../types/jobWithDetails'
import { useJobDetailOpenerBridge } from './JobDetailOpenerBridgeContext'
import { useJobsListCache } from './JobsListCacheContext'

export type OpenJobDetailOptions = {
  jobId: string
  prefillRowLabel?: string | null
  prefillAddress?: string | null
  scheduleContext?: DetailJobScheduleContext | null
  /** When set (including `[]`), used as-is. When omitted, rows are derived from JobsListCache. */
  assignedJobsRows?: DetailJobModalAssignedJobRow[]
  onEditJobSaved?: () => void
}

export type JobDetailModalContextValue = {
  openJobDetail: (options: OpenJobDetailOptions) => void
  closeJobDetail: () => void
  isOpen: boolean
}

const JobDetailModalContext = createContext<JobDetailModalContextValue | null>(null)

function mapJobsToAssignedRows(jobs: JobWithDetails[]): DetailJobModalAssignedJobRow[] {
  return jobs.map((j) => ({
    id: j.id,
    hcp_number: j.hcp_number ?? '',
    job_name: j.job_name ?? '',
    job_address: j.job_address ?? '',
    google_drive_link: j.google_drive_link,
    job_plans_link: j.job_plans_link,
    revenue: j.revenue != null ? Number(j.revenue) : null,
    project_id: j.project_id,
  }))
}

type OpenState =
  | { kind: 'closed' }
  | {
      kind: 'open'
      instanceKey: number
      jobId: string
      scheduleContext: DetailJobScheduleContext | null
      prefillRowLabel: string | null | undefined
      prefillAddress: string | null | undefined
      /** null = derive from JobsListCache jobs */
      explicitAssignedRows: DetailJobModalAssignedJobRow[] | null
      onEditJobSaved?: () => void
    }

let jobDetailModalInstanceSeed = 0

export function JobDetailModalProvider({ children }: { children: ReactNode }) {
  const { role: authRole } = useAuth()
  const { jobs, runFetchJobs } = useJobsListCache()
  const [openState, setOpenState] = useState<OpenState>({ kind: 'closed' })

  const cacheAssignedRows = useMemo(() => mapJobsToAssignedRows(jobs), [jobs])

  const assignedRowsForModal = useMemo((): DetailJobModalAssignedJobRow[] => {
    if (openState.kind !== 'open') return []
    if (openState.explicitAssignedRows !== null) return openState.explicitAssignedRows
    return cacheAssignedRows
  }, [openState, cacheAssignedRows])

  const closeJobDetail = useCallback(() => {
    setOpenState({ kind: 'closed' })
  }, [])

  const openJobDetail = useCallback((options: OpenJobDetailOptions) => {
    jobDetailModalInstanceSeed += 1
    const hasExplicitRows = 'assignedJobsRows' in options
    const explicitAssignedRows = hasExplicitRows ? (options.assignedJobsRows ?? []) : null
    setOpenState({
      kind: 'open',
      instanceKey: jobDetailModalInstanceSeed,
      jobId: options.jobId,
      scheduleContext: options.scheduleContext ?? null,
      prefillRowLabel: options.prefillRowLabel,
      prefillAddress: options.prefillAddress,
      explicitAssignedRows,
      onEditJobSaved: options.onEditJobSaved,
    })
  }, [])

  // Let components above this provider (e.g. the Edit Job singleton) open Job Detail.
  const openerBridge = useJobDetailOpenerBridge()
  useEffect(() => {
    if (!openerBridge) return
    openerBridge.registerJobDetailOpener((jobId) => openJobDetail({ jobId }))
    return () => openerBridge.registerJobDetailOpener(null)
  }, [openerBridge, openJobDetail])

  const value = useMemo(
    (): JobDetailModalContextValue => ({
      openJobDetail,
      closeJobDetail,
      isOpen: openState.kind === 'open',
    }),
    [openJobDetail, closeJobDetail, openState.kind],
  )

  return (
    <JobDetailModalContext.Provider value={value}>
      {children}
      {openState.kind === 'open' ? (
        <DetailJobModal
          key={openState.instanceKey}
          open
          onClose={closeJobDetail}
          jobId={openState.jobId}
          scheduleContext={openState.scheduleContext}
          authRole={authRole}
          assignedJobsRows={assignedRowsForModal}
          prefillRowLabel={openState.prefillRowLabel ?? undefined}
          prefillAddress={openState.prefillAddress ?? undefined}
          onEditJobSaved={() => {
            if (openState.kind !== 'open') return
            if (openState.onEditJobSaved) openState.onEditJobSaved()
            else void runFetchJobs(null)
          }}
        />
      ) : null}
    </JobDetailModalContext.Provider>
  )
}

export function useJobDetailModal(): JobDetailModalContextValue | null {
  return useContext(JobDetailModalContext)
}
