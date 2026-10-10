/**
 * GC mode, the real build, the schedule's PR 8a: moving a bar on real data (to-dos/gc-mode/SCHEDULE_REAL_BUILD.md,
 * PR 8, on branch spike/gc-mode). Ported from the GC mode prototype's `GcScheduleMoves.tsx`, its words kept: the
 * window every move goes through (what it does, why, in whose words) and the list of every move made, with Undo
 * and Redo. The prototype sent each press to its reducer; here each press is a callback the schedule's body sends
 * through the schedule's io (`saveScheduleMove`, `undoScheduleMove`, `redoScheduleMove`). A save someone else beat
 * stays open and says what they changed (G-134). A part's own move (PR 8b) goes through the same window. Since PR 11,
 * both take `trying` in the what-if copy (G-81): the reason is optional, a move with none keeps the stand-in marked
 * `noWhy`, and the record is the copy's. Telling the trades comes with PR 13. What a move does to the bills (G-97) is
 * Owner Billing's.
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { MOVE_REASONS, moveActivityName, moveRecord, moveRows, moveWhyProblem, planMove, redoableMove, spanWords, undoableMove, type MoveLimits } from '../../lib/gc/schedule/moves'
import { daysBetween } from '../../lib/gc/schedule/network'
import { crowdingAfterMove } from '../../lib/gc/schedule/places'
import { WHAT_IF_NO_WHY } from '../../lib/gc/schedule/whatIf'
import { changeTimeWords, moveWords, partMovePress } from '../../lib/gc/schedule/scheduleWindow'
import { lineLabel } from '../../lib/gc/schedule/splitBars'
import type { ScheduleActivity, ScheduleMove, ScheduleMoveReason } from '../../lib/gc/schedule/types'
import { SCHEDULE_CHANGED, scheduleChangedRefusal, type ScheduleChange } from '../../lib/gc/schedule/versionRefusal'
import type { GcProject, GcState } from '../../lib/gc/types'
import { weekdayDate } from '../../lib/gc/words'
import { formatErrorMessage } from '../../utils/errorHandling'
import { Btn, Card, Chip, input } from './gcUi'

/** A move waiting on its explanation: the activity and where it would go. */
export interface PendingMove {
  lineId: string
  start: string
  finish: string
  after: string[]
  /** The gap after each wait, the day it cannot start before, the day it must finish by, when the form set them (PR 8b). */
  limits?: MoveLimits
  /** A split line's part moved (G-39, PR 8b): the part, its dates before, and its new ones. The move's start and finish are then its line's new span. */
  part?: { id: string; name: string; from: { start: string; finish: string }; start: string; finish: string }
}

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const

/**
 * The changes someone else saved first (G-134): the refusal's words, each change's time and line, and what to
 * do now. The schedule reads again behind it, so the chart shows their dates.
 */
