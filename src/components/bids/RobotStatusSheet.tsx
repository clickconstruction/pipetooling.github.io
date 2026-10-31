import { useEffect, useState } from 'react'
import type { Bid } from '../../types/bids'
import { robotRowState, robotStatusTimeline, type RobotRowInput } from '../../lib/bids/robotRowState'
import type { RobotProgress } from '../../lib/bids/robotProgress'
import type { RobotStage } from '../../lib/bids/robotStage'
import { useRobotRunSignals } from '../../hooks/useRobotProgress'
import { heartbeatDetailWords, heartbeatWords } from '../../../supabase/functions/_shared/twinHeartbeat'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { RobotRing } from './RobotRing'

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
  /** v2.5732 (punch list #142): the robot's progress on this bid — the seven-step bar, the last word, Read the run. */
  progress?: RobotProgress | null
  /** v2.5732: Leave this one to me — the bid's robot opt-out; the robot stops within five minutes. */
  onLeaveToMe?: (bid: Bid) => void
  /** v2.5751: open with Read the run already unfolded — the comparison modal's door on a sent bid's live run. */
  runOpenAtStart?: boolean
  /** Robot fixtures (punch list #221, PR 3b): the bid's standing with the robots; the door to the fixtures opens once sealed. */
  stage?: RobotStage | null
  onOpenFixtures?: (bid: Bid) => void
}

/** Remembered per browser: the first visit shows What the robot touches open; later visits fold it. */
const TOUCHES_SEEN_KEY = 'pipetooling_robot_touches_seen'

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
 * v2.5732: with a progress row the second step opens into the seven-step bar
 * (the same steps the ring on the icon fills), the last word and the Mac it
 * came from, the first-visit fold about what the robot touches, Read the run
 * and Leave this one to me.
 */
export function RobotStatusSheet(props: RobotStatusSheetProps) {
  if (!props.input) return null
  return <RobotStatusSheetBody {...props} input={props.input} />
}

