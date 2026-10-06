import { useCallback, useMemo, useState, type CSSProperties, type Dispatch, type ReactNode } from 'react'
import {
  GC_COMPANY,
  activityName,
  addDays,
  daysBetween,
  inspectedTrades,
  rfiRows,
  LOOKAHEAD_WEEKS,
  markReason,
  MILESTONE_GRACE_DAYS,
  mondayOf,
  onSiteWords,
  partnerById,
  pushAfter,
  pushedAfterWords,
  RELIABILITY_WEEKS,
  scheduleMeasures,
  scheduleSummary,
  scheduleSummaryWords,
  shortDate,
  startsToPromise,
  substantialCompletionOn,
  submittalHolding,
  submittalNeededBy,
  tradePromisesOf,
  verifyList,
  weekdayDate,
  type GcAction,
  type GcProject,
  type GcState,
  type LookAheadReason,
  type LookAheadState,
  type ProjectedFinish,
  type ScheduleActivity,
  type ScheduleItem,
  type ScheduleMilestone,
  type ScheduleRow,
} from '../../lib/gcMode/gcModel'
import type { GcPaneProps } from './GcOfficeTabs'
import { Btn, Card, Chip, Why, input, type Tone } from './gcUi'
import { GcBuildingPromise } from './GcBuildingPromise'
import { GcGantt } from './GcGantt'
import { GcMoveExplain, GcMoveHistory, type PendingMove } from './GcScheduleMoves'
import { GcScheduleWalk, GcWalkLine } from './GcScheduleWalk'
import { walkStanding } from '../../lib/gcMode/gcScheduleWalk'
import { planMove, whatIfSlips, type MoveLimits } from '../../lib/gcMode/gcScheduleMoves'
import type { GanttHold } from '../../lib/gcMode/gcGantt'
import { changeOrderMove, changeOrdersOnChart, changeOrderTails, type ChangeOrderOnChart } from '../../lib/gcMode/gcChangeOrderDays'
import { WAIT_KINDS, waitHolds, waitKind, waitRows, waitWhoDefault, type WaitRow } from '../../lib/gcMode/gcScheduleWaits'
import { daysLostByCause, lostDaysByLine } from '../../lib/gcMode/gcDaysLost'
import { ADDED_WHO, addedActivityProblem } from '../../lib/gcMode/gcAddedActivity'
import { actualProblem, actualWords } from '../../lib/gcMode/gcActualDates'
import { baselineDue, baselineHistory, baselineWords, nextBaselineName } from '../../lib/gcMode/gcBaseline'
import { customerScheduleHtml, customerScheduleLetter, scheduleSends } from '../../lib/gcMode/gcCustomerScheduleSend'
import { customerDoneWords, customerSchedulePicture, customerStanding } from '../../lib/gcMode/gcCustomerSchedule'
import type { GanttPrintJob } from '../../lib/gcMode/gcGanttPrint'
import { useAuth } from '../../hooks/useAuth'
import type { WaitKind } from '../../lib/gcMode/gcTypes'

/**
 * GC mode design spike: the schedule (Building lane, owner's shape 2026-10-02). Each activity is a
 * line of a trade's statement of work, or a stage our own crew runs. We draw it while buying out
 * (a first draft, then each activity's dates and what it waits on, and the milestones); Start
 * locks it as the baseline. Once building: four measures on top, the chart, the look-ahead. An
 * inspection is an activity of its own (owner, 2026-10-03): the city's, with no dollars.
 */

/** The signed-in person's name. Outside the app's sign-in (a test), none. */
function useMeName(): string | null {
  try {
    return useAuth().profileName
  } catch {
    return null
  }
}

/** A box at the height of the button beside it (the owner, 2026-10-04): a date input runs taller on its own. */
const rowBox = { ...input, height: 30, boxSizing: 'border-box', padding: '0 0.45rem' } as const

export function GcBuildingScheduleTab({ state, project, dispatch }: GcPaneProps) {
  const me = useMeName() ?? 'The office'
  const m = useMemo(() => scheduleMeasures(state, project), [state, project])
  const [picked, setPicked] = useState<string | null>(null)
  const holds = useMemo(() => holdsOf(state, project), [state, project])
  // Days a signed change order adds that are not on the dates yet, drawn as tails (G-76).
  const tails = useMemo(() => changeOrderTails(project, state.today), [project, state.today])
  // What the work waits on from outside the trades (G-73 to G-75): rows on the chart, and the card.
  const waits = useMemo(() => waitRows(state, project), [state, project])
  // Days the daily log says were lost to the weather, by bar (G-58).
  const lost = useMemo(() => lostDaysByLine(project), [project])
  // Every move goes through the explanation window first (the owner, 2026-10-05; the Gantt, Phase 2).
  const [pending, setPending] = useState<PendingMove | null>(null)
  // The weekly walk (the owner, 2026-10-05): every bar that should have moved, one at a time.
  const [walking, setWalking] = useState(false)
  const planOf = useCallback(
    (lineId: string, start: string, finish: string) => {
      const plan = planMove(project, lineId, start, finish)
      return plan && !plan.problem ? { pushed: plan.pushed.map((p) => ({ lineId: p.lineId, start: p.to.start, finish: p.to.finish })), words: plan.words } : null
    },
    [project],
  )
  // Print or PDF on the chart (G-21): the job's words, and the customer's picture as their portal reads it.
  const printJob = useMemo<GanttPrintJob | null>(
    () =>
      m.finish
        ? {
            name: project.name,
            place: project.address,
            company: GC_COMPANY.name,
            by: me,
            finishWords: finishSentence(m.finish, m.contract),
            doneWords: project.stage === 'building' ? customerDoneWords(customerStanding(state, project)) : null,
            customer: customerSchedulePicture(state, project),
          }
        : null,
    [state, project, m, me],
  )
  const schedule = project.schedule
  const building = project.stage === 'building'

  if (!schedule || m.rows.length === 0) {
    return (
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <ScheduleWhy />
        <DraftCard project={project} today={state.today} dispatch={dispatch} />
      </div>
    )
  }

  const pickedRow = m.items.find((r) => r.activity.lineId === picked) ?? null
  const pickedInspection = pickedRow?.activity.inspection

  return (
    <div style={{ display: 'grid', gap: '0.9rem' }}>
      <ScheduleWhy />

      {building ? (
        <Measures m={m} />
      ) : (
        <Card>
          <strong>Drawing the schedule.</strong>{' '}
          <span style={{ color: 'var(--text-muted)' }}>
            Pick an activity to change its dates and what it waits on. Start locks this plan as the baseline. The measures read
            against it from then on.
          </span>
        </Card>
      )}

      {pickedRow && (
        <ActivityEditor
          key={pickedRow.activity.lineId}
          project={project}
          row={pickedRow}
          rows={m.items}
          started={Boolean(project.startedOn)}
          onSave={(start, finish, after, limits) => setPending({ lineId: pickedRow.activity.lineId, start, finish, after, limits })}
          today={state.today}
          onActual={(actualStart, actualFinish) => dispatch({ type: 'setActualDates', projectId: project.id, lineId: pickedRow.activity.lineId, actualStart, actualFinish, by: me })}
          extra={
            pickedRow.activity.added ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: 'var(--text-muted)' }}>{pickedRow.activity.added.who}. Nobody reports it: mark it here.</span>
                {pickedRow.activity.added.doneOn ? (
                  <Btn kind="plain" onClick={() => dispatch({ type: 'setAddedActivityDone', projectId: project.id, lineId: pickedRow.activity.lineId, on: null })}>
                    Not done after all
                  </Btn>
                ) : (
                  <Btn kind="primary" onClick={() => dispatch({ type: 'setAddedActivityDone', projectId: project.id, lineId: pickedRow.activity.lineId, on: state.today })}>
                    Mark it done today
                  </Btn>
                )}
                <Btn
                  kind="quiet"
                  onClick={() => {
                    dispatch({ type: 'removeScheduleActivity', projectId: project.id, lineId: pickedRow.activity.lineId })
                    setPicked(null)
                  }}
                >
                  Take it off the schedule
                </Btn>
              </div>
            ) : undefined
          }
          check={
            building && pickedInspection && !pickedInspection.passedOn ? (
              <InspectionCheck project={project} activity={pickedRow.activity} today={state.today} dispatch={dispatch} hint="Our superintendent records it. A pass meets the milestone with the same name." />
            ) : undefined
          }
          onClose={() => setPicked(null)}
        />
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {building && <GcWalkLine state={state} project={project} holds={holds} onWalk={() => setWalking(true)} />}
        <GcGantt
          holds={holds}
          tails={tails}
          waits={waits}
          lost={lost}
          {...(printJob ? { print: printJob } : {})}
          items={m.items}
          float={m.float}
          milestones={m.milestones}
          today={state.today}
          building={building}
          picked={picked}
          onPick={setPicked}
          onMove={(lineId, start, finish) => setPending({ lineId, start, finish, after: schedule.activities.find((a) => a.lineId === lineId)?.after ?? [] })}
          planOf={planOf}
          onLink={(from, to) => {
            const a = schedule.activities.find((x) => x.lineId === to)
            if (a && !a.after.includes(from)) setPending({ lineId: to, start: a.start, finish: a.finish, after: [...a.after, from] })
          }}
          onUnlink={(from, to) => {
            const a = schedule.activities.find((x) => x.lineId === to)
            if (a) setPending({ lineId: to, start: a.start, finish: a.finish, after: a.after.filter((id) => id !== from) })
          }}
        />
      </Card>

      {walking && <GcScheduleWalk state={state} project={project} holds={holds} dispatch={dispatch} onClose={() => setWalking(false)} />}

      {pending && <GcMoveExplain key={`${pending.lineId}:${pending.start}:${pending.finish}`} project={project} pending={pending} dispatch={dispatch} onClose={() => setPending(null)} />}

      <GcMoveHistory state={state} project={project} dispatch={dispatch} />

      {building && <DaysLostCard project={project} />}

      <ChangeOrderDaysCard
        project={project}
        today={state.today}
        onPut={(r) => {
          const move = changeOrderMove(project, r.co, state.today)
          if (move) setPending(move)
        }}
      />

      <WaitsCard state={state} project={project} rows={waits} items={m.items} dispatch={dispatch} />

      <AddActivityCard project={project} items={m.items} today={state.today} by={me} dispatch={dispatch} />

      <MilestonesCard project={project} milestones={schedule.milestones} dispatch={dispatch} />

      {schedule.baseline && <BaselineCard project={project} today={state.today} by={me} dispatch={dispatch} />}

      {building && <ScheduleSendCard state={state} project={project} by={me} dispatch={dispatch} />}

      {building && <VerifyCard project={project} rows={m.rows} today={state.today} dispatch={dispatch} />}

      {building && <StartsCard state={state} project={project} dispatch={dispatch} />}

      {building && <LookAhead weeks={m.lookAhead} />}
    </div>
  )
}

