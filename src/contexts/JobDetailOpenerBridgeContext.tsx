import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'
import type { JobWithDetails } from '../types/jobWithDetails'

/**
 * Ref-based bridge so components rendered ABOVE `JobDetailModalProvider` (notably the
 * `JobFormModal` singleton rendered by `JobFormModalProvider`) can open the Job Detail modal.
 * `JobDetailModalProvider` registers its `openJobDetail` here on mount. Mirrors
 * `UpdateFocusOpenerBridgeContext`.
 *
 * v2.1675: it also carries the Job-window edit opener — `openEditJob` (in the
 * form provider, above) delegates edit opens down to the tabbed Job window
 * (owned by `JobDetailModalProvider`, below) through here.
 */

/** What `openEditJob` forwards to the Job window (mirrors OpenEditJobOptions). */
export type JobWindowEditOpenOptions = {
  initialJob?: JobWithDetails
  onSaved?: () => void
  billingCustomerHighlight?: boolean
  fixturesSectionHighlight?: boolean
  jobPicturesLinkHighlight?: boolean
  alsoOpenCreateCustomerModal?: boolean
  initialTab?: 'edit' | 'bill'
}

type JobDetailOpenerBridgeContextValue = {
  registerJobDetailOpener: (opener: ((jobId: string) => void) | null) => void
  /** Returns false when no opener is registered (Job Detail provider not mounted). */
  requestOpenJobDetail: (jobId: string) => boolean
  registerJobWindowEditOpener: (
    opener: ((jobId: string, options: JobWindowEditOpenOptions) => void) | null,
  ) => void
  /** Returns false when no Job-window opener is registered — callers fall back to the standalone form. */
  requestOpenJobWindowEdit: (jobId: string, options: JobWindowEditOpenOptions) => boolean
}

const JobDetailOpenerBridgeContext = createContext<JobDetailOpenerBridgeContextValue | null>(null)

export function JobDetailOpenerBridgeProvider({ children }: { children: ReactNode }) {
  const openerRef = useRef<((jobId: string) => void) | null>(null)
  const windowEditOpenerRef = useRef<((jobId: string, options: JobWindowEditOpenOptions) => void) | null>(null)

  const registerJobDetailOpener = useCallback((opener: ((jobId: string) => void) | null) => {
    openerRef.current = opener
  }, [])

  const requestOpenJobDetail = useCallback((jobId: string): boolean => {
    const fn = openerRef.current
    if (!fn) return false
    fn(jobId)
    return true
  }, [])

  const registerJobWindowEditOpener = useCallback(
    (opener: ((jobId: string, options: JobWindowEditOpenOptions) => void) | null) => {
      windowEditOpenerRef.current = opener
    },
    [],
  )

  const requestOpenJobWindowEdit = useCallback((jobId: string, options: JobWindowEditOpenOptions): boolean => {
    const fn = windowEditOpenerRef.current
    if (!fn) return false
    fn(jobId, options)
    return true
  }, [])

  const value = useMemo(
    (): JobDetailOpenerBridgeContextValue => ({
      registerJobDetailOpener,
      requestOpenJobDetail,
      registerJobWindowEditOpener,
      requestOpenJobWindowEdit,
    }),
    [registerJobDetailOpener, requestOpenJobDetail, registerJobWindowEditOpener, requestOpenJobWindowEdit],
  )

  return (
    <JobDetailOpenerBridgeContext.Provider value={value}>
      {children}
    </JobDetailOpenerBridgeContext.Provider>
  )
}

/** Null outside the provider — callers optional-chain. */
export function useJobDetailOpenerBridge(): JobDetailOpenerBridgeContextValue | null {
  return useContext(JobDetailOpenerBridgeContext)
}
