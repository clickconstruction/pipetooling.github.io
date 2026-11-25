import type { CSSProperties } from 'react'
import type { PickPatch } from '../../hooks/usePunchListPicks'
import { byLine, type PickRecord } from '../../lib/todos/punchListView'
import { ANSWER_LABEL, ANSWER_PICKS, answerOf, answerPatch, type AnswerPick, type AskedCard } from '../../lib/todos/punchListWaiting'

/**
 * The answer to a card's question (punch list #438): Go ahead, Change, Not now. It is the board's own
 * pick, saved where Do, Later and Drop are saved, with the question it answers beside it. Change opens
 * the note, which says what should change. A pressed answer pressed again is taken back. The control
 * draws wherever the card does: the Waiting on me rows, and the card's row in By group and By number.
 */
export function PunchListAnswer({
  item,
  rec,
  onSave,
}: {
  item: AskedCard
  rec: PickRecord | undefined
  onSave: (slug: string, patch: PickPatch) => void | Promise<void>
}) {
  const answer = answerOf(item, rec)
  // The note belongs to the answer: one left under an older question is not this question's.
  const note = answer ? (rec?.note ?? '') : ''
  const who = answer ? byLine(rec) : ''
  const noteId = `punch-answer-note-${item.slug}`
  return (
    <div data-testid={`punch-answer-${item.number}`} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div role="group" aria-label={`Answer for ${item.name}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
        {ANSWER_PICKS.map((p, i) => {
          const pressed = answer === p
          return (
            <button
              key={p}
              type="button"
              aria-pressed={pressed}
              onClick={() => onSave(item.slug, answerPatch(item, answer, p))}
              style={{ ...ANSWER_BUTTON, borderRight: i < 2 ? '1px solid var(--border-strong)' : 0, ...(pressed ? ANSWER_PRESSED[p] : ANSWER_REST) }}
            >
              {ANSWER_LABEL[p]}
            </button>
          )
        })}
      </div>
      {answer === 'change' ? (
        <>
          <label htmlFor={noteId} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            What should change?
          </label>
          <input
            id={noteId}
            key={note}
            type="text"
            placeholder="A note for the session…"
            defaultValue={note}
            onBlur={(e) => {
              const v = e.currentTarget.value.trim()
              if (v !== note) onSave(item.slug, { note: v })
            }}
            style={{
              fontFamily: 'inherit',
              fontSize: '0.82rem',
              minHeight: 40,
              boxSizing: 'border-box',
              padding: '0.35rem 0.5rem',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--surface)',
              color: 'var(--text-base)',
              width: '100%',
            }}
          />
        </>
      ) : null}
      {who ? (
        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <b style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{who.split(' · ')[0]}</b>
          {who.includes(' · ') ? ` · ${who.split(' · ')[1]}` : ''}
        </p>
      ) : null}
    </div>
  )
}

/** One third of the control: a thumb's height, the page's own type. */
const ANSWER_BUTTON: CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.82rem',
  fontWeight: 600,
  minHeight: 44,
  padding: '0 0.25rem',
  border: 0,
  cursor: 'pointer',
}

const ANSWER_REST: CSSProperties = { background: 'var(--surface)', color: 'var(--text-base)' }

/**
 * A pressed answer's fill. Go ahead and Change are coloured presses: each colour's light value under
 * white words, deep in both themes. Not now is a grey press: its token under the surface's colour.
 */
const ANSWER_PRESSED: Record<AnswerPick, CSSProperties> = {
  do: { background: '#15803d', color: '#fff' },
  change: { background: '#92400e', color: '#fff' },
  later: { background: 'var(--text-700)', color: 'var(--surface)' },
}
