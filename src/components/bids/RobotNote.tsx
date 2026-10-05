/**
 * The robot in one line (2026-10-05): a chip that says the state, the one thing to press beside
 * it, and the full story in a card. The words come from `robotNote.ts`; this draws them.
 *
 * The card opens while the pointer is on the line, while anything on the line has the keyboard,
 * and when the chip (or the small ? of an offer) is pressed — a phone has no hover. Pressed, it
 * stays open until Esc, a second press, or a press anywhere else. The button is never inside the
 * card, so nobody has to chase it. The card hangs under the line with no gap to cross.
 */
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { RobotNoteWords } from '../../lib/submittals/robotNote'
import { SUBMITTAL_GUIDE_HREF } from '../../lib/submittals/submittalTour'

const TONE: Record<RobotNoteWords['tone'], CSSProperties> = {
  plain: { border: '1px solid var(--border-strong)', background: 'var(--bg-muted)', color: 'var(--text-strong)' },
  warn: { border: '1px solid #d97706', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-700)' },
  good: { border: '1px solid #16a34a', background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  bad: { border: '1px solid #dc2626', background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' },
}
const muted: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }

export function RobotNote({ note, busy = false, onPress, testId, buttonTestId, lineTestId, needsTestId, tour, stale }: {
  note: RobotNoteWords
  busy?: boolean
  /** The note's one button. */
  onPress?: () => void
  /** On the line itself. */
  testId: string
  buttonTestId?: string
  /** On the card's second line (a task's own line, or what to do by hand). */
  lineTestId?: string
  /** On an offer's "what it needs" line in the card. */
  needsTestId?: string
  /** The walkthrough anchor, when the tour has a stop for it. */
  tour?: string
  /** The ask is stuck: read by the tests and the walkthrough. */
  stale?: boolean
}) {
  const [hover, setHover] = useState(false)
  const [focus, setFocus] = useState(false)
  const [pinned, setPinned] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const cardId = useId()
  const open = hover || focus || pinned
  useEffect(() => {
    if (!pinned) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPinned(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pinned])
  const close = () => {
    setPinned(false)
    setHover(false)
    setFocus(false)
  }
  const held = note.button?.held ?? false
  return (
    <span
      ref={rootRef}
      data-testid={testId}
      data-tour={tour}
      data-stale={stale ? 'true' : undefined}
      data-open={open ? 'true' : undefined}
      style={{ position: 'relative', display: 'inline-flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap', alignSelf: 'flex-start', maxWidth: '100%', fontSize: '0.78rem' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          close()
        }
      }}
    >
      {note.chip ? (
        <button type="button" aria-expanded={open} aria-describedby={open ? cardId : undefined} onClick={() => setPinned((p) => !p)} style={{ ...TONE[note.tone], font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.12rem 0.6rem', borderRadius: 999, cursor: 'pointer', maxWidth: '100%', textAlign: 'left' }} data-testid={`${testId}-chip`}>
          <span aria-hidden>🤖 </span>
          {note.chip}
        </button>
      ) : (
        <span aria-hidden>🤖</span>
      )}
      {note.button ? (
        note.chip ? (
          <button type="button" disabled={busy} onClick={onPress} style={{ font: 'inherit', fontSize: '0.78rem', background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', textDecoration: 'underline', cursor: busy ? 'not-allowed' : 'pointer', flexShrink: 0 }} data-testid={buttonTestId}>
            {note.button.label}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || held}
            aria-describedby={open ? cardId : undefined}
            onClick={onPress}
            data-testid={buttonTestId}
            style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 500, padding: '0.22rem 0.65rem', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: busy || held ? 'not-allowed' : 'pointer', opacity: busy || held ? 0.6 : 1 }}
          >
            {note.button.label}
          </button>
        )
      ) : null}
      {note.heldWhy ? <span style={{ ...muted, color: 'var(--text-amber-700)', fontWeight: 600 }} data-testid={`${testId}-held`}>{note.heldWhy}</span> : null}
      {/* An offer has no chip to press, so a small ? opens its card on a tap. */}
      {note.chip ? null : (
        <button type="button" aria-label="What the robot does" aria-expanded={open} onClick={() => setPinned((p) => !p)} style={{ font: 'inherit', flexShrink: 0, width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #3b82f6', color: 'var(--text-blue-500)', background: 'var(--surface)', fontSize: '0.66rem', fontWeight: 700, lineHeight: 1, padding: 0, cursor: 'pointer' }} data-testid={`${testId}-why`}>
          ?
        </button>
      )}
      {open ? (
        // The wrapper's padding bridges the line and the card, so the pointer never leaves on the way down.
        <span id={cardId} role="note" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 60, paddingTop: 6, width: 'min(22rem, 82vw)' }} data-testid={`${testId}-card`}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', padding: '0.6rem 0.75rem', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)', fontSize: '0.8125rem', color: 'var(--text-base)', fontWeight: 400, textAlign: 'left', whiteSpace: 'normal' }}>
            {note.lines.map((l, i) => (
              <span key={i} style={i === 0 ? { color: 'var(--text-strong)', fontWeight: 600 } : i === 1 && note.guide && held ? { ...muted, color: 'var(--text-amber-700)' } : muted} data-testid={i === 1 ? (note.guide ? needsTestId : lineTestId) : undefined}>
                {l}
              </span>
            ))}
            {note.guide ? (
              <Link to={SUBMITTAL_GUIDE_HREF} style={{ ...muted, color: 'var(--text-link)', alignSelf: 'flex-start' }}>
                What is the robot? →
              </Link>
            ) : null}
          </span>
        </span>
      ) : null}
    </span>
  )
}
