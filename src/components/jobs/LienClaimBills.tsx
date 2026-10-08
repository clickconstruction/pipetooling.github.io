import { demandMoney } from '../../lib/jobsDocuments/demandLetter'
import { formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import { LIEN_BILL_FROM_HERE_HINT, LIEN_BILL_FROM_HERE_LABEL, lienUnbilledWords, type LienClaimBill } from '../../lib/jobs/lienClaimBills'

/**
 * The bills behind the claim (v2.4969): one line per sent bill — billed, paid, still owed — and,
 * under them, the part of the job no sent bill carries with the door that bills it from the desk.
 * Drawn on the Months card under the claim box; the owed column adds up to the claim.
 */
export default function LienClaimBills({
  bills,
  unbilled,
  revenue,
  loading,
  onBill,
  billWhy,
}: {
  bills: ReadonlyArray<LienClaimBill>
  unbilled: number
  revenue: number | null | undefined
  loading: boolean
  /** The door: opens Bill Customer over the desk. Absent for a reader who cannot bill. */
  onBill?: () => void
  /** Why the door is off right now (the job's bills still reading); '' when it is on. */
  billWhy?: string
}) {
  const money = (n: number) => demandMoney(String(n))
  return (
    <div className="lienClaimBills" data-lien-claim-bills data-loading={loading ? 'yes' : 'no'}>
      <div className="lienClaimBillsHead">
        <strong>The bills behind the claim</strong>
        <span>what was billed, what is paid, what is still owed</span>
      </div>
      {loading && bills.length === 0 ? <div className="lienClaimBillsEmpty">Reading the bills…</div> : null}
      {bills.map((b) => (
        <div key={b.invoiceId} className="lienClaimBill" data-lien-claim-bill={b.invoiceId} data-owed={b.owed > 0 ? 'yes' : 'no'}>
          <span className="lienClaimBillName">
            <strong>
              {b.number}
              {b.what ? ` · ${b.what}` : ''}
            </strong>
            <small>{[b.sentYmd ? `Sent ${formatYmdMonthDay(b.sentYmd)}` : 'Sent day not recorded', b.stripe ? 'Stripe' : 'paper', b.dueYmd ? `due ${formatYmdMonthDay(b.dueYmd)}` : ''].filter(Boolean).join(' · ')}</small>
          </span>
          <span className="lienClaimBillNum" data-col="billed">
            <small>Billed</small>
            {money(b.billed)}
          </span>
          <span className="lienClaimBillNum" data-col="paid">
            <small>Paid</small>
            {money(b.paid)}
          </span>
          <span className="lienClaimBillNum" data-col="owed">
            <small>Owed</small>
            {b.owed > 0 ? money(b.owed) : 'paid'}
          </span>
        </div>
      ))}
      {unbilled > 0 ? (
        <div className="lienClaimBill" data-lien-claim-unbilled data-tone="amber">
          <span className="lienClaimBillName">
            <strong>Not billed yet</strong>
            <small>{lienUnbilledWords(unbilled, revenue)}</small>
          </span>
          <span className="lienClaimBillNum" data-col="door">
            {onBill ? (
              <button type="button" onClick={onBill} disabled={Boolean(billWhy)} title={billWhy || LIEN_BILL_FROM_HERE_HINT} data-lien-bill-from-here>
                {LIEN_BILL_FROM_HERE_LABEL}
              </button>
            ) : null}
          </span>
        </div>
      ) : null}
      {!loading && bills.length === 0 && unbilled <= 0 ? <div className="lienClaimBillsEmpty">No sent bills on this job.</div> : null}
    </div>
  )
}
