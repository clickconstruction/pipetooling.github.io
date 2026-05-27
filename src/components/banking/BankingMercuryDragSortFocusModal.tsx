import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Database } from '../../types/database'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { mercuryBankDescriptionFromRaw } from '../../lib/mercuryBankDescriptionFromRaw'
import type { DragSortLabelBucketVisualState } from './dragSortLabelBucketCard'
import { DragSortLabelBucketCard } from './dragSortLabelBucketCard'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']

const OVERLAY_Z = 1120
/** Must match Sidebar Accounting Labels **`aria-controls`** pattern for collapsible tiles. */
const FOCUS_LABEL_CARDS_REGION_ID = 'drag-sort-focus-label-cards-region'

function formatBankingDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatUsd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export type BankingMercuryDragSortFocusModalProps = {
  open: boolean
  onClose: () => void
  currentTx: MercuryTxRow | null
  unlabeledRemaining: number
  labels: DragLabelRow[]
  labelsLoading: boolean
  onPickLabel: (mercuryTransactionId: string, labelId: string) => void
  /** Mirrors Drag Sort sidebar **Accounting Labels** tile expansion (persisted storage in parent). */
  labelCardsExpanded: boolean
  onToggleLabelCardsExpanded: () => void
  /** Live bucket stats per **`mercury_drag_sort_labels.id`** (same as **`bucketStats.byLabel`**). */
  statsByLabelId: Map<string, { count: number; sum: number }>
  /** Quick label assigns only — max two steps in parent undo stack */
  undoAvailable: boolean
  onUndo: () => void
}

