/**
 * GC mode, the real build, the schedule's PR 11: the what-if copy on real data (G-81; the plan is
 * to-dos/gc-mode/mockups/schedule-pr11.md on branch spike/gc-mode). Ported from the GC mode prototype's `GcWhatIf.tsx`,
 * its words kept. The way in and out on the chart's toolbar; the violet line over the chart while the copy is shown,
 * with Keep and Throw it away; and the window Keep goes through. The prototype sent each press to its reducer; here each
 * is a callback the Schedule window sends through the copy's own presses, never the real move save (call 3). Keep asks
 * the kernel first (`keepWhatIf`), so its refusals are said here in its words (call 5). The kept line with Tell the
 * trades waits for the schedule's PR 13 (call 8). The money team's sentence about the bills comes in from the money
 * state (call 7).
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { MOVE_REASONS, moveRows, moveWhyProblem } from '../../lib/gc/schedule/moves'
import type { ProjectSchedule, ScheduleMove, ScheduleMoveReason } from '../../lib/gc/schedule/types'
import { scheduleChangedRefusal, type ScheduleChange } from '../../lib/gc/schedule/versionRefusal'
import { keepWhatIf, whatIfBaseChangedWords, whatIfBaseChanges, whatIfProject, whatIfTried } from '../../lib/gc/schedule/whatIf'
import { whatIfLineWords } from '../../lib/gc/schedule/whatIfWindow'
import type { GcProject } from '../../lib/gc/types'
import { weekdayDate } from '../../lib/gc/words'
import { formatErrorMessage } from '../../utils/errorHandling'
import { GcScheduleRefusal } from './GcScheduleMoves'
import { Btn, Chip, input } from './gcUi'

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const
const toolBtn: CSSProperties = { background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-base)' }

/** On the chart's toolbar: make a copy, open the one there is, or go back to the real schedule. */
export function GcWhatIfButton({ project, shown, busy, onStart, onShow }: { project: GcProject; shown: boolean; busy: boolean; onStart: () => void; onShow: (copy: boolean) => void }) {
  // One border shorthand in both looks: React warns when a rerender drops a longhand beside the shorthand.
  const violet: CSSProperties = { ...toolBtn, border: '1px solid var(--text-violet-800)', color: 'var(--text-violet-800)' }
  if (shown) {
    return (
      <button type="button" data-what-if-button style={violet} onClick={() => onShow(false)} title="The copy stays open. Come back to it from here.">
        See the real schedule
      </button>
    )
  }
  if (project.whatIf) {
    return (
      <button type="button" data-what-if-button style={violet} onClick={() => onShow(true)} title="The what-if copy, with the moves tried on it.">
        What if · {whatIfTried(project).length}
      </button>
    )
  }
  return (
    <button
      type="button"
      data-what-if-button
      disabled={busy}
      style={{ ...toolBtn, ...(busy ? { cursor: 'default', opacity: 0.6 } : {}) }}
      onClick={onStart}
      title="A copy of the schedule to try moves on. Nothing reaches the trades or the customer until you keep it."
    >
      What if…
    </button>
  )
}

/**
 * Over the chart while the copy is shown: what it is, what it does against the real one, and Keep or Throw it away.
 * `project` is the real one, with its copy. `bills` is the money team's sentence; anyone else's is null.
 */
export function GcWhatIfLine({
  project,
  bills,
  busy,
  problem,
  onKeep,
  onThrowAway,
  onReal,
}: {
  project: GcProject
  bills: string | null
  busy: boolean
  problem: string | null
  onKeep: () => void
  onThrowAway: () => void
  onReal: () => void
}) {
  const [throwing, setThrowing] = useState(false)
  const line = whatIfLineWords(project, bills)
  if (!line) return null
  return (
    <div data-what-if-line style={{ display: 'grid', gap: '0.45rem', padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-violet-100)' }}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip tone="violet">what if</Chip>
        <span data-what-if-words style={{ fontSize: '0.875rem', color: 'var(--text-base)', flex: '1 1 16rem' }}>
          {line.words.join(' ')}
        </span>
      </div>
      {problem && (
        <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
          {problem}
        </div>
      )}
      {throwing ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.85rem' }}>
            {line.moves === 0 ? 'Throw away the copy?' : `Throw away the copy and its ${line.moves === 1 ? 'move' : `${line.moves} moves`}?`} The real schedule stays as it is.
          </span>
          <Btn kind="primary" disabled={busy} onClick={onThrowAway}>
            Throw it away
          </Btn>
          <Btn kind="quiet" onClick={() => setThrowing(false)}>
            Cancel
          </Btn>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn kind="primary" disabled={line.moves === 0 || busy} onClick={onKeep} title="Each move goes on the real schedule with its reason.">
            {line.moves === 0 ? 'Keep the moves…' : `Keep the ${line.moves === 1 ? 'move' : `${line.moves} moves`}…`}
          </Btn>
          <Btn kind="plain" disabled={busy} onClick={() => setThrowing(true)}>
            Throw it away
          </Btn>
          <Btn kind="quiet" onClick={onReal}>
            See the real schedule
          </Btn>
        </div>
      )}
    </div>
  )
}

type Why = { reason: ScheduleMoveReason | null; note: string }

