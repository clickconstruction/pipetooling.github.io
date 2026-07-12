import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'

/**
 * Ref-based bridge so components rendered ABOVE `JobDetailModalProvider` (notably the
 * `JobFormModal` singleton rendered by `JobFormModalProvider`) can open the Job Detail modal.
 * `JobDetailModalProvider` registers its `openJobDetail` here on mount. Mirrors
 * `UpdateFocusOpenerBridgeContext`.
 */
type JobDetailOpenerBridgeContextValue = {
  registerJobDetailOpener: (opener: ((jobId: string) => void) | null) => void
  /** Returns false when no opener is registered (Job Detail provider not mounted). */
  requestOpenJobDetail: (jobId: string) => boolean
}

const JobDetailOpenerBridgeContext = createContext<JobDetailOpenerBridgeContextValue | null>(null)

export function JobDetailOpenerBridgeProvider({ children }: { children: ReactNode }) {
  const openerRef = useRef<((jobId: string) => void) | null>(null)

  const registerJobDetailOpener = useCallback((opener: ((jobId: string) => void) | null) => {
    openerRef.current = opener
  }, [])

  const requestOpenJobDetail = useCallback((jobId: string): boolean => {
    const fn = openerRef.current
    if (!fn) return false
    fn(jobId)
    return true
  }, [])

  const value = useMemo(
    (): JobDetailOpenerBridgeContextValue => ({ registerJobDetailOpener, requestOpenJobDetail }),
    [registerJobDetailOpener, requestOpenJobDetail],
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
