import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { HAND_ASK, HAND_LIST_MAX, HAND_REASON_MAX, HAND_TITLE, handBackLabel, handPeople, handPressLabel, handSentence, type HandPerson } from '../../lib/tasks/taskDoerActs'
import { TASK_PILL_LIT_STYLE, TASK_PILL_STYLE } from '../../lib/tasks/taskPillStyle'
import { TaskSheetHead } from './TaskSheetHead'

/**
 * Hand it on (punch list #369, step C7, tool 7): the person doing a task gives it to the right person, or back to
 * whoever gave it. The task stays the same task, with its notes, place, lines and photos: only who it is for changes.
 * The office's FWD made a copy for the other person and deleted the first, with its thread.
 *
 * *Back to Imani* is one press. Anyone else is found by name. A reason is asked for and not required. The press names
 * who takes it.
 */
export function TaskHandOnSheet({
  open,
  taskTitle,
  once,
  selfId,
  giver,
  people,
  peopleError = null,
  onHand,
  onClose,
}: {
  open: boolean
  taskTitle: string
  /** A one-time task moves whole. A task that repeats gives away this day alone. */
  once: boolean
  selfId: string | null
  /** Who gave the task, offered first as *Back to …*. Null when the person gave it to themself. */
  giver: HandPerson | null
  /** Everyone who can take a task in the app. */
  people: ReadonlyArray<HandPerson>
  peopleError?: string | null
  /** Resolves null once the task is handed on, or the reason it was not. */
  onHand: (to: HandPerson, reason: string) => Promise<string | null>
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const [taker, setTaker] = useState<HandPerson | null>(null)
  const [query, setQuery] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTaker(null)
    setQuery('')
    setReason('')
    setSaving(false)
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const others = handPeople(people, selfId, query).filter((p) => p.id !== giver?.id)
  const listed = query.trim() ? others : others.slice(0, HAND_LIST_MAX)
  const dead = !taker || saving
  const told = taker && giver && giver.id !== taker.id ? giver.name : null
  const press = async () => {
    if (dead || !taker) return
    setSaving(true)
    setError(null)
    try {
      const refused = await onHand(taker, reason.replace(/\s+/g, ' ').trim())
      if (refused) setError(refused)
      else onClose()
    } finally {
      setSaving(false)
    }
  }
  const pick = (p: HandPerson) => {
    setTaker(taker?.id === p.id ? null : p)
    setError(null)
  }

  const panel: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: '18px 18px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxHeight: '88vh', overflowY: 'auto' }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(440px, calc(100vw - 32px))', borderRadius: 16, padding: '16px 18px', maxHeight: '88vh', overflowY: 'auto' }
  const box: React.CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', height: 46, padding: '0 0.75rem', fontSize: '1rem', border: '2px solid var(--text-600)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-strong)' }

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 1210, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="task-hand-on-title" onClick={(e) => e.stopPropagation()} style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)' }}>
        <TaskSheetHead title={HAND_TITLE} labelId="task-hand-on-title" taskTitle={taskTitle} onClose={onClose} />
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>{HAND_ASK}</div>
        {giver ? (
          <div style={{ marginBottom: 10 }}>
            <button type="button" data-hand-back aria-pressed={taker?.id === giver.id} onClick={() => pick(giver)} style={{ ...TASK_PILL_STYLE, minHeight: 38, ...(taker?.id === giver.id ? TASK_PILL_LIT_STYLE : {}) }}>
              {handBackLabel(giver.name)}
            </button>
          </div>
        ) : null}
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a person…" aria-label="Find a person" style={box} />
        {peopleError ? (
          <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-red-700)' }}>
            {peopleError}
          </p>
        ) : null}
        <div role="group" aria-label="People" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
          {listed.map((p) => (
            <button key={p.id} type="button" data-hand-person={p.id} aria-pressed={taker?.id === p.id} onClick={() => pick(p)} style={{ ...TASK_PILL_STYLE, minHeight: 38, ...(taker?.id === p.id ? TASK_PILL_LIT_STYLE : {}) }}>
              {p.name}
            </button>
          ))}
          {listed.length === 0 && !peopleError ? <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{query.trim() ? 'Nobody by that name can take a task. Try fewer letters.' : 'Type a name to find someone.'}</span> : null}
          {!query.trim() && others.length > listed.length ? <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>Type a name for the rest.</span> : null}
        </div>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value.slice(0, HAND_REASON_MAX))} placeholder="Why, if it helps them…" aria-label="Why" maxLength={HAND_REASON_MAX} style={box} />
        <p role="status" data-hand-sentence style={{ margin: '12px 0 8px', fontSize: 13, lineHeight: 1.4, color: taker ? 'var(--text-green-700)' : 'var(--text-muted)' }}>
          {taker ? handSentence({ takerName: taker.name, once, toldName: told }) : 'Pick who takes it.'}
        </p>
        {error ? (
          <p role="alert" style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-red-700)' }}>
            {error}
          </p>
        ) : null}
        <button
          type="button"
          data-hand-press
          onClick={() => void press()}
          disabled={dead}
          style={{ width: '100%', minHeight: 46, borderRadius: 10, border: 'none', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: dead ? 'not-allowed' : 'pointer', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Handing on…' : handPressLabel(taker?.name ?? null)}
        </button>
      </div>
    </div>,
    document.body,
  )
}
