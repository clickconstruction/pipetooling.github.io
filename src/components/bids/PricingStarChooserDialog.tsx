/**
 * Bids → Pricing: "Send / Print / Export which price?" (F2, v2.2120; "both", v2.3685) — the
 * chooser of region P7 of `docs/BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`. The JSX moved out
 * of `BidsPricingTab` as it was; it renders and reports only. "Both" is offered for a share.
 */
import type { CSSProperties } from 'react'
import { starChooserConfirmLabel, starChooserVerb, type StarAwareAction, type StarChoice } from '../../lib/bids/starAwareShare'

export function PricingStarChooserDialog({
  action,
  choice,
  busy,
  starName,
  viewedName,
  onChoose,
  onCancel,
  onConfirm,
}: {
  action: StarAwareAction
  choice: StarChoice
  /** The ★'s prices are loading — the backdrop and Cancel hold still. */
  busy: boolean
  starName: string
  viewedName: string
  onChoose: (choice: StarChoice) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const verb = starChooserVerb(action)
  const radio = (on: boolean): CSSProperties => ({ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.5rem 0.6rem', border: on ? '1px solid #3b82f6' : '1px solid var(--border)', background: on ? 'var(--bg-blue-tint)' : 'transparent', borderRadius: 8, cursor: 'pointer', marginTop: '0.35rem', font: 'inherit', color: 'inherit', width: '100%', textAlign: 'left' })
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
      onClick={() => !busy && onCancel()}
    >
      <div
        role="dialog"
        aria-label={`${verb} which price?`}
        style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, padding: '1rem 1.1rem', maxWidth: 460, width: '92%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.02rem' }}>{verb} which price?</h3>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>You're viewing {viewedName}; the customer's price is ★ {starName}.</p>
        <button type="button" style={radio(choice === 'star')} onClick={() => onChoose('star')}>
          <input type="radio" readOnly checked={choice === 'star'} style={{ marginTop: '0.2rem' }} />
          <span><b style={{ display: 'block', fontSize: '0.9rem' }}>Customer's price — ★ {starName}</b><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>What the Cover Letter and the bid value use.</span></span>
        </button>
        <button type="button" style={radio(choice === 'viewed')} onClick={() => onChoose('viewed')}>
          <input type="radio" readOnly checked={choice === 'viewed'} style={{ marginTop: '0.2rem' }} />
          <span><b style={{ display: 'block', fontSize: '0.9rem' }}>The one you're viewing — {viewedName}</b><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>For a teammate to check. Not what the GC sees.</span></span>
        </button>
        {action === 'share' ? (
          <button type="button" style={radio(choice === 'both')} onClick={() => onChoose('both')}>
            <input type="radio" readOnly checked={choice === 'both'} style={{ marginTop: '0.2rem' }} />
            <span><b style={{ display: 'block', fontSize: '0.9rem' }}>Both — ★ {starName} and {viewedName}</b><span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>One package: the customer's price first, {viewedName} under it. Text, mail or send it the same way.</span></span>
          </button>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.8rem' }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} style={{ font: 'inherit', fontSize: '0.85rem', padding: '0.4rem 0.9rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: busy ? 'wait' : 'pointer' }}>
            {starChooserConfirmLabel({ action, choice, starName, viewedName, busy })}
          </button>
        </div>
      </div>
    </div>
  )
}
