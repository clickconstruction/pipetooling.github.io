import type { Bid } from '../../types/bids'
import { robotRowState, robotStatusTimeline, type RobotRowInput } from '../../lib/bids/robotRowState'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { RobotGlyph } from './RobotGlyph'

type RobotStatusSheetProps = {
  /** The human bid and everything the kernel needs; null = closed. */
  input: (RobotRowInput & { bid: Bid }) | null
  /** The paired robot bid row, when one exists (for the Robot Board / comparison doors). */
  twin: Bid | null
  onClose: () => void
  onOpenRobotBoard: (twin: Bid) => void
  /** After send: today's comparison modal. */
  onCompare: (twin: Bid, source: Bid) => void
  /** Front of the line: stamps / clears bids.robot_requested_at (the dispatcher honors it). */
  onToggleRequest: (bid: Bid) => void
  /** Open questions live on Bids → Audits → Standing rulings. */
  onOpenQuestions: () => void
}

function fmtWhen(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return dateOnly
    ? d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'UTC' })
    : d.toLocaleString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ })
}

/**
 * The robot-icon click on a live bid: where the robot is on this bid, as a
 * timeline. Blind-safe — the sealed number is never read here. Once the bid
 * is sent and scored, the comparison door opens from the same sheet.
 */
export function RobotStatusSheet({ input, twin, onClose, onOpenRobotBoard, onCompare, onToggleRequest, onOpenQuestions }: RobotStatusSheetProps) {
  if (!input) return null
  const { bid } = input
  const state = robotRowState(input)
  const steps = robotStatusTimeline(input)
  const label = `b${bid.bid_number ?? '?'} · ${bid.project_name ?? 'bid'}`
  const scored = state.kind === 'scored'
  const requested = !!bid.robot_requested_at
  const subtitle =
    state.kind === 'queued'
      ? 'Queued — a robot picks it up in the next batch'
      : state.kind === 'sealed'
        ? `Sealed${state.lockedAt ? ` ${fmtWhen(state.lockedAt)}` : ''} — its number shows when you send`
        : state.kind === 'scored'
          ? 'Scored against the number you sent'
          : state.kind === 'working'
            ? 'Working — reading the plans and counting'
            : state.title

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="robot-status-title"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1005, padding: '1rem' }}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 560, width: '100%', padding: '1.1rem 1.25rem', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <RobotGlyph state={state} size={22} />
          <div style={{ minWidth: 0 }}>
            <h2 id="robot-status-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Robot on {label}</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subtitle}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
        </div>

        <ol style={{ listStyle: 'none', margin: '0 0 1rem', padding: '0 0 0 0.6rem', borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {steps.map((s, i) => {
            const dot = s.state === 'done' ? '#16a34a' : s.state === 'now' ? '#2563eb' : 'var(--border-strong)'
            const when = fmtWhen(s.at)
            return (
              <li key={i} style={{ position: 'relative', paddingLeft: '0.9rem', fontSize: '0.875rem', color: s.state === 'todo' ? 'var(--text-muted)' : 'var(--text-base)' }}>
                <span aria-hidden style={{ position: 'absolute', left: '-0.6rem', top: '0.45em', width: 8, height: 8, borderRadius: '50%', background: dot, transform: 'translateX(-50%)', boxShadow: s.state === 'now' ? '0 0 0 3px rgba(37,99,235,0.2)' : undefined }} />
                <span style={{ fontWeight: s.state === 'now' ? 600 : 400 }}>{s.label}</span>
                {when || s.detail ? (
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {[when, s.detail].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
          {(scored || !!bid.bid_date_sent) && twin ? (
            <button type="button" onClick={() => onCompare(twin, bid)} style={btn(true)}>Compare counts and pricing</button>
          ) : null}
          {twin ? (
            <button type="button" onClick={() => onOpenRobotBoard(twin)} style={btn(!(scored || !!bid.bid_date_sent))}>Open robot bid b{twin.bid_number ?? '?'}</button>
          ) : null}
          {input.openQuestions > 0 ? (
            <button type="button" onClick={onOpenQuestions} style={btn(false)}>Its questions ({input.openQuestions})</button>
          ) : null}
          {state.kind === 'queued' || state.kind === 'working' ? (
            <button
              type="button"
              onClick={() => onToggleRequest(bid)}
              title={requested ? 'Asked for early — click to take it back' : 'Put this bid at the front of the next robot batch'}
              style={{ ...btn(false), border: 'none', color: 'var(--text-blue-500)', background: 'transparent', fontWeight: 500 }}
            >
              {requested ? 'Front of the line ✓ · undo' : 'Front of the line next batch'}
            </button>
          ) : null}
          <button type="button" onClick={onClose} style={{ ...btn(false), marginLeft: 'auto' }}>Close</button>
        </div>
      </div>
    </div>
  )
}

function btn(primary: boolean): React.CSSProperties {
  return primary
    ? { padding: '0.45rem 0.85rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }
    : { padding: '0.45rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }
}
