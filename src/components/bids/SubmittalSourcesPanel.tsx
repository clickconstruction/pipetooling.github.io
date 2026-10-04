/**
 * The first step's body (moved out of `BidsSubmittalsTab.tsx`, 2026-10-04, the split's step 5): the
 * three places a row can come from — the takeoff, the quotes compared on Pricing, the plans'
 * schedule — with the robot's read of the schedule in its card and, once read, the tags to confirm
 * under the cards. It draws what it is handed and reports each press; the tab owns every write.
 */
import { Fragment } from 'react'
import { confirmLabel, liveTask, scheduleToConfirm, taskStatus, type SubmittalTaskRow } from '../../lib/submittals/robotTasks'
import { staleAsk, type RobotSeatState } from '../../lib/submittals/robotOffer'
import { formatShortDate } from '../../lib/submittals/submittalRevision'
import { describeTask } from '../../../supabase/functions/_shared/submittalRobot'
import { RobotOffer } from './RobotOffer'
import { btn, btnGreen, btnPrimary, btnQuiet, smallMuted } from './submittalTabStyles'

export type SubmittalSourcesPanelProps = {
  /** Fixtures counted on the takeoff, and how many of them carry a part. */
  takeoffFixtures: number
  takeoffWithProduct: number
  /** Tags on the plans' schedule. */
  scheduleTags: number
  /** Lines picked on Pricing's compare. */
  picks: number
  /** A revision exists: the takeoff door reads "Add", not "Choose". */
  hasRevision: boolean
  /** The bid has a plans link: the robot's offer says so when it does not. */
  hasPlans: boolean
  tasks: ReadonlyArray<SubmittalTaskRow>
  robotSeat: RobotSeatState
  /** The robot's unsure tags the office ticked to keep. */
  lookChecked: Readonly<Record<string, boolean>>
  busy: boolean
  onChooseFromTakeoff: () => void
  /** Absent when the tab has no door to Pricing: the button does not draw. */
  onOpenCompare?: () => void
  onPlugIn: () => void
  onAskRobot: () => void
  onCancelTask: (taskId: string) => void
  onLookChecked: (tag: string, checked: boolean) => void
  /** Confirm these tags into the schedule; the robot's other rows are dropped. */
  onConfirmSchedule: (task: SubmittalTaskRow, tags: string[]) => void
}

