import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { DROP_REASONS, DROP_REASON_MAX, DROP_TITLE, dropPressLabel, dropReasonTidy, dropRule, dropSentence } from '../../lib/tasks/taskDoerActs'
import { TASK_PILL_LIT_STYLE, TASK_PILL_STYLE } from '../../lib/tasks/taskPillStyle'
import { TaskSheetHead } from './TaskSheetHead'

/**
 * No longer applies (punch list #369, step C4, tool 3): the person doing a one-time task closes it without doing it,
 * and says why. Three reasons are one press each, in the Add row's pills, and the box takes the person's own words.
 * The press is dead until there is a reason. The task leaves the list as a finished task does, with the reason kept in
 * its thread, and whoever gave it can put it back.
 */
export function TaskDropSheet({
  open,
  taskTitle,
  giverName,
  onDrop,
  onClose,
}: {
  open: boolean
  taskTitle: string
  giverName: string | null
  /** Resolves null once the task is closed, or the reason it was not. */
  onDrop: (reason: string) => Promise<string | null>
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

  const why = dropRule(reason)
  const dead = why !== null || saving
  const press = async () => {
    if (dead) return
    setSaving(true)
    setError(null)
    try {
      const refused = await onDrop(dropReasonTidy(reason))
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
      <div role="dialog" aria-modal="true" aria-labelledby="task-drop-title" onClick={(e) => e.stopPropagation()} style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)' }}>
        <TaskSheetHead title={DROP_TITLE} labelId="task-drop-title" taskTitle={taskTitle} onClose={onClose} />
        <div role="group" aria-label="Why" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {DROP_REASONS.map((r) => {
            const on = dropReasonTidy(reason) === r
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
            setReason(e.target.value.slice(0, DROP_REASON_MAX))
            setError(null)
          }}
          placeholder="Or say why in your own words…"
          aria-label="Why it no longer applies"
          maxLength={DROP_REASON_MAX}
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: 46, padding: '0 0.75rem', fontSize: '1rem', border: '2px solid var(--text-600)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-strong)' }}
        />
        <p role="status" data-drop-sentence style={{ margin: '12px 0 8px', fontSize: 13, lineHeight: 1.4, color: why ? 'var(--text-muted)' : 'var(--text-green-700)' }}>
          {why ?? dropSentence(giverName)}
        </p>
        {error ? (
          <p role="alert" style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-red-700)' }}>
            {error}
          </p>
        ) : null}
        <button
          type="button"
          data-drop-press
          onClick={() => void press()}
          disabled={dead}
          style={{ width: '100%', minHeight: 46, borderRadius: 10, border: 'none', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: dead ? 'not-allowed' : 'pointer', background: dead ? DEAD_PRESS_FILL : '#2563eb', color: dead ? DEAD_PRESS_TEXT : '#fff', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Closing…' : dropPressLabel(!why)}
        </button>
      </div>
    </div>,
    document.body,
  )
}
