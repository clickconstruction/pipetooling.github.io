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
import { JobWindowModal, type JobWindowTab } from '../components/jobs/JobWindowModal'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { isSubcontractorLikeRole } from '../lib/subcontractorLikeRole'
import type { JobWithDetails } from '../types/jobWithDetails'
import { useJobDetailOpenerBridge, type JobWindowEditOpenOptions } from './JobDetailOpenerBridgeContext'
import { useJobsListCache } from './JobsListCacheContext'

export type OpenJobDetailOptions = {
  jobId: string
  prefillRowLabel?: string | null
  prefillAddress?: string | null
  scheduleContext?: DetailJobScheduleContext | null
  /** When set (including `[]`), used as-is. When omitted, rows are derived from JobsListCache. */
  assignedJobsRows?: DetailJobModalAssignedJobRow[]
  onEditJobSaved?: () => void
  /** Auto-open the Share-with-supply-house modal on top (v2.1610 — Dispatch inbox one-click). */
  openSupplyHouseShare?: boolean
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
    job_pictures_link: j.job_pictures_link,
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
      /** Which tab the Job window starts on ('job' for detail opens). */
      initialTab: JobWindowTab
      scheduleContext: DetailJobScheduleContext | null
      prefillRowLabel: string | null | undefined
      prefillAddress: string | null | undefined
      /** null = derive from JobsListCache jobs */
      explicitAssignedRows: DetailJobModalAssignedJobRow[] | null
      onEditJobSaved?: () => void
      openSupplyHouseShare?: boolean
      /** Set when the open came through `openEditJob` (form options ride along). */
      editOptions: JobWindowEditOpenOptions | null
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
      initialTab: 'job',
      scheduleContext: options.scheduleContext ?? null,
      prefillRowLabel: options.prefillRowLabel,
      prefillAddress: options.prefillAddress,
      explicitAssignedRows,
      onEditJobSaved: options.onEditJobSaved,
      openSupplyHouseShare: options.openSupplyHouseShare,
      editOptions: null,
    })
  }, [])

  /** `openEditJob` delegates here (via the bridge) — same window, Edit tab. */
  const openJobWindowEdit = useCallback((jobId: string, options: JobWindowEditOpenOptions) => {
    jobDetailModalInstanceSeed += 1
    setOpenState({
      kind: 'open',
      instanceKey: jobDetailModalInstanceSeed,
      jobId,
      initialTab: options.initialTab ?? 'edit',
      scheduleContext: null,
      prefillRowLabel: undefined,
      prefillAddress: undefined,
      explicitAssignedRows: null,
      editOptions: options,
    })
  }, [])

  // Let components above this provider (e.g. the Edit Job singleton) open Job Detail,
  // and let `openEditJob` (the form provider, above) open the Job window's Edit tab.
  const openerBridge = useJobDetailOpenerBridge()
  useEffect(() => {
    if (!openerBridge) return
    openerBridge.registerJobDetailOpener((jobId) => openJobDetail({ jobId }))
    return () => openerBridge.registerJobDetailOpener(null)
  }, [openerBridge, openJobDetail])
  useEffect(() => {
    if (!openerBridge) return
    openerBridge.registerJobWindowEditOpener(openJobWindowEdit)
    return () => openerBridge.registerJobWindowEditOpener(null)
  }, [openerBridge, openJobWindowEdit])

  const value = useMemo(
    (): JobDetailModalContextValue => ({
      openJobDetail,
      closeJobDetail,
      isOpen: openState.kind === 'open',
    }),
    [openJobDetail, closeJobDetail, openState.kind],
  )

  // Roles that can edit jobs get the tabbed Job window (v2.1675); everyone else
  // keeps the plain read-only Job Detail modal, unchanged.
  const canEditJobs = authRole !== null && !isSubcontractorLikeRole(authRole as UserRole)

  const handleSaved = useCallback(() => {
    if (openState.kind !== 'open') return
    let handled = false
    if (openState.editOptions?.onSaved) {
      openState.editOptions.onSaved()
      handled = true
    }
    if (openState.onEditJobSaved) {
      openState.onEditJobSaved()
      handled = true
    }
    if (!handled) void runFetchJobs(null)
  }, [openState, runFetchJobs])

  return (
    <JobDetailModalContext.Provider value={value}>
      {children}
      {openState.kind === 'open' ? (
        canEditJobs ? (
          <JobWindowModal
            key={openState.instanceKey}
            jobId={openState.jobId}
            initialTab={openState.initialTab}
            onClose={closeJobDetail}
            authRole={authRole}
            scheduleContext={openState.scheduleContext}
            assignedJobsRows={assignedRowsForModal}
            prefillRowLabel={openState.prefillRowLabel ?? null}
            prefillAddress={openState.prefillAddress ?? null}
            autoOpenSupplyHouseShare={openState.openSupplyHouseShare ?? false}
            initialJob={openState.editOptions?.initialJob ?? null}
            billingCustomerHighlightInitial={openState.editOptions?.billingCustomerHighlight ?? false}
            fixturesSectionHighlightInitial={openState.editOptions?.fixturesSectionHighlight ?? false}
            jobPicturesLinkHighlightInitial={openState.editOptions?.jobPicturesLinkHighlight ?? false}
            alsoOpenCreateCustomerModal={openState.editOptions?.alsoOpenCreateCustomerModal ?? false}
            onSaved={handleSaved}
          />
        ) : (
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
            autoOpenSupplyHouseShare={openState.openSupplyHouseShare ?? false}
            onEditJobSaved={() => {
              if (openState.kind !== 'open') return
              if (openState.onEditJobSaved) openState.onEditJobSaved()
              else void runFetchJobs(null)
            }}
          />
        )
      ) : null}
    </JobDetailModalContext.Provider>
  )
}

export function useJobDetailModal(): JobDetailModalContextValue | null {
  return useContext(JobDetailModalContext)
}