function RobotStatusSheetBody({ input, twin, progress = null, onClose, onOpenRobotBoard, onCompare, onToggleRequest, onOpenQuestions, onLeaveToMe, runOpenAtStart = false, stage = null, onOpenFixtures }: RobotStatusSheetProps & { input: RobotRowInput & { bid: Bid } }) {
  const { bid } = input
  const state = robotRowState(input)
  const steps = robotStatusTimeline(input)
  const label = `b${bid.bid_number ?? '?'} · ${bid.project_name ?? 'bid'}`
  const scored = state.kind === 'scored'
  const requested = !!bid.robot_requested_at
  const live = state.kind === 'queued' || state.kind === 'working' || state.kind === 'sealed'
  const showProgress = !!progress && live && !progress.void
  const optedOut = !!(bid as { robot_opt_out?: boolean | null }).robot_opt_out
  const subtitle =
    showProgress && progress && !progress.sealed
      ? progress.sentence
      : state.kind === 'queued'
        ? 'Queued — a robot picks it up in the next batch'
        : state.kind === 'sealed'
          ? `Sealed${state.lockedAt ? ` ${fmtWhen(state.lockedAt)}` : ''} — its number shows when you send`
          : state.kind === 'scored'
            ? 'Scored against the number you sent'
            : state.kind === 'working'
              ? 'Working — reading the plans and counting'
              : state.title
  const [touchesOpen, setTouchesOpen] = useState(() => {
    try {
      return localStorage.getItem(TOUCHES_SEEN_KEY) !== '1'
    } catch {
      return true
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(TOUCHES_SEEN_KEY, '1')
    } catch {
      /* a private window: the fold opens every time */
    }
  }, [])
  const [runOpen, setRunOpen] = useState(runOpenAtStart)
  const { signals, loading } = useRobotRunSignals(runOpen ? bid.id : null)

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="robot-status-title"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1005, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 560, width: '100%', padding: '1.1rem 1.25rem', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', maxHeight: 'min(85vh, 100%)', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <RobotRing state={state} progress={showProgress ? progress : null} size={34} />
          <div style={{ minWidth: 0 }}>
            <h2 id="robot-status-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Robot on {label}</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="robot-status-subtitle">{subtitle}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
        </div>

        <ol style={{ listStyle: 'none', margin: '0 0 1rem', padding: '0 0 0 0.6rem', borderLeft: '2px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {steps.map((s, i) => {
            const dot = s.state === 'done' ? '#16a34a' : s.state === 'now' ? '#2563eb' : 'var(--border-strong)'
            const when = fmtWhen(s.at)
            const bar = i === 1 && showProgress && progress && !progress.sealed
            return (
              <li key={i} style={{ position: 'relative', paddingLeft: '0.9rem', fontSize: '0.875rem', color: s.state === 'todo' ? 'var(--text-muted)' : 'var(--text-base)' }}>
                <span aria-hidden style={{ position: 'absolute', left: '-0.6rem', top: '0.45em', width: 8, height: 8, borderRadius: '50%', background: dot, transform: 'translateX(-50%)', boxShadow: s.state === 'now' ? '0 0 0 3px rgba(37,99,235,0.2)' : undefined }} />
                <span style={{ fontWeight: s.state === 'now' ? 600 : 400 }}>{s.label}</span>
                {bar ? <ProgressBar progress={progress} /> : when || s.detail ? (
                  <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {[when, s.detail].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ol>

        {showProgress ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.7rem', margin: '0 0 0.9rem', background: 'var(--bg-subtle)' }} data-testid="robot-touches">
            <button
              type="button"
              onClick={() => setTouchesOpen((o) => !o)}
              aria-expanded={touchesOpen}
              style={{ font: 'inherit', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-strong)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', gap: '0.4rem', alignItems: 'center', width: '100%' }}
            >
              What the robot touches
              <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontWeight: 400 }}>{touchesOpen ? '▾' : '▸'}</span>
            </button>
            {touchesOpen ? (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-700)', display: 'grid', gap: '0.25rem', marginTop: '0.35rem' }}>
                <p style={{ margin: 0 }}>The robot reads the plans and works on its own copy of the bid.</p>
                <p style={{ margin: 0 }}>It never edits your bid. It never sends anything to anyone.</p>
                <p style={{ margin: 0 }}>Its number stays sealed until you send yours.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {runOpen ? (
          <div data-testid="robot-run" style={{ margin: '0 0 0.9rem', fontSize: '0.76rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-strong)', display: 'flex', gap: '0.4rem', alignItems: 'baseline' }}>
              Read the run <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.74rem' }}>every signal and stamp, oldest first</span>
            </div>
            {loading && !signals ? <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)' }}>Reading the run…</p> : null}
            {signals && signals.length === 0 ? <p style={{ margin: '0.3rem 0 0', color: 'var(--text-muted)' }}>No signals on this bid yet.</p> : null}
            {(signals ?? []).map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '7rem 3.4rem 1fr', gap: '0.5rem', padding: '0.22rem 0', borderBottom: '1px solid var(--border)', alignItems: 'baseline' }}>
                <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtWhen(s.at)}</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', borderRadius: 4, padding: '1px 5px', textAlign: 'center', background: s.kind === 'stamp' ? 'var(--bg-violet-100)' : 'var(--bg-muted)', color: s.kind === 'stamp' ? 'var(--text-violet-800)' : 'var(--text-muted)' }}>{s.kind}</span>
                <span style={{ color: 'var(--text-700)', overflowWrap: 'anywhere' }}>
                  {s.kind === 'signal'
                    ? [heartbeatWords(s.progress, s.state), heartbeatDetailWords(s.progress), s.words.replace(/^heartbeat\s+stage=.*?state=(working|blocked|done|idle)\s*/, '').trim()].filter(Boolean).join(' ')
                    : s.words}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', alignItems: 'center' }}>
          {stage?.fixturesOpen && onOpenFixtures && !bid.bid_date_sent ? (
            <button type="button" onClick={() => onOpenFixtures(bid)} data-testid="robot-status-fixtures" style={{ ...btn(true), background: '#2563eb', color: '#fff', borderColor: '#2563eb' }} title="The fixtures the robot found on this bid's plans, on the Counts tab">
              {stage.fixturesTaken > 0 ? `${stage.fixturesTaken} of ${stage.fixturesFound} fixtures on your count · Review` : `Fixtures ready · ${stage.fixturesFound} · Review them`}
            </button>
          ) : null}
          {(scored || !!bid.bid_date_sent) && twin ? (
            <button type="button" onClick={() => onCompare(twin, bid)} style={btn(true)}>Compare counts and pricing</button>
          ) : null}
          {showProgress || twin ? (
            <button type="button" onClick={() => setRunOpen((o) => !o)} style={btn(showProgress && !(scored || !!bid.bid_date_sent))} aria-expanded={runOpen}>
              {runOpen ? 'Hide the run' : 'Read the run'}
            </button>
          ) : null}
          {twin ? (
            <button type="button" onClick={() => onOpenRobotBoard(twin)} style={btn(false)}>Open robot bid b{twin.bid_number ?? '?'}</button>
          ) : null}
          {input.openQuestions > 0 ? (
            <button type="button" onClick={onOpenQuestions} style={btn(false)}>Its questions ({input.openQuestions})</button>
          ) : null}
          {live && onLeaveToMe && !optedOut && !bid.bid_date_sent ? (
            <button type="button" onClick={() => onLeaveToMe(bid)} style={btn(false)} title="Takes the bid off the robots. The robot stops within five minutes and sets its copy aside.">
              Leave this one to me
            </button>
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
          {live && onLeaveToMe && !optedOut && !bid.bid_date_sent ? (
            <p style={{ width: '100%', margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Leave this one to me takes the bid off the robots. The robot stops within five minutes.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** The seven steps as a bar: the done ones green, the lit one blue (amber when quiet), the rest gray; the last word under it. */
function ProgressBar({ progress }: { progress: RobotProgress }) {
  const tone = progress.tone === 'amber' ? '#d97706' : progress.tone === 'green' ? '#16a34a' : '#2563eb'
  return (
    <div data-testid="robot-progress-bar" style={{ marginTop: '0.45rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {progress.steps.map((s) => (
          <div
            key={s.key}
            data-step={s.key}
            data-state={s.state}
            style={{ fontSize: '0.64rem', lineHeight: 1.2, textAlign: 'center', color: s.state === 'now' ? tone : s.state === 'done' ? 'var(--text-700)' : 'var(--text-muted)', fontWeight: s.state === 'now' ? 700 : 400 }}
          >
            <div style={{ height: 6, borderRadius: 3, marginBottom: 4, background: s.state === 'done' ? '#16a34a' : s.state === 'now' ? tone : 'var(--border)', boxShadow: s.state === 'now' ? `0 0 0 2px ${tone}38` : undefined }} />
            {s.label}
            {s.detail ? <><br />{s.detail}</> : null}
          </div>
        ))}
      </div>
      <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: progress.quiet ? 'var(--text-amber-800)' : 'var(--text-700)' }} data-testid="robot-progress-line">
        {progress.quiet
          ? progress.sentence
          : [progress.lastWordAt ? `Last word ${fmtWhen(progress.lastWordAt)}${progress.host ? `, from ${progress.host}` : ''}.` : null, progress.usualWords].filter(Boolean).join(' ')}
      </p>
    </div>
  )
}

function btn(primary: boolean): React.CSSProperties {
  return primary
    ? { padding: '0.45rem 0.85rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }
    : { padding: '0.45rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }
}
