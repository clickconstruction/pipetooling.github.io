/**
 * GC mode design spike: the weekly walk of the schedule, the Gantt's Phase 2 (the owner,
 * 2026-10-05: "build the weekly walk"; `to-dos/gc-mode/GANTT_PLAN.md`, G-52, G-53, G-59). One bar
 * at a time: what the trade reported, what the daily log shows, the day its pace points to. Keep
 * it as drawn, or give it a new day with why. It ends on what changed. Two pieces: the line over
 * the chart that says when the schedule was last walked, and the walk itself.
 */
import { useEffect, useState, type Dispatch, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { addDays, daysBetween, weekdayDate, type GcAction, type GcProject, type GcState, type ScheduleMoveReason } from '../../lib/gcMode/gcModel'
import type { GanttHold } from '../../lib/gcMode/gcGantt'
import { MOVE_REASONS, moveWhyProblem, planMove, spanWords } from '../../lib/gcMode/gcScheduleMoves'
import { walkChanges, walkItems, walkStanding, walkTally, type WalkItem } from '../../lib/gcMode/gcScheduleWalk'
import { Btn, Chip, input } from './gcUi'

/** The signed-in person's name. Outside the app's sign-in (a test), none. */
function useMeName(): string | null {
  try {
    return useAuth().profileName
  } catch {
    return null
  }
}

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const

/** Over the chart: when the schedule was last walked, and the door to walking it now. */
export function GcWalkLine({ state, project, holds, onWalk }: { state: GcState; project: GcProject; holds: Map<string, GanttHold>; onWalk: () => void }) {
  const standing = walkStanding(project, state.today)
  const count = walkItems(state, project, holds).length
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', background: standing.stale ? 'var(--bg-amber-tint)' : 'var(--bg-subtle)' }}>
      {/* A walk that skipped bars is said so: walked, but not all of it. */}
      <Chip tone={standing.stale || standing.partial ? 'amber' : 'green'}>{standing.stale ? 'check the dates' : standing.partial ? 'part walked' : 'walked'}</Chip>
      <span style={{ fontSize: '0.875rem', color: standing.stale ? 'var(--text-amber-800)' : 'var(--text-600)', flex: '1 1 14rem' }}>
        {standing.words}
        {standing.last && !standing.stale ? ` ${walkTally(standing.last.kept.length, standing.last.moveIds.length, standing.last.skipped)}` : ''}
      </span>
      <Btn kind={standing.stale || standing.partial ? 'primary' : 'plain'} disabled={count === 0} onClick={onWalk} title="Go through every bar that should have moved this week, one at a time.">
        Update the week{count > 0 ? ` · ${count}` : ''}
      </Btn>
    </div>
  )
}

type Outcome = { kind: 'kept' } | { kind: 'moved'; moveId: string }

