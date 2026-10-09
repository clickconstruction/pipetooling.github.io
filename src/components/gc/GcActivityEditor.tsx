/**
 * GC mode, the real build, the schedule's PR 8b: the opened bar's form, for those who may move a bar (to-dos/gc-mode/
 * SCHEDULE_REAL_BUILD.md, PR 8, on branch spike/gc-mode). Ported from the GC mode prototype's `ActivityEditor`
 * (`GcBuildingSchedule.tsx`), its words kept: the bar's dates, the day it cannot start before and the day it must
 * finish by (G-36), what it waits on with a gap after each (G-35, side by side below zero, G-82), what a slip would
 * cost (G-80), and the days it really ran (G-55). **Save, and say why** hands the change to the move's window
 * (`GcMoveExplain`), so a change is a move like a drag. The real days are a record and keep at once. Since PR 9a, the
 * job's own bar's buttons (G-38) and an inspection's pass or failure sit at its foot (`extra`, `check`). Its trade's
 * papers (G-77) and its place (G-83) come with PR 9b and 9d; the what-if copy with PR 11.
 */
import { useState, type ReactNode } from 'react'
import { addDays } from '../../lib/gc/building'
import { actualProblem, actualWords } from '../../lib/gc/schedule/actualDates'
import { whatIfSlips, type MoveLimits } from '../../lib/gc/schedule/moves'
import { daysBetween, pushAfter, pushedAfterWords } from '../../lib/gc/schedule/network'
import { sideBySideWords } from '../../lib/gc/schedule/recovery'
import { activityName, type ScheduleItem } from '../../lib/gc/schedule/schedule'
import type { GcProject } from '../../lib/gc/types'
import { shortDate, weekdayDate } from '../../lib/gc/words'
import { Btn, Card, input } from './gcUi'

/**
 * One activity: its dates and what it waits on. After Start, the plan at Start stays the baseline. `onSave` opens the
 * move's window with the new dates, waits and limits. `onActual` keeps the real days; it throws a refusal in words.
 */
export function GcActivityEditor({
  project,
  row,
  rows,
  started,
  today,
  onSave,
  onActual,
  check,
  extra,
  onClose,
}: {
  project: GcProject
  row: ScheduleItem
  rows: ScheduleItem[]
  started: boolean
  today: string
  onSave: (start: string, finish: string, after: string[], limits: MoveLimits) => void
  /** The real start and finish, recorded (G-55). Null clears one. */
  onActual?: (actualStart: string | null, actualFinish: string | null) => Promise<void>
  /** An inspection not passed yet, on a job being built: passed or failed, today. */
  check?: ReactNode
  /** An added activity's own buttons (G-38): done, not done, off the schedule. */
  extra?: ReactNode
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
  const [keeping, setKeeping] = useState(false)
  const [actualFailed, setActualFailed] = useState<string | null>(null)
  const actualChanged = (actualStart || undefined) !== a.actualStart || (actualFinish || undefined) !== a.actualFinish
  const actualBad = actualProblem(actualStart || undefined, actualFinish || undefined, today)
  const limits: MoveLimits = { lag, notBefore: notBefore || null, mustFinishBy: mustFinishBy || null }
  const limitsChanged = JSON.stringify(Object.fromEntries(Object.entries(lag).filter(([id, d]) => after.includes(id) && d !== 0))) !== JSON.stringify(a.lag ?? {}) || (notBefore || undefined) !== a.notBefore || (mustFinishBy || undefined) !== a.mustFinishBy
  const bad = !start || !finish || finish < start || (notBefore !== '' && start < notBefore)
  const changed = start !== a.start || finish !== a.finish || after.join() !== a.after.join() || limitsChanged
  const others = rows.filter((r) => r.activity.lineId !== a.lineId)
  const trades = [...new Set(others.map((r) => r.pkg?.id ?? ''))]
  // What it waits on, finishing after it starts: it cannot start on the day drawn.
  // A wait it is meant to overlap, side by side (a gap below zero, G-82), is no warning.
  const late = others.filter((r) => after.includes(r.activity.lineId) && r.activity.finish >= start && !((lag[r.activity.lineId] ?? 0) < 0 && addDays(r.activity.finish, 1 + (lag[r.activity.lineId] ?? 0)) <= start))
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
  const keepActual = async () => {
    if (!onActual || actualBad !== null || keeping) return
    setKeeping(true)
    setActualFailed(null)
    try {
      await onActual(actualStart || null, actualFinish || null)
    } catch (e) {
      setActualFailed(e instanceof Error ? e.message : 'The real days did not save.')
    } finally {
      setKeeping(false)
    }
  }
  return (
    <Card style={{ border: '2px solid #2563eb' }} dataTour="gc-activity-editor">
      <div data-gc-activity-editor={a.lineId} style={{ display: 'grid', gap: '0.6rem', fontSize: '0.875rem' }}>
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
                    {/* A gap after it finishes: cure time, a lead time (G-35). Below zero it starts before that work finishes, side by side (G-82), never before it starts. */}
                    {after.includes(r.activity.lineId) && (
                      <span style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {(lag[r.activity.lineId] ?? 0) >= 0 ? '+' : ''}
                        <input
                          type="number"
                          min={-daysBetween(r.activity.start, r.activity.finish)}
                          value={lag[r.activity.lineId] ?? 0}
                          onChange={(e) => setLag((was) => ({ ...was, [r.activity.lineId]: Math.max(-daysBetween(r.activity.start, r.activity.finish), Number(e.target.value) || 0) }))}
                          aria-label={`Days of gap after ${activityName(r)}`}
                          style={{ ...input, width: '3.4rem', height: 24, padding: '0 0.3rem' }}
                        />
                        days
                        {(lag[r.activity.lineId] ?? 0) < 0 && <span>: starts {sideBySideWords(-(lag[r.activity.lineId] ?? 0), r.label)}</span>}
                      </span>
                    )}
                  </label>
                )),
            )}
          </div>
        </div>
        {late.length > 0 && (
          <div style={{ color: 'var(--text-amber-800)' }}>
            {late.map(activityName).join(', ')} {late.length === 1 ? 'finishes' : 'finish'} on or after this starts. The spare days count it starting the day after.
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
        {row.activity.inspection?.passedOn && <div style={{ color: 'var(--text-green-800)' }}>It passed {shortDate(row.activity.inspection.passedOn)}.</div>}
        {(row.activity.inspection?.failed ?? []).length > 0 && (
          <div style={{ display: 'grid', gap: '0.15rem', color: 'var(--text-muted)' }}>
            {(row.activity.inspection?.failed ?? []).map((f) => (
              <span key={f.on + f.reinspectOn}>
                Failed {shortDate(f.on)}: {f.note} Re-inspection {shortDate(f.reinspectOn)}.
              </span>
            ))}
          </div>
        )}
        {!a.inspection && onActual && (
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
              <Btn kind="plain" disabled={actualBad !== null || keeping} title={actualBad ?? undefined} onClick={() => void keepActual()}>
                Keep the real days
              </Btn>
            )}
            <span style={{ color: actualBad && actualChanged ? 'var(--text-red-700)' : 'var(--text-muted)', fontSize: '0.82rem' }}>{actualChanged && actualBad ? actualBad : (actualWords(a) ?? 'Not recorded. The walk asks when it started and finished.')}</span>
            {actualFailed && (
              <span role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.82rem' }}>
                {actualFailed}
              </span>
            )}
          </div>
        )}
        {extra && <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>{extra}</div>}
        {check && <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>{check}</div>}
      </div>
    </Card>
  )
}
