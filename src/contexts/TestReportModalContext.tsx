import { createContext, useCallback, useContext, lazy, Suspense, useMemo, useRef, useState } from 'react'
import type { JobWithDetails } from '../types/jobWithDetails'

/** Code-split: the modal pulls the jsPDF renderer; load it only when a Test report opens. */
const TestReportModal = lazy(() => import('../components/jobs/TestReportModal'))

/** Above JobFormModal (1010) and beside Bill Customer (1020) — the two it can open from. */
const TEST_REPORT_OVERLAY_Z_INDEX = 1030

export type OpenTestReportOptions = {
  job: JobWithDetails
  /** Open a specific report (from a Needs You line or the job's list); omitted = the newest draft, else a new one. */
  reportId?: string | null
  /** Fired after a save, delete or send so the board can refresh. */
  onChanged?: () => void | Promise<void>
}

type TestReportModalContextValue = {
  openTestReport: (opts: OpenTestReportOptions) => void
  closeTestReport: () => void
}

const TestReportModalContext = createContext<TestReportModalContextValue | null>(null)

/**
 * The Test report modal's opener (v2.3298) — the Stages rows, the mobile
 * cards, Job Detail and the Needs You line all open the same modal through
 * this, the way Bill Customer does; one instance, mounted once in App.
 */
export function TestReportModalProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ job: JobWithDetails; reportId: string | null; nonce: number } | null>(null)
  const onChangedRef = useRef<(() => void | Promise<void>) | null>(null)

  const openTestReport = useCallback((opts: OpenTestReportOptions) => {
    onChangedRef.current = opts.onChanged ?? null
    setSession((prev) => ({ job: opts.job, reportId: opts.reportId ?? null, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [])

  const closeTestReport = useCallback(() => setSession(null), [])

  const value = useMemo(() => ({ openTestReport, closeTestReport }), [openTestReport, closeTestReport])

  return (
    <TestReportModalContext.Provider value={value}>
      {children}
      {session ? (
        <Suspense fallback={null}>
          <TestReportModal
            key={session.nonce}
            job={session.job}
            initialReportId={session.reportId}
            zIndex={TEST_REPORT_OVERLAY_Z_INDEX}
            onClose={closeTestReport}
            onChanged={() => void onChangedRef.current?.()}
          />
        </Suspense>
      ) : null}
    </TestReportModalContext.Provider>
  )
}

export function useTestReportModal(): TestReportModalContextValue {
  const ctx = useContext(TestReportModalContext)
  if (!ctx) throw new Error('useTestReportModal must be used within TestReportModalProvider')
  return ctx
}

/** Same hook, null outside the provider — for components rendered in tests or standalone previews. */
export function useTestReportModalOptional(): TestReportModalContextValue | null {
  return useContext(TestReportModalContext)
}
