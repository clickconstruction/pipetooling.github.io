import { useState } from 'react'

import { promoteConfirmCopy, type PromoteAlternate, type PromoteConfirmMode } from '../../lib/bids/promoteBidGc'

/**
 * The promote/take-off confirm (punch list #136): one sentence, both outcomes on the
 * table. Opened by the × on the ★ Bid's-GC card (mode 'remove' — the departing GC off
 * the bid, "keep as an alternate" one click away; with 2+ alternates a radio asks who
 * steps up) and by "make bid's GC" on an alternate card (mode 'promote' — the old GC
 * stays). The parent runs the `promote_bid_gc` RPC; this component only collects the
 * choice.
 */
export function PromoteBidGcModal({
  mode,
  oldGcName,
  oldIsCustomer,
  alternates,
  targetCustomerId,
  recommendedId,
  busy,
  onConfirm,
  onClose,
}: {
  mode: PromoteConfirmMode
  oldGcName: string
  /** False when the current primary is a legacy builder label — it can't stay as an alternate. */
  oldIsCustomer: boolean
  alternates: PromoteAlternate[]
  /** mode 'promote': the card whose door was pressed. */
  targetCustomerId?: string
  /** mode 'remove': the preselected successor. */
  recommendedId?: string | null
  busy: boolean
  onConfirm: (newGcId: string, oldStays: boolean) => void
  onClose: () => void
}) {
  const [pickedId, setPickedId] = useState<string>(
    mode === 'promote' ? targetCustomerId ?? '' : recommendedId ?? alternates[0]?.customerId ?? '',
  )
  const picked = alternates.find((a) => a.customerId === pickedId) ?? alternates[0]
  if (!picked) return null
  const copy = promoteConfirmCopy({
    mode,
    oldName: oldGcName,
    oldIsCustomer,
    successorName: picked.name,
    alternateCount: mode === 'remove' ? alternates.length : 1,
  })
  const btn = (kind: 'primary' | 'plain' | 'ghost'): React.CSSProperties => ({
    padding: '0.5rem 0.9rem',
    borderRadius: 6,
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.6 : 1,
    ...(kind === 'primary'
      ? { background: '#2563eb', color: 'white', border: '1px solid #2563eb' }
      : kind === 'plain'
        ? { background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border-strong)' }
        : { background: 'none', color: 'var(--text-muted)', border: 'none', fontWeight: 500 }),
  })
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-label={copy.title} style={{ background: 'var(--surface)', padding: '1.25rem 1.4rem', borderRadius: 10, width: 'min(440px, calc(100vw - 2rem))', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>{copy.title}</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{copy.body}</p>
        {copy.pickPrompt ? (
          <>
            <p style={{ margin: '0 0 0.4rem', fontSize: '0.875rem', fontWeight: 600 }}>{copy.pickPrompt}</p>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: '0.9rem' }}>
              {alternates.map((a, i) => (
                <label
                  key={a.customerId}
                  style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', padding: '0.5rem 0.65rem', cursor: 'pointer', borderTop: i === 0 ? 'none' : '1px solid var(--border)', fontSize: '0.85rem' }}
                >
                  <input
                    type="radio"
                    name="promote-bid-gc-pick"
                    checked={pickedId === a.customerId}
                    onChange={() => setPickedId(a.customerId)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontWeight: 600 }}>{a.name}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {a.source === 'version' ? 'own packet' : 'same letter'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={onClose} disabled={busy} style={btn('ghost')}>
            Cancel
          </button>
          {copy.keepLabel ? (
            <button type="button" onClick={() => onConfirm(picked.customerId, true)} disabled={busy} style={btn('plain')}>
              {copy.keepLabel}
            </button>
          ) : null}
          <button type="button" onClick={() => onConfirm(picked.customerId, mode === 'promote')} disabled={busy} style={btn('primary')}>
            {busy ? 'Working…' : copy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
