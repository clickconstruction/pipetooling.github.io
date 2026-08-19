import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { BidPreviewModal, type BidPreviewTabUrl } from './BidPreviewModal'
import { fetchBidForPreview } from '../../lib/fetchBidForPreview'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

/**
 * The tabbed Bid window: ONE modal for a bid with two tabs — Bid (the read
 * view, BidPreviewModal in pane mode) · Edit (BidFormModal embedded) — and a
 * single ✕. Mirrors the Job window (JobWindowModal, v2.1675). Both panes stay
 * mounted (display-toggled) so flipping to Bid to check a fact never loses
 * half-typed edits; Save still closes the window.
 *
 * The Edit pane arrives as `children` because BidFormModal's entire engine
 * (useBidEditForm, save pipeline, customer/project loads) lives in Bids.tsx —
 * this window is chrome, not a data owner. It only fetches the read view.
 *
 * Escape closes the window unless `escBlocked` says a Bids-page modal is
 * stacked above it (delete confirm, attestation, evaluate checklist, the
 * form's service-type switcher, or an open customer dropdown).
 */

export type BidWindowTab = 'bid' | 'edit'

/** Matches the old bid-form overlay tier so stacked modals (1001+) sit above. */
const BID_WINDOW_OVERLAY_Z_INDEX = 1000

const TAB_LABELS: Record<BidWindowTab, string> = { bid: 'Bid', edit: 'Edit' }

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
  bidId: string
  initialTab?: BidWindowTab
  onRequestClose: () => void
  /** Pane tab chips (Open in Bids) — Bids.tsx navigates and closes the window. */
  onNavigateToBidsTab: (tab: BidPreviewTabUrl, bidId: string) => void
  /** True while a Bids-page modal stacks above the window — Esc leaves the window alone. */
  escBlocked?: boolean
  /** The embedded BidFormModal, fully wired by Bids.tsx. */
  children: ReactNode
}

export function BidWindowModal({
  bidId,
  initialTab = 'edit',
  onRequestClose,
  onNavigateToBidsTab,
  escBlocked = false,
  children,
}: Props) {
  const [tab, setTab] = useState<BidWindowTab>(initialTab)
  const [refreshKey, setRefreshKey] = useState(0)
  const [previewBid, setPreviewBid] = useState<BidWithBuilder | null>(null)
  const [previewLoading, setPreviewLoading] = useState(true)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPreviewLoading(true)
    void (async () => {
      const { bid, error } = await fetchBidForPreview(bidId)
      if (cancelled) return
      setPreviewBid(bid)
      setPreviewError(error)
      setPreviewLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [bidId, refreshKey])

  useEffect(() => {
    if (escBlocked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onRequestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [escBlocked, onRequestClose])

  return (
    <div
      className="bid-window-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: BID_WINDOW_OVERLAY_Z_INDEX,
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onRequestClose()
      }}
      role="presentation"
    >
      <style>{`
        @media (max-width: 640px) {
          .bid-window-overlay {
            align-items: stretch !important;
            justify-content: stretch !important;
            padding: 0 !important;
          }
          .bid-window-dialog {
            max-width: 100% !important;
            max-height: 100% !important;
            border-radius: 0 !important;
          }
          .bid-window-form-pane {
            padding: 1rem !important;
          }
        }
      `}</style>
      <div
        className="bid-window-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Bid window"
        style={{
          background: 'var(--surface)',
          borderRadius: 10,
          maxWidth: 720,
          width: '100%',
          maxHeight: 'min(90vh, 100%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          role="tablist"
          aria-label="Bid window tabs"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.6rem 0.9rem',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          {(Object.keys(TAB_LABELS) as BidWindowTab[]).map((t) => (
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
            onClick={onRequestClose}
            title="Close"
            aria-label="Close bid window"
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

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div style={tab === 'bid' ? undefined : { display: 'none' }} role="tabpanel" aria-label="Bid">
            <BidPreviewModal
              paneMode
              bid={previewBid}
              loading={previewLoading}
              error={previewError}
              onClose={onRequestClose}
              onNavigateToBidsTab={onNavigateToBidsTab}
              onRequestEditBid={() => setTab('edit')}
              onNotesMutated={() => setRefreshKey((k) => k + 1)}
            />
          </div>
          <div
            className="bid-window-form-pane"
            style={{ padding: '1rem 2rem 2rem', ...(tab === 'edit' ? undefined : { display: 'none' }) }}
            role="tabpanel"
            aria-label="Edit"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BidWindowModal