/** The walk: the bars down the side, one at a time on the right, then what changed. */
export function GcScheduleWalk({ state, project, holds, dispatch, onClose }: { state: GcState; project: GcProject; holds: Map<string, GanttHold>; dispatch: Dispatch<GcAction>; onClose: () => void }) {
  const me = useMeName() ?? 'The office'
  // The list as it stood when the walk opened: a bar moved during the walk keeps its place on it.
  const [list] = useState<WalkItem[]>(() => walkItems(state, project, holds))
  const [done, setDone] = useState<Record<string, Outcome>>({})
  const [pick, setPick] = useState<string | null>(list[0]?.lineId ?? null)
  const [finished, setFinished] = useState(false)
  // The new day being typed for the bar in hand, and why.
  const [day, setDay] = useState('')
  const [moving, setMoving] = useState(false)
  const [reason, setReason] = useState<ScheduleMoveReason | null>(null)
  const [note, setNote] = useState('')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 700px)').matches
  const item = list.find((i) => i.lineId === pick) ?? null
  const activity = item ? project.schedule?.activities.find((a) => a.lineId === item.lineId) : undefined
  const kept = list.filter((i) => done[i.lineId]?.kind === 'kept').map((i) => i.lineId)
  const moveIds = list.flatMap((i) => {
    const o = done[i.lineId]
    return o?.kind === 'moved' ? [o.moveId] : []
  })
  const left = list.length - kept.length - moveIds.length

  const open = (lineId: string) => {
    setPick(lineId)
    setMoving(false)
    setDay('')
    setReason(null)
    setNote('')
  }
  const next = (from: string, outcome?: Outcome) => {
    const now = outcome ? { ...done, [from]: outcome } : done
    if (outcome) setDone(now)
    const at = list.findIndex((i) => i.lineId === from)
    const after = [...list.slice(at + 1), ...list.slice(0, at)].find((i) => !now[i.lineId])
    if (after) open(after.lineId)
    else setMoving(false)
  }
  // A started bar moves its finish; one not started moves whole, keeping its length.
  const target = item && activity && day ? (item.started ? { start: activity.start, finish: day } : { start: day, finish: addDays(day, daysBetween(activity.start, activity.finish)) }) : null
  const plan = item && target ? planMove(project, item.lineId, target.start, target.finish) : null
  const problem = !day ? 'Pick the new day.' : (plan?.problem ?? (plan?.same ? 'That is the day it already has.' : moveWhyProblem(reason, note)))
  const move = () => {
    if (!item || !activity || !target || !reason || problem) return
    const moveId = `move-${(project.schedule?.moves ?? []).length + 1}`
    dispatch({ type: 'setScheduleActivity', projectId: project.id, lineId: item.lineId, start: target.start, finish: target.finish, after: activity.after, why: { reason, note: note.trim(), by: me } })
    next(item.lineId, { kind: 'moved', moveId })
  }
  const finish = () => {
    if (kept.length + moveIds.length > 0) dispatch({ type: 'recordScheduleWalk', projectId: project.id, by: me, kept, moveIds, skipped: left })
    setFinished(true)
  }

  const shell = (children: ReactNode) =>
    createPortal(
      <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Update the week"
          onClick={(e) => e.stopPropagation()}
          style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(980px, 100%)', maxHeight: phone ? '92vh' : 'min(92vh, 740px)', overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', display: 'grid', fontSize: '0.9rem' }}
        >
          {children}
        </div>
      </div>,
      document.body,
    )

  if (finished) {
    const changes = walkChanges(project, moveIds)
    return shell(
      <div style={{ padding: '1.1rem', display: 'grid', gap: '0.75rem', overflow: 'auto' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{kept.length + moveIds.length > 0 ? 'The week is updated' : 'Nothing was looked at'}</h3>
          <div style={{ color: 'var(--text-muted)' }}>
            {kept.length + moveIds.length > 0 ? `Walked today by ${me}. ${walkTally(kept.length, moveIds.length, left)}` : 'The walk is not recorded. The schedule still reads as not walked.'}
          </div>
        </div>
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={label}>What changed</span>
          {changes.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No dates moved. The schedule stands as drawn.</div>}
          {changes.map((c) => (
            <div key={c.move.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.55rem 0.7rem', display: 'grid', gap: '0.15rem' }}>
              <div>
                {c.what} <Chip tone="grey">{c.reason}</Chip>
              </div>
              <div>“{c.move.note}”</div>
              {c.effect && <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>{c.effect}</div>}
            </div>
          ))}
        </div>
        {changes.length > 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>
            This is the list the trades and the customer's Friday report will be told from. Telling them is the next phase; for now it is kept under the chart, in Changes to the schedule.
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <Btn kind="primary" onClick={onClose}>
            Done
          </Btn>
        </div>
      </div>,
    )
  }

  return shell(
    <div style={{ display: 'grid', gridTemplateColumns: phone ? 'minmax(0, 1fr)' : '17rem minmax(0, 1fr)', gridTemplateRows: phone ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr)', minHeight: 0, overflow: 'hidden', maxHeight: 'inherit' }}>
      <div style={{ background: 'var(--bg-subtle)', borderRight: phone ? 'none' : '1px solid var(--border)', borderBottom: phone ? '1px solid var(--border)' : 'none', padding: '0.8rem 0.5rem', overflow: 'auto', maxHeight: phone ? '9.5rem' : undefined }}>
        <div style={{ ...label, padding: '0 0.5rem 0.4rem' }}>
          The week · {list.length - left} of {list.length}
        </div>
        {list.map((i) => {
          const o = done[i.lineId]
          const on = i.lineId === pick
          return (
            <button
              key={i.lineId}
              type="button"
              aria-current={on}
              onClick={() => open(i.lineId)}
              style={{ display: 'grid', gap: '0.1rem', width: '100%', textAlign: 'left', border: 'none', borderRadius: 8, padding: '0.45rem 0.5rem', cursor: 'pointer', background: on ? 'var(--surface)' : 'transparent', color: 'var(--text-base)', font: 'inherit' }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {i.name}
                {o && <span style={{ color: 'var(--text-green-800)', fontWeight: 600 }}> · {o.kind === 'kept' ? 'kept' : 'moved'}</span>}
              </span>
              <span style={{ color: i.tone === 'red' ? 'var(--text-red-700)' : i.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-muted)', fontSize: '0.78rem' }}>{i.chip}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
        <div style={{ padding: '1rem', overflow: 'auto', display: 'grid', gap: '0.7rem', alignContent: 'start', flex: 1 }}>
          {!item || !activity ? (
            <div style={{ color: 'var(--text-muted)' }}>Nothing on the schedule needs a look this week.</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{item.name}</h3>
                <Chip tone={item.tone}>{item.chip}</Chip>
                {done[item.lineId] && <Chip tone="green">{done[item.lineId]?.kind === 'kept' ? 'kept as drawn' : 'moved'}</Chip>}
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: '-0.45rem' }}>
                {item.company} · drawn {spanWords({ start: activity.start, finish: activity.finish })}
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.2rem' }}>
                {item.facts.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div style={{ background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.7rem', display: 'grid', gap: '0.6rem' }}>
                <strong>{item.started ? `Does it still finish ${weekdayDate(activity.finish)}?` : `Does it still start ${weekdayDate(activity.start)}?`}</strong>
                {!moving && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Btn kind="primary" onClick={() => next(item.lineId, { kind: 'kept' })}>
                      Yes, keep it
                    </Btn>
                    {item.paceFinish && (
                      <Btn
                        kind="plain"
                        onClick={() => {
                          setDay(item.paceFinish ?? '')
                          setMoving(true)
                        }}
                      >
                        Take {weekdayDate(item.paceFinish)}, its pace
                      </Btn>
                    )}
                    <Btn kind="plain" onClick={() => setMoving(true)}>
                      {item.started ? 'A new finish day' : 'A new start day'}
                    </Btn>
                    <Btn kind="quiet" onClick={() => next(item.lineId)}>
                      Skip for now
                    </Btn>
                  </div>
                )}
                {moving && (
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    <label style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{item.started ? 'It finishes' : 'It starts'}</span>
                      <input type="date" value={day} min={item.started ? activity.start : undefined} onChange={(e) => setDay(e.target.value)} aria-label={item.started ? 'The new finish day' : 'The new start day'} style={input} />
                      {day && <span style={{ color: 'var(--text-muted)' }}>{weekdayDate(day)}</span>}
                    </label>
                    {plan && !plan.problem && !plan.same && <div style={{ color: plan.finishDays > 0 ? 'var(--text-red-700)' : 'var(--text-600)', fontWeight: plan.finishDays > 0 ? 600 : 400 }}>{plan.words}</div>}
                    <div role="group" aria-label="Why it moved" style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {MOVE_REASONS.map((r) => {
                        const on = reason === r.key
                        return (
                          <button
                            key={r.key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setReason(r.key)}
                            style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: on ? 600 : 400, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-base)' }}
                          >
                            {r.label}
                          </button>
                        )
                      })}
                    </div>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="What happened, in your words" placeholder="What happened, in your words." style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, padding: '0.45rem 0.55rem' }} />
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <Btn kind="primary" disabled={problem !== null} onClick={move}>
                        Move it
                      </Btn>
                      <Btn kind="quiet" onClick={() => setMoving(false)}>
                        Back
                      </Btn>
                      {problem && <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{problem}</span>}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div style={{ padding: '0.7rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 10rem' }}>
            {walkTally(kept.length, moveIds.length, left)} {left > 0 ? 'You can finish with some not looked at; the record says how many.' : 'Every bar has been looked at.'}
          </span>
          <Btn kind="quiet" onClick={onClose}>
            Close
          </Btn>
          <Btn kind={left === 0 ? 'primary' : 'plain'} onClick={finish}>
            Finish the walk
          </Btn>
        </div>
      </div>
    </div>,
  )
}
