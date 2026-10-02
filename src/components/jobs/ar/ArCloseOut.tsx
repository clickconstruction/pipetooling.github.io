/**
 * "Not a customer’s payment?" — the close-out strip (v2.3529, Money with no bill PR 2;
 * v2.4363 Close out books it).
 *
 * Sits above Allocations in the Accounts Receivable modal, only while an UNTOUCHED deposit
 * still has money on it. Four reason buttons, then the books line: how Banking books the
 * deposit once it is closed out — the label a rule or a person already put on it, a rule match
 * Close out will approve, or a picker when nothing labels it. Every word comes from
 * `src/lib/jobs/arCloseOut.ts` and `src/lib/jobs/arCloseBooking.ts`; this file only draws.
 *
 * The button records the reason and books the label in one RPC (`close_out_ar_deposit`).
 * Reason first, then the button: the reason is the record, so it cannot be skipped.
 */
import { Link } from 'react-router-dom'
import { AR_CLOSE_REASONS, arCloseOutReady, type ArCloseOutOffer as ArCloseOutModel } from '../../../lib/jobs/arCloseOut'
import { AR_BOOK_LEAVE, type ArBookingLabel, type ArCloseBookingView } from '../../../lib/jobs/arCloseBooking'

const fieldStyle = {
  fontFamily: 'inherit',
  fontSize: '0.875rem',
  padding: '0.45rem 0.6rem',
  borderRadius: 8,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-strong)',
  minHeight: 44,
  boxSizing: 'border-box',
} as const

function buttonStyle(kind: 'reason' | 'reason-on' | 'quiet' | 'dark', disabled = false) {
  const base = {
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    padding: '0.5rem 0.9rem',
    borderRadius: 8,
    minHeight: 44,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  } as const
  if (kind === 'reason-on') return { ...base, border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', fontWeight: 600 }
  if (kind === 'dark') return { ...base, border: '1px solid var(--text-strong)', background: 'var(--text-strong)', color: 'var(--surface)', fontWeight: 600 }
  if (kind === 'quiet') return { ...base, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }
  return { ...base, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)' }
}

const TONE = {
  green: { border: '1px solid var(--border-green)', background: 'var(--surface)' },
  blue: { border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)' },
  amber: { border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)' },
  plain: { border: '1px solid var(--border)', background: 'var(--surface)' },
} as const

function ToneMark({ tone }: { tone: ArCloseBookingView['tone'] }) {
  if (tone === 'green') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-green-700)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', marginTop: 1 }}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    )
  }
  if (tone === 'blue') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-blue-800)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: 'none', marginTop: 1 }}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  if (tone === 'amber') {
    return <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--text-amber-700)', display: 'inline-block', flex: 'none', marginTop: 6 }} />
  }
  return null
}

