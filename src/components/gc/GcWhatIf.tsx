/**
 * GC mode design spike: a what-if copy of the schedule (G-81, `to-dos/gc-mode/mockups/G-81.md`).
 * The way in and out on the chart's toolbar; the violet line over the chart while the copy is
 * shown, with Keep and Throw it away; the window Keep goes through; and, once kept, the line that
 * names the companies not told yet, with Tell the trades.
 */
import { useEffect, useState, type CSSProperties, type Dispatch } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import { weekdayDate, type GcAction, type GcProject, type GcState, type ScheduleMoveReason } from '../../lib/gcMode/gcModel'
import { MOVE_REASONS, moveRows, moveWhyProblem } from '../../lib/gcMode/gcScheduleMoves'
import { whatIfBaseChangedWords, whatIfBaseChanges, whatIfDiff, whatIfKeptWords, whatIfProject, whatIfTried } from '../../lib/gcMode/gcWhatIf'
import { Btn, Chip, input } from './gcUi'
import { GcTellTrades } from './GcScheduleMoves'

/** The signed-in person's name. Outside the app's sign-in (a test), none. */
function useMeName(): string | null {
  try {
    return useAuth().profileName
  } catch {
    return null
  }
}

const label = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)', textTransform: 'uppercase' } as const
const toolBtn: CSSProperties = { background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '0.25rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-base)' }

/** On the chart's toolbar: make a copy, open the one there is, or go back to the real schedule. */
export function GcWhatIfButton({ project, shown, dispatch, onShow }: { project: GcProject; shown: boolean; dispatch: Dispatch<GcAction>; onShow: (copy: boolean) => void }) {
  const me = useMeName() ?? 'The office'
  // One border shorthand in both looks: React warns when a rerender drops a longhand beside the shorthand.
  const violet: CSSProperties = { ...toolBtn, border: '1px solid var(--text-violet-800)', color: 'var(--text-violet-800)' }
  if (shown) {
    return (
      <button type="button" data-tour="gc-what-if" style={violet} onClick={() => onShow(false)} title="The copy stays open. Come back to it from here.">
        See the real schedule
      </button>
    )
  }
  if (project.whatIf) {
    return (
      <button type="button" data-tour="gc-what-if" style={violet} onClick={() => onShow(true)} title="The what-if copy, with the moves tried on it.">
        What if · {whatIfTried(project).length}
      </button>
    )
  }
  return (
    <button
      type="button"
      // The tour's round five lights this door, in each of its three looks.
      data-tour="gc-what-if"
      style={toolBtn}
      onClick={() => {
        dispatch({ type: 'startWhatIf', projectId: project.id, by: me })
        onShow(true)
      }}
      title="A copy of the schedule to try moves on. Nothing reaches the trades or the customer until you keep it."
    >
      What if…
    </button>
  )
}

