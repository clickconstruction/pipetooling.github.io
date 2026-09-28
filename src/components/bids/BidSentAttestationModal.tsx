/**
 * "Confirm bid sent" — the three-line checklist a person confirms before a new Bid Date Sent
 * is applied, with the optional note that is added to the bid. Moved out of
 * `src/pages/Bids.tsx` verbatim (the Bids map's step 4); `useBidDateSentAttestation` holds
 * the state.
 */
import type { BidDateSentAttestation, BidSentAckKey } from '../../hooks/useBidDateSentAttestation'

const ACK_ROWS: { key: BidSentAckKey; label: string }[] = [
  { key: 'email', label: 'I sent the bid via email and the client knew it was coming' },
  { key: 'phone', label: 'I followed up with a phone call' },
  { key: 'honesty', label: 'I understand that lying about this will result in my suspension' },
]

export function BidSentAttestationModal({
  modal,
  signerName,
}: {
  modal: BidDateSentAttestation['modal']
  /** The signed-in person's name as it is stamped under a ticked line; `null` when nobody is signed in. */
  signerName: string | null
}) {
  const { acks, allAcked } = modal
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bid-sent-attest-title"
        style={{
          background: 'var(--surface)',
          padding: '1.5rem 2rem',
          borderRadius: 8,
          maxWidth: '520px',
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        }}
      >
        <h2 id="bid-sent-attest-title" style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1.125rem' }}>
          Confirm bid sent
        </h2>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Check each statement when it applies. You must confirm all three before the new sent date is applied.
        </p>
        {ACK_ROWS.map((row) => {
          const ack = acks[row.key]
          return (
            <div key={row.key} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  checked={ack.checked}
                  onChange={(e) => modal.toggleAck(row.key, e.target.checked)}
                  style={{ marginTop: '0.2rem' }}
                />
                <span>{row.label}</span>
              </label>
              {ack.checked && ack.checkedAt && signerName != null ? (
                <div style={{ marginLeft: '1.5rem', marginTop: '0.35rem', fontSize: '0.8125rem', color: 'var(--text-700)' }}>
                  {signerName} ·{' '}
                  {new Date(ack.checkedAt).toLocaleString(undefined, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </div>
              ) : null}
            </div>
          )
        })}
        <div style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.35rem' }}>
            Adds to bid note:
          </div>
          <textarea
            value={modal.followupNoteDraft}
            onChange={(e) => modal.setFollowupNoteDraft(e.target.value)}
            placeholder="What happened when you called them or left a voicemail?"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '0.5rem',
              fontSize: '0.875rem',
              border: '1px solid var(--border-strong)',
              borderRadius: 4,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button
            type="button"
            onClick={modal.cancel}
            style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!allAcked || signerName == null}
            onClick={modal.confirm}
            style={{
              padding: '0.5rem 1rem',
              background: !allAcked ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: !allAcked ? 'not-allowed' : 'pointer',
            }}
          >
            Confirm sent date
          </button>
        </div>
      </div>
    </div>
  )
}