function ScheduleWhy() {
  return (
    <Why>
      Each activity is a line of a trade's statement of work, or a stage our own crew runs. We draw the dates and what each
      waits on while buying out. Start locks it as the baseline, the plan we measure against. Spare days are how long an
      activity can slip before the job finishes later. No spare days is the critical path. An inspection is an activity of its
      own. It belongs to the job and has no dollars. It counts on the critical path, not in work done.
    </Why>
  )
}

// ---------------------------------------------------------------------------------------------
// Drawing: the first draft, an activity, the milestones
// ---------------------------------------------------------------------------------------------

/** Nothing drawn yet: a start day and a first draft to draw from. */
function DraftCard({ project, today, dispatch }: { project: GcProject; today: string; dispatch: Dispatch<GcAction> }) {
  const [start, setStart] = useState(project.startDate ?? addDays(mondayOf(today), 7))
  return (
    <Card>
      <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
        <div>
          <strong>No schedule is drawn yet.</strong> Start from a first draft: every line of every trade, the trades in build order,
          each line after the one before it. Then change what is wrong.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Work starts</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={rowBox} />
          </label>
          <Btn kind="primary" disabled={!start} onClick={() => dispatch({ type: 'draftSchedule', projectId: project.id, start })}>
            Draw a first draft
          </Btn>
        </div>
      </div>
    </Card>
  )
}

/**
 * One activity: its dates and what it waits on. After Start, the plan at Start stays the baseline.
 * An inspection on a job being built also takes its pass, recorded today.
 */
function ActivityEditor({
  project,
  row,
  rows,
  started,
  onSave,
  check,
  extra,
  today,
  onActual,
  onClose,
}: {
  project: GcProject
  row: ScheduleItem
  rows: ScheduleItem[]
  started: boolean
  onSave: (start: string, finish: string, after: string[], limits: MoveLimits) => void
  /** An inspection not passed yet, on a job being built: passed or failed, today. */
  check?: ReactNode
  /** An added activity's own buttons (G-38): done, not done, off the schedule. */
  extra?: ReactNode
  today: string
  /** The real start and finish, recorded (G-55). Null clears one. */
  onActual: (actualStart: string | null, actualFinish: string | null) => void
  onClose: () => void
}) {
  const a = row.activity
  const [start, setStart] = useState(a.start)
  const [finish, setFinish] = useState(a.finish)
  const [after, setAfter] = useState<string[]>(a.after)
  // The gap after each wait, and the two day limits (G-35, G-36).
  const [lag, setLag] = useState<Record<string, number>>(a.lag ?? {})
  const [notBefore, setNotBefore] = useState(a.notBefore ?? '')
  const [mustFinishBy, setMustFinishBy] = useState(a.mustFinishBy ?? '')
  // The days it really ran (G-55), kept beside the planned ones.
  const [actualStart, setActualStart] = useState(a.actualStart ?? '')
  const [actualFinish, setActualFinish] = useState(a.actualFinish ?? '')
  const actualChanged = (actualStart || undefined) !== a.actualStart || (actualFinish || undefined) !== a.actualFinish
  const actualBad = actualProblem(actualStart || undefined, actualFinish || undefined, today)
  const limits: MoveLimits = { lag, notBefore: notBefore || null, mustFinishBy: mustFinishBy || null }
  const limitsChanged = JSON.stringify(Object.fromEntries(Object.entries(lag).filter(([id, d]) => after.includes(id) && d > 0))) !== JSON.stringify(a.lag ?? {}) || (notBefore || undefined) !== a.notBefore || (mustFinishBy || undefined) !== a.mustFinishBy
  const bad = !start || !finish || finish < start || (notBefore !== '' && start < notBefore)
  const changed = start !== a.start || finish !== a.finish || after.join() !== a.after.join() || limitsChanged
  const others = rows.filter((r) => r.activity.lineId !== a.lineId)
  const trades = [...new Set(others.map((r) => r.pkg?.id ?? ''))]
  // What it waits on, finishing after it starts: it cannot start on the day drawn.
  const late = others.filter((r) => after.includes(r.activity.lineId) && r.activity.finish >= start)
  // What comes after it moves out with it on Save (owner, 2026-10-04).
  const moves = bad
    ? ''
    : pushedAfterWords(
        pushAfter(
          project,
          (project.schedule?.activities ?? []).map((x) => (x.lineId === a.lineId ? { ...x, start, finish, after } : x)),
          a.lineId,
        ).moved,
      )
  return (
    <Card style={{ border: '2px solid #2563eb' }}>
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.875rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
          <strong>
            {activityName(row)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {row.company}</span>
          </strong>
          <Btn kind="quiet" onClick={onClose}>
            Close
          </Btn>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Starts</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} />
          </label>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Finishes</span>
            <input type="date" value={finish} min={start} onChange={(e) => setFinish(e.target.value)} style={input} />
          </label>
          {!bad && <span style={{ color: 'var(--text-muted)' }}>{daysBetween(start, finish) + 1} days</span>}
          {bad && <span style={{ color: 'var(--text-red-700)' }}>{notBefore !== '' && start < notBefore ? `It cannot start before ${weekdayDate(notBefore)}.` : 'It has to finish on or after it starts.'}</span>}
        </div>
        {/* The day it cannot start before (a delivery, a permit) and the day it must finish by (G-36). */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Not before</span>
            <input type="date" value={notBefore} onChange={(e) => setNotBefore(e.target.value)} aria-label="The day it cannot start before" style={input} />
          </label>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Must finish by</span>
            <input type="date" value={mustFinishBy} onChange={(e) => setMustFinishBy(e.target.value)} aria-label="The day it must finish by" style={input} />
          </label>
          {mustFinishBy && finish > mustFinishBy && <span style={{ color: 'var(--text-amber-800)' }}>It finishes {daysBetween(mustFinishBy, finish)} days past that.</span>}
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>It waits on</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '0.15rem 0.75rem' }}>
            {trades.map((pkgId) =>
              others
                .filter((r) => (r.pkg?.id ?? '') === pkgId)
                .map((r) => (
                  <label key={r.activity.lineId} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={after.includes(r.activity.lineId)}
                      onChange={(e) => setAfter((list) => (e.target.checked ? [...list, r.activity.lineId] : list.filter((id) => id !== r.activity.lineId)))}
                    />
                    <span>
                      {activityName(r)} <span style={{ color: 'var(--text-muted)' }}>· ends {shortDate(r.activity.finish)}</span>
                    </span>
                    {/* A gap after it finishes: cure time, a lead time (G-35). */}
                    {after.includes(r.activity.lineId) && (
                      <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        +
                        <input type="number" min={0} value={lag[r.activity.lineId] ?? 0} onChange={(e) => setLag((was) => ({ ...was, [r.activity.lineId]: Math.max(0, Number(e.target.value) || 0) }))} aria-label={`Days of gap after ${activityName(r)}`} style={{ ...input, width: '3.4rem', height: 24, padding: '0 0.3rem' }} />
                        days
                      </span>
                    )}
                  </label>
                )),
            )}
          </div>
        </div>
        {late.length > 0 && (
          <div style={{ color: 'var(--text-amber-800)' }}>
            {late.map(activityName).join(', ')} {late.length === 1 ? 'finishes' : 'finish'} on or after this starts. The
            spare days count it starting the day after.
          </div>
        )}
        {changed && moves && <div style={{ color: 'var(--text-amber-800)' }}>On Save: {moves}</div>}
        {/* What a slip would cost, before anyone asks (the Gantt, G-80). */}
        {!changed && row.actual < 100 && (
          <div style={{ display: 'grid', gap: '0.1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {[5, 10].map((days) => {
              const words = whatIfSlips(project, a.lineId, days)
              return words ? <span key={days}>{words}</span> : null
            })}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn kind="primary" disabled={bad || !changed} onClick={() => onSave(start, finish, after, limits)}>
            Save, and say why
          </Btn>
          {started && <span style={{ color: 'var(--text-muted)' }}>The plan at Start stays as the baseline this is measured against.</span>}
        </div>
        {row.activity.inspection?.passedOn && (
          <div style={{ color: 'var(--text-green-800)' }}>It passed {shortDate(row.activity.inspection.passedOn)}.</div>
        )}
        {(row.activity.inspection?.failed ?? []).length > 0 && (
          <div style={{ display: 'grid', gap: '0.15rem', color: 'var(--text-muted)' }}>
            {(row.activity.inspection?.failed ?? []).map((f) => (
              <span key={f.on + f.reinspectOn}>
                Failed {shortDate(f.on)}: {f.note} Re-inspection {shortDate(f.reinspectOn)}.
              </span>
            ))}
          </div>
        )}
        {!a.inspection && (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Really</span>
            <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>started</span>
              <input type="date" value={actualStart} max={today} onChange={(e) => setActualStart(e.target.value)} aria-label="The day it really started" style={input} />
            </label>
            <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>finished</span>
              <input type="date" value={actualFinish} min={actualStart || undefined} max={today} onChange={(e) => setActualFinish(e.target.value)} aria-label="The day it really finished" style={input} />
            </label>
            {actualChanged && (
              <Btn kind="plain" disabled={actualBad !== null} title={actualBad ?? undefined} onClick={() => onActual(actualStart || null, actualFinish || null)}>
                Keep the real days
              </Btn>
            )}
            <span style={{ color: actualBad && actualChanged ? 'var(--text-red-700)' : 'var(--text-muted)', fontSize: '0.82rem' }}>{actualChanged && actualBad ? actualBad : (actualWords(a) ?? 'Not recorded. The walk asks when it started and finished.')}</span>
          </div>
        )}
        {extra && <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>{extra}</div>}
        {check && <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>{check}</div>}
      </div>
    </Card>
  )
}