export function SubmittalSourcesPanel({ takeoffFixtures, takeoffWithProduct, scheduleTags, picks, hasRevision, hasPlans, tasks, robotSeat, lookChecked, busy, onChooseFromTakeoff, onOpenCompare, onPlugIn, onAskRobot, onCancelTask, onLookChecked, onConfirmSchedule }: SubmittalSourcesPanelProps) {
  return (
    <>
      {/* v2.4107 · three sources, the takeoff first: a bid priced from a takeoff has no picks and often no schedule, yet the takeoff already names every product. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem', maxWidth: 900 }} data-testid="submittal-sources">
        <div style={{ border: `1px solid ${takeoffFixtures > 0 && scheduleTags === 0 && picks === 0 ? '#2563eb' : 'var(--border)'}`, borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="source-takeoff">
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>The takeoff <span style={{ ...smallMuted, fontWeight: 400 }}>· {takeoffFixtures === 0 ? 'none on this bid' : `${takeoffFixtures} fixture${takeoffFixtures === 1 ? '' : 's'}, ${takeoffWithProduct} with a part`}</span></div>
          <span style={smallMuted}>{takeoffFixtures === 0 ? 'Count the fixtures on Takeoffs and they show here.' : 'One row per fixture you tick. The part under it is the product.'}</span>
          <button type="button" disabled={busy || takeoffFixtures === 0} onClick={onChooseFromTakeoff} style={{ ...(takeoffFixtures > 0 && scheduleTags === 0 && picks === 0 ? btnPrimary : btn), alignSelf: 'flex-start', opacity: takeoffFixtures === 0 ? 0.5 : 1 }} title="Tick the fixtures you counted. Each one becomes a row, with its part as the product" data-testid="choose-from-takeoff" data-tour="submittals-takeoff">
            {hasRevision ? 'Add from the takeoff' : 'Choose from the takeoff'}
          </button>
        </div>
        {picks > 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="source-picks">
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Quotes compared <span style={{ ...smallMuted, fontWeight: 400 }}>· {picks} picked line{picks === 1 ? '' : 's'}</span></div>
            <span style={smallMuted}>The house you picked for each line on Pricing, with the reason and lead time you gave.</span>
            {onOpenCompare ? <button type="button" disabled={busy} onClick={onOpenCompare} style={{ ...btn, alignSelf: 'flex-start' }}>Open the compare</button> : null}
          </div>
        ) : null}
        {(() => {
          // v2.4109 · the robot lives in the schedule card: the offer under the typed door, the state while it works, Cancel beside it.
          // v2.4144 · the state row is two lines, not three: the sentence, then the task line with Cancel/Dismiss at its right.
          const t = liveTask(tasks, 'read_schedule')
          const st = t ? taskStatus(t) : null
          const conf = t ? scheduleToConfirm(t) : null
          // 2026-10-03 · a queued ask nobody is coming for says the day it was asked and that no robot is on shift.
          const stale = t && st === 'queued' ? staleAsk('read_schedule', t.requested_at, robotSeat, Date.now(), formatShortDate) : null
          return (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }} data-testid="source-schedule">
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-strong)' }}>The plans’ schedule <span style={{ ...smallMuted, fontWeight: 400 }}>· {scheduleTags === 0 ? 'none yet' : `${scheduleTags} tag${scheduleTags === 1 ? '' : 's'}`}</span></div>
              <span style={smallMuted}>{scheduleTags === 0 ? 'Optional. A tag is the plan’s name for a fixture, like WC-1. With the schedule, the app checks each row against the plans.' : 'Every tag here becomes a row. A row with no pick gets its product typed with Edit.'}</span>
              {t ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', background: stale ? 'var(--bg-amber-tint)' : 'var(--bg-muted)', borderRadius: 6, padding: '0.3rem 0.55rem', fontSize: '0.8rem' }} data-testid="robot-schedule" data-stale={stale ? 'true' : undefined} data-tour="submittals-robot">
                  <span style={{ color: 'var(--text-strong)' }}>
                    {stale ? stale.head : st === 'ready' ? (conf ? 'The robot read the schedule. Confirm the tags below.' : 'The robot read the schedule and found no tags.') : st === 'blocked' ? (t.summary || 'The robot could not read the plans.') : st === 'working' ? 'The robot is reading the fixture schedule off the plans.' : 'The robot is queued to read the fixture schedule off the plans.'}
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'baseline' }}>
                    <span style={{ ...smallMuted, fontStyle: stale ? 'normal' : 'italic' }} data-testid="robot-line">{stale ? stale.detail : describeTask(t)}</span>
                    {st === 'blocked' || st === 'queued' ? (
                      <button type="button" disabled={busy} onClick={() => onCancelTask(t.id)} style={{ ...btnQuiet, textDecoration: 'underline', fontSize: '0.78rem', flexShrink: 0 }}>{st === 'blocked' ? 'Dismiss' : stale ? 'Take the ask back' : 'Cancel'}</button>
                    ) : null}
                  </span>
                </div>
              ) : null}
              <button type="button" disabled={busy} onClick={onPlugIn} style={{ ...((scheduleTags === 0 && takeoffFixtures === 0) || stale ? btnPrimary : btn), alignSelf: 'flex-start' }} title="Type or paste the tags from the plans, one per line" data-testid="plug-in-schedule" data-tour="submittals-plug-in">
                {scheduleTags === 0 ? 'Type or paste the schedule' : 'Add to the schedule'}
              </button>
              {!t && scheduleTags === 0 ? <RobotOffer kind="read_schedule" seat={robotSeat} hasPlans={hasPlans} busy={busy} onAsk={onAskRobot} testId="ask-robot-schedule" tour="submittals-robot" /> : null}
            </div>
          )
        })()}
      </div>
      {(() => {
        // 6b · the schedule read, ready: the tags to confirm, under the cards at full width
        const t = liveTask(tasks, 'read_schedule')
        const conf = t ? scheduleToConfirm(t) : null
        if (!t || !conf) return null
        const n = conf.sure.length + conf.look.length
        return (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', padding: '0.6rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', maxWidth: 900, marginTop: '0.6rem' }} data-testid="robot-schedule-confirm">
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>The robot read {n} tag{n === 1 ? '' : 's'} off the plans <span style={{ ...smallMuted, fontWeight: 400 }}>· confirm them and they join the schedule; the rest are dropped</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.6rem', fontSize: '0.8125rem', alignItems: 'baseline' }}>
              {conf.sure.map((r) => (
                <Fragment key={r.tag}><span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>{r.tag} ✓</span><span>{[r.manufacturer, r.model].filter(Boolean).join(' ') || r.description || r.fixture || '—'}{r.fixture ? <span style={smallMuted}> · {r.fixture}</span> : null}</span></Fragment>
              ))}
              {conf.look.map((r) => (
                <Fragment key={r.tag}>
                  <label style={{ color: 'var(--text-amber-700)', fontWeight: 600, display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <input type="checkbox" aria-label={`Keep ${r.tag}`} checked={!!lookChecked[r.tag]} onChange={(e) => onLookChecked(r.tag, e.target.checked)} /> {r.tag} ?
                  </label>
                  <span>{[r.manufacturer, r.model].filter(Boolean).join(' ') || r.description || r.fixture || '—'}{r.fixture ? <span style={smallMuted}> · {r.fixture}</span> : null}<span style={smallMuted}> · want a look</span></span>
                </Fragment>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" disabled={busy} onClick={() => onConfirmSchedule(t, [...conf.sure.map((r) => r.tag), ...conf.look.filter((r) => lookChecked[r.tag]).map((r) => r.tag)])} style={btnGreen} data-testid="confirm-schedule">
                {confirmLabel(conf.sure.length + conf.look.filter((r) => lookChecked[r.tag]).length, conf.look.filter((r) => !lookChecked[r.tag]).length, 'leave') || 'Confirm'}
              </button>
              <button type="button" disabled={busy} onClick={() => onConfirmSchedule(t, [])} style={{ ...btn, color: 'var(--text-muted)' }}>Discard the robot's rows</button>
              <span style={smallMuted}>Confirmed tags join the schedule; the rest are dropped.</span>
            </div>
          </div>
        )
      })()}
    </>
  )
}
