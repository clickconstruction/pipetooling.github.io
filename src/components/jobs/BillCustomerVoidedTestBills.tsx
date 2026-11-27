import { useEffect, useState, type CSSProperties } from 'react'
import { Money } from '../Money'
import { ValueLine, ValueLines, WorkedOutValue } from '../valuesInPlace/ValuesInPlace'
import {
  VOIDED_TEST_BILLS_NOTE,
  VOIDED_TEST_BILL_NO_ADDRESS,
  VOIDED_TEST_BILL_NO_NAME,
  VOIDED_TEST_BILL_NO_SENDS,
  voidedTestBillsDrawn,
  voidedTestBillsHeading,
  type VoidedTestBill,
} from '../../lib/billing/voidedTestBills'
import { readVoidedTestBills } from '../../lib/billing/voidedTestBillsIo'

/**
 * **Voided test bills**, a folded line at the foot of Bill Customer (punch list #443, row 7). For a developer on a
 * ZZ test job, and for nobody else: it draws nothing for any other role, on a real job, and while the job has no
 * record.
 *
 * **Void invoice** deletes the bill's row, so the job is back at Ready to Bill and Bill Customer is where the bill
 * is made again. This is that window, and the line says what was voided here before: each bill's amount, the day it
 * was voided and by whom, what was done in Stripe, and its sends, one a line. Every value is worked out, so nothing
 * here can be pressed.
 *
 * The read answers an empty list when the table is not on the database yet, so the line stays out until the
 * migration is pushed.
 */
export function BillCustomerVoidedTestBills({
  role,
  jobId,
  job,
}: {
  role: string | null | undefined
  jobId: string | null | undefined
  /** The job's own names, as stored: the ZZ rule reads them. */
  job: { job_name?: string | null; customer_name?: string | null } | null | undefined
}) {
  const drawn = voidedTestBillsDrawn(role, job)
  /** The records, with the job they were read for. Null until read. */
  const [read, setRead] = useState<{ jobId: string; bills: VoidedTestBill[] } | null>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!drawn || !jobId) return
    let live = true
    void readVoidedTestBills(jobId).then((bills) => {
      if (live) setRead({ jobId, bills })
    })
    return () => {
      live = false
    }
  }, [drawn, jobId])
  const bills = drawn && read && read.jobId === jobId ? read.bills : []
  if (bills.length === 0) return null

  const word: CSSProperties = { fontFamily: 'inherit', fontSize: '0.8125rem', border: 'none', background: 'transparent', padding: 0, minHeight: 44, cursor: 'pointer', color: 'var(--text-700)', textDecoration: 'underline', textUnderlineOffset: 2 }
  const quiet: CSSProperties = { color: 'var(--text-muted)' }
  return (
    <div
      data-testid="voided-test-bills"
      style={{ margin: '1rem 0 0', padding: '0 0.6rem', borderRadius: 8, background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', fontSize: '0.8125rem', color: 'var(--text-700)', minWidth: 0 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <b>{voidedTestBillsHeading(bills.length)}</b>
        <button type="button" onClick={() => setShown((v) => !v)} aria-expanded={shown} style={word}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {shown ? (
        <div style={{ paddingBottom: '0.5rem' }}>
          <p style={{ ...quiet, margin: '0 0 0.35rem' }}>{VOIDED_TEST_BILLS_NOTE}</p>
          {bills.map((b) => (
            <div key={b.id} data-testid="voided-test-bill" style={{ padding: '0.45rem 0', borderTop: '1px solid var(--border)', minWidth: 0, overflowWrap: 'anywhere' }}>
              <ValueLines>
                {b.number ? (
                  <ValueLine label="Bill">
                    <WorkedOutValue>{b.number}</WorkedOutValue>
                  </ValueLine>
                ) : null}
                <ValueLine label="Amount">
                  <WorkedOutValue>
                    <Money amount={b.amount} empty="Not on record" />
                  </WorkedOutValue>
                </ValueLine>
                <ValueLine label="Voided">
                  <WorkedOutValue>{b.voidedDay}</WorkedOutValue> <WorkedOutValue>{b.voidedTime}</WorkedOutValue>
                </ValueLine>
                <ValueLine label="Voided by">
                  <WorkedOutValue>{b.voidedBy || VOIDED_TEST_BILL_NO_NAME}</WorkedOutValue>
                </ValueLine>
                <ValueLine label="In Stripe">
                  <WorkedOutValue>{b.stripeWords}</WorkedOutValue>
                  {b.stripeInvoiceId ? <span style={quiet}> {b.stripeInvoiceId}</span> : null}
                </ValueLine>
              </ValueLines>
              <div style={{ ...quiet, margin: '0.4rem 0 0.15rem' }}>Its sends</div>
              {b.sends.length === 0 ? (
                <div style={quiet} data-testid="voided-test-bill-no-sends">
                  {VOIDED_TEST_BILL_NO_SENDS}
                </div>
              ) : (
                <ValueLines>
                  {b.sends.map((s) => (
                    <ValueLine key={s.key} label={s.how}>
                      <span data-testid="voided-test-bill-send">
                        {s.to ? <WorkedOutValue>{s.to}</WorkedOutValue> : <span style={quiet}>{VOIDED_TEST_BILL_NO_ADDRESS}</span>} <WorkedOutValue>{s.day}</WorkedOutValue>{' '}
                        <WorkedOutValue>{s.time}</WorkedOutValue>
                      </span>
                    </ValueLine>
                  ))}
                </ValueLines>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
