import { useState, type CSSProperties } from 'react'
import type { ReviewState } from '../../lib/contracts/contractTextHistory'
import { REVIEW_NOTE_MAX } from '../../lib/contracts/fetchContractHistory'

/**
 * A card's review on Settings → Contracts & terms: *Mark reviewed* (with a note, if there is
 * something to say about the read), and *Take it back* for a review marked today by mistake.
 */

const PILL: CSSProperties = { font: 'inherit', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.65rem', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }
const PRIMARY: CSSProperties = { ...PILL, background: 'var(--text-link)', borderColor: 'var(--text-link)', color: 'white' }
const MUTED: CSSProperties = { fontSize: '0.76rem', color: 'var(--text-muted)' }

export type ContractCardReviewProps = {
  name: string
  state: ReviewState
  /** The signed-in person may take back the newest review: they marked it, today. */
  canTakeBack: boolean
  onMark: (note: string) => Promise<boolean>
  onTakeBack: () => Promise<boolean>
  cardKey: string
}

export function ContractCardReview({ name, state, canTakeBack, onMark, onTakeBack, cardKey }: ContractCardReviewProps) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (work: () => Promise<boolean>) => {
    if (busy) return
    setBusy(true)
    const ok = await work()
    setBusy(false)
    if (ok) {
      setOpen(false)
      setNote('')
    }
  }

  if (!open) {
    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
        <button type="button" style={PILL} onClick={() => setOpen(true)} disabled={busy} title="Record that you read this wording and it still stands">
          Mark reviewed
        </button>
        {canTakeBack ? (
          <button type="button" style={PILL} onClick={() => void run(onTakeBack)} disabled={busy}>
            {busy ? 'Taking it back…' : 'Take it back'}
          </button>
        ) : null}
      </span>
    )
  }

  return (
    <div style={{ flexBasis: '100%', display: 'grid', gap: '0.35rem', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.6rem', background: 'var(--bg-page)' }} data-testid={`contract-review-form-${cardKey}`}>
      <span style={MUTED}>
        You read <strong style={{ color: 'var(--text-strong)' }}>{name}</strong> and it still stands. {state.last?.note ? `The last note: “${state.last.note}”` : ''}
      </span>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, REVIEW_NOTE_MAX))}
        rows={2}
        placeholder="A note, if there is one — who read it with you, what to change next time"
        aria-label="Review note"
        disabled={busy}
        style={{ font: 'inherit', fontSize: '0.8rem', padding: '0.35rem 0.45rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'inherit', resize: 'vertical', boxSizing: 'border-box', width: '100%' }}
      />
      <span style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
        <button type="button" style={PILL} onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
        <button type="button" style={{ ...PRIMARY, opacity: busy ? 0.6 : 1 }} onClick={() => void run(() => onMark(note))} disabled={busy}>
          {busy ? 'Saving…' : 'Save the review'}
        </button>
      </span>
    </div>
  )
}