/**
 * The window Keep goes through (G-81): the copy's moves, oldest first, each with its reason; one tried with none asks
 * for one here. Keep waits until every move has a reason and a sentence, and is refused once the real schedule moved
 * since the copy was made, with Throw it away beside the words. A save someone else beat reads the schedule again and
 * stays open (decision 6): if the copy's base still holds, the next press keeps it.
 */
export function GcWhatIfKeep({
  project,
  by,
  today,
  onKeep,
  onThrowAway,
  onReload,
  onClose,
}: {
  project: GcProject
  by: string
  today: string
  /** The kernel's answer: the real schedule with the moves on it, and the moves kept, oldest first. */
  onKeep: (kept: { schedule: ProjectSchedule; kept: ScheduleMove[] }) => Promise<void>
  onThrowAway: () => void
  onReload: () => void
  onClose: () => void
}) {
  const [whys, setWhys] = useState<Record<string, Why>>({})
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
  const copy = whatIfProject(project)
  const line = whatIfLineWords(project)
  if (!copy || !line) return null
  const tried = whatIfTried(project)
  const rows = new Map(moveRows(copy).map((r) => [r.move.id, r]))
  const changes = whatIfBaseChanges(project)
  const missing = tried.filter((m) => m.noWhy).some((m) => moveWhyProblem(whys[m.id]?.reason ?? null, whys[m.id]?.note ?? '') !== null)
  const problem = changes.length > 0 ? whatIfBaseChangedWords(changes) : tried.length === 0 ? 'Nothing was tried in the what-if.' : missing ? 'Give each move a reason and a sentence.' : null
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const set = (id: string, change: Partial<Why>) => setWhys((was) => ({ ...was, [id]: { reason: was[id]?.reason ?? null, note: was[id]?.note ?? '', ...change } }))
  const keep = async () => {
    if (problem || saving) return
    const given = Object.fromEntries(
      tried.flatMap((m) => {
        const w = whys[m.id]
        return m.noWhy && w?.reason ? [[m.id, { reason: w.reason, note: w.note.trim() }]] : []
      }),
    )
    // The kernel's rule first (call 5): its refusal is said here, and nothing is sent.
    const kept = keepWhatIf(project, given, by, today)
    if ('problem' in kept) {
      setFailed(kept.problem)
      return
    }
    setSaving(true)
    setRefused(null)
    setFailed(null)
    try {
      await onKeep(kept)
      onClose()
    } catch (e) {
      const refusal = scheduleChangedRefusal(e)
      if (refusal) {
        // Someone saved first: their changes, and the schedule reads again behind the window.
        setRefused(refusal.changes)
        onReload()
      } else setFailed(formatErrorMessage(e, 'The what-if was not kept.'))
    } finally {
      setSaving(false)
    }
  }
  const finish =
    line.finishDays === 0
      ? `The real schedule then still finishes ${weekdayDate(line.finishCopy)}.`
      : `The real schedule then finishes ${weekdayDate(line.finishCopy)}, ${Math.abs(line.finishDays)} ${Math.abs(line.finishDays) === 1 ? 'day' : 'days'} ${line.finishDays > 0 ? 'later' : 'sooner'}.`
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keep the what-if"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(620px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Keep the what-if</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>These moves go on the real schedule, oldest first, each with its reason.</div>
        </div>
        <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.6rem' }}>
          {tried.map((m) => {
            const r = rows.get(m.id)
            const w = whys[m.id]
            return (
              <li key={m.id} data-keep-move={m.id} style={{ display: 'grid', gap: '0.3rem' }}>
                <span>
                  {r?.what} {r?.effect}
                </span>
                {m.noWhy ? (
                  <div style={{ display: 'grid', gap: '0.35rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem 0.6rem' }}>
                    <span style={label}>No reason yet</span>
                    <div role="group" aria-label={`Why it moved: ${r?.what ?? m.lineId}`} style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                      {MOVE_REASONS.map((x) => {
                        const on = w?.reason === x.key
                        return (
                          <button
                            key={x.key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => set(m.id, { reason: x.key })}
                            style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: on ? 600 : 400, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-base)' }}
                          >
                            {x.label}
                          </button>
                        )
                      })}
                    </div>
                    <textarea
                      value={w?.note ?? ''}
                      onChange={(e) => set(m.id, { note: e.target.value })}
                      rows={2}
                      aria-label={`What happened, in your words: ${r?.what ?? m.lineId}`}
                      placeholder="What happened, in your words."
                      style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, padding: '0.45rem 0.55rem' }}
                    />
                  </div>
                ) : (
                  <span style={{ display: 'flex', gap: '0.4rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <Chip tone="grey">{r?.reason ?? m.reason}</Chip>
                    <span>“{m.note}”</span>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <div style={{ color: line.finishDays > 0 ? 'var(--text-red-700)' : 'var(--text-600)' }}>{finish}</div>
        {refused && <GcScheduleRefusal changes={refused} what="Nothing was kept. The chart shows the new dates now. Press Keep again if the copy still holds." />}
        {failed && (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
            {failed}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span data-keep-problem style={{ color: problem ? 'var(--text-amber-800)' : 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 12rem' }}>
            {problem ?? `Kept as moves by ${by}, today. Undo takes them off one at a time.`}
          </span>
          {changes.length > 0 && (
            <Btn kind="plain" onClick={onThrowAway}>
              Throw it away
            </Btn>
          )}
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null || saving} onClick={() => void keep()}>
            {saving ? 'Keeping…' : `Keep the ${tried.length === 1 ? 'move' : `${tried.length} moves`}`}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}
