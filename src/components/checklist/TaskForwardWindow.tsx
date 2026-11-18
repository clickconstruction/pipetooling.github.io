import { useState } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { FORWARD_KEEPS_WORDS, FORWARD_PICK_LABEL, FORWARD_TITLE, forwardPressLabel, type HandPerson } from '../../lib/tasks/taskDoerActs'

/**
 * The office's Forward window (v2.7563): the task's words, who takes it, and one press. The task itself goes
 * (`handOnTask`), so the window takes no new title. My Inbox draws it, and Checklist's Today and Review since v2.7587; a refusal stays in the window in its words.
 */
export function TaskForwardWindow({ title, people, saving, refusal, onForward, onClose }: {
  /** The task's words, already plain. */
  title: string
  /** Who may take it: `forwardTakers`. */
  people: ReadonlyArray<HandPerson>
  saving: boolean
  /** Why the last press did not take, in the database's own words. */
  refusal: string | null
  onForward: (toUserId: string) => void
  onClose: () => void
}) {
  const [toId, setToId] = useState('')
  const taker = people.find((p) => p.id === toId) ?? null
  const ready = taker !== null && !saving
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 750, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-label={FORWARD_TITLE} style={{ background: 'var(--surface)', borderRadius: 8, padding: '1.5rem', minWidth: 320, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>{FORWARD_TITLE}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <div style={{ marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Title</div>
            <div data-fwd-title style={{ fontSize: '0.9375rem', lineHeight: 1.35 }}>{title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{FORWARD_KEEPS_WORDS}</div>
          </div>
          <div>
            <label htmlFor="task-forward-to" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Assign to</label>
            <select
              id="task-forward-to"
              value={toId}
              onChange={(e) => setToId(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
            >
              <option value="" disabled>{FORWARD_PICK_LABEL}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {refusal && (
            <div role="alert" style={{ fontSize: '0.85rem', color: 'var(--text-red-700)' }}>{refusal}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => taker && onForward(taker.id)}
            disabled={!ready}
            title={taker ? undefined : `${FORWARD_PICK_LABEL} first`}
            style={{ padding: '0.5rem 1rem', background: ready ? '#2563eb' : DEAD_PRESS_FILL, color: ready ? 'white' : DEAD_PRESS_TEXT, border: 'none', borderRadius: 4, cursor: ready ? 'pointer' : 'not-allowed', fontWeight: 500 }}
          >
            {forwardPressLabel(taker?.name ?? null, saving)}
          </button>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '0.5rem 1rem', background: 'var(--bg-200)', color: 'var(--text-700)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