export function ArCloseOut({
  offer,
  reason,
  note,
  busy,
  confirming,
  error,
  booking,
  loading = false,
  labels,
  chosenLabelId,
  rememberLine,
  onChangeReason,
  onChangeNote,
  onChooseLabel,
  onOpenPicker,
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
  /** The books line for the picked reason; null until a reason is picked. */
  booking: ArCloseBookingView | null
  /** The Banking read is still on its way: the button waits for it. */
  loading?: boolean
  /** The labels the picker offers. */
  labels: ReadonlyArray<ArBookingLabel>
  chosenLabelId: string | null
  /** "Texas Mutual’s Aug 13 deposit was a vendor refund." — when the reason was picked from it. */
  rememberLine: string | null
  onChangeReason: (reason: string) => void
  onChangeNote: (note: string) => void
  onChooseLabel: (labelId: string) => void
  /** Change: open the picker over a label that is already set. */
  onOpenPicker: () => void
  onRequest: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const ready = arCloseOutReady(reason, note)
  const box = {
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    borderRadius: 10,
    padding: '0.8rem 0.9rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.7rem',
  } as const

  if (confirming && booking) {
    return (
      <div data-testid="ar-close-out" data-confirming="true" style={box}>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{booking.confirmTitle}</div>
          <div data-testid="ar-close-out-confirm-body" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {booking.confirmBody}
          </div>
          {error ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)', marginTop: 4 }}>{error}</div> : null}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} disabled={busy} style={buttonStyle('quiet', busy)}>
            Cancel
          </button>
          <button type="button" data-testid="ar-close-out-confirm" onClick={onConfirm} disabled={busy} style={buttonStyle('dark', busy)}>
            {busy ? 'Closing…' : 'Close it out'}
          </button>
        </div>
      </div>
    )
  }

  const selectedLabelValue =
    chosenLabelId != null ? chosenLabelId : booking?.sendLabelId ?? (booking?.pickerCanLeave ? AR_BOOK_LEAVE : '')

  return (
    <div data-testid="ar-close-out" style={box}>
      <div>
        <div style={{ fontWeight: 700, color: 'var(--text-strong)' }}>{offer.headline}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>{offer.sentence}</div>
      </div>

      <div role="group" aria-label="Why this deposit is not a customer's payment" style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        {AR_CLOSE_REASONS.map((r) => {
          const on = reason === r.key
          return (
            <button
              key={r.key}
              type="button"
              data-testid={`ar-close-out-reason-${r.key}`}
              aria-pressed={on}
              title={r.hint}
              disabled={busy}
              onClick={() => onChangeReason(r.key)}
              style={buttonStyle(on ? 'reason-on' : 'reason', busy)}
            >
              {r.label}
            </button>
          )
        })}
      </div>

      {rememberLine ? (
        <div data-testid="ar-close-out-remembered" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {rememberLine}
        </div>
      ) : null}

      {reason === 'other' ? (
        <input
          id="ar-close-out-note"
          aria-label="What it is"
          placeholder="What is it?"
          value={note}
          maxLength={240}
          disabled={busy}
          onChange={(e) => onChangeNote(e.target.value)}
          style={{ ...fieldStyle, width: '100%', maxWidth: 360 }}
        />
      ) : null}

      {booking && booking.state !== 'unread' ? (
        <div
          data-testid="ar-close-out-books"
          data-state={booking.state}
          style={{ ...TONE[booking.tone], borderRadius: 8, padding: '0.6rem 0.75rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}
        >
          <ToneMark tone={booking.tone} />
          <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {booking.pickerOpen ? (
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', color: 'var(--text-strong)' }}>
                <span>{booking.state === 'kept' || booking.state === 'approve' ? booking.lead : 'Book it as'}</span>
                <select
                  data-testid="ar-close-out-label"
                  aria-label="Banking label"
                  value={selectedLabelValue}
                  disabled={busy}
                  onChange={(e) => onChooseLabel(e.target.value)}
                  style={{ ...fieldStyle, maxWidth: 260 }}
                >
                  {booking.pickerCanLeave ? <option value={AR_BOOK_LEAVE}>Leave it for Banking</option> : null}
                  {labels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div style={{ color: 'var(--text-strong)' }}>
                {booking.lead} <strong>{booking.label?.name}</strong>.
              </div>
            )}
            {booking.detail ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{booking.detail}</div> : null}
            {booking.warning ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)' }}>{booking.warning}</div> : null}
            {booking.partsDoor ? (
              <div data-testid="ar-close-out-parts" style={{ fontSize: '0.8125rem', color: 'var(--text-strong)' }}>
                Parts returned from a job? Record the credit in{' '}
                <Link to="/materials?tab=supply-houses" style={{ color: 'var(--text-link)' }}>
                  Supply houses
                </Link>{' '}
                too, so the job’s cost drops.
              </div>
            ) : null}
          </div>
          {!booking.pickerOpen ? (
            <button
              type="button"
              data-testid="ar-close-out-change"
              onClick={onOpenPicker}
              disabled={busy}
              style={{ fontFamily: 'inherit', fontSize: '0.875rem', border: 'none', background: 'transparent', color: 'var(--text-link)', cursor: 'pointer', padding: '0 0.25rem', minHeight: 44, flex: 'none' }}
            >
              Change
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>{error}</div> : null}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
        <div data-testid="ar-close-out-footer" style={{ flex: '1 1 220px', minWidth: 0, fontSize: '0.8125rem', color: 'var(--text-strong)' }}>
          {loading ? 'Reading how Banking books it…' : booking ? booking.footer : 'Pick a reason first.'}
        </div>
        <button
          type="button"
          data-testid="ar-close-out-request"
          onClick={onRequest}
          disabled={busy || loading || !ready || !booking}
          style={buttonStyle(ready && booking && !loading ? 'dark' : 'quiet', busy || loading || !ready || !booking)}
        >
          {busy ? 'Closing…' : offer.buttonLabel}
        </button>
      </div>
    </div>
  )
}