export function GcScheduleRefusal({ changes, what }: { changes: ScheduleChange[]; what: string }) {
  return (
    <div role="alert" data-schedule-refused style={{ display: 'grid', gap: '0.25rem', background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.55rem 0.7rem', fontSize: '0.85rem' }}>
      <strong>{SCHEDULE_CHANGED}</strong>
      {changes.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.1rem' }}>
          {changes.map((c) => (
            <li key={c.version}>
              {changeTimeWords(c.at)} {c.words}
            </li>
          ))}
        </ul>
      )}
      <span>{what}</span>
    </div>
  )
}

/**
 * The window a move is saved from: what it does, then why. Nothing is saved without both. `onSave` sends the
 * move, the bars as the move leaves them and its line in the log; it throws the database's refusal. A refusal
 * keeps the window open with the person's reason and words, and `onReload` reads the schedule again, so the
 * move is worked out afresh on the new dates.
 */
export function GcMoveExplain({
  state,
  project,
  pending,
  by,
  today,
  onSave,
  onReload,
  onClose,
  trying = false,
}: {
  state?: GcState
  project: GcProject
  pending: PendingMove
  by: string
  today: string
  onSave: (move: ScheduleMove, activities: ScheduleActivity[], words: string) => Promise<void>
  onReload: () => void
  onClose: () => void
  /** In the what-if copy (G-81, PR 11): the move is tried on the copy, and its reason is optional. */
  trying?: boolean
}) {
  const [reason, setReason] = useState<ScheduleMoveReason | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<ScheduleChange[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const plan = planMove(project, pending.lineId, pending.start, pending.finish, pending.after, pending.limits)
  // What the move does to a place with too many trades (G-83), said before it saves.
  const crowding = useMemo(() => (state && plan && !plan.problem && !plan.same ? crowdingAfterMove(state, project, plan.activities) : []), [state, project, pending]) // eslint-disable-line react-hooks/exhaustive-deps
  // A part moved inside its line's span (G-39) leaves the line's dates as they are: still a move, with its reason.
  if (!plan || (plan.same && !pending.part) || !project.schedule) return null
  const schedule = project.schedule
  // In the what-if a reason is optional: the move is tried with one when it is given whole, else with none yet.
  const whyGiven = moveWhyProblem(reason, note) === null
  const problem = trying ? plan.problem : (plan.problem ?? moveWhyProblem(reason, note))
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const dated = plan.from.start !== plan.to.start || plan.from.finish !== plan.to.finish || Boolean(pending.part)
  const shift = daysBetween(plan.from.finish, plan.to.finish)
  const longer = daysBetween(plan.to.start, plan.to.finish) - daysBetween(plan.from.start, plan.from.finish)
  const save = async () => {
    if (problem || (!trying && !reason) || saving) return
    const why = reason && whyGiven ? { reason, note: note.trim(), by } : { ...WHAT_IF_NO_WHY, by }
    const tried = (move: ScheduleMove): ScheduleMove => (trying && !(reason && whyGiven) ? { ...move, noWhy: true } : move)
    setSaving(true)
    setRefused(null)
    setFailed(null)
    try {
      if (pending.part) {
        // A part's move (G-39): its line's span moves like any bar, and the parts' days come along, for Undo and Redo.
        const press = partMovePress(project, pending.lineId, pending.part.id, pending.part.start, pending.part.finish, why, today)
        if (!press) throw new Error('This part does not move. Close this and drag it again.')
        await onSave(tried(press.move), press.activities, press.words)
      } else await onSave(tried(moveRecord(schedule, pending.lineId, plan, why, today)), plan.activities, moveWords(project, pending.lineId, plan, why))
      onClose()
    } catch (e) {
      const refusal = scheduleChangedRefusal(e)
      if (refusal) {
        // Someone saved first: their changes, and the chart reads again behind the window.
        setRefused(refusal.changes)
        onReload()
      } else setFailed(formatErrorMessage(e, 'The move did not save.'))
    } finally {
      setSaving(false)
    }
  }
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Why it moved"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(560px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
            {trying ? `Try ${dated ? 'moving' : 'changing'}` : dated ? 'Move' : 'Change'} {moveActivityName(project, pending.lineId)}
            {pending.part ? `, ${pending.part.name}` : ''}
          </h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{trying ? 'In the what-if, a reason is optional. Keep asks for one.' : "A move is saved with why it moved. Both stay on the schedule's record."}</div>
        </div>
        <div style={{ display: 'grid', gap: '0.3rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.6rem 0.7rem' }}>
          {pending.part ? (
            <GcPartMoveLines project={project} pending={pending} part={pending.part} plan={plan} />
          ) : dated ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{spanWords(plan.from)}</span>
              <span aria-hidden>→</span>
              <strong>
                {weekdayDate(plan.to.start)} to {weekdayDate(plan.to.finish)}
              </strong>
              {shift !== 0 && <Chip tone={shift > 0 ? 'amber' : 'green'}>{Math.abs(shift)} {Math.abs(shift) === 1 ? 'day' : 'days'} {shift > 0 ? 'later' : 'sooner'}</Chip>}
              {longer !== 0 && <Chip tone="grey">{Math.abs(longer)} {Math.abs(longer) === 1 ? 'day' : 'days'} {longer > 0 ? 'longer' : 'shorter'}</Chip>}
            </div>
          ) : (
            <strong>Its dates stay {spanWords(plan.from)}.</strong>
          )}
          {plan.linksChanged && <div>What it waits on, or its limits, change.</div>}
          {plan.warnings.map((w) => (
            <div key={w} style={{ color: 'var(--text-amber-800)' }}>
              {w}
            </div>
          ))}
          <div style={{ color: plan.finishDays > 0 ? 'var(--text-red-700)' : 'var(--text-600)', fontWeight: plan.finishDays > 0 ? 600 : 400 }}>{plan.words}</div>
          {plan.pushed.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '1.1rem', color: 'var(--text-600)', fontSize: '0.83rem', display: 'grid', gap: '0.1rem' }}>
              {plan.pushed.slice(0, 5).map((p) => (
                <li key={p.lineId}>
                  {p.label}: {spanWords(p.to)}, {p.days} {p.days === 1 ? 'day' : 'days'} later
                </li>
              ))}
              {plan.pushed.length > 5 && <li>and {plan.pushed.length - 5} more</li>}
            </ul>
          )}
          {crowding.map((c) => (
            <div key={c.words} data-move-crowding style={{ color: c.tone === 'amber' ? 'var(--text-amber-800)' : 'var(--text-green-800)' }}>
              {c.words}
            </div>
          ))}
        </div>
        {refused && <GcScheduleRefusal changes={refused} what="Your move was not saved. The chart shows the new dates now. Try it again on them." />}
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={label}>Why it moved</span>
          <div role="group" aria-label="Why it moved" style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {MOVE_REASONS.map((r) => {
              const on = reason === r.key
              return (
                <button
                  key={r.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReason(r.key)}
                  style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 999, padding: '0.25rem 0.7rem', fontSize: '0.82rem', cursor: 'pointer', fontWeight: on ? 600 : 400, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-base)' }}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>
        <label style={{ display: 'grid', gap: '0.35rem' }}>
          <span style={label}>What happened, in your words</span>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save()
            }}
            rows={3}
            placeholder="Rain stopped the roof Tuesday and Wednesday. Summit is back Thursday."
            style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, padding: '0.45rem 0.55rem' }}
          />
        </label>
        {failed && (
          <div role="alert" style={{ color: 'var(--text-red-700)' }}>
            {failed}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 10rem' }}>
            {problem ?? (trying ? (whyGiven ? 'Tried with its reason, on the copy only.' : 'Tried with no reason yet, on the copy only.') : `Saved as moved by ${by}, today.`)}
          </span>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null || saving} onClick={() => void save()}>
            {saving ? 'Saving…' : trying ? 'Try it' : 'Save the move'}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Every move made on the schedule, newest first, each with who, why and what it did. The last one standing can be
 * undone, and the newest undone one put back (G-40). Without `onUndo` and `onRedo` (someone who may not move a
 * bar) it is the record only. A refusal says what someone else changed first; the schedule reads again behind it.
 */
export function GcMoveHistory({
  project,
  onUndo,
  onRedo,
  busy = false,
  refused = null,
  problem = null,
  trying = false,
}: {
  project: GcProject
  onUndo?: (move: ScheduleMove) => void
  onRedo?: (move: ScheduleMove) => void
  busy?: boolean
  refused?: ScheduleChange[] | null
  problem?: string | null
  /** The what-if copy's own record (G-81, PR 11): the moves tried on it. */
  trying?: boolean
}) {
  const rows = moveRows(project)
  const [all, setAll] = useState(false)
  const undoable = undoableMove(project)
  // Redo (G-40): the newest undone move, while everything it touched still sits where the undo left it.
  const redoable = redoableMove(project)
  if (rows.length === 0) {
    return (
      <Card>
        <strong>{trying ? 'Tried in the what-if' : 'Changes to the schedule'}</strong>{' '}
        <span style={{ color: 'var(--text-muted)' }}>
          {trying ? 'Nothing tried yet. Drag a bar on the chart, or press one to change its dates.' : 'None yet. Drag a bar on the chart, or press one to change its dates. Every move is kept here with who made it and why.'}
        </span>
      </Card>
    )
  }
  const shown = all ? rows : rows.slice(0, 5)
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <strong>
          {trying ? 'Tried in the what-if' : 'Changes to the schedule'} ({rows.length})
        </strong>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{trying ? 'Every move tried on the copy, newest first. Keep puts them on the real schedule.' : 'Every move, who made it and why. Newest first.'}</span>
      </div>
      {refused && <GcScheduleRefusal changes={refused} what="Nothing was undone or put back. The chart shows the new dates now." />}
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      <div style={{ display: 'grid' }}>
        {shown.map((r) => (
          <div key={r.move.id} style={{ display: 'grid', gap: '0.15rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem', opacity: r.undone ? 0.6 : 1 }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{r.who}</span>
              <Chip tone="grey">{r.reason}</Chip>
              {r.undone && <Chip tone="amber">undone</Chip>}
              <span style={{ flex: 1 }} />
              {onUndo && undoable?.id === r.move.id && (
                <Btn kind="plain" disabled={busy} onClick={() => onUndo(r.move)} title="Put every date this move changed back where it was. The move stays on the record.">
                  Undo
                </Btn>
              )}
              {onRedo && redoable?.id === r.move.id && (
                <Btn kind="plain" disabled={busy} onClick={() => onRedo(r.move)} title="Put the move back. Every date it changed moves again.">
                  Redo
                </Btn>
              )}
            </div>
            <div style={r.undone ? { textDecoration: 'line-through' } : undefined}>{r.what}</div>
            {r.move.noWhy ? <div style={{ color: 'var(--text-muted)' }}>{r.move.note}</div> : <div style={{ color: 'var(--text-base)' }}>“{r.move.note}”</div>}
            {(r.effect || r.undone) && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{[r.effect, r.undone].filter(Boolean).join(' ')}</div>}
          </div>
        ))}
      </div>
      {rows.length > 5 && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
          <Btn kind="quiet" onClick={() => setAll((v) => !v)}>
            {all ? 'Show the last 5' : `Show all ${rows.length}`}
          </Btn>
        </div>
      )}
    </Card>
  )
}