/**
 * The customer's schedule on its own (the Gantt, G-94): the letter as it would go today, the same
 * picture as their portal, sent and kept as sent, or printed to a PDF. Nothing leaves the app in the prototype.
 */
function ScheduleSendCard({ state, project, by, dispatch }: { state: GcState; project: GcProject; by: string; dispatch: Dispatch<GcAction> }) {
  const [open, setOpen] = useState(false)
  const letter = customerScheduleLetter(state, project, by)
  const sends = scheduleSends(project)
  const print = () => {
    const w = window.open('', '_blank', 'width=760,height=900')
    if (!w) return
    w.document.write(customerScheduleHtml(letter))
    w.document.close()
    w.focus()
    w.print()
  }
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <strong>Send {project.owner} their schedule</strong>
        {sends.length > 0 && <Chip tone="grey">{sends.length === 1 ? 'sent once' : `sent ${sends.length} times`}</Chip>}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flex: '1 1 16rem' }}>The same picture as their portal, as a dated letter: the finish, the stages, what changed, what we need from them. Kept as it went.</span>
        <Btn kind="plain" onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide the letter' : 'Read the letter'}
        </Btn>
        <Btn kind="plain" onClick={print} title="Opens it as a page to print or save as a PDF.">
          Print or PDF
        </Btn>
        <Btn kind="primary" onClick={() => dispatch({ type: 'sendCustomerSchedule', projectId: project.id, by })} title="Kept on the job as sent, dated. In the prototype nothing leaves the app.">
          Send to {letter.to.split(',')[0]}
        </Btn>
      </div>
      {open && (
        <article style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: sends.length > 0 ? '0.6rem' : 0 }}>
          <div style={{ padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.82rem', display: 'grid', gap: '0.1rem', background: 'var(--bg-subtle)' }}>
            <span>
              <span style={{ color: 'var(--text-muted)' }}>To </span>
              {letter.to}
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, marginTop: '0.2rem' }}>{letter.subject}</span>
          </div>
          <div style={{ padding: '0.7rem 0.75rem', display: 'grid', gap: '0.4rem', lineHeight: 1.45, fontSize: '0.875rem' }}>
            {letter.lines.map((line, i) => (
              <div key={`${i}:${line}`}>{line}</div>
            ))}
          </div>
        </article>
      )}
      {sends.length > 0 && (
        <div style={{ display: 'grid', gap: '0.15rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {sends.map((s) => (
            <div key={s.id}>
              {weekdayDate(s.on)} · {s.by} sent {s.to} “{s.subject}”, {s.lines.length} lines.
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

/**
 * The baseline (the Gantt, G-41): the plan every measure reads against, locked at Start. After a
 * signed change order's days go on the schedule, a new one takes the plan as it stands; the old
 * ones are kept and named. Anyone on our team may set one, like a move (the owner's call 9 is open).
 */
function BaselineCard({ project, today, by, dispatch }: { project: GcProject; today: string; by: string; dispatch: Dispatch<GcAction> }) {
  const schedule = project.schedule
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [why, setWhy] = useState('')
  if (!schedule?.baseline) return null
  const history = baselineHistory(schedule)
  const due = baselineDue(project, today)
  const offered = nextBaselineName(project, today)
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <strong>The baseline</strong>
        {due && <Chip tone="amber">a new one is due</Chip>}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flex: '1 1 16rem' }}>The plan every measure reads against: work done against plan, spare days, where a bar sat. A signed change order's days call for a new one; the old ones are kept.</span>
        {!open && (
          <Btn
            kind={due ? 'primary' : 'plain'}
            onClick={() => {
              setName(offered)
              setWhy(due ? '' : '')
              setOpen(true)
            }}
          >
            Set a new baseline
          </Btn>
        )}
      </div>
      {due && <div style={{ color: 'var(--text-amber-800)', fontSize: '0.875rem', marginBottom: '0.4rem' }}>{due}</div>}
      <div style={{ display: 'grid', gap: '0.15rem', fontSize: '0.875rem' }}>
        {history.map((b, i) => (
          <div key={`${b.lockedOn}:${b.name ?? ''}`} style={{ color: i === history.length - 1 ? 'var(--text-base)' : 'var(--text-muted)' }}>
            {i === history.length - 1 ? <strong>Now: </strong> : 'Before: '}
            {baselineWords(b)}
          </div>
        ))}
      </div>
      {open && (
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.6rem', fontSize: '0.875rem' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="After change order 2" aria-label="The new baseline's name" style={{ ...rowBox, width: '14rem' }} />
          <input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why, in a few words" aria-label="Why a new baseline" style={{ ...rowBox, width: '18rem' }} />
          <Btn
            kind="primary"
            disabled={!name.trim()}
            onClick={() => {
              dispatch({ type: 'setScheduleBaseline', projectId: project.id, name, why, by })
              setOpen(false)
            }}
          >
            Take the plan as it stands
          </Btn>
          <Btn kind="quiet" onClick={() => setOpen(false)}>
            Cancel
          </Btn>
        </div>
      )}
    </Card>
  )
}

/**
 * An activity that is no trade's line (the Gantt, G-38): mobilize, cure time, the customer's own
 * work. Named, given to someone, dated, and tied in: what it waits on and what waits on it.
 */
function AddActivityCard({ project, items, today, by, dispatch }: { project: GcProject; items: ScheduleItem[]; today: string; by: string; dispatch: Dispatch<GcAction> }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [whoPick, setWhoPick] = useState<(typeof ADDED_WHO)[number]>('Cure time')
  const [whoText, setWhoText] = useState('')
  const [start, setStart] = useState(today)
  const [finish, setFinish] = useState(today)
  const [after, setAfter] = useState<string[]>([])
  const [holdsUp, setHoldsUp] = useState<string[]>([])
  const who = whoPick === 'Someone else' ? whoText : whoPick
  const problem = addedActivityProblem(label, who, start, finish)
  const candidates = items.filter((r) => r.actual < 100)
  const reset = () => {
    setOpen(false)
    setLabel('')
    setWhoText('')
    setAfter([])
    setHoldsUp([])
  }
  if (!open) {
    return (
      <Card>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong>Something that is no trade's line</strong>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flex: '1 1 16rem' }}>Mobilize, cure time, the customer's own work: a bar of its own, with what it waits on and what waits on it. No dollars; the office marks it done.</span>
          <Btn onClick={() => setOpen(true)}>Add an activity</Btn>
        </div>
      </Card>
    )
  }
  const pick = (list: string[], set: (next: string[]) => void, id: string, on: boolean) => set(on ? [...list, id] : list.filter((x) => x !== id))
  const list = (title: string, chosen: string[], set: (next: string[]) => void, skip: string[]) => (
    <div>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '0.15rem 0.75rem' }}>
        {candidates
          .filter((r) => !skip.includes(r.activity.lineId))
          .map((r) => (
            <label key={r.activity.lineId} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
              <input type="checkbox" checked={chosen.includes(r.activity.lineId)} onChange={(e) => pick(chosen, set, r.activity.lineId, e.target.checked)} />
              <span>
                {activityName(r)} <span style={{ color: 'var(--text-muted)' }}>· {shortDate(r.activity.start)} to {shortDate(r.activity.finish)}</span>
              </span>
            </label>
          ))}
      </div>
    </div>
  )
  return (
    <Card style={{ border: '2px solid #2563eb' }}>
      <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.875rem' }}>
        <strong>An activity that is no trade's line</strong>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Slab cure" aria-label="What it is" style={{ ...rowBox, width: '16rem' }} />
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Whose</span>
            <select value={whoPick} onChange={(e) => setWhoPick(e.target.value as (typeof ADDED_WHO)[number])} aria-label="Whose it is" style={rowBox}>
              {ADDED_WHO.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          {whoPick === 'Someone else' && <input value={whoText} onChange={(e) => setWhoText(e.target.value)} placeholder="Who" aria-label="Who it is" style={{ ...rowBox, width: '12rem' }} />}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Starts</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="The day it starts" style={rowBox} />
          </label>
          <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-muted)' }}>Finishes</span>
            <input type="date" value={finish} min={start} onChange={(e) => setFinish(e.target.value)} aria-label="The day it finishes" style={rowBox} />
          </label>
          {start && finish && finish >= start && <span style={{ color: 'var(--text-muted)' }}>{daysBetween(start, finish) + 1} days</span>}
        </div>
        {list('It waits on', after, setAfter, holdsUp)}
        {list('It holds up', holdsUp, setHoldsUp, after)}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Btn
            kind="primary"
            disabled={problem !== null}
            title={problem ?? undefined}
            onClick={() => {
              dispatch({ type: 'addScheduleActivity', projectId: project.id, label, who, start, finish, after, holdsUp, by })
              reset()
            }}
          >
            Put it on the schedule
          </Btn>
          <Btn kind="quiet" onClick={reset}>
            Cancel
          </Btn>
          {problem && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{problem}</span>}
          {holdsUp.length > 0 && <span style={{ color: 'var(--text-amber-800)', fontSize: '0.82rem' }}>What waits on it moves out if it has to.</span>}
        </div>
      </div>
    </Card>
  )
}

