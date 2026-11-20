import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { dayLabel } from '../../lib/checklistDueDates'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { MOVE_DAY_PICK_LABEL, MOVE_DAY_TITLE, moveDayPicks, moveDayPressLabel, moveDayRule, moveDaySentence } from '../../lib/tasks/taskDoerActs'
import { TaskSheetHead } from './TaskSheetHead'

type Choice = 'tomorrow' | 'monday' | 'day'

/**
 * Not today (punch list #369, step C3, tool 1): the person doing a one-time task moves it to a day they can do it. One
 * joined bar in the New task window's shape, *Tomorrow · Monday · Pick a day*, a green line that says what the press
 * will do, and a press that names the day. The date box opens only for Pick a day. The task's due day moves; the task
 * keeps its place in the list and its thread.
 */
export function TaskMoveDaySheet({
  open,
  taskTitle,
  todayYmd,
  dueYmd = null,
  giverName,
  onMove,
  onClose,
}: {
  open: boolean
  taskTitle: string
  todayYmd: string
  /** The day the task is due now, which the press will not move it to again. */
  dueYmd?: string | null
  giverName: string | null
  /** Resolves null once the task has moved, or the reason it did not. */
  onMove: (ymd: string) => Promise<string | null>
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const [choice, setChoice] = useState<Choice | null>(null)
  const [picked, setPicked] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setChoice(null)
    setPicked('')
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

  const picks = moveDayPicks(todayYmd)
  const ymd = choice === 'day' ? picked || null : choice ? (picks.find((p) => p.key === choice)?.ymd ?? null) : null
  const why = moveDayRule(ymd, todayYmd, dueYmd)
  const dead = why !== null || saving
  const day = ymd && !why ? dayLabel(ymd) : null

  const press = async () => {
    if (dead || !ymd) return
    setSaving(true)
    setError(null)
    try {
      const refused = await onMove(ymd)
      if (refused) setError(refused)
      else onClose()
    } finally {
      setSaving(false)
    }
  }

  const panel: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: '18px 18px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxHeight: '88vh', overflowY: 'auto' }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(440px, calc(100vw - 32px))', borderRadius: 16, padding: '16px 18px' }
  const segments: Array<[Choice, string]> = [...picks.map((p): [Choice, string] => [p.key, p.label]), ['day', MOVE_DAY_PICK_LABEL]]

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 1210, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="task-move-day-title" onClick={(e) => e.stopPropagation()} style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)' }}>
        <TaskSheetHead title={MOVE_DAY_TITLE} labelId="task-move-day-title" taskTitle={taskTitle} onClose={onClose} />
        <div role="group" aria-label="Move it to" style={{ display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden', minWidth: 0 }}>
          {segments.map(([key, label], i) => {
            const on = choice === key
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setChoice(key)
                  setError(null)
                }}
                style={{
                  flex: '1 1 0',
                  minWidth: 0,
                  font: 'inherit',
                  fontSize: 13,
                  minHeight: 42,
                  padding: '0 6px',
                  border: 'none',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--border)',
                  borderRadius: on ? (i === 0 ? '9px 0 0 9px' : i === segments.length - 1 ? '0 9px 9px 0' : 0) : 0,
                  background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: on ? 'var(--text-blue-800)' : 'var(--text-strong)',
                  fontWeight: on ? 700 : 400,
                  boxShadow: on ? 'inset 0 0 0 1.5px #2563eb' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
        {choice === 'day' ? (
          <input
            type="date"
            aria-label="The day"
            value={picked}
            min={todayYmd}
            onChange={(e) => {
              setPicked(e.target.value)
              setError(null)
            }}
            style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: 46, marginTop: 10, padding: '0 0.75rem', fontSize: '1rem', border: '2px solid var(--text-600)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-strong)' }}
          />
        ) : null}
        <p role="status" data-move-day-sentence style={{ margin: '12px 0 8px', fontSize: 13, lineHeight: 1.4, color: day ? 'var(--text-green-700)' : 'var(--text-muted)' }}>
          {day ? moveDaySentence(day, giverName) : choice ? why : 'Pick the day you can do it.'}
        </p>
        {error ? (
          <p role="alert" style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-red-700)' }}>
            {error}
          </p>
        ) : null}
        <button
          type="button"
          data-move-day-press
          onClick={() => void press()}
          disabled={dead}
          style={{ width: '100%', minHeight: 46, borderRadius: 10, border: 'none', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: dead ? 'not-allowed' : 'pointer', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Moving…' : moveDayPressLabel(day)}
        </button>
      </div>
    </div>,
    document.body,
  )
}