/** Center card matching Drag Sort ledger info density (readable, not overlay-only preview). */
function FocusTransactionCard({ row }: { row: MercuryTxRow }) {
  const party = row.counterparty_name?.trim() ?? '—'
  const bankRaw = mercuryBankDescriptionFromRaw(row.raw)
  const bankNote = (bankRaw ?? '').trim()
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 440,
        margin: '0 auto',
        padding: '1.25rem 1.35rem',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow:
          '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: '1.35rem', color: '#0f172a' }}>{formatUsd(Number(row.amount))}</div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: '0.35rem',
            rowGap: '0.25rem',
            fontSize: '0.8125rem',
            color: '#64748b',
          }}
        >
          <span>{formatBankingDate(row.posted_at)}</span>
          <span aria-hidden>·</span>
          <span>{formatMercuryKind(row.kind)}</span>
        </div>
      </div>
      <div
        style={{
          marginTop: '0.65rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          columnGap: '0.5rem',
          rowGap: '0.25rem',
        }}
      >
        <span style={{ fontSize: '0.9375rem', color: '#1e293b', wordBreak: 'break-word' }}>{party}</span>
        {bankNote !== '' ? (
          <span
            style={{
              fontSize: '0.8125rem',
              color: '#64748b',
              lineHeight: 1.4,
            }}
            title={bankNote.length > 200 ? bankNote : undefined}
          >
            {bankNote}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default function BankingMercuryDragSortFocusModal({
  open,
  onClose,
  currentTx,
  unlabeledRemaining,
  labels,
  labelsLoading,
  onPickLabel,
  labelCardsExpanded,
  onToggleLabelCardsExpanded,
  statsByLabelId,
  undoAvailable,
  onUndo,
}: BankingMercuryDragSortFocusModalProps) {
  const [labelSearch, setLabelSearch] = useState('')
  const [overlayDepartingTx, setOverlayDepartingTx] = useState<MercuryTxRow | null>(null)
  const [pickInteractionLabelId, setPickInteractionLabelId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setLabelSearch('')
      setOverlayDepartingTx(null)
      setPickInteractionLabelId(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const progressText = useMemo(() => {
    const hasActive = currentTx !== null || overlayDepartingTx !== null
    if (!hasActive && unlabeledRemaining === 0) return 'Queue empty'
    return `Remaining unlabeled in this view: ${unlabeledRemaining}`
  }, [currentTx, overlayDepartingTx, unlabeledRemaining])

  const needle = labelSearch.trim().toLowerCase()
  const filteredLabels = useMemo(() => {
    if (needle === '') return labels
    return labels.filter((L) => {
      const nm = L.name.toLowerCase()
      const sc = (L.schedule_c_line ?? '').toLowerCase()
      return nm.includes(needle) || sc.includes(needle)
    })
  }, [labels, needle])

  const handlePickLabel = useCallback(
    (labelId: string) => {
      if (!currentTx) return
      if (overlayDepartingTx) return
      const departing = currentTx
      setOverlayDepartingTx(departing)
      onPickLabel(departing.id, labelId)
    },
    [currentTx, onPickLabel, overlayDepartingTx],
  )

  const handleExitAnimationEnd = useCallback(() => {
    setOverlayDepartingTx(null)
  }, [])

  const undoDisabled = !undoAvailable || overlayDepartingTx !== null

  if (!open) return null

  return (
    <>
      <style>{`
        @keyframes mercuryDragSortFocusSlideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(115%); opacity: 0; }
        }
        .mercuryDragSortFocus-exit-inner {
          animation: mercuryDragSortFocusSlideOutRight 0.32s cubic-bezier(0.4, 0, 0.2, 1) forwards;
          will-change: transform, opacity;
        }
      `}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mercury-drag-sort-focus-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: OVERLAY_Z,
          background: 'rgba(15,23,42,0.45)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            padding: '0.85rem 1.25rem',
            background: '#fff',
            borderBottom: '1px solid #e5e7eb',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              flexWrap: 'wrap',
              minWidth: 0,
              flex: '1 1 auto',
            }}
          >
            <h2 id="mercury-drag-sort-focus-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
              Quick label
            </h2>
            <button
              type="button"
              aria-expanded={labelCardsExpanded}
              aria-controls={FOCUS_LABEL_CARDS_REGION_ID}
              onClick={onToggleLabelCardsExpanded}
              style={{
                flexShrink: 0,
                padding: '2px 6px',
                fontSize: '0.75rem',
                color: '#2563eb',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textDecoration: 'underline',
                whiteSpace: 'nowrap',
              }}
            >
              {labelCardsExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              aria-label="Undo last Quick label"
              title="Undo last assignment (max 2 steps)"
              disabled={undoDisabled}
              onClick={() => {
                if (undoDisabled) return
                onUndo()
              }}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: undoDisabled ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                opacity: undoDisabled ? 0.55 : 1,
              }}
            >
              Undo
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.45rem 0.95rem',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: '1rem 1rem 1.75rem',
            background: '#f8fafc',
          }}
        >
          {!labelsLoading && (currentTx !== null || overlayDepartingTx !== null) ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                marginBottom: '0.75rem',
                maxWidth: 960,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              <p
                className="mercury-drag-sort-focus-progress"
                aria-live="polite"
                aria-atomic="true"
                style={{
                  margin: 0,
                  flex: '1 1 auto',
                  minWidth: 0,
                  textAlign: 'left',
                  fontSize: '0.875rem',
                  color: '#475569',
                }}
              >
                {progressText}
              </p>
              <div
                style={{
                  flex: '1 1 12rem',
                  maxWidth: 480,
                  minWidth: 'min(10rem, 100%)',
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="search"
                  value={labelSearch}
                  onChange={(e) => setLabelSearch(e.target.value)}
                  autoComplete="off"
                  aria-label="Filter accounting labels"
                  placeholder="Search labels…"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    boxSizing: 'border-box',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>
          ) : null}

          {labelsLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading labels…</div>
          ) : currentTx === null && overlayDepartingTx === null ? (
            <div
              style={{
                textAlign: 'center',
                padding: '2.5rem 1rem',
                color: '#64748b',
                fontSize: '0.9375rem',
              }}
            >
              No unlabeled transactions in the current Drag Sort filters. Adjust search or toggles on the Banking page,
              then try again.
            </div>
          ) : (
            <>
              <div
                style={{
                  position: 'relative',
                  maxWidth: 520,
                  margin: '0 auto 1rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  width: '100%',
                  ...(overlayDepartingTx !== null && currentTx === null ? { minHeight: 140 } : {}),
                }}
              >
                {(currentTx || overlayDepartingTx) && (
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    {currentTx !== null ? <FocusTransactionCard row={currentTx} /> : null}
                  </div>
                )}
                {overlayDepartingTx ? (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  >
                    <div className="mercuryDragSortFocus-exit-inner" onAnimationEnd={handleExitAnimationEnd}>
                      <FocusTransactionCard row={overlayDepartingTx} />
                    </div>
                  </div>
                ) : null}
              </div>

              <div
                id={FOCUS_LABEL_CARDS_REGION_ID}
                style={{
                  maxWidth: 960,
                  margin: '0 auto',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.65rem',
                  justifyContent: 'center',
                  alignItems: 'stretch',
                }}
              >
                {filteredLabels.length === 0 ? (
                  <span style={{ color: '#64748b', fontSize: '0.875rem' }}>No labels match this filter.</span>
                ) : (
                  filteredLabels.map((L) => {
                    const blocked = !currentTx || !!overlayDepartingTx
                    const bucket = statsByLabelId.get(L.id) ?? { count: 0, sum: 0 }
                    let visualState: DragSortLabelBucketVisualState = 'idle'
                    if (!blocked && pickInteractionLabelId === L.id) {
                      visualState = 'clickableHover'
                    }
                    return (
                      <button
                        key={L.id}
                        type="button"
                        disabled={blocked}
                        onClick={() => handlePickLabel(L.id)}
                        title={L.description ?? L.name}
                        onMouseEnter={() => !blocked && setPickInteractionLabelId(L.id)}
                        onMouseLeave={() => setPickInteractionLabelId(null)}
                        onFocus={() => !blocked && setPickInteractionLabelId(L.id)}
                        onBlur={(e) => {
                          const nextFocus = e.relatedTarget
                          const cur = e.currentTarget
                          if (!(nextFocus instanceof Node && cur.contains(nextFocus))) setPickInteractionLabelId(null)
                        }}
                        style={{
                          margin: 0,
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          cursor: blocked ? 'not-allowed' : 'pointer',
                          opacity: blocked ? 0.55 : 1,
                          display: 'block',
                          flex: '0 1 auto',
                          maxWidth: 'min(22rem, 100%)',
                          textAlign: 'left',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      >
                        <DragSortLabelBucketCard
                          variant="grid"
                          labelName={L.name}
                          scheduleCLine={L.schedule_c_line}
                          description={L.description}
                          count={bucket.count}
                          amountSum={bucket.sum}
                          expanded={labelCardsExpanded}
                          visualState={blocked ? 'idle' : visualState}
                          onDelete={undefined}
                          defaultKey={L.default_key}
                        />
                      </button>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
