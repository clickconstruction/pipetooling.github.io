/**
 * The door to "It did not clock me in" (v2.4257): a quiet line where a person looks at their own
 * time — under the Job Mode card and in My Time's footer. Owns the modal. Salaried people have no
 * door: their hours come from the schedule, not the clock.
 */
import { useState, type CSSProperties } from 'react'
import { MissedClockInModal } from './MissedClockInModal'

type Props = {
  userId: string
  /** `link`: a centred sentence under a card. `button`: a bordered button for an action row. */
  variant: 'link' | 'button'
  onSaved?: () => void
  style?: CSSProperties
}

export function MissedClockInDoor({ userId, variant, onSaved, style }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {variant === 'link' ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.6rem', ...style }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{ border: 'none', background: 'none', padding: '0.4rem 0.6rem', minHeight: 40, color: 'var(--text-link)', fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Worked a day the clock missed? Tell the office
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Report hours the clock did not record — the office approves them"
          style={{
            padding: '0.3rem 0.7rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 6,
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text-700)',
            cursor: 'pointer',
            ...style,
          }}
        >
          The clock missed a day…
        </button>
      )}
      {open ? <MissedClockInModal userId={userId} onClose={() => setOpen(false)} onSaved={onSaved} /> : null}
    </>
  )
}
