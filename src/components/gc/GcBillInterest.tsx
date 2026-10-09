import { useState } from 'react'
import { Btn, Chip } from './gcUi'
import { emailedTo } from '../../lib/gc/customerEmail'
import { ownerInterest } from '../../lib/gc/ownerBillingInterest'
import type { GcProject, GcState } from '../../lib/gc/types'
import { money, shortDate } from '../../lib/gc/words'

/**
 * GC mode, the real build, Owner Billing's O6b-2: Bill the interest in Bill the customer. What has built up and is
 * not billed yet (`ownerInterest().toBill`) goes on the job's next interest bill through `gc_send_owner_interest_bill`,
 * never more; the tick, off to start, emails it to the customer (`gc-customer-email`, kind `interest_bill`). Each
 * interest bill shows its day, its amount, whether it is paid, and who it was emailed to.
 */

export interface InterestWrites {
  /** Bill what has built up; with `email`, email the customer the interest bill too. */
  onBillInterest: (amount: number, email: boolean) => void
}

export function GcBillInterest({
  state,
  project,
  writes,
  emailed = {},
  busy,
}: {
  state: GcState
  project: GcProject
  writes: InterestWrites
  /** Who each interest bill was emailed to and when, by number, from its sent copies. */
  emailed?: Record<number, { to: string; on: string }[]>
  busy?: string | null
}) {
  // Off to start, as every send's: billing the interest emails no one until it is ticked.
  const [emailIt, setEmailIt] = useState(false)
  const interest = ownerInterest(state, project)
  const bills = project.ownerBilling?.interestBills ?? []
  const toBill = Math.round(interest.toBill * 100) / 100
  if (interest.pctPerMonth === null && bills.length === 0) return null
  return (
    <div style={{ display: 'grid', gap: '0.4rem', fontSize: '0.875rem' }}>
      {interest.pctPerMonth !== null && toBill >= 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: '12rem' }}>{`${money(toBill)} of interest has built up and is not billed yet.`}</span>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <input type="checkbox" checked={emailIt} onChange={(e) => setEmailIt(e.target.checked)} />
            Email the customer the bill now
          </label>
          <Btn kind="primary" disabled={busy === 'bill-interest'} onClick={() => writes.onBillInterest(toBill, emailIt)}>
            {`Bill the interest ${money(toBill)}`}
          </Btn>
        </div>
      )}
      {bills.map((b) => {
        const line = emailedTo(emailed[b.number] ?? [])
        return (
          <div key={b.number} style={{ display: 'grid', gap: '0.15rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{`Interest bill ${b.number} · ${shortDate(b.sentOn)}`}</span>
              <span style={{ flex: 1 }} />
              <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(b.amount)}</strong>
              {b.paidOn ? <Chip tone="green">{`paid ${shortDate(b.paidOn)}`}</Chip> : <Chip tone="amber">open</Chip>}
            </div>
            {line && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{line}</div>}
          </div>
        )
      })}
    </div>
  )
}
