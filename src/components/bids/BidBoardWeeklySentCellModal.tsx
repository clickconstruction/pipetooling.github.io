import { useEffect, useId, useMemo, type CSSProperties } from 'react'
import { useBidPreview } from '../../contexts/BidPreviewModalContext'
import { formatCurrency } from '../../lib/format'
import type { BidWithBuilder } from '../../types/bidWithBuilder'

function outcomeShort(outcome: string | null | undefined): string {
  if (!outcome) return '—'
  if (outcome === 'won') return 'Won'
  if (outcome === 'lost') return 'Lost'
  if (outcome === 'started_or_complete') return 'Started / complete'
  return outcome
}

function bidRowPrimaryLabel(bid: BidWithBuilder): string {
  const project = (bid.project_name ?? '').trim() || 'Untitled bid'
  return project
}

function bidRowSecondaryLabel(bid: BidWithBuilder): string | null {
  const gc = bid.bids_gc_builders?.name?.trim()
  const customer = bid.customers?.name?.trim()
  if (gc && customer) return `${gc} · ${customer}`
  if (gc) return gc
  if (customer) return customer
  return null
}

const rowBtn: CSSProperties = {
  width: '100%',
  textAlign: 'left',
  padding: '0.5rem 0.65rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
  cursor: 'pointer',
  fontSize: '0.875rem',
  lineHeight: 1.35,
  display: 'block',
  boxSizing: 'border-box',
}

const Z_INDEX = 900

export type BidBoardWeeklySentCellModalProps = {
  open: boolean
  onClose: () => void
  weekLabel: string
  estimatorDisplayName: string
  bidIds: string[]
  bids: BidWithBuilder[]
}

export function BidBoardWeeklySentCellModal({
  open,
  onClose,
  weekLabel,
  estimatorDisplayName,
  bidIds,
  bids,
}: BidBoardWeeklySentCellModalProps) {
  const titleId = useId()
  const bidPreview = useBidPreview()

  const orderedBids = useMemo(() => {
    const byId = new Map(bids.map((b) => [b.id, b]))
    return bidIds.map((id) => byId.get(id)).filter((b): b is BidWithBuilder => b != null)
  }, [bids, bidIds])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const title = `${estimatorDisplayName} · ${weekLabel}`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: Z_INDEX,
        padding: '1rem',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          padding: '1.25rem',
          maxWidth: 520,
          width: '100%',
          maxHeight: 'min(85vh, 560px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, lineHeight: 1.3 }}>
              Sent bids
            </h2>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
              {title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'var(--bg-muted)',
              borderRadius: 6,
              padding: '0.35rem 0.65rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 120, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {orderedBids.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No matching bids in the current board filter (ids may be stale if data refreshed).
            </p>
          ) : (
            orderedBids.map((bid) => {
              const sub = bidRowSecondaryLabel(bid)
              const valueStr =
                bid.bid_value != null && Number.isFinite(Number(bid.bid_value))
                  ? formatCurrency(Number(bid.bid_value))
                  : '—'
              return (
                <button
                  key={bid.id}
                  type="button"
                  style={rowBtn}
                  onClick={() => {
                    if (bidPreview) bidPreview.openBidPreviewFromBid(bid)
                    onClose()
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{bidRowPrimaryLabel(bid)}</div>
                  {sub ? (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                  ) : null}
                  <div
                    style={{
                      marginTop: 6,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.35rem 0.75rem',
                      fontSize: '0.8125rem',
                      color: 'var(--text-700)',
                    }}
                  >
                    <span>
                      <span style={{ color: 'var(--text-muted)' }}>Value </span>
                      {valueStr}
                    </span>
                    <span>
                      <span style={{ color: 'var(--text-muted)' }}>Outcome </span>
                      {outcomeShort(bid.outcome)}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
