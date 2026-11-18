/**
 * Tell the dev (punch list #380): the box's insides, the same at a desk and on a phone.
 *
 * Three starts, the rest of the sentence, the list of what goes with the note, and one press.
 * Everything the note will carry is on screen before the press. No picture of the screen is taken.
 */
import { useId } from 'react'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { NOTE_BODY_MAX, NOTE_STARTS, canSendNote, noteStart, type NoteKind } from '../../lib/tellTheDev/starts'
import type { NoteContextLine } from '../../lib/tellTheDev/noteContext'
import type { MyNoteLine } from '../../lib/tellTheDev/myNotes'

export type TellTheDevBoxProps = {
  kind: NoteKind
  onKind: (kind: NoteKind) => void
  typed: string
  onTyped: (typed: string) => void
  lines: NoteContextLine[]
  sending: boolean
  /** Set once a note has gone; the box says so and offers another. */
  sent: boolean
  onSendAnother: () => void
  /** The reason a send failed, in words. The typed words are still in the box. */
  error: string | null
  onSend: () => void
  /** The person's own last notes, each with where it stands and its answer when there is one. */
  notes?: MyNoteLine[]
}

/** *Your notes*: the loop closing. An answer the person has not seen yet is ringed. */
function YourNotes({ notes }: { notes: MyNoteLine[] }) {
  if (notes.length === 0) return null
  return (
    <section aria-label="Your notes" style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>Your notes</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {notes.map((n) => (
          <li key={n.id} style={{ padding: '0.35rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
            <div style={{ color: n.wordless ? 'var(--text-muted)' : 'var(--text-base)', fontStyle: n.wordless ? 'italic' : undefined, overflowWrap: 'anywhere' }}>
              {n.words}{' '}
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  fontStyle: 'normal',
                  padding: '0.05rem 0.45rem',
                  borderRadius: 999,
                  whiteSpace: 'nowrap',
                  color: n.state === 'answered' ? 'var(--text-green-800)' : 'var(--text-muted)',
                  background: n.state === 'answered' ? 'var(--bg-green-tint)' : 'var(--surface)',
                  border: `1px solid ${n.state === 'answered' ? 'var(--border-green)' : 'var(--border)'}`,
                }}
              >
                {n.chip}
              </span>
            </div>
            {n.answer ? (
              <div style={{ marginTop: 3, paddingLeft: 9, borderLeft: `2px solid ${n.fresh ? '#16a34a' : 'var(--border-green)'}`, color: 'var(--text-base)', fontWeight: n.fresh ? 600 : 400, overflowWrap: 'anywhere' }}>
                {n.answer}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TellTheDevBox({ kind, onKind, typed, onTyped, lines, sending, sent, onSendAnother, error, onSend, notes = [] }: TellTheDevBoxProps) {
  const groupId = useId()
  const fieldId = useId()
  const start = noteStart(kind)
  const check = canSendNote(kind, typed)
  const canSend = check.ok && !sending

  if (sent) {
    return (
      <div>
        <p role="status" style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-green-800)', background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
          Sent to the dev. Thank you.
        </p>
        <button
          type="button"
          onClick={onSendAnother}
          style={{ marginTop: '0.6rem', background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Send another note
        </button>
        <YourNotes notes={notes} />
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSend()
      }}
    >
      <p id={groupId} style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        Pick a start. Finish the sentence if you can.
      </p>
      <div role="radiogroup" aria-labelledby={groupId} style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: '0.6rem' }}>
        {NOTE_STARTS.map((s) => {
          const on = s.kind === kind
          return (
            <button
              key={s.kind}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onKind(s.kind)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '0.45rem 0.6rem',
                borderRadius: 8,
                border: `1px solid ${on ? 'var(--border-blue)' : 'var(--border)'}`,
                background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                color: on ? 'var(--text-strong)' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden
                style={{ flex: 'none', width: 13, height: 13, borderRadius: 999, border: `2px solid ${on ? 'var(--text-link)' : 'var(--text-faint)'}`, background: on ? 'var(--text-link)' : 'transparent', boxShadow: on ? 'inset 0 0 0 2px var(--surface)' : undefined }}
              />
              {s.label}
            </button>
          )
        })}
      </div>

      <label htmlFor={fieldId} style={{ display: 'block', margin: '0 0 0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
        {start.lead}
      </label>
      <textarea
        id={fieldId}
        value={typed}
        onChange={(e) => onTyped(e.target.value)}
        rows={3}
        maxLength={NOTE_BODY_MAX}
        placeholder="The rest of the sentence"
        style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: '0.9375rem', fontFamily: 'inherit', resize: 'vertical' }}
      />
      {!start.needsWords && (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No words? Send it anyway. The dev still sees which page.</p>
      )}

      <div style={{ marginTop: '0.6rem', border: '1px dashed var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem', background: 'var(--bg-subtle)' }}>
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 4 }}>Goes with your note</div>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(88px, max-content) 1fr', gap: '2px 10px', fontSize: '0.75rem' }}>
          {lines.map((line) => (
            <div key={line.label} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--text-faint)' }}>{line.label}</dt>
              <dd style={{ margin: 0, color: 'var(--text-base)', overflowWrap: 'anywhere' }}>{line.value}</dd>
            </div>
          ))}
        </dl>
        <div style={{ marginTop: 5, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-green-700)' }}>A picture of your screen is never sent.</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.65rem' }}>
        <button
          type="submit"
          disabled={!canSend}
          style={{ padding: '0.5rem 1rem', background: canSend ? '#2563eb' : DEAD_PRESS_FILL, color: canSend ? 'white' : DEAD_PRESS_TEXT, border: 'none', borderRadius: 7, cursor: canSend ? 'pointer' : 'not-allowed', fontSize: '0.875rem', fontWeight: 700 }}
        >
          {sending ? 'Sending…' : 'Send to the dev'}
        </button>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>{check.ok ? 'The owner and the dev read these.' : check.reason}</span>
      </div>
      {error && (
        <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)', whiteSpace: 'pre-wrap' }}>
          {error} Your words are still here.
        </p>
      )}
      <YourNotes notes={notes} />
    </form>
  )
}
