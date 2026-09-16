/**
 * "Not a customer's payment?" — the close-out strip (v2.3529, Money with no bill PR 2).
 *
 * Sits above Allocations in the Accounts Receivable modal, only while an UNTOUCHED deposit
 * still has money on it. The rule for when to show it and every word come from
 * `src/lib/jobs/arCloseOut.ts`; this file only draws. The button records a reason on the
 * deposit so it leaves To match — no bill, no job, no payment row — in one RPC.
 *
 * Reason first, then the button: the reason is the record, so it cannot be skipped.
 */
import { AR_CLOSE_REASONS, arCloseOutReady, type ArCloseOutOffer as ArCloseOutModel } from '../../../lib/jobs/arCloseOut'

const inputStyle = {
  fontSize: '0.78rem',
  padding: '0.3rem 0.5rem',
  borderRadius: 6,
  border: '1px solid var(--border-400)',
  background: 'var(--bg-page)',
  color: 'var(--text-strong)',
} as const

export function ArCloseOut({
  offer,
  reason,
  note,
  busy,
  confirming,
  error,
  onChangeReason,
  onChangeNote,
  onRequest,
  onConfirm,
  onCancel,
}: {
  offer: ArCloseOutModel
  reason: string | null
  note: string
  busy: boolean
  /** Second press confirms — it takes the deposit off the pile for everyone. */
  confirming: boolean
  error: string | null
  onChangeReason: (reason: string) => void
  onChangeNote: (note: string) => void
  onRequest: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const ready = arCloseOutReady(reason, note)
  const reasonLabel = AR_CLOSE_REASONS.find((r) => r.key === reason)?.label ?? 'this reason'
  const box = {
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    borderRadius: 8,
    padding: '0.65rem 0.8rem',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.6rem',
  } as const

  if (confirming) {
    return (
      <div data-testid="ar-close-out" data-confirming="true" style={box}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
            Close out this deposit as {reasonLabel}?
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
            It leaves To match for everyone with the reason on the record. Nothing is written to a job. You can reopen it from To match · All.
          </div>
          {error ? <div style={{ fontSize: '0.78rem', color: 'var(--text-red-700)', marginTop: 4 }}>{error}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flex: 'none' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{ ...inputStyle, cursor: busy ? 'default' : 'pointer', padding: '0.3rem 0.65rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="ar-close-out-confirm"
            onClick={onConfirm}
            disabled={busy}
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: 6,
              border: '1px solid var(--text-strong)',
              background: 'var(--text-strong)',
              color: 'var(--surface)',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.55 : 1,
            }}
          >
            {busy ? 'Closing…' : 'Close it out'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="ar-close-out" style={box}>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{offer.headline}</div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{offer.sentence}</div>
        {error ? <div style={{ fontSize: '0.78rem', color: 'var(--text-red-700)', marginTop: 4 }}>{error}</div> : null}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flex: 'none', alignItems: 'center' }}>
        <select
          id="ar-close-out-reason"
          aria-label="Why this deposit is not a customer's payment"
          value={reason ?? ''}
          disabled={busy}
          onChange={(e) => onChangeReason(e.target.value)}
          style={{ ...inputStyle, maxWidth: 200 }}
        >
          <option value="">— Reason</option>
          {AR_CLOSE_REASONS.map((r) => (
            <option key={r.key} value={r.key} title={r.hint}>
              {r.label}
            </option>
          ))}
        </select>
        {reason === 'other' ? (
          <input
            id="ar-close-out-note"
            aria-label="What it is"
            placeholder="What is it?"
            value={note}
            maxLength={240}
            disabled={busy}
            onChange={(e) => onChangeNote(e.target.value)}
            style={{ ...inputStyle, width: 180 }}
          />
        ) : null}
        <button
          type="button"
          data-testid="ar-close-out-request"
          onClick={onRequest}
          disabled={busy || !ready}
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '0.3rem 0.75rem',
            borderRadius: 6,
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text-strong)',
            cursor: busy || !ready ? 'default' : 'pointer',
            opacity: busy || !ready ? 0.55 : 1,
          }}
        >
          {busy ? 'Closing…' : offer.buttonLabel}
        </button>
      </div>
    </div>
  )
}
