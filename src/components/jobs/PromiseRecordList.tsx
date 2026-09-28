import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { promiseSaidLine, type PaymentPromise } from '../../lib/jobs/paymentPromises'

/**
 * The promises on record for one bill, under "They said…": the day named,
 * who said it and how, and the day it was written down. "never said that"
 * takes one off the record — a wrong entry, not a changed date. The parent
 * owns the confirm and the write.
 */
export default function PromiseRecordList({
  promises,
  boardYmd,
  busyId,
  onNeverSaid,
}: {
  promises: readonly PaymentPromise[]
  /** The date the board is showing for this bill, when there is one. */
  boardYmd: string | null
  /** The promise being taken off, while the write runs. */
  busyId: string | null
  onNeverSaid: (promise: PaymentPromise) => void
}) {
  if (promises.length === 0) return null
  return (
    <div style={{ marginTop: '0.9rem', paddingTop: '0.7rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
        On record for this bill · {promises.length} promise{promises.length === 1 ? '' : 's'}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
        {promises.map((p) => {
          const said = promiseSaidLine(p)
          const written = new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          const onBoard = boardYmd != null && p.promisedYmd === boardYmd
          return (
            <li key={p.id} data-testid="promise-record-row" style={{ fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
                <span style={{ flex: 1, fontWeight: 600, color: onBoard ? 'var(--text-green-800)' : 'inherit' }}>
                  {formatYmdMonthDay(p.promisedYmd)}
                  {onBoard ? <span style={{ fontWeight: 400, fontSize: '0.72rem' }}> · on the board</span> : null}
                </span>
                <button
                  type="button"
                  disabled={busyId != null}
                  onClick={() => onNeverSaid(p)}
                  aria-label={`They never said ${formatYmdMonthDay(p.promisedYmd)} — take it off the record`}
                  title="A wrong entry — take it off the record. It is hidden, not deleted."
                  style={{ padding: 0, fontSize: '0.75rem', border: 'none', background: 'none', color: 'var(--text-red-600)', textDecoration: 'underline', cursor: busyId != null ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: busyId != null && busyId !== p.id ? 0.5 : 1 }}
                >
                  {busyId === p.id ? 'removing…' : 'never said that'}
                </button>
              </div>
              <div title={p.note ?? undefined} style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                {said ? `${said} · ` : ''}written {written}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
