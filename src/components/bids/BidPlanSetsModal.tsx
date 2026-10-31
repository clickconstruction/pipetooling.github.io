import type { CSSProperties } from 'react'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { planSetDateWords, planSetFileWords, type PlanSetItem } from '../../lib/bids/bidPlanSets'

/**
 * The Bid Board's plans picker (v2.6169): a bid with two or more sets of plans opens this window from
 * the plans icon in its Links cluster. Each set reads name · date · memo and what stands behind the
 * link (the file's name or the PDF count, and the size), with Open ↗; the set the robot reads wears a
 * chip. Edit bid at the foot is where a set is added or changed. One set never opens this window: the
 * icon opens the set itself.
 */
export function BidPlanSetsModal({ bid, items, onClose, onEditBid }: { bid: { id: string; bid_number: string | null; project_name: string | null }; items: ReadonlyArray<PlanSetItem>; onClose: () => void; /** Opens Edit Bid on this bid; the window closes first. */ onEditBid?: () => void }) {
  const label = `b${bid.bid_number ?? '?'} · ${bid.project_name ?? 'bid'}`
  const btn: CSSProperties = { font: 'inherit', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.7rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', whiteSpace: 'nowrap' }
  const muted: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
  return (
    <div
      role="dialog"
      aria-modal
      aria-label={`Plans on ${label}`}
      data-testid="bid-plan-sets-modal"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.1rem 1.25rem', maxWidth: 560, width: '100%', maxHeight: 'min(85vh, 100%)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.02rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Plans on {label}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.15rem', lineHeight: 1, color: 'inherit', flexShrink: 0 }}>
            ×
          </button>
        </div>
        <p style={{ ...muted, margin: 0 }}>
          {items.length} sets of plans on this bid. Open the one you want.
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
          {items.map((set) => {
            const date = planSetDateWords(set.planDate)
            return (
              <li key={set.id} data-testid="bid-plan-set" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.55rem 0.7rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-subtle)' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: '0.15rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{set.name}</span>
                    {date ? <span style={muted}>{date}</span> : null}
                    {set.robotReads ? (
                      <span data-testid="bid-plan-set-robot" style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.05rem 0.45rem', borderRadius: 999, background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', color: 'var(--text-blue-800)' }}>
                        Robot reads this
                      </span>
                    ) : null}
                  </div>
                  {set.memo ? <div style={{ fontSize: '0.82rem', color: 'var(--text-base)' }}>{set.memo}</div> : null}
                  <div style={muted} data-testid="bid-plan-set-file">
                    {planSetFileWords(set)}
                  </div>
                </div>
                <button type="button" onClick={() => openInExternalBrowser(set.link)} title={set.link} style={btn}>
                  Open ↗
                </button>
              </li>
            )
          })}
        </ul>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
          <span style={muted}>Add or change sets in Edit bid.</span>
          {onEditBid ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onEditBid()
              }}
              style={btn}
            >
              Edit bid
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
