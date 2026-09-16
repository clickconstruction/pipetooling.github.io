/**
 * "They paid over" — the tip offer strip (v2.3496).
 *
 * Sits above Allocations in the Accounts Receivable modal, and only while a matched deposit
 * still has money on it. The rule for when to show it, the job choices, and every word in it
 * come from `src/lib/jobs/arTipOffer.ts`; this file only draws. The button records the
 * difference as a `Tip` line on the job plus a job-level payment, in one RPC.
 *
 * The job list is closed on purpose: a tip belongs to one of the jobs this deposit already
 * paid, so there is nothing to search.
 */
import type { ArTipOffer as ArTipOfferModel } from '../../../lib/jobs/arTipOffer'

export function ArTipOffer({
  offer,
  chosenJobId,
  busy,
  confirming,
  error,
  onChooseJob,
  onRequest,
  onConfirm,
  onCancel,
}: {
  offer: ArTipOfferModel
  /** The job the tip will land on: the sole job, or whatever the office picked. */
  chosenJobId: string | null
  busy: boolean
  /** Second press confirms — a money write, and undoing it takes two steps. */
  confirming: boolean
  error: string | null
  onChooseJob: (jobId: string) => void
  onRequest: () => void
  onConfirm: () => void
  onCancel: () => void
}) {
  const needsPick = offer.jobChoices.length > 1
  const chosenLabel =
    offer.jobChoices.find((c) => c.jobId === chosenJobId)?.label ?? offer.jobLabel ?? 'this job'

  if (confirming) {
    return (
      <div
        data-testid="ar-tip-offer"
        style={{
          border: '1px solid var(--border-blue)',
          background: 'var(--bg-blue-tint)',
          borderRadius: 8,
          padding: '0.65rem 0.8rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>
            Add this tip to {chosenLabel}?
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
            It becomes a Tip line on the job and a payment on this deposit. Removing it later takes two
            steps in Edit Job.
          </div>
          {error ? (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-red-700)', marginTop: 4 }}>{error}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flex: 'none' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              fontSize: '0.78rem',
              padding: '0.3rem 0.65rem',
              borderRadius: 6,
              border: '1px solid var(--border-400)',
              background: 'var(--bg-page)',
              color: 'var(--text-strong)',
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '0.3rem 0.75rem',
              borderRadius: 6,
              border: '1px solid var(--text-blue-700)',
              background: 'var(--text-blue-700)',
              color: '#fff',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.55 : 1,
            }}
          >
            {busy ? 'Adding…' : 'Add the tip'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="ar-tip-offer"
      style={{
        border: '1px solid var(--border-blue)',
        background: 'var(--bg-blue-tint)',
        borderRadius: 8,
        padding: '0.65rem 0.8rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.6rem',
      }}
    >
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>
          {offer.headline}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{offer.sentence}</div>
        {error ? (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-red-700)', marginTop: 4 }}>{error}</div>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flex: 'none', alignItems: 'center' }}>
        {needsPick ? (
          <select
            id="ar-tip-job"
            aria-label="Which job earned the tip"
            value={chosenJobId ?? ''}
            disabled={busy}
            onChange={(e) => onChooseJob(e.target.value)}
            style={{
              fontSize: '0.78rem',
              padding: '0.3rem 0.5rem',
              borderRadius: 6,
              border: '1px solid var(--border-400)',
              background: 'var(--bg-page)',
              color: 'var(--text-strong)',
              maxWidth: 260,
            }}
          >
            <option value="">— Which job?</option>
            {offer.jobChoices.map((c) => (
              <option key={c.jobId} value={c.jobId}>
                {c.label}
              </option>
            ))}
          </select>
        ) : null}

        <button
          type="button"
          onClick={onRequest}
          disabled={busy || !chosenJobId}
          style={{
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '0.3rem 0.75rem',
            borderRadius: 6,
            border: '1px solid var(--text-blue-700)',
            background: 'var(--text-blue-700)',
            color: '#fff',
            cursor: busy || !chosenJobId ? 'default' : 'pointer',
            opacity: busy || !chosenJobId ? 0.55 : 1,
          }}
        >
          {busy ? 'Adding…' : offer.buttonLabel}
        </button>
      </div>
    </div>
  )
}