/** A part's move (G-39, PR 8b): the part's days before and after, then what its line does. Ported from the prototype with its words. */
function GcPartMoveLines({ project, pending, part, plan }: { project: GcProject; pending: PendingMove; part: NonNullable<PendingMove['part']>; plan: { same: boolean; from: { start: string; finish: string }; to: { start: string; finish: string } } }) {
  const shift = daysBetween(part.from.finish, part.finish)
  const longer = daysBetween(part.start, part.finish) - daysBetween(part.from.start, part.from.finish)
  const name = lineLabel(project, pending.lineId)
  const lineWords = plan.same
    ? `${name} keeps its dates, ${spanWords(plan.from)}. Nothing after it moves.`
    : plan.from.start === plan.to.start
      ? `${name} now ends ${weekdayDate(plan.to.finish)}.`
      : plan.from.finish === plan.to.finish
        ? `${name} now starts ${weekdayDate(plan.to.start)}.`
        : `${name} now runs ${weekdayDate(plan.to.start)} to ${weekdayDate(plan.to.finish)}.`
  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span>{part.name}</span>
        <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{spanWords(part.from)}</span>
        <span aria-hidden>→</span>
        <strong>
          {weekdayDate(part.start)} to {weekdayDate(part.finish)}
        </strong>
        {shift !== 0 && <Chip tone={shift > 0 ? 'amber' : 'green'}>{Math.abs(shift)} {Math.abs(shift) === 1 ? 'day' : 'days'} {shift > 0 ? 'later' : 'sooner'}</Chip>}
        {longer !== 0 && <Chip tone="grey">{Math.abs(longer)} {Math.abs(longer) === 1 ? 'day' : 'days'} {longer > 0 ? 'longer' : 'shorter'}</Chip>}
      </div>
      <div data-gc-part-line>{lineWords}</div>
    </>
  )
}
