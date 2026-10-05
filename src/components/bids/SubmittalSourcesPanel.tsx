/**
 * The first step's body (moved out of `BidsSubmittalsTab.tsx`, 2026-10-04, the split's step 5): the
 * three places a row can come from — the takeoff, the quotes compared on Pricing, the plans'
 * schedule — with the robot's read of the schedule in its card and, once read, the tags to confirm
 * under the cards. It draws what it is handed and reports each press; the tab owns every write.
 */
import { Fragment, type CSSProperties } from 'react'
import { confirmLabel, liveTask, scheduleToConfirm, taskStatus, type SubmittalTaskRow } from '../../lib/submittals/robotTasks'
import { staleAsk, type RobotSeatState } from '../../lib/submittals/robotOffer'
import { formatShortDate } from '../../lib/submittals/submittalRevision'
import { RobotNote } from './RobotNote'
import { RobotOffer } from './RobotOffer'
import { robotScheduleNote } from '../../lib/submittals/robotNote'
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

/** One source, one row: the name and its count at a fixed width so the doors line up, then the doors; on a narrow screen the doors wrap under the name. */
const sourceRow = (first: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem 0.75rem', padding: '0.35rem 0', borderTop: first ? 'none' : '1px solid var(--border)', fontSize: '0.8125rem' })
const sourceName: CSSProperties = { flex: '0 1 17rem', minWidth: 0 }
const rowButton: CSSProperties = { padding: '0.25rem 0.7rem', fontSize: '0.78rem' }

export function SubmittalSourcesPanel({ takeoffFixtures, takeoffWithProduct, scheduleTags, picks, hasRevision, hasPlans, tasks, robotSeat, lookChecked, busy, onChooseFromTakeoff, onOpenCompare, onPlugIn, onAskRobot, onCancelTask, onLookChecked, onConfirmSchedule }: SubmittalSourcesPanelProps) {
  return (
    <>
      {/* v2.4107 · three sources, the takeoff first: a bid priced from a takeoff has no picks and often no schedule, yet the takeoff already names every product.
          2026-10-05 · each source is one row — its name and count, then its door — where a card of three lines stood. The sentences the cards carried are the hover line on each name; the walkthrough and the guide teach them. */}
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 900 }} data-testid="submittal-sources">
        <div style={sourceRow(true)} data-testid="source-takeoff">
          <span style={sourceName} title={takeoffFixtures === 0 ? 'Count the fixtures on Takeoffs and they show here.' : 'One row per fixture you tick. The part under it is the product.'}>
            <b style={{ fontWeight: 600, color: 'var(--text-strong)' }}>The takeoff</b> <span style={smallMuted}>· {takeoffFixtures === 0 ? 'none on this bid' : `${takeoffFixtures} fixture${takeoffFixtures === 1 ? '' : 's'}, ${takeoffWithProduct} with a part`}</span>
          </span>
          <button type="button" disabled={busy || takeoffFixtures === 0} onClick={onChooseFromTakeoff} style={{ ...(takeoffFixtures > 0 && scheduleTags === 0 && picks === 0 ? btnPrimary : btn), ...rowButton, opacity: takeoffFixtures === 0 ? 0.5 : 1 }} title="Tick the fixtures you counted. Each one becomes a row, with its part as the product" data-testid="choose-from-takeoff" data-tour="submittals-takeoff">
            {hasRevision ? 'Add from the takeoff' : 'Choose from the takeoff'}
          </button>
        </div>
        {picks > 0 ? (
          <div style={sourceRow(false)} data-testid="source-picks">
            <span style={sourceName} title="The house you picked for each line on Pricing, with the reason and lead time you gave.">
              <b style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Quotes compared</b> <span style={smallMuted}>· {picks} picked line{picks === 1 ? '' : 's'}</span>
            </span>
            {onOpenCompare ? <button type="button" disabled={busy} onClick={onOpenCompare} style={{ ...btn, ...rowButton }}>Open the compare</button> : null}
          </div>
        ) : null}
        {(() => {
          // v2.4109 · the robot lives on the schedule's row, after the typed door: the offer, or the state of what was asked.
          const t = liveTask(tasks, 'read_schedule')
          const st = t ? taskStatus(t) : null
          // 2026-10-03 · a queued ask nobody is coming for says the day it was asked and that no robot is on shift.
          const stale = t && st === 'queued' ? staleAsk('read_schedule', t.requested_at, robotSeat, Date.now(), formatShortDate) : null
          return (
            <div style={sourceRow(false)} data-testid="source-schedule">
              <span style={sourceName} title={scheduleTags === 0 ? 'Optional. A tag is the plan’s name for a fixture, like WC-1. With the schedule, the app checks each row against the plans.' : 'Every tag here becomes a row. A row with no pick gets its product typed with Edit.'}>
                <b style={{ fontWeight: 600, color: 'var(--text-strong)' }}>The plans’ schedule</b> <span style={smallMuted}>· {scheduleTags === 0 ? 'none yet' : `${scheduleTags} tag${scheduleTags === 1 ? '' : 's'}`}</span>
              </span>
              <button type="button" disabled={busy} onClick={onPlugIn} style={{ ...((scheduleTags === 0 && takeoffFixtures === 0) || stale ? btnPrimary : btn), ...rowButton }} title="Type or paste the tags from the plans, one per line" data-testid="plug-in-schedule" data-tour="submittals-plug-in">
                {scheduleTags === 0 ? 'Type or paste the schedule' : 'Add to the schedule'}
              </button>
              {/* The header's old door to Pricing: with a schedule and nothing picked yet, the compare is where each tag gets its product. */}
              {scheduleTags > 0 && picks === 0 && onOpenCompare ? <button type="button" disabled={busy} onClick={onOpenCompare} style={{ ...btnQuiet, textDecoration: 'underline', fontSize: '0.78rem' }} data-testid="open-compare-from-schedule">Pick the products on Pricing</button> : null}
              {/* The robot is one small line beside the human door: its state in a chip, the one thing to press, the story on hover. */}
              {t ? (
                <RobotNote note={robotScheduleNote(t, robotSeat, Date.now(), formatShortDate)} busy={busy} onPress={() => onCancelTask(t.id)} testId="robot-schedule" buttonTestId="robot-schedule-button" lineTestId="robot-line" tour="submittals-robot" stale={Boolean(stale)} />
              ) : scheduleTags === 0 ? (
                <RobotOffer kind="read_schedule" seat={robotSeat} hasPlans={hasPlans} busy={busy} onAsk={onAskRobot} testId="ask-robot-schedule" tour="submittals-robot" />
              ) : null}
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
