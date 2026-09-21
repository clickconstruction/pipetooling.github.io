/**
 * The mark an approver reads on a quick add (to-dos/quick-time-add): a self-reported block added
 * after an off-hours call or email, not a punch. It is never hidden inside ordinary clocked time —
 * wherever sessions are listed for approval, this chip and the person's sentence sit on the row.
 */
import type { CSSProperties } from 'react'

const chipStyle: CSSProperties = {
  display: 'inline-block',
  marginRight: '0.4rem',
  padding: '0.05rem 0.4rem',
  borderRadius: 999,
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
  // Violet: the one hue the hours surfaces do not already use for a status (green approved, amber pending, red rejected).
  background: 'rgba(124, 58, 237, 0.16)',
  color: '#8b5cf6',
  verticalAlign: '1px',
}

export function QuickAddChip() {
  return (
    <span style={chipStyle} title="Added after the fact (a call or an email off the clock) — not a clock punch">
      quick add
    </span>
  )
}
