/**
 * GC mode, the real build, the schedule's PR 9d: pulling work earlier (G-37), ported from the GC mode prototype (branch
 * spike/gc-mode, `GcPullEarlier.tsx`; the plan is to-dos/gc-mode/mockups/schedule-pr9d.md there). Work that finished
 * early catches its plan up, and the work right behind it can start sooner, by the days it gave back, on a press, never
 * by itself. Three pieces: the line over the chart, the window every pull goes through (what finished, what comes in
 * with a tick each, what keeps its dates, then why), and a small box for one bar in the walk and in its form. A pull is
 * re-planned at the press from the schedule as read (`planPull`) and saved as one move (`pullMove`) through the
 * window's one save, against the version read; someone else's save first is refused and the schedule read again. The
 * billing line, the money team's only, came with the schedule's PR 16c (`billingOf`).
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { MOVE_REASONS, moveWhyProblem, spanWords, type MovePlan } from '../../lib/gc/schedule/moves'
import { planPull, pullCountWords, pullMove, pullSentences, pullWordsFor, type PullOffer } from '../../lib/gc/schedule/pullEarlier'
import { pullLogWords } from '../../lib/gc/schedule/scheduleWindow'
import type { ScheduleActivity, ScheduleMove, ScheduleMoveReason } from '../../lib/gc/schedule/types'
import { scheduleChangedRefusal, type ScheduleChange } from '../../lib/gc/schedule/versionRefusal'
import type { GcProject, GcState } from '../../lib/gc/types'
import { shortDate, weekdayDate } from '../../lib/gc/words'
import { formatErrorMessage } from '../../utils/errorHandling'
import { GcScheduleRefusal } from './GcScheduleMoves'
import { Btn, Chip, input } from './gcUi'

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const

/** The window's one save: the move, the bars as it leaves them, its line in the log. Answers the saved move's id, when found. */
export type ScheduleSave = (move: ScheduleMove, activities: ScheduleActivity[], words: string) => Promise<string | null>

/** Over the chart, under the walk line: work finished early, and either the press or what holds the days. Nothing when there is neither. */
export function GcPullLine({ offer, onPull }: { offer: PullOffer; onPull: () => void }) {
  if (offer.show === 'quiet') return null
  return (
    <div data-pull-line style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-green-tint)' }}>
      <Chip tone="green">finished early</Chip>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-600)', flex: '1 1 14rem' }}>{pullSentences(offer).join(' ')}</span>
      {offer.show === 'pull' && (
        <Btn kind="primary" onClick={onPull} title="Opens the window every pull goes through: what comes in, what keeps its dates, and why.">
          Pull the work earlier
        </Btn>
      )}
    </div>
  )
}

/** One bar's word from the offer, with the press when there is one: in the walk, and in the bar's form. */
export function GcPullBox({ offer, lineId, onPull }: { offer: PullOffer; lineId: string; onPull: () => void }) {
  const words = pullWordsFor(offer, lineId)
  if (!words) return null
  return (
    <div data-pull-box style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', background: 'var(--bg-green-tint)', border: '1px solid var(--bg-green-200)', borderRadius: 8, padding: '0.5rem 0.65rem', fontSize: '0.85rem' }}>
      <span style={{ flex: '1 1 14rem', color: 'var(--text-600)' }}>{words}</span>
      {offer.show === 'pull' && (
        <Btn kind="plain" onClick={onPull}>
          Pull the work earlier…
        </Btn>
      )}
    </div>
  )
}

/**
 * The window a pull is saved from (G-37): what finished early, each bar that comes in with a tick, what keeps its dates
 * and why, what it does to the finish, then the reason and the sentence. Unticking one re-plans the pull: it keeps its
 * dates, and so does what waited only on it.
 */
