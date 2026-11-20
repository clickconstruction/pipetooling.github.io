import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { STUCK_ASK, STUCK_REASONS, STUCK_REASON_MAX, STUCK_TITLE, stuckPressLabel, stuckReasonTidy, stuckRule, stuckSentence } from '../../lib/tasks/taskDoerActs'
import { TASK_PILL_LIT_STYLE, TASK_PILL_STYLE } from '../../lib/tasks/taskPillStyle'
import { TaskSheetHead } from './TaskSheetHead'

/**
 * Can't do it (punch list #369, step C6, tool 2): the person doing a task says what is in the way, in one press, and
 * whoever gave it is told. Four reasons as pills and a box for the person's own words. The press names who is told.
 * The task stays the person's own: it wears an amber *Stuck* line, sits under the tasks that can be done, and shows on
 * the office's Review until someone says it is sorted.
 */
export function TaskStuckSheet({
  open,
  taskTitle,
  giverName,
  onSay,
  onClose,
}: {
  open: boolean
  taskTitle: string
  giverName: string | null
  /** Resolves null once the line is written, or the reason it was not. */
  onSay: (reason: string) => Promise<string | null>
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
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

  const why = stuckRule(reason)
  const dead = why !== null || saving
  const press = async () => {
    if (dead) return
    setSaving(true)
    setError(null)
    try {
      const refused = await onSay(stuckReasonTidy(reason))
      if (refused) setError(refused)
      else onClose()
    } finally {
      setSaving(false)
    }
  }

  const panel: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: '18px 18px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxHeight: '88vh', overflowY: 'auto' }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(440px, calc(100vw - 32px))', borderRadius: 16, padding: '16px 18px' }

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 1210, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="task-stuck-title" onClick={(e) => e.stopPropagation()} style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)' }}>
        <TaskSheetHead title={STUCK_TITLE} labelId="task-stuck-title" taskTitle={taskTitle} onClose={onClose} />
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: 8 }}>{STUCK_ASK}</div>
        <div role="group" aria-label={STUCK_ASK} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {STUCK_REASONS.map((r) => {
            const on = stuckReasonTidy(reason) === r
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setReason(on ? '' : r)
                  setError(null)
                }}
                style={{ ...TASK_PILL_STYLE, ...(on ? TASK_PILL_LIT_STYLE : {}) }}
              >
                {r}
              </button>
            )
          })}
        </div>
        <input
          type="text"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value.slice(0, STUCK_REASON_MAX))
            setError(null)
          }}
          placeholder="Or say it in your own words…"
          aria-label="What is in the way"
          maxLength={STUCK_REASON_MAX}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: 46, padding: '0 0.75rem', fontSize: '1rem', border: '2px solid var(--text-600)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-strong)' }}
        />
        <p role="status" data-stuck-sentence style={{ margin: '12px 0 8px', fontSize: 13, lineHeight: 1.4, color: why ? 'var(--text-muted)' : 'var(--text-green-700)' }}>
          {why ?? stuckSentence(giverName)}
        </p>
        {error ? (
          <p role="alert" style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-red-700)' }}>
            {error}
          </p>
        ) : null}
        <button
          type="button"
          data-stuck-press
          onClick={() => void press()}
          disabled={dead}
          style={{ width: '100%', minHeight: 46, borderRadius: 10, border: 'none', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: dead ? 'not-allowed' : 'pointer', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : stuckPressLabel(!why, giverName)}
        </button>
      </div>
    </div>,
    document.body,
  )
}
