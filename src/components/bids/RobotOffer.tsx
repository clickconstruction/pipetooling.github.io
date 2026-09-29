import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { robotOfferText, type RobotKind, type RobotSeatState } from '../../lib/submittals/robotOffer'
import { SUBMITTAL_GUIDE_HREF } from '../../lib/submittals/submittalTour'

/**
 * One robot offer (v2.4136, punch list #59): the same three lines at every spot on
 * Submittals — what the robot does, what it needs and whether this bid has it, what you
 * do after — the awake line, the button (second to the human door beside it), and the
 * one `?` to the guide's robot section. Draws nothing while no seat is live.
 */
export function RobotOffer({
  kind,
  seat,
  hasPlans,
  busy,
  onAsk,
  testId,
  tour,
}: {
  kind: RobotKind
  seat: RobotSeatState
  /** The schedule read needs the plans on the bid; the other kinds have what they need when offered. */
  hasPlans?: boolean
  busy: boolean
  onAsk: () => void
  /** The button's `data-testid`. */
  testId: string
  /** The walkthrough anchor on the block, when the tour has a stop for it. */
  tour?: string
}) {
  if (!seat.live) return null
  const t = robotOfferText(kind, { hasPlans })
  const muted: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
  return (
    <div
      data-testid={`robot-offer-${kind}`}
      data-tour={tour}
      style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.2rem', maxWidth: 440, border: '1px dashed var(--border-strong)', borderRadius: 8, padding: '0.45rem 0.65rem', background: 'var(--bg-muted)', fontSize: '0.8125rem', color: 'var(--text-base)' }}
    >
      <span>
        <span aria-hidden>🤖 </span>
        <b style={{ color: 'var(--text-strong)' }}>{t.does}</b>
      </span>
      <span style={{ ...muted, color: t.needs.ok ? 'var(--text-muted)' : 'var(--text-amber-700)' }} data-testid={`robot-needs-${kind}`}>
        {t.needs.text} · {seat.line}
      </span>
      <span style={muted}>{t.after}</span>
      <span style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.15rem' }}>
        <button
          type="button"
          disabled={busy || !t.needs.ok}
          onClick={onAsk}
          data-testid={testId}
          style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 500, padding: '0.28rem 0.7rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: busy || !t.needs.ok ? 'not-allowed' : 'pointer', opacity: busy || !t.needs.ok ? 0.6 : 1 }}
        >
          {t.button}
        </button>
        <Link to={SUBMITTAL_GUIDE_HREF} style={{ ...muted, color: 'var(--text-link)' }}>
          What is the robot? →
        </Link>
      </span>
    </div>
  )
}