/** Days lost by cause (the Gantt, G-96): the moves' reasons added up, the customer's, the weather's, a trade's, ours, for a time extension ask. */
function DaysLostCard({ project }: { project: GcProject }) {
  const lost = daysLostByCause(project)
  if (lost.moves === 0 && lost.logWeatherDays === 0) return null
  const n = (d: number) => `${Math.abs(d)} ${Math.abs(d) === 1 ? 'day' : 'days'}${d < 0 ? ' back' : ''}`
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <strong>Days lost, by cause</strong>
        {lost.finishDays > 0 && <Chip tone="red">finish {n(lost.finishDays)} later</Chip>}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Every standing move's reason, laid at a door. The numbers a time extension ask is written from.</span>
      </div>
      <div style={{ fontSize: '0.875rem', marginBottom: lost.rows.length > 0 ? '0.5rem' : 0 }}>{lost.words}</div>
      {lost.rows.length > 0 && (
        <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
              <th style={{ padding: '0.2rem 1rem 0.2rem 0', fontWeight: 500 }}>Whose</th>
              <th style={{ padding: '0.2rem 1rem 0.2rem 0', fontWeight: 500, textAlign: 'right' }}>On the finish</th>
              <th style={{ padding: '0.2rem 1rem 0.2rem 0', fontWeight: 500, textAlign: 'right' }}>On the work</th>
              <th style={{ padding: '0.2rem 1rem 0.2rem 0', fontWeight: 500, textAlign: 'right' }}>Moves</th>
              <th style={{ padding: '0.2rem 0', fontWeight: 500 }}>Given as</th>
            </tr>
          </thead>
          <tbody>
            {lost.rows.map((r) => (
              <tr key={r.cause} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '0.25rem 1rem 0.25rem 0', textTransform: 'capitalize' }}>{r.label}</td>
                <td style={{ padding: '0.25rem 1rem 0.25rem 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.finishDays > 0 ? 'var(--text-red-700)' : undefined }}>{r.finishDays === 0 ? '—' : n(r.finishDays)}</td>
                <td style={{ padding: '0.25rem 1rem 0.25rem 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.workDays === 0 ? '—' : n(r.workDays)}</td>
                <td style={{ padding: '0.25rem 1rem 0.25rem 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.moves}</td>
                <td style={{ padding: '0.25rem 0', color: 'var(--text-muted)' }}>{r.reasons.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

/**
 * Days from signed change orders (the Gantt, G-76): where each order's days land and whether they
 * are on the schedule yet. The contract's finish moves by itself; the bar moves when someone puts
 * the days on it, as a move like any other, so the trades are told and the customer reads why.
 */
function ChangeOrderDaysCard({ project, today, onPut }: { project: GcProject; today: string; onPut: (row: ChangeOrderOnChart) => void }) {
  const rows = changeOrdersOnChart(project, today)
  if (rows.length === 0) return null
  const waiting = rows.filter((r) => r.lineId && !r.landed).length
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <strong>Days from change orders ({rows.length})</strong>
        {waiting > 0 && <Chip tone="violet">{waiting} not on the dates yet</Chip>}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>A signed change order moves the contract's finish by itself. Its days go on the bar its work is on when you put them there, as a move the trades are told of.</span>
      </div>
      <div style={{ display: 'grid' }}>
        {rows.map((r) => (
          <div key={r.co.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.45rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }}>
            <span style={{ flex: '1 1 18rem' }}>{r.words}</span>
            {r.landed ? (
              <Chip tone="green">on the schedule</Chip>
            ) : r.lineId ? (
              <Btn kind="primary" onClick={() => onPut(r)} title="Opens Why it moved with the change order as the reason. The finish of that bar moves out by its days.">
                Put its {r.days} {r.days === 1 ? 'day' : 'days'} on the schedule
              </Btn>
            ) : (
              <Chip tone="grey">contract only</Chip>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/**
 * What the work waits on from outside the trades (the Gantt, G-73 to G-75): deliveries on order,
 * the decisions the customer owes, permits, the utility. Each with where it stands, its next step,
 * a new expected day, and a way off. Add one with the work it holds.
 */
function WaitsCard({ state, project, rows, items, dispatch }: { state: GcState; project: GcProject; rows: WaitRow[]; items: ScheduleItem[]; dispatch: Dispatch<GcAction> }) {
  const [adding, setAdding] = useState(false)
  const [redating, setRedating] = useState<string | null>(null)
  const [newDay, setNewDay] = useState('')
  const [newNote, setNewNote] = useState('')
  const late = rows.filter((r) => r.state !== 'done' && r.late).length
  const open = rows.filter((r) => r.state !== 'done').length
  const step = (r: WaitRow) => {
    if (!r.nextStep) return
    dispatch({ type: 'setScheduleWaitStep', projectId: project.id, waitId: r.wait.id, step: r.nextStep.step, on: state.today })
  }
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <strong>What the work waits on{rows.length > 0 ? ` (${open} open)` : ''}</strong>
        {late > 0 && <Chip tone="red">{late} {late === 1 ? 'comes' : 'come'} late</Chip>}
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', flex: '1 1 16rem' }}>Deliveries on order, decisions the customer owes, permits, the utility's work. Each holds the work that needs it, and shows on the chart beside the day that work starts.</span>
        {!adding && <Btn onClick={() => setAdding(true)}>Add one</Btn>}
      </div>
      {adding && <NewWait state={state} project={project} items={items} dispatch={dispatch} onDone={() => setAdding(false)} />}
      {rows.length === 0 && !adding && <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Nothing yet. A long-lead item, a tile the customer has to pick, the service permit: put it here and the chart holds the work until it is in.</div>}
      <div style={{ display: 'grid' }}>
        {rows.map((r) => (
          <div key={r.wait.id} style={{ display: 'grid', gap: '0.2rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem', opacity: r.state === 'done' ? 0.7 : 1 }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Chip tone="violet">{waitKind(r.wait.kind).label}</Chip>
              <strong>{r.wait.title}</strong>
              <span style={{ color: 'var(--text-muted)' }}>
                · {r.wait.who} · for {r.trade}
              </span>
              <Chip tone={r.tone}>{r.stateWords}</Chip>
            </div>
            <div style={{ color: r.late && r.state !== 'done' ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
              {r.words}
              {r.wait.note ? ` ${r.wait.note}` : ''}
            </div>
            {r.holds.length > 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Holds {r.holds.map((h) => `${h.name} (${shortDate(h.start)})`).join(', ')}.</div>}
            {r.state !== 'done' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {r.nextStep && (
                  <Btn kind="primary" onClick={() => step(r)} title={`Mark it ${r.nextStep.label.toLowerCase()} today.`}>
                    {r.nextStep.label} today
                  </Btn>
                )}
                {redating === r.wait.id ? (
                  <>
                    <input type="date" value={newDay} onChange={(e) => setNewDay(e.target.value)} aria-label="The new expected day" style={rowBox} />
                    <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Who said so" aria-label="Who said the new day" style={{ ...rowBox, width: '14rem' }} />
                    <Btn
                      kind="primary"
                      disabled={!newDay}
                      onClick={() => {
                        dispatch({ type: 'setScheduleWaitStep', projectId: project.id, waitId: r.wait.id, step: 'expected', on: newDay, note: newNote })
                        setRedating(null)
                        setNewDay('')
                        setNewNote('')
                      }}
                    >
                      Save the day
                    </Btn>
                    <Btn kind="quiet" onClick={() => setRedating(null)}>
                      Cancel
                    </Btn>
                  </>
                ) : (
                  <Btn
                    kind="plain"
                    onClick={() => {
                      setRedating(r.wait.id)
                      setNewDay(r.wait.expectedOn)
                      setNewNote('')
                    }}
                  >
                    A new expected day
                  </Btn>
                )}
                <Btn kind="quiet" onClick={() => dispatch({ type: 'removeScheduleWait', projectId: project.id, waitId: r.wait.id })}>
                  Take it off
                </Btn>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

/** One thing the work waits on, added: its kind, its name, whose work it is for, who we wait on, the day it is expected, and the lines it holds. */
function NewWait({ state, project, items, dispatch, onDone }: { state: GcState; project: GcProject; items: ScheduleItem[]; dispatch: Dispatch<GcAction>; onDone: () => void }) {
  const [kind, setKind] = useState<WaitKind>('delivery')
  const [title, setTitle] = useState('')
  const [packageId, setPackageId] = useState<string>(project.packages[0]?.id ?? '')
  const [who, setWho] = useState('')
  const [expectedOn, setExpectedOn] = useState('')
  const [askedOn, setAskedOn] = useState('')
  const [lineIds, setLineIds] = useState<string[]>([])
  const k = waitKind(kind)
  const pkgId = packageId || null
  const whoDefault = waitWhoDefault(state, project, kind, pkgId)
  // The lines it can hold: the trade's own, or every line left to do for the job's own.
  const candidates = items.filter((r) => r.actual < 100 && !r.activity.inspection && (pkgId ? r.pkg?.id === pkgId : true))
  const problem = !title.trim() ? 'Give it a name.' : !expectedOn ? 'Say when it is expected.' : null
  return (
    <div style={{ display: 'grid', gap: '0.55rem', padding: '0.7rem', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '0.6rem', fontSize: '0.875rem' }}>
      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }} role="group" aria-label="What kind of wait">
        {WAIT_KINDS.map((w) => {
          const on = kind === w.key
          return (
            <button key={w.key} type="button" aria-pressed={on} onClick={() => setKind(w.key)} style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 999, padding: '0.25rem 0.7rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: on ? 600 : 400, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-base)' }}>
              {w.label}
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'delivery' ? 'Rooftop units' : kind === 'decision' ? 'The restroom tile' : kind === 'permit' ? 'Electrical service permit' : 'The transformer'} aria-label="What it is" style={{ ...rowBox, width: '16rem' }} />
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>For</span>
          <select value={packageId} onChange={(e) => { setPackageId(e.target.value); setLineIds([]) }} aria-label="Whose work it is for" style={rowBox}>
            {project.packages.map((p) => (
              <option key={p.id} value={p.id}>{p.trade}</option>
            ))}
            <option value="">The job's own</option>
          </select>
        </label>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>From</span>
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder={whoDefault} aria-label="Who we wait on" style={{ ...rowBox, width: '14rem' }} />
        </label>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>Expected</span>
          <input type="date" value={expectedOn} onChange={(e) => setExpectedOn(e.target.value)} aria-label="The day it is expected" style={rowBox} />
        </label>
        <label style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>{k.asked.charAt(0).toUpperCase() + k.asked.slice(1)} on</span>
          <input type="date" value={askedOn} onChange={(e) => setAskedOn(e.target.value)} aria-label={`The day it was ${k.asked}`} style={rowBox} />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>blank: not yet</span>
        </label>
      </div>
      <div>
        <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>The work that cannot start without it</div>
        {candidates.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>Nothing left to do on this trade's lines.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '0.15rem 0.75rem' }}>
            {candidates.map((r) => (
              <label key={r.activity.lineId} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <input type="checkbox" checked={lineIds.includes(r.activity.lineId)} onChange={(e) => setLineIds((list) => (e.target.checked ? [...list, r.activity.lineId] : list.filter((id) => id !== r.activity.lineId)))} />
                <span>
                  {activityName(r)} <span style={{ color: 'var(--text-muted)' }}>· starts {shortDate(r.activity.start)}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn
          kind="primary"
          disabled={problem !== null}
          title={problem ?? undefined}
          onClick={() => {
            dispatch({ type: 'addScheduleWait', projectId: project.id, kind, title, packageId: pkgId, who: who.trim() || whoDefault, lineIds, expectedOn, askedOn: askedOn || null })
            onDone()
          }}
        >
          Put it on the schedule
        </Btn>
        <Btn kind="quiet" onClick={onDone}>
          Cancel
        </Btn>
        {problem && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{problem}</span>}
      </div>
    </div>
  )
}

/** The milestones: each one's day and the trade it belongs to. Add, move or take one off. */
function MilestonesCard({ project, milestones, dispatch }: { project: GcProject; milestones: ScheduleMilestone[]; dispatch: Dispatch<GcAction> }) {
  const [label, setLabel] = useState('')
  const [planned, setPlanned] = useState('')
  const [packageId, setPackageId] = useState('')
  const save = (m: ScheduleMilestone) => dispatch({ type: 'setScheduleMilestone', projectId: project.id, milestone: m })
  const sorted = [...milestones].sort((a, b) => (a.planned < b.planned ? -1 : 1))
  return (
    <Card>
      <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Milestones</div>
      <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }}>
        {sorted.map((m) => (
          <MilestoneLine
            key={m.id}
            project={project}
            milestone={m}
            onSave={save}
            onRemove={() => dispatch({ type: 'removeScheduleMilestone', projectId: project.id, milestoneId: m.id })}
          />
        ))}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.4rem', borderTop: '1px solid var(--border)' }}>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="A new milestone" style={{ ...rowBox, minWidth: '12rem' }} aria-label="New milestone" />
          <input type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} style={rowBox} aria-label="New milestone's day" />
          <TradePick project={project} value={packageId} onChange={setPackageId} />
          <Btn
            disabled={!label.trim() || !planned}
            onClick={() => {
              save({ id: `${project.id}-ms-${milestones.length + 1}-${label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, label, planned, packageId: packageId || null, metOn: null })
              setLabel('')
              setPlanned('')
              setPackageId('')
            }}
          >
            Add milestone
          </Btn>
        </div>
      </div>
    </Card>
  )
}

function MilestoneLine({ project, milestone, onSave, onRemove }: { project: GcProject; milestone: ScheduleMilestone; onSave: (m: ScheduleMilestone) => void; onRemove: () => void }) {
  const [planned, setPlanned] = useState(milestone.planned)
  const [packageId, setPackageId] = useState(milestone.packageId ?? '')
  const changed = planned !== milestone.planned || packageId !== (milestone.packageId ?? '')
  // Substantial completion moves with the days signed change orders add (owner, 2026-10-04).
  const sub = /substantial completion/i.test(milestone.label) ? substantialCompletionOn(project) : null
  const moved = sub && sub.days > 0 ? sub : null
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ minWidth: '12rem' }}>
        {milestone.label}
        {milestone.metOn && <span style={{ color: 'var(--text-muted)' }}> · met {shortDate(milestone.metOn)}</span>}
        {moved && moved.planned === milestone.planned && (
          <span style={{ color: 'var(--text-amber-800)' }}>
            {' '}
            · {shortDate(moved.on)} with {moved.days} {moved.days === 1 ? 'day' : 'days'} by change order
          </span>
        )}
      </span>
      <input type="date" value={planned} onChange={(e) => setPlanned(e.target.value)} style={rowBox} aria-label={`${milestone.label} day`} />
      <TradePick project={project} value={packageId} onChange={setPackageId} />
      <Btn disabled={!changed || !planned} onClick={() => onSave({ ...milestone, planned, packageId: packageId || null })}>
        Save
      </Btn>
      <Btn kind="quiet" onClick={onRemove}>
        Take off
      </Btn>
    </div>
  )
}

function TradePick({ project, value, onChange }: { project: GcProject; value: string; onChange: (id: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={rowBox} aria-label="Whose milestone">
      <option value="">The job's own</option>
      {project.packages.map((k) => (
        <option key={k.id} value={k.id}>
          {k.trade}
        </option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------------------------
// The measures
// ---------------------------------------------------------------------------------------------

function Measures({ m }: { m: ReturnType<typeof scheduleMeasures> }) {
  const behind = m.work.daysBehind
  const nextMilestone = m.milestones.find((r) => r.state === 'due')
  const lateOnes = m.milestones.filter((r) => r.state === 'late' || r.state === 'missed')
  const rel = m.reliability
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.75rem' }}>
      <Measure
        label="Work done against the plan"
        value={`${Math.round(m.work.donePct)}% done`}
        tone={behind > 7 ? 'red' : behind > 0 ? 'amber' : 'green'}
        chip={behind > 0 ? `${behind} ${behind === 1 ? 'day' : 'days'} behind` : behind < 0 ? `${-behind} days ahead` : 'on plan'}
      >
        {Math.round(m.work.plannedPct)}% was planned by today, weighted by what each line is worth.
      </Measure>
      <Measure label="Critical path" value={`${m.critical.length} ${m.critical.length === 1 ? 'activity' : 'activities'}`} tone={m.critical.length > 0 ? 'amber' : 'green'} chip="no spare days">
        {m.critical.length > 0 ? m.critical.map(activityName).join(', ') : 'Every open activity has spare days.'}
      </Measure>
      <Measure
        label="Milestones hit"
        value={m.hitRate.of > 0 ? `${m.hitRate.hit} of ${m.hitRate.of}` : 'none yet'}
        tone={lateOnes.length > 0 ? 'red' : 'green'}
        chip={`within ${MILESTONE_GRACE_DAYS} days`}
      >
        {lateOnes.map((r) => `${r.milestone.label} is ${r.daysLate} days late.`).join(' ')}{' '}
        {nextMilestone ? `Next: ${nextMilestone.milestone.label} ${shortDate(nextMilestone.due)}.` : ''}
      </Measure>
      <Measure
        label="Look-ahead done as planned"
        value={rel.of > 0 ? `${Math.round((rel.done / rel.of) * 100)}%` : 'none yet'}
        tone={rel.of > 0 && rel.done / rel.of < 0.8 ? 'amber' : 'green'}
        chip={`last ${RELIABILITY_WEEKS} weeks`}
      >
        {rel.done} of {rel.of} verified marks were done. {rel.waiting > 0 ? `${rel.waiting} ${rel.waiting === 1 ? 'mark waits' : 'marks wait'} on our superintendent.` : ''}
      </Measure>
      {m.finish && <FinishMeasure finish={m.finish} contract={m.contract} />}
    </div>
  )
}

/**
 * When the job finishes as the schedule stands today (owner, 2026-10-04), against substantial
 * completion in the contract, in days. The late fee in dollars stays on Bill the owner.
 */
/** The projected finish and the contract's day, as the Projected finish card says them: the printed chart's head reads it too (G-21). */
function finishSentence(finish: ProjectedFinish, contract: ReturnType<typeof substantialCompletionOn>): string {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
  return `${finish.why} ${contract ? `The contract says substantial completion by ${shortDate(contract.on)}${contract.days > 0 ? `, with ${days(contract.days)} by change order` : ''}.` : 'No substantial completion milestone to measure against.'}`
}

function FinishMeasure({ finish, contract }: { finish: ProjectedFinish; contract: ReturnType<typeof substantialCompletionOn> }) {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
  const past = contract ? daysBetween(contract.on, finish.on) : null
  const chip =
    past === null
      ? finish.behind > 0
        ? `${days(finish.behind)} past the plan at Start`
        : 'on the plan'
      : past > 0
        ? `${days(past)} past the contract`
        : past === 0
          ? 'no days to spare'
          : `${days(-past)} to spare`
  const tone: Tone = past === null ? (finish.behind > 0 ? 'amber' : 'green') : past > 0 ? 'red' : past === 0 ? 'amber' : 'green'
  return (
    <Measure label="Projected finish" value={weekdayDate(finish.on)} tone={tone} chip={chip}>
      {finishSentence(finish, contract)}
    </Measure>
  )
}

function Measure({ label, value, tone, chip, children }: { label: string; value: string; tone: Tone; chip: string; children: ReactNode }) {
  return (
    <Card>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginTop: '0.15rem' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
        <Chip tone={tone}>{chip}</Chip>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{children}</div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------------------------

/**
 * What holds a line on the chart: a submittal not yet approved (owner, 2026-10-04), or a question
 * about the plans not yet answered (the Gantt, G-71). A submittal wins when both hold one line.
 */
function holdsOf(state: GcState, project: GcProject): Map<string, GanttHold> {
  const holds = new Map<string, GanttHold>()
  for (const r of rfiRows(state, project)) {
    if (r.state === 'answered') continue
    for (const h of r.holds) holds.set(h.lineId, { kind: 'rfi', words: `${r.label}, ${r.stateWords}`, late: r.late })
  }
  for (const a of project.schedule?.activities ?? []) {
    const s = submittalHolding(project, a.lineId)
    if (!s) continue
    const needed = submittalNeededBy(project, s)
    holds.set(a.lineId, { kind: 'submittal', words: `submittal ${s.number}`, late: needed !== null && needed < state.today })
  }
  // A delivery, a decision, a permit or the utility (G-73 to G-75), where nothing else holds the line.
  for (const [lineId, hold] of waitHolds(state, project)) if (!holds.has(lineId)) holds.set(lineId, hold)
  return holds
}

// ---------------------------------------------------------------------------------------------
// The look-ahead
// ---------------------------------------------------------------------------------------------

const MARK_WORDS: Record<LookAheadState, { tone: Tone; word: string }> = {
  done: { tone: 'green', word: 'done' },
  not: { tone: 'red', word: 'not done' },
  waiting: { tone: 'amber', word: 'waiting on our superintendent' },
  unmarked: { tone: 'grey', word: 'not marked yet' },
}

function LookAhead({ weeks }: { weeks: ReturnType<typeof scheduleMeasures>['lookAhead'] }) {
  return (
    <Card>
      <div style={{ fontWeight: 700, marginBottom: '0.2rem' }}>The look-ahead · the next {LOOKAHEAD_WEEKS} weeks</div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        Each week the trade marks each activity done or not in its portal. Our superintendent verifies the mark. Only a verified
        mark counts.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', gap: '0.75rem' }}>
        {weeks.map((w, i) => (
          <div key={w.weekOf} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.65rem', display: 'grid', gap: '0.35rem', alignContent: 'start' }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              {i === 0 ? 'This week' : i === 1 ? 'Next week' : 'In two weeks'} · {shortDate(w.weekOf)}
            </div>
            {w.items.length === 0 && w.inspections.length === 0 && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nothing planned.</span>}
            {w.items.map(({ row, mark, state }) => (
              <div key={row.activity.lineId} style={{ fontSize: '0.82rem', display: 'grid', gap: '0.1rem' }}>
                <span>
                  {row.trade} · {row.label} <span style={{ color: 'var(--text-muted)' }}>· {row.company}</span>
                </span>
                {i === 0 && (
                  <span style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip tone={MARK_WORDS[state].tone}>{MARK_WORDS[state].word}</Chip>
                    {mark && state === 'waiting' && (
                      <span style={{ color: 'var(--text-muted)' }}>they say {mark.done ? 'done' : `not done${mark.reason ? `, ${mark.reason}` : ''}`}</span>
                    )}
                    {mark && state === 'not' && markReason(mark) && <span style={{ color: 'var(--text-muted)' }}>{markReason(mark)}</span>}
                  </span>
                )}
              </div>
            ))}
            {w.inspections.map((insp) => (
              <div key={insp.activity.lineId} style={{ fontSize: '0.82rem', display: 'grid', gap: '0.1rem' }}>
                <span>
                  {insp.label} <span style={{ color: 'var(--text-muted)' }}>· {insp.company} · {shortDate(insp.activity.start)} to {shortDate(insp.activity.finish)}</span>
                </span>
                <span>
                  <InspectionChip activity={insp.activity} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// The superintendent's verify list
// ---------------------------------------------------------------------------------------------

const REASONS: LookAheadReason[] = ['weather', 'trade before', 'materials', 'crew', 'other']

/**
 * The superintendent's verify list (owner, 2026-10-02): each trade mark waiting, with what they say
 * and what they reported against the plan; right, or corrected. Our own crew's activities this
 * week are marked here too, and count as verified.
 */
function VerifyCard({ project, rows, today, dispatch }: { project: GcProject; rows: ScheduleRow[]; today: string; dispatch: Dispatch<GcAction> }) {
  const { waiting, ourCrew, inspections } = verifyList(project, rows, today)
  if (waiting.length === 0 && ourCrew.length === 0 && inspections.length === 0) {
    return (
      <Card>
        <strong>To verify</strong> <span style={{ color: 'var(--text-muted)' }}>· nothing waits on our superintendent.</span>
      </Card>
    )
  }
  const thisWeek = mondayOf(today)
  return (
    <Card style={{ border: '1px solid var(--border-strong)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
        <strong>To verify</strong>
        {waiting.length + ourCrew.length > 0 && (
          <Chip tone="amber">
            {waiting.length + ourCrew.length} {waiting.length + ourCrew.length === 1 ? 'mark' : 'marks'}
          </Chip>
        )}
        {inspections.length > 0 && (
          <Chip tone="violet">
            {inspections.length} {inspections.length === 1 ? 'inspection' : 'inspections'}
          </Chip>
        )}
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
        Our superintendent checks each trade's mark on the job. Only a verified mark counts toward the look-ahead.
      </div>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {waiting.map(({ mark, row }) => (
          <VerifyLine
            key={`${mark.weekOf}-${mark.lineId}`}
            row={row}
            weekOf={mark.weekOf}
            saysDone={mark.done}
            saysReason={mark.reason ?? null}
            onSite={onSiteWords(project, row.pkg.id, mark.weekOf)}
            onVerify={(done, reason) => dispatch({ type: 'verifyLookAhead', projectId: project.id, weekOf: mark.weekOf, lineId: mark.lineId, done, ...(reason ? { reason } : {}) })}
          />
        ))}
        {ourCrew.map((row) => (
          <VerifyLine
            key={`crew-${row.activity.lineId}`}
            row={row}
            weekOf={thisWeek}
            saysDone={null}
            saysReason={null}
            onSite={onSiteWords(project, row.pkg.id, thisWeek)}
            onVerify={(done, reason) => dispatch({ type: 'crewMarkLookAhead', projectId: project.id, weekOf: thisWeek, lineId: row.activity.lineId, done, ...(reason ? { reason } : {}) })}
          />
        ))}
        {inspections.map((insp) => (
          <div key={insp.activity.lineId} style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <div>
              <strong>{insp.label}</strong>{' '}
              <span style={{ color: 'var(--text-muted)' }}>
                · {insp.company} · planned {shortDate(insp.activity.start)} to {shortDate(insp.activity.finish)}
              </span>
            </div>
            <InspectionCheck project={project} activity={insp.activity} today={today} dispatch={dispatch} />
          </div>
        ))}
      </div>
    </Card>
  )
}

/**
 * One mark to verify. `saysDone` null: our own crew's activity, which we mark ourselves. A "done"
 * marked not done asks why; a "not done" corrected to done needs no reason.
 */
function VerifyLine({
  row,
  weekOf,
  saysDone,
  saysReason,
  onSite = null,
  onVerify,
}: {
  row: ScheduleRow
  weekOf: string
  saysDone: boolean | null
  saysReason: LookAheadReason | null
  /** What the daily log says of their week on site (owner, 2026-10-04). Null: no log that week. */
  onSite?: string | null
  onVerify: (done: boolean, reason?: LookAheadReason) => void
}) {
  const [reason, setReason] = useState<LookAheadReason>('other')
  const ours = saysDone === null
  const reasonPick = (
    <select value={reason} onChange={(e) => setReason(e.target.value as LookAheadReason)} style={input} aria-label={`Why not, ${row.label}`}>
      {REASONS.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  )
  return (
    <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
      <div>
        <strong>
          {row.trade} · {row.label}
        </strong>{' '}
        <span style={{ color: 'var(--text-muted)' }}>
          · {row.company} · week of {shortDate(weekOf)}
        </span>
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {ours ? 'Our own crew. Mark it yourself.' : saysDone ? 'They say done.' : `They say not done${saysReason ? `: ${saysReason}` : ''}.`} Reported{' '}
        {Math.round(row.actual)}%, planned {Math.round(row.plannedToday)}% by today.
      </div>
      {onSite && <div style={{ color: 'var(--text-muted)' }}>{onSite}</div>}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {ours ? (
          <>
            <Btn kind="primary" onClick={() => onVerify(true)}>
              Done
            </Btn>
            {reasonPick}
            <Btn onClick={() => onVerify(false, reason)}>Not done</Btn>
          </>
        ) : saysDone ? (
          <>
            <Btn kind="primary" onClick={() => onVerify(true)}>
              Right, done
            </Btn>
            {reasonPick}
            <Btn onClick={() => onVerify(false, reason)}>Not done</Btn>
          </>
        ) : (
          <>
            <Btn kind="primary" onClick={() => onVerify(false)}>
              Right, not done
            </Btn>
            <Btn onClick={() => onVerify(true)}>It is done</Btn>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Starting soon: the day a trade says its crew will be on site (owner, 2026-10-04, question 8)
// ---------------------------------------------------------------------------------------------

/** Trades due on the job within two weeks, or overdue, and not on it yet. The first day the daily log has their crew keeps the day they gave. */
function StartsCard({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const starts = startsToPromise(project, state.today, tradePromisesOf(state))
  if (starts.length === 0) return null
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
        <strong>Starting soon</strong>
        <Chip tone="blue">
          {starts.length} {starts.length === 1 ? 'trade' : 'trades'}
        </Chip>
      </div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
        Ask each when their crew will be on site. The first day the daily log has them keeps it.
      </div>
      <div style={{ display: 'grid', gap: '0.6rem' }}>
        {starts.map((x) => (
          <div key={x.pkg.id} style={{ display: 'grid', gap: '0.25rem', fontSize: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <div>
              <strong>{x.pkg.trade}</strong>{' '}
              <span style={{ color: x.start < state.today ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                · {partnerById(state, x.partnerId)?.company ?? 'A trade'} ·{' '}
                {x.start < state.today ? `planned to start ${shortDate(x.start)}. Not on the daily log yet.` : `planned to start ${weekdayDate(x.start)}.`}
              </span>
            </div>
            <GcBuildingPromise
              state={state}
              project={project}
              pkg={x.pkg}
              kind="start"
              note={
                x.promisedBy && x.promisedBy > x.start ? (
                  <div style={{ color: 'var(--text-amber-800)' }}>
                    That is {daysBetween(x.start, x.promisedBy)} {daysBetween(x.start, x.promisedBy) === 1 ? 'day' : 'days'} after the schedule's start.
                  </div>
                ) : undefined
              }
              dispatch={dispatch}
            />
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// An inspection: passed, or failed with a re-inspection day (owner, 2026-10-03)
// ---------------------------------------------------------------------------------------------

/** An inspection in the look-ahead: passed, failed and when again, or just planned. */
function InspectionChip({ activity }: { activity: ScheduleActivity }) {
  const inspection = activity.inspection
  const fails = inspection?.failed ?? []
  const last = fails[fails.length - 1]
  if (inspection?.passedOn) return <Chip tone="green">passed {shortDate(inspection.passedOn)}</Chip>
  if (last) return <Chip tone="red">failed, again {shortDate(last.reinspectOn)}</Chip>
  return <Chip tone="violet">inspection</Chip>
}

/**
 * Our superintendent records an inspection: it passed today, or it failed. A failure says what
 * failed, whose work (the trades it inspects come ticked) and the re-inspection day; the inspection
 * moves to that day and what waits on it moves out. The last failure shows until it passes.
 */
function InspectionCheck({
  project,
  activity,
  today,
  dispatch,
  hint,
}: {
  project: GcProject
  activity: ScheduleActivity
  today: string
  dispatch: Dispatch<GcAction>
  hint?: string
}) {
  const [failing, setFailing] = useState(false)
  const fails = activity.inspection?.failed ?? []
  const last = fails[fails.length - 1]
  const whose = (ids: string[]) =>
    project.packages
      .filter((k) => ids.includes(k.id))
      .map((k) => k.trade)
      .join(', ')
  return (
    <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.85rem' }}>
      {last && (
        <div style={{ color: 'var(--text-red-700)' }}>
          Failed {shortDate(last.on)}
          {last.packageIds.length > 0 ? ` on the ${whose(last.packageIds)} work` : ''}: {last.note} Re-inspection {shortDate(last.reinspectOn)}.
          {fails.length > 1 ? ` It has failed ${fails.length} times.` : ''}
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="primary" onClick={() => dispatch({ type: 'passInspection', projectId: project.id, lineId: activity.lineId })}>
          It passed today
        </Btn>
        {!failing && <Btn onClick={() => setFailing(true)}>It failed</Btn>}
        {!failing && hint && <span style={{ color: 'var(--text-muted)' }}>{hint}</span>}
      </div>
      {failing && (
        <InspectionFailForm
          project={project}
          activity={activity}
          today={today}
          onCancel={() => setFailing(false)}
          onFail={(note, packageIds, reinspectOn) => {
            dispatch({ type: 'failInspection', projectId: project.id, lineId: activity.lineId, note, packageIds, reinspectOn })
            setFailing(false)
          }}
        />
      )}
    </div>
  )
}

function InspectionFailForm({
  project,
  activity,
  today,
  onFail,
  onCancel,
}: {
  project: GcProject
  activity: ScheduleActivity
  today: string
  onFail: (note: string, packageIds: string[], reinspectOn: string) => void
  onCancel: () => void
}) {
  const inspected = inspectedTrades(project, activity)
  const others = project.packages.filter((k) => !inspected.includes(k) && (k.sow?.status === 'signed' || k.selfPerform))
  const [picked, setPicked] = useState<string[]>(inspected.map((k) => k.id))
  const [note, setNote] = useState('')
  const [again, setAgain] = useState(addDays(today, 3))
  const problem = !note.trim() ? 'Say what failed first.' : !again || again <= today ? 'The re-inspection is after today.' : null
  const box = (id: string, trade: string) => (
    <label key={id} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
      <input type="checkbox" checked={picked.includes(id)} onChange={(e) => setPicked((list) => (e.target.checked ? [...list, id] : list.filter((x) => x !== id)))} />
      <span>{trade}</span>
    </label>
  )
  const label = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' } as const
  return (
    <div style={{ padding: '0.65rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--bg-subtle)', display: 'grid', gap: '0.55rem' }}>
      <label style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={label}>What failed · the trades read this in their portal</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="The main bonding jumper is missing at the service panel."
          style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
        />
      </label>
      <div style={{ display: 'grid', gap: '0.2rem' }}>
        <span style={label}>Whose work</span>
        <div style={{ display: 'flex', gap: '0.25rem 0.9rem', flexWrap: 'wrap' }}>
          {inspected.map((k) => box(k.id, k.trade))}
          {others.map((k) => box(k.id, k.trade))}
        </div>
      </div>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={label}>Re-inspection</span>
        <input type="date" value={again} min={addDays(today, 1)} onChange={(e) => setAgain(e.target.value)} style={input} />
        <span style={{ color: 'var(--text-muted)' }}>The inspection moves to that day. What waits on it moves out.</span>
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="primary" disabled={problem !== null} title={problem ?? undefined} onClick={() => onFail(note, picked, again)}>
          Record the failure
        </Btn>
        <Btn kind="quiet" onClick={onCancel}>
          Keep it
        </Btn>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// The board row
// ---------------------------------------------------------------------------------------------

/**
 * A won job's block on the Project Board, once its schedule is drawn (owner, 2026-10-03: the row
 * shows the schedule's measures on Building): days behind or ahead in the big number, then the
 * milestones hit and the look-ahead. The sentences behind it are on hover. Null: no schedule, so
 * the board keeps its own block.
 */
export function GcBuildingScheduleBlock({ project, today, box }: { project: GcProject; today: string; box: CSSProperties }) {
  const sum = scheduleSummary(project, today)
  if (!sum) return null
  const d = sum.daysBehind
  const tone =
    d > 7
      ? { bg: 'var(--bg-red-100)', fg: 'var(--text-red-800)' }
      : d > 0
        ? { bg: 'var(--bg-amber-100)', fg: 'var(--text-amber-800)' }
        : { bg: 'var(--bg-green-100)', fg: 'var(--text-green-800)' }
  const late = sum.milestones.late.length > 0
  // Not walked this week (G-59; the owner's OK 2026-10-06): the row says so, in place of the look-ahead line.
  const walk = walkStanding(project, today)
  const small: CSSProperties = { fontSize: '0.68rem', whiteSpace: 'nowrap' }
  return (
    <span style={{ ...box, background: tone.bg, color: tone.fg, textAlign: 'center' }} title={scheduleSummaryWords(sum)} aria-label={scheduleSummaryWords(sum)}>
      {d === 0 ? (
        <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.02em' }}>ON PLAN</span>
      ) : (
        <>
          <span style={{ fontSize: '1.35rem', fontWeight: 800 }}>{Math.abs(d)}</span>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {Math.abs(d) === 1 ? 'day' : 'days'} {d > 0 ? 'behind' : 'ahead'}
          </span>
        </>
      )}
      <span style={{ ...small, fontWeight: late ? 700 : 400 }}>
        {sum.milestones.of > 0 ? `${sum.milestones.hit} of ${sum.milestones.of} milestones` : 'no milestone yet'}
      </span>
      {walk.stale ? <span style={{ ...small, fontWeight: 700 }}>not walked</span> : <span style={small}>{sum.lookAhead.of > 0 ? `look-ahead ${Math.round((sum.lookAhead.done / sum.lookAhead.of) * 100)}%` : 'look-ahead new'}</span>}
    </span>
  )
}
