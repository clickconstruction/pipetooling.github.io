import type { CSSProperties } from 'react'
import type { BridgeCall, CallLink } from '../../lib/bridge/calls'
import { CALL_LINK_NAMES, stageKindOf } from '../../lib/bridge/calls'
import { LINK_DESK } from '../../lib/bridge/linkDesk'

/**
 * The link's desk (link PR 2): for the pressed stage, what it is, why it
 * matters, how the Bridge reads it, and today's reading. Since v2.6840 (punch
 * list #303, PR 2) the moves, the owner box on each and the record press are
 * gone from here: the call is made on the first screen's card, which proposes
 * the pressed step with a person on each move. This card says which step that
 * is and sends the reader up to it.
 */

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

export function BridgeLinkDesk({
  link,
  status,
  todayReading,
  thisWeekCall,
  dayLabel,
  door,
  onGoToCall,
}: {
  link: CallLink
  status: string
  todayReading: string
  thisWeekCall: BridgeCall | null
  dayLabel: (ymd: string) => string
  /** A door under today's reading (v2.5853: Collect's *Break it down*). */
  door?: { label: string; onPress: () => void }
  /** Takes the reader to the first screen's card, where the call on this step is made. */
  onGoToCall: () => void
}) {
  const desk = LINK_DESK[link]
  const recorded = thisWeekCall?.link === link
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 0.9rem', marginTop: '0.6rem' }} data-testid="bridge-link-desk">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', alignItems: 'baseline' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{CALL_LINK_NAMES[link]}</span>
        <span style={det}>· {stageKindOf(link)}</span>
        <span style={{ ...det, marginLeft: 'auto' }} data-testid="bridge-link-desk-status">
          {status}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.5rem 1.2rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
        <div>
          <div style={label}>What it is</div>
          <div>{desk.what}</div>
        </div>
        <div>
          <div style={label}>Why it matters to throughput</div>
          <div>{desk.why}</div>
        </div>
        <div>
          <div style={label}>How the Bridge reads it</div>
          <div>{desk.how}</div>
        </div>
        <div>
          <div style={label}>Today's reading</div>
          <div data-testid="bridge-link-desk-today">{todayReading}</div>
          {door && (
            <button type="button" onClick={door.onPress} style={{ marginTop: 6, height: 30, padding: '0 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }} data-testid="bridge-link-desk-door">
              {door.label} ›
            </button>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.6rem' }}>
        {recorded && thisWeekCall ? (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-green-700)', fontWeight: 600 }} data-testid="bridge-link-desk-recorded">
            This week's call: {CALL_LINK_NAMES[thisWeekCall.link]}, recorded {dayLabel(thisWeekCall.calledOn)}
            {thisWeekCall.calledByName ? ` by ${thisWeekCall.calledByName}` : ''}. Friday asks whether it moved.
          </span>
        ) : (
          <span style={det} data-testid="bridge-link-desk-call">
            {thisWeekCall ? `This week’s call is ${CALL_LINK_NAMES[thisWeekCall.link]}.` : `The card at the top proposes the call on ${CALL_LINK_NAMES[link]}, with a person on each move.`}
          </span>
        )}
        <button type="button" onClick={onGoToCall} data-testid="bridge-link-desk-go" style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.85rem', fontWeight: 600, minHeight: 36, padding: '0.3rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }}>
          Go to this week’s call ↑
        </button>
      </div>
    </div>
  )
}
