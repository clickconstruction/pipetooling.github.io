import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { clearReturnEditJobFromStages, peekReturnEditJobFromStages } from '../../lib/returnEditJobFromStages'

/** The banner takes itself down after this long. */
export const STAGES_RETURN_EDIT_BANNER_MS = 10_000

/**
 * "Back to Edit Job" on the Pipeline (the Stages map's step 16): someone left Edit Job through a bill's *See in Stages*,
 * which leaves a note in session storage, and the board offers the way back for ten seconds. The banner holds its own
 * state and its three effects, as `JobsStagesTab` held them: a hidden board clears the note, a board that shows on its
 * own address picks it up once its jobs have loaded, and the banner dismisses itself. The tab says what going back does.
 */
export function StagesReturnEditBanner({ active, jobsListLoading, onBack }: { active: boolean; jobsListLoading: boolean; onBack: (jobId: string) => void }) {
  const [searchParams] = useSearchParams()
  /** Set after Ready to Bill → See in Stages; cleared on timeout, dismiss, tab change, or reopening Edit Job. */
  const [returnEditBannerJobId, setReturnEditBannerJobId] = useState<string | null>(null)

  useEffect(() => {
    if (!active) {
      setReturnEditBannerJobId(null)
      clearReturnEditJobFromStages()
    }
  }, [active])

  useEffect(() => {
    if (!active || jobsListLoading) return
    const tabParam = searchParams.get('tab')
    const urlWantsStages = tabParam == null || tabParam === 'stages' || tabParam === 'billed'
    if (!urlWantsStages) return
    const id = peekReturnEditJobFromStages()
    if (id) setReturnEditBannerJobId(id)
  }, [active, jobsListLoading, searchParams])

  useEffect(() => {
    if (!returnEditBannerJobId) return
    const t = window.setTimeout(() => {
      clearReturnEditJobFromStages()
      setReturnEditBannerJobId(null)
    }, STAGES_RETURN_EDIT_BANNER_MS)
    return () => window.clearTimeout(t)
  }, [returnEditBannerJobId])

  if (!(returnEditBannerJobId && active)) return null
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.65rem 0.85rem',
        background: '#1e40af',
        color: 'white',
        borderRadius: 8,
        border: '2px solid #1d4ed8',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: 'min(360px, calc(100vw - 2rem))',
      }}
    >
      <button
        type="button"
        onClick={() => {
          const jid = returnEditBannerJobId
          clearReturnEditJobFromStages()
          setReturnEditBannerJobId(null)
          if (!jid) return
          onBack(jid)
        }}
        style={{
          flex: 1,
          textAlign: 'left',
          background: 'transparent',
          border: 'none',
          color: 'white',
          fontSize: '0.9375rem',
          fontWeight: 600,
          cursor: 'pointer',
          padding: '0.15rem 0',
        }}
      >
        Back to Edit Job
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          clearReturnEditJobFromStages()
          setReturnEditBannerJobId(null)
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'white',
          fontSize: '1.35rem',
          lineHeight: 1,
          cursor: 'pointer',
          padding: '0 0.15rem',
        }}
      >
        ×
      </button>
    </div>
  )
}
