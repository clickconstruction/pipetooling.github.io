import { createContext, useCallback, useContext, useState } from 'react'
import JobFormModal from '../components/jobs/JobFormModal'
import type { JobWithDetails } from '../types/jobWithDetails'

export type OpenEditJobOptions = {
  initialJob?: JobWithDetails
  onSaved?: () => void
  billingCustomerHighlight?: boolean
  /** After opening edit, open "Create customer from job" when customer name is present (billing flow). */
  alsoOpenCreateCustomerModal?: boolean
}

export type OpenNewJobOptions = {
  onSaved?: () => void
  /** Fires after insert succeeds, before the form closes (use for routing / follow-up by job id). */
  onCreatedJobId?: (jobId: string) => void
  projectId?: string | null
}

type JobFormModalContextValue = {
  isOpen: boolean
  openEditJob: (jobId: string, options?: OpenEditJobOptions) => void
  openNewJob: (options?: OpenNewJobOptions) => void
  closeJobForm: () => void
}

type InternalOpenState =
  | { kind: 'closed' }
  | {
      kind: 'edit'
      job_id: string
      initialJob: JobWithDetails | null
      billingCustomerHighlight: boolean
      alsoOpenCreateCustomerModal: boolean
      onSaved: (() => void) | null
    }
  | {
      kind: 'new'
      projectId: string | null
      onSaved: (() => void) | null
      onCreatedJobId: ((jobId: string) => void) | null
    }

const JobFormModalContext = createContext<JobFormModalContextValue | null>(null)

/** Incremented so JobFormModal remounts on each open with clean internal state. */
let jobFormModalInstanceSeed = 0

export function JobFormModalProvider({ children }: { children: React.ReactNode }) {
  const [openState, setOpenState] = useState<InternalOpenState>({ kind: 'closed' })
  const [instanceKey, setInstanceKey] = useState(0)

  const openEditJob = useCallback((jobId: string, options?: OpenEditJobOptions) => {
    jobFormModalInstanceSeed += 1
    setInstanceKey(jobFormModalInstanceSeed)
    setOpenState({
      kind: 'edit',
      job_id: jobId,
      initialJob: options?.initialJob ?? null,
      billingCustomerHighlight: options?.billingCustomerHighlight ?? false,
      alsoOpenCreateCustomerModal: options?.alsoOpenCreateCustomerModal ?? false,
      onSaved: options?.onSaved ?? null,
    })
  }, [])

  const openNewJob = useCallback((options?: OpenNewJobOptions) => {
    jobFormModalInstanceSeed += 1
    setInstanceKey(jobFormModalInstanceSeed)
    setOpenState({
      kind: 'new',
      projectId: options?.projectId ?? null,
      onSaved: options?.onSaved ?? null,
      onCreatedJobId: options?.onCreatedJobId ?? null,
    })
  }, [])

  const closeJobForm = useCallback(() => {
    setOpenState({ kind: 'closed' })
  }, [])

  const value: JobFormModalContextValue = {
    isOpen: openState.kind !== 'closed',
    openEditJob,
    openNewJob,
    closeJobForm,
  }

  return (
    <JobFormModalContext.Provider value={value}>
      {children}
      {openState.kind === 'edit' ? (
        <JobFormModal
          key={instanceKey}
          mode="edit"
          editJobId={openState.job_id}
          initialJob={openState.initialJob}
          billingCustomerHighlightInitial={openState.billingCustomerHighlight}
          alsoOpenCreateCustomerModal={openState.alsoOpenCreateCustomerModal}
          onClose={closeJobForm}
          onSaved={openState.onSaved}
        />
      ) : openState.kind === 'new' ? (
        <JobFormModal
          key={instanceKey}
          mode="new"
          editJobId={null}
          initialJob={null}
          newJobProjectId={openState.projectId}
          billingCustomerHighlightInitial={false}
          alsoOpenCreateCustomerModal={false}
          onClose={closeJobForm}
          onSaved={openState.onSaved}
          onCreatedJobId={openState.onCreatedJobId}
        />
      ) : null}
    </JobFormModalContext.Provider>
  )
}

export function useJobFormModal(): JobFormModalContextValue | null {
  return useContext(JobFormModalContext)
}
