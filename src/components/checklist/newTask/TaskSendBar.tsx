import type { KeyboardEventHandler, RefObject } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../../lib/deadPress'

type Props = {
  /** What Send will do, from `newTaskSentence`. While something is missing it names that. */
  sentence: string
  /** Send cannot go yet. */
  dead: boolean
  /** The words on Send, from `taskSendLabel`. */
  label: string
  submitting: boolean
  onSend: () => void
  /** The bell: the giver hears when the task is done. Null hides it, on a task that is only the giver's. */
  tellMe: boolean | null
  onTellMe: (next: boolean) => void
  /** What went wrong on the last Send, or null. */
  error: string | null
  sendRef?: RefObject<HTMLButtonElement>
  /** The words on Send while it works. *Sending…* unless the window saves an edit. */
  busyLabel?: string
  /** The bell's words. *Tell me* unless the giver is someone else, whom it then names. */
  tellLabel?: string
  onSendKeyDown?: KeyboardEventHandler<HTMLButtonElement>
}

/**
 * The bar at the bottom of the New task window (punch list #331). It says in words what Send will
 * do, where the eye ends, and its button names who gets the task. The only solid blue in the
 * window is this button. The bell beside it is *Tell me when it's done*, lit by default.
 */
export function TaskSendBar({ sentence, dead, label, submitting, onSend, tellMe, onTellMe, error, sendRef, onSendKeyDown, busyLabel = 'Sending…', tellLabel = 'Tell me' }: Props) {
  const held = dead || submitting
  return (
    <div data-testid="new-task-bar" style={{ display: 'grid', gap: 8 }}>
      <p role="status" style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: dead ? 'var(--text-muted)' : 'var(--text-green-700)' }}>
        {sentence}
      </p>
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : null}
      <div style={{ display: 'flex', gap: 8 }}>
        {tellMe === null ? null : (
          <button
            type="button"
            aria-pressed={tellMe}
            aria-label={`${tellLabel} when it's done`}
            title={tellMe ? 'A note goes out when it is done. Press to turn that off.' : 'No note goes out when it is done. Press to turn that on.'}
            onClick={() => onTellMe(!tellMe)}
            style={{
              flex: 'none',
              font: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              minHeight: 46,
              padding: '0 11px',
              borderRadius: 10,
              border: tellMe ? '1px solid #2563eb' : '1px solid var(--border-strong)',
              background: tellMe ? 'var(--bg-blue-tint)' : 'var(--surface)',
              color: tellMe ? 'var(--text-blue-800)' : 'var(--text-muted)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden>{tellMe ? '🔔' : '🔕'}</span> {tellLabel}
          </button>
        )}
        <button
          type="button"
          ref={sendRef}
          onClick={onSend}
          disabled={held}
          onKeyDown={onSendKeyDown}
          style={{
            flex: '1 1 0',
            minWidth: 0,
            font: 'inherit',
            fontSize: 15,
            fontWeight: 700,
            minHeight: 46,
            padding: '0 12px',
            borderRadius: 10,
            border: 'none',
            background: dead ? DEAD_PRESS_FILL : '#2563eb',
            color: dead ? DEAD_PRESS_TEXT : '#fff',
            cursor: held ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {submitting ? busyLabel : label}
        </button>
      </div>
    </div>
  )
}
