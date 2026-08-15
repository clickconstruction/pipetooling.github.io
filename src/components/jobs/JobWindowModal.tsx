import { useRef, useState, type CSSProperties } from 'react'
import DetailJobModal, {
  type DetailJobModalAssignedJobRow,
  type DetailJobScheduleContext,
} from './DetailJobModal'
import JobFormModal from './JobFormModal'
import type { JobWithDetails } from '../../types/jobWithDetails'

/**
 * The tabbed Job window (v2.1675, owner-approved mockup): ONE modal for a job
 * with three tabs — Job (the read view, DetailJobModal in pane mode) · Edit
 * (identity/team/customer/links/line items) · Bill (the billing half) — and a
 * single ✕. The Edit and Bill tabs are ONE JobFormModal instance in embedded
 * mode showing one region at a time; everything stays mounted (display-toggled)
 * so switching tabs never loses state, and the form's autosave slices mean
 * there is no Save button anywhere.
 *
 * Close semantics: the ✕, Escape, and the backdrop all route through the
 * form's guarded close-flush (registered via `registerRequestClose`), so an
 * in-flight autosave is never abandoned. Escape is owned by the form's own
 * listener; the Job tab reports its stacked-satellite state up (Reports /
 * Calendar / …) so Esc closes the satellite, never the window underneath it.
 *
 * This component renders only for roles that can edit jobs —
 * JobDetailModalContext keeps serving the plain DetailJobModal to everyone
 * else, unchanged.
 */

export type JobWindowTab = 'job' | 'edit' | 'bill'

/** Matches JobFormModal's overlay tier so its nested overlays stack above. */
const JOB_WINDOW_OVERLAY_Z_INDEX = 1010

const TAB_LABELS: Record<JobWindowTab, string> = { job: 'Job', edit: 'Edit', bill: 'Bill' }

const tabButtonStyle = (active: boolean): CSSProperties => ({
  padding: '0.3rem 0.85rem',
  fontSize: '0.875rem',
  fontWeight: 600,
  border: 'none',
  borderRadius: 999,
  cursor: 'pointer',
  background: active ? '#2563eb' : 'transparent',
  color: active ? '#fff' : 'var(--text-muted)',
})

type Props = {
  jobId: string
  initialTab: JobWindowTab
  onClose: () => void
  /* ---- Job pane (DetailJobModal) ---- */
  authRole: string | null
  scheduleContext: DetailJobScheduleContext | null
  assignedJobsRows: DetailJobModalAssignedJobRow[]
  prefillRowLabel?: string | null
  prefillAddress?: string | null
  autoOpenSupplyHouseShare?: boolean
  /* ---- Edit/Bill panes (JobFormModal, edit mode) ---- */
  initialJob: JobWithDetails | null
  billingCustomerHighlightInitial: boolean
  fixturesSectionHighlightInitial: boolean
  jobPicturesLinkHighlightInitial: boolean
  alsoOpenCreateCustomerModal: boolean
  /** Fires after form saves (also refreshes the Job pane via externalRefreshKey). */
  onSaved: (() => void) | null
}

export function JobWindowModal({
  jobId,
  initialTab,
  onClose,
  authRole,
  scheduleContext,
  assignedJobsRows,
  prefillRowLabel = null,
  prefillAddress = null,
  autoOpenSupplyHouseShare = false,
  initialJob,
  billingCustomerHighlightInitial,
  fixturesSectionHighlightInitial,
  jobPicturesLinkHighlightInitial,
  alsoOpenCreateCustomerModal,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<JobWindowTab>(initialTab)
  // The Job pane reloads when this bumps — form saves must never leave the
  // read view stale behind a tab switch.
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const [detailEscBlocked, setDetailEscBlocked] = useState(false)
  const formCloseRef = useRef<(() => Promise<boolean>) | null>(null)

  const requestClose = () => {
    const flushClose = formCloseRef.current
    if (flushClose) void flushClose()
    else onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: JOB_WINDOW_OVERLAY_Z_INDEX,
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label="Job window"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          role="tablist"
          aria-label="Job window tabs"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.6rem 0.9rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {(Object.keys(TAB_LABELS) as JobWindowTab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              style={tabButtonStyle(tab === t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
          <span
            style={{
              marginLeft: 'auto',
              color: 'var(--text-faint)',
              fontSize: '0.68rem',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            esc to close
          </span>
          <button
            type="button"
            onClick={requestClose}
            title="Close"
            aria-label="Close job window"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.3rem 0.5rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '1.15rem',
              lineHeight: 1,
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Top padding stays slimmer than the sides: the tab bar's own bottom
            padding already separates it from the title (v2.1679). */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0.5rem 1.25rem 1.25rem' }}>
          {/* Job pane — ALWAYS visible (v2.1676): its title, action icons, and
              Street View / map band are the window's shared header on every
              tab. Only its read-view body hides on Edit/Bill (paneBodyHidden),
              so the icon handlers and their satellite modals stay live from
              any tab. */}
          <div role="tabpanel" aria-label="Job">
            <DetailJobModal
              open
              paneMode
              paneBodyHidden={tab !== 'job'}
              onClose={onClose}
              jobId={jobId}
              scheduleContext={scheduleContext}
              authRole={authRole}
              assignedJobsRows={assignedJobsRows}
              prefillRowLabel={prefillRowLabel ?? undefined}
              prefillAddress={prefillAddress ?? undefined}
              autoOpenSupplyHouseShare={autoOpenSupplyHouseShare}
              externalRefreshKey={detailRefreshKey}
              onEscBlockedChange={setDetailEscBlocked}
            />
          </div>
          {/* Edit + Bill panes — ONE form instance; the region prop picks which
              half shows. Hidden entirely on the Job tab. */}
          <div style={tab === 'job' ? { display: 'none' } : undefined} role="tabpanel" aria-label={tab === 'bill' ? 'Bill' : 'Edit'}>
            <JobFormModal
              mode="edit"
              editJobId={jobId}
              initialJob={initialJob}
              billingCustomerHighlightInitial={billingCustomerHighlightInitial}
              fixturesSectionHighlightInitial={fixturesSectionHighlightInitial}
              jobPicturesLinkHighlightInitial={jobPicturesLinkHighlightInitial}
              alsoOpenCreateCustomerModal={alsoOpenCreateCustomerModal}
              onClose={onClose}
              onSaved={() => {
                setDetailRefreshKey((k) => k + 1)
                onSaved?.()
              }}
              embeddedRegion={tab === 'bill' ? 'bill' : 'edit'}
              registerRequestClose={(fn) => {
                formCloseRef.current = fn
              }}
              externalEscBlocked={detailEscBlocked}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default JobWindowModal
