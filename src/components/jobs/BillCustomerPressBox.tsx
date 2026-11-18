import { billSampleHref, type BillSendChannel, type TheyWillGet } from '../../lib/billing/billCustomerTheyWillGet'

export type BillCustomerPressBoxProps = {
  channel: BillSendChannel
  /** The window's words for this channel (`theyWillGet`). */
  words: TheyWillGet
  /** A paid job with no "bill again" tick: every press is dead, so the box is not drawn. */
  paidJobBlocked: boolean
  /** The signed-in role may open What customers see, so the box offers the sample. */
  canSeeSample: boolean
}

/** Punch list #343: what the press does, what it does not, and where the copy is kept, in a box right above the press. */
export function BillCustomerPressBox({ channel, words, paidJobBlocked, canSeeSample }: BillCustomerPressBoxProps) {
  // A paid job's presses are dead until the tick: the notice above says why, and this box would promise a send.
  if (paidJobBlocked) return null
  return (
    <div
      data-testid="bill-customer-press-box"
      style={{ margin: '0.6rem 0 0', padding: '0.55rem 0.7rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-subtle)', fontSize: '0.8125rem', color: 'var(--text-700)', lineHeight: 1.45 }}
    >
      <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{words.pressTitle}</div>
      <ol style={{ margin: '0.2rem 0 0', paddingLeft: '1.15rem' }}>
        {words.pressLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      {words.later ? <div style={{ marginTop: '0.3rem' }}>{words.later.line}</div> : null}
      {canSeeSample ? (
        <a href={billSampleHref(channel)} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '0.3rem', color: 'var(--text-link)' }}>
          See a sample of this email
        </a>
      ) : null}
    </div>
  )
}
