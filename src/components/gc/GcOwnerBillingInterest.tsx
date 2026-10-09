import { useState, type Dispatch } from 'react'
import { Btn, Card, Chip, input } from './gcUi'
import { OWNER_INTEREST_DEFAULT_PCT, money, ownerInterest, shortDate, type GcAction, type GcProject, type GcState } from '../../lib/gcMode/gcModel'

/**
 * GC mode design spike: interest on the owner's late bills, on Bill the owner. Ours to offer and to
 * choose per job (the owner, 2026-10-04): off until we set a rate. What has built up goes to the
 * owner on a bill of its own, never on the pay application.
 */
export function GcOwnerBillingInterest({ state, project, dispatch }: { state: GcState; project: GcProject; dispatch: Dispatch<GcAction> }) {
  const i = ownerInterest(state, project)
  const [open, setOpen] = useState(false)
  const [pct, setPct] = useState(String(i.pctPerMonth ?? OWNER_INTEREST_DEFAULT_PCT))
  const pctNum = Number(pct)
  const ready = pctNum > 0 && pctNum <= 5
  const sent = project.ownerBilling?.interestBills ?? []
  const save = (value: number | null) => {
    dispatch({ type: 'setOwnerLateInterest', projectId: project.id, pctPerMonth: value })
    setOpen(false)
  }

  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: '1.05rem' }}>Interest on late bills</strong>
        {Math.round(i.owed) > 0 && <Chip tone="amber">{`${money(i.owed)} billed, not paid`}</Chip>}
        <span style={{ flex: 1 }} />
        {!open && (
          <Btn kind="quiet" onClick={() => setOpen(true)}>
            {i.pctPerMonth === null ? 'Charge interest' : 'Change'}
          </Btn>
        )}
      </div>
      <div style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
        {i.pctPerMonth === null
          ? `We do not charge ${project.owner} interest on a late bill.`
          : `${project.owner} pays ${i.pctPerMonth}% a month on what is still open, from the day a bill is late.`}
      </div>

      {open && (
        <div style={{ marginTop: '0.6rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'grid', gap: '0.5rem' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            It is ours to offer. Use the rate the contract with {project.owner} names. A bill is late the day after the contract’s days to pay
            run out. They count from the architect’s certificate, or from the day the bill went. A promise never moves it.
            {project.ownerPayDays == null ? ' None runs until the contract’s days to pay are typed.' : ` The contract gives ${project.ownerPayDays === 1 ? '1 day' : `${project.ownerPayDays} days`}.`}
          </div>
          <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.875rem' }}>
            <input style={{ ...input, width: '4.5rem' }} type="number" min={0.1} max={5} step={0.1} value={pct} onChange={(e) => setPct(e.target.value)} />% a
            month on what is still open
          </label>
          {!ready && <div style={{ fontSize: '0.85rem', color: 'var(--text-red-700)' }}>Pick a rate above 0% and up to 5% a month.</div>}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Btn kind="primary" disabled={!ready} onClick={() => save(pctNum)}>
              Save
            </Btn>
            {i.pctPerMonth !== null && <Btn onClick={() => save(null)}>Stop charging it</Btn>}
            <Btn kind="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {i.bills.length > 0 && (
        <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.25rem', fontSize: '0.85rem' }}>
          {i.bills.map((b) => (
            <div key={b.app.number} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span>{b.app.final ? 'Final pay application' : `Pay application ${b.app.number}`}</span>
              <span style={{ color: 'var(--text-muted)' }}>
                late since {shortDate(b.from)}, {b.days === 1 ? '1 day' : `${b.days} days`}
                {b.app.paidOn ? `, paid ${shortDate(b.app.paidOn)}` : ''}
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(b.amount)}</span>
            </div>
          ))}
          <div style={{ color: 'var(--text-muted)' }}>
            {money(i.builtUp)} has built up. {money(i.billed)} is billed, {money(i.paid)} paid.
          </div>
        </div>
      )}

      {Math.round(i.toBill) >= 1 && (
        <div style={{ marginTop: '0.5rem' }}>
          <Btn kind="primary" onClick={() => dispatch({ type: 'sendOwnerInterestBill', projectId: project.id })}>
            Bill the interest, {money(i.toBill)}
          </Btn>
        </div>
      )}

      {sent.length > 0 && (
        <div style={{ marginTop: '0.6rem', display: 'grid', gap: '0.3rem', fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
          {[...sent].reverse().map((b) => (
            <div key={b.number} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>Interest bill {b.number}</strong>
              <span style={{ color: 'var(--text-muted)' }}>sent {shortDate(b.sentOn)}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(b.amount)}</span>
              {b.paidOn ? (
                <Chip tone="green">{`paid ${shortDate(b.paidOn)}`}</Chip>
              ) : (
                <Btn kind="quiet" onClick={() => dispatch({ type: 'ownerPaidInterest', projectId: project.id, number: b.number })}>
                  Mark paid
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
