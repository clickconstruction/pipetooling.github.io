import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import JobHoursStoryModal from '../components/jobs/JobHoursStoryModal'

/**
 * App-level opener for the job work-story modal (v2.1766) — the
 * CustomerProfileModalContext pattern. First consumer: the man-hours chip on
 * Jobs → Pipeline rows (all four row renderers, including the follow-up
 * deck's embedded rows, share it through StagesRowRenderContext).
 */

export type JobHoursStoryTarget = {
  jobId: string
  hcpNumber: string | null
  clickNumber?: string | null
  jobName: string | null
}

export type JobHoursStoryModalContextValue = {
  openJobHoursStory: (target: JobHoursStoryTarget) => void
  isOpen: boolean
}

const JobHoursStoryModalContext = createContext<JobHoursStoryModalContextValue | null>(null)

export function JobHoursStoryModalProvider({ children }: { children: ReactNode }) {
  const [openState, setOpenState] = useState<{ target: JobHoursStoryTarget; instanceKey: number } | null>(null)

  const openJobHoursStory = useCallback((target: JobHoursStoryTarget) => {
    setOpenState((prev) => ({ target, instanceKey: (prev?.instanceKey ?? 0) + 1 }))
  }, [])

  return (
    <JobHoursStoryModalContext.Provider value={{ openJobHoursStory, isOpen: openState != null }}>
      {children}
      {openState != null && (
        <JobHoursStoryModal
          key={`${openState.target.jobId}-${openState.instanceKey}`}
          jobId={openState.target.jobId}
          hcpNumber={openState.target.hcpNumber}
          clickNumber={openState.target.clickNumber}
          jobName={openState.target.jobName}
          onClose={() => setOpenState(null)}
        />
      )}
    </JobHoursStoryModalContext.Provider>
  )
}

export function useJobHoursStoryModal(): JobHoursStoryModalContextValue | null {
  return useContext(JobHoursStoryModalContext)
}
