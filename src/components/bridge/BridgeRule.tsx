import { useState, type CSSProperties } from 'react'
import { STAGE_RULE_LINE, STAGE_RULE_LONG, STAGE_RULE_POINTS } from '../../lib/bridge/stageFlow'

/**
 * The rule the Bridge opens on (link PR 1): one line, and a "?" that shows the
 * longer reading and the five points from *The Goal* in our words on hover,
 * focus or press.
 */

const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

export function BridgeRule() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', marginTop: '0.4rem' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} data-testid="bridge-rule">
      <div style={{ fontSize: '0.95rem', borderLeft: '3px solid #2563eb', padding: '0.35rem 0.7rem', background: 'var(--surface)', borderRadius: '0 8px 8px 0', display: 'flex', gap: '0.6rem', alignItems: 'baseline' }}>
        <span>{STAGE_RULE_LINE}</span>
        <button
          type="button"
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onClick={() => setOpen((o) => !o)}
          aria-label="Why this rule"
          aria-expanded={open}
          style={{ marginLeft: 'auto', width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', lineHeight: 1, flex: '0 0 auto', font: 'inherit' }}
        >
          ?
        </button>
      </div>
      {open && (
        <div role="tooltip" style={{ position: 'absolute', left: 0, top: '100%', marginTop: 6, zIndex: 5, maxWidth: 680, background: 'var(--text-base)', color: 'var(--surface)', padding: '0.7rem 0.85rem', borderRadius: 8, fontSize: '0.88rem', lineHeight: 1.45, boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }} data-testid="bridge-rule-popover">
          <div>{STAGE_RULE_LONG}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {STAGE_RULE_POINTS.map((p) => (
              <div key={p.head}>
                <b>{p.head}.</b> {p.text}
              </div>
            ))}
          </div>
          <div style={{ ...det, color: 'var(--border)', marginTop: 8 }}>
            After <em>The Goal</em>, Eliyahu M. Goldratt and Jeff Cox. The Theory of Constraints, in our words.
          </div>
        </div>
      )}
    </div>
  )
}