export function GcPullWindow({
  state,
  project,
  by,
  onSave,
  onReload,
  onClose,
  onSaved,
  billingOf,
}: {
  state: GcState
  project: GcProject
  by: string
  onSave: ScheduleSave
  onReload: () => void
  onClose: () => void
  /** The pull saved, with its move's id when the read after it shows it (the walk keeps it). */
  onSaved?: (moveId: string | null) => void
  /** What a plan moves between the customer's bills (9d's billing line, the schedule's PR 16c): the money team's only. */
  billingOf?: (plan: Pick<MovePlan, 'activities'>) => string | null
}) {
  const [leaveOut, setLeaveOut] = useState<string[]>([])
  const [reason, setReason] = useState<ScheduleMoveReason | null>('early')
  const [note, setNote] = useState(() => planPull(state, project)?.note ?? '')
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
  // Every bar that could come in, for the ticks; and the pull as the ticks have it.
  const full = useMemo(() => planPull(state, project), [state, project])
  const plan = useMemo(() => planPull(state, project, leaveOut), [state, project, leaveOut])
  const billing = useMemo(() => (billingOf && plan && plan.pulls.length > 0 ? billingOf(plan) : null), [billingOf, plan])
  if (!full || !plan || full.show !== 'pull' || !project.schedule) return null
  const schedule = project.schedule
  const problem = plan.pulls.length === 0 ? 'Tick at least one to pull.' : moveWhyProblem(reason, note)
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const toggle = (lineId: string) => setLeaveOut((was) => (was.includes(lineId) ? was.filter((x) => x !== lineId) : [...was, lineId]))
  const save = async () => {
    if (problem || !reason || saving) return
    const why = { reason, note: note.trim(), by }
    const move = pullMove(schedule, plan, why, state.today)
    if (!move) return
    setSaving(true)
    setRefused(null)
    setFailed(null)
    try {
      const moveId = await onSave(move, plan.activities, pullLogWords(project, plan, by))
      onSaved?.(moveId)
      onClose()
    } catch (e) {
      const refusal = scheduleChangedRefusal(e)
      if (refusal) {
        // Someone saved first: their changes, and the chart reads again behind the window.
        setRefused(refusal.changes)
        onReload()
      } else setFailed(formatErrorMessage(e, 'The pull did not save.'))
    } finally {
      setSaving(false)
    }
  }
  const kept = plan.stays.filter((s) => !s.left)
  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pull the work earlier"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(620px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Pull the work earlier</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Work finished early. What was right behind it can start sooner.</div>
        </div>
        <div style={{ display: 'grid', gap: '0.45rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.6rem 0.7rem' }}>
          <span style={label}>Finished early</span>
          {plan.finished.map((f) => (
            <div key={f.lineId} style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <strong style={{ flex: '1 1 12rem' }}>
                {f.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {f.company}</span>
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>
                planned {shortDate(f.planned.finish)}, done {shortDate(f.finishedOn)}
              </span>
              <Chip tone="green">
                {f.early} {f.early === 1 ? 'day' : 'days'} early
              </Chip>
            </div>
          ))}
          <span style={{ ...label, marginTop: '0.3rem' }}>Can start sooner</span>
          {full.pulls.map((p) => {
            const now = plan.pulls.find((x) => x.lineId === p.lineId)
            const left = leaveOut.includes(p.lineId)
            return (
              <label key={p.lineId} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '0.5rem', alignItems: 'start', cursor: now || left ? 'pointer' : 'default' }}>
                <input type="checkbox" checked={Boolean(now)} disabled={!now && !left} onChange={() => toggle(p.lineId)} aria-label={`Pull ${p.name} earlier`} style={{ marginTop: '0.2rem' }} />
                <span style={{ display: 'grid', gap: '0.1rem' }}>
                  <span>
                    <strong>{p.name}</strong> <span style={{ color: 'var(--text-muted)' }}>· {p.company}</span>
                  </span>
                  {now ? (
                    <span style={{ display: 'flex', gap: '0.45rem', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{spanWords(now.from)}</span>
                      <span aria-hidden>→</span>
                      <span>
                        {weekdayDate(now.to.start)} to {weekdayDate(now.to.finish)}
                      </span>
                      <Chip tone="green">
                        {now.days} {now.days === 1 ? 'day' : 'days'} sooner
                      </Chip>
                      {now.limit && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{now.limit}</span>}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{left ? 'Left out. It keeps its dates.' : 'It keeps its dates, with the work before it.'}</span>
                  )}
                </span>
              </label>
            )
          })}
          {kept.length > 0 && (
            <>
              <span style={{ ...label, marginTop: '0.3rem' }}>Keeps its dates</span>
              {kept.map((s) => (
                <div key={s.lineId} style={{ fontSize: '0.85rem', color: s.held ? 'var(--text-amber-800)' : 'var(--text-600)' }}>
                  <strong>{s.name}</strong> <span style={{ color: 'var(--text-muted)' }}>· {s.company}</span>: {s.why}
                </div>
              ))}
            </>
          )}
          <div style={{ color: plan.finishDays < 0 ? 'var(--text-green-800)' : 'var(--text-600)', fontWeight: plan.finishDays < 0 ? 600 : 400, marginTop: '0.2rem' }}>{plan.words.finish}</div>
          {billing && <div data-pull-billing style={{ color: 'var(--text-600)' }}>Billing: {billing}</div>}
          {plan.words.lost && <div style={{ color: 'var(--text-amber-800)' }}>{plan.words.lost}</div>}
        </div>
        {refused && <GcScheduleRefusal changes={refused} what="Your pull was not saved. The chart shows the new dates now. Look at it again on them." />}
        <WhyItMoved reason={reason} onReason={setReason} />
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
            style={{ ...input, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4, padding: '0.45rem 0.55rem' }}
          />
        </label>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Untick one a trade cannot start sooner. It keeps its dates, and so does what waits on it.</div>
        {failed && (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.85rem' }}>
            {failed}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 10rem' }}>{problem ?? `Saved as one move by ${by}, today. Undo puts every date back.`}</span>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null || saving} onClick={() => void save()}>
            Pull {pullCountWords(plan)} earlier
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** The reasons a move takes (`MOVE_REASONS`), one pressed: the pull's, the days back's and the walk's. */
export function WhyItMoved({ reason, onReason, small = false }: { reason: ScheduleMoveReason | null; onReason: (r: ScheduleMoveReason) => void; small?: boolean }) {
  const buttons = (
    <div role="group" aria-label="Why it moved" style={{ display: 'flex', gap: small ? '0.3rem' : '0.35rem', flexWrap: 'wrap' }}>
      {MOVE_REASONS.map((r) => {
        const on = reason === r.key
        return (
          <button
            key={r.key}
            type="button"
            aria-pressed={on}
            onClick={() => onReason(r.key)}
            style={{ border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, borderRadius: 999, padding: small ? '0.2rem 0.65rem' : '0.25rem 0.7rem', fontSize: small ? '0.8rem' : '0.82rem', cursor: 'pointer', fontWeight: on ? 600 : 400, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-base)' }}
          >
            {r.label}
          </button>
        )
      })}
    </div>
  )
  if (small) return buttons
  return (
    <div style={{ display: 'grid', gap: '0.35rem' }}>
      <span style={label}>Why it moved</span>
      {buttons}
    </div>
  )
}
