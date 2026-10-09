import { Card } from './gcUi'
import { allJobsMoney } from '../../lib/gc/ownerBilling'
import { ownerInterest } from '../../lib/gc/ownerBillingInterest'
import type { GcState } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'

/**
 * GC mode, the real build, Owner Billing's O6b-1: interest on late bills, on the Money lens, over each job's own terms
 * (`ownerInterest`). Each job that charges it: its rate, what has built up on its late bills from the day after each
 * fell due by the contract (decision 7), what went on interest bills, what the customer paid on them, and what is
 * left to bill. Read only: billing it is O6b-2's.
 */
export function GcMoneyInterest({ state }: { state: GcState }) {
  const rows = allJobsMoney(state).jobs.flatMap((j) => {
    const interest = ownerInterest(state, j.project)
    return interest.pctPerMonth === null ? [] : [{ project: j.project, interest }]
  })
  const toBill = rows.reduce((t, r) => t + r.interest.toBill, 0)
  return (
    <Card>
      <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.4rem' }}>Interest on late bills</div>
      {rows.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No job charges interest on late bills. A job&rsquo;s rate is set in Bill the customer, with its terms.</div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
          <div>{Math.round(toBill) > 0 ? <strong>{`${money(toBill)} of interest has built up and is not billed yet.`}</strong> : 'No interest is waiting to be billed.'}</div>
          {rows.map(({ project, interest }) => (
            <div key={project.id} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem', display: 'grid', gap: '0.15rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                <strong style={{ flex: 1, minWidth: 0 }}>{project.name}</strong>
                <span style={{ color: 'var(--text-muted)' }}>{`${interest.pctPerMonth}% a month`}</span>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{`${money(interest.toBill)} to bill`}</strong>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                {`Built up ${money(interest.builtUp)}, billed ${money(interest.billed)}, paid ${money(interest.paid)}.`}
                {project.ownerPayDays == null ? ' None runs until the contract’s days to pay are typed.' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