/** Over the chart while the copy is shown: what it is, what it does against the real one, and Keep or Throw it away. */
export function GcWhatIfLine({ state, project, dispatch, onKeep, onReal }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; onKeep: () => void; onReal: () => void }) {
  const me = useMeName() ?? 'The office'
  const [throwing, setThrowing] = useState(false)
  const diff = whatIfDiff(state, project)
  if (!diff) return null
  return (
    <div data-tour="gc-what-if-line" style={{ display: 'grid', gap: '0.45rem', padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-violet-100)' }}>
      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip tone="violet">what if</Chip>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-base)', flex: '1 1 16rem' }}>{diff.words.join(' ')}</span>
      </div>
      {throwing ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.85rem' }}>
            {diff.moves === 0 ? 'Throw away the copy?' : `Throw away the copy and its ${diff.moves === 1 ? 'move' : `${diff.moves} moves`}?`} The real schedule stays as it is.
          </span>
          <Btn
            kind="primary"
            onClick={() => {
              dispatch({ type: 'throwAwayWhatIf', projectId: project.id, by: me })
              onReal()
            }}
          >
            Throw it away
          </Btn>
          <Btn kind="quiet" onClick={() => setThrowing(false)}>
            Cancel
          </Btn>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Btn kind="primary" disabled={diff.moves === 0} onClick={onKeep} title="Each move goes on the real schedule with its reason. The trades are told when you press Tell the trades.">
            {diff.moves === 0 ? 'Keep the moves…' : `Keep the ${diff.moves === 1 ? 'move' : `${diff.moves} moves`}…`}
          </Btn>
          <Btn kind="plain" onClick={() => setThrowing(true)}>
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
 * The window Keep goes through (G-81): the copy's moves, oldest first, each with its reason; one
 * tried with none asks for one here. Keep waits until every move has a reason and a sentence, and
 * is refused once the real schedule moved since the copy was made.
 */
export function GcWhatIfKeep({ state, project, dispatch, onClose, onKept }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction>; onClose: () => void; onKept: () => void }) {
  const me = useMeName() ?? 'The office'
  const [whys, setWhys] = useState<Record<string, Why>>({})
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const copy = whatIfProject(project)
  const diff = whatIfDiff(state, project)
  if (!copy || !diff) return null
  const tried = whatIfTried(project)
  const rows = new Map(moveRows(copy).map((r) => [r.move.id, r]))
  const changes = whatIfBaseChanges(project)
  const missing = tried.filter((m) => m.noWhy).some((m) => moveWhyProblem(whys[m.id]?.reason ?? null, whys[m.id]?.note ?? '') !== null)
  const problem = changes.length > 0 ? whatIfBaseChangedWords(changes) : tried.length === 0 ? 'Nothing was tried in the what-if.' : missing ? 'Give each move a reason and a sentence.' : null
  const phone = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches
  const set = (id: string, change: Partial<Why>) => setWhys((was) => ({ ...was, [id]: { reason: was[id]?.reason ?? null, note: was[id]?.note ?? '', ...change } }))
  const keep = () => {
    if (problem) return
    const given = Object.fromEntries(
      tried.flatMap((m) => {
        const w = whys[m.id]
        return m.noWhy && w?.reason ? [[m.id, { reason: w.reason, note: w.note.trim() }]] : []
      }),
    )
    dispatch({ type: 'keepWhatIf', projectId: project.id, by: me, whys: given })
    onKept()
    onClose()
  }
  const finish =
    diff.finishDays === 0
      ? `The real schedule then still finishes ${weekdayDate(diff.finishCopy)}.`
      : `The real schedule then finishes ${weekdayDate(diff.finishCopy)}, ${Math.abs(diff.finishDays)} ${Math.abs(diff.finishDays) === 1 ? 'day' : 'days'} ${diff.finishDays > 0 ? 'later' : 'sooner'}.`
  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: phone ? 'flex-end' : 'center', justifyContent: 'center', padding: phone ? 0 : '1rem' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keep the what-if"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-base)', borderRadius: phone ? '12px 12px 0 0' : 12, width: phone ? '100%' : 'min(620px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 24px 48px rgba(0,0,0,0.22)', padding: '1rem', display: 'grid', gap: '0.75rem', fontSize: '0.9rem' }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Keep the what-if</h3>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>These moves go on the real schedule, oldest first, each with its reason. The trades are told when you press Tell the trades.</div>
        </div>
        <ol style={{ margin: 0, paddingLeft: '1.2rem', display: 'grid', gap: '0.6rem' }}>
          {tried.map((m) => {
            const r = rows.get(m.id)
            const w = whys[m.id]
            return (
              <li key={m.id} style={{ display: 'grid', gap: '0.3rem' }}>
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
        <div style={{ color: diff.finishDays > 0 ? 'var(--text-red-700)' : 'var(--text-600)' }}>{finish}</div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
          <span style={{ color: problem ? 'var(--text-amber-800)' : 'var(--text-muted)', fontSize: '0.82rem', flex: '1 1 12rem' }}>{problem ?? `Kept as moves by ${me}, today. Undo takes them off one at a time.`}</span>
          <Btn kind="quiet" onClick={onClose}>
            Cancel
          </Btn>
          <Btn kind="primary" disabled={problem !== null} onClick={keep}>
            Keep the {tried.length === 1 ? 'move' : `${tried.length} moves`}
          </Btn>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Once kept, over the chart until they are told: the companies the kept moves changed days for, and Tell the trades. */
export function GcWhatIfKept({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const [telling, setTelling] = useState(false)
  const kept = whatIfKeptWords(state, project)
  if (!kept) return null
  return (
    <div data-tour="gc-what-if-kept" style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.55rem 0.75rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-violet-100)' }}>
      <Chip tone="violet">kept</Chip>
      <span style={{ fontSize: '0.875rem', flex: '1 1 14rem' }}>{kept.words}</span>
      <Btn kind="primary" onClick={() => setTelling(true)} title="Each company whose days moved gets one message with its old and new days and why.">
        Tell the trades
      </Btn>
      {telling && <GcTellTrades state={state} project={project} dispatch={dispatch} onClose={() => setTelling(false)} />}
    </div>
  )
}
