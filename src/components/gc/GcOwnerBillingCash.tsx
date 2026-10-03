import { useState } from 'react'
import { Btn, Card, num, td, th } from './gcUi'
import { money, projectCash, type GcProject, type GcState } from '../../lib/gcMode/gcModel'

/**
 * GC mode design spike: money in and money out on one job, on Bill the owner. What the owner has
 * paid us beside what we have paid the trades, so it shows where we carry the cash. Office only:
 * in the real build it is for the owner and the controller, like the rest of the app's money.
 */
export function GcOwnerBillingCash({ state, project }: { state: GcState; project: GcProject }) {
  const [byTrade, setByTrade] = useState(false)
  const cash = projectCash(state, project)
  const ahead = Math.round(cash.net) >= 0
  const row = (words: string, value: number, strong = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.875rem', padding: '0.15rem 0' }}>
      <span>{words}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: strong ? 700 : undefined }}>{money(value)}</span>
    </div>
  )
  const heading = (words: string) => (
    <div style={{ fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{words}</div>
  )

  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <strong style={{ fontSize: '1.05rem' }}>Money in and money out</strong>
        <span style={{ flex: 1 }} />
        {cash.byTrade.length > 0 && (
          <Btn kind="quiet" onClick={() => setByTrade(!byTrade)}>
            {byTrade ? 'Hide each trade' : 'See each trade'}
          </Btn>
        )}
      </div>
      <div
        style={{
          fontSize: '0.95rem',
          fontWeight: 600,
          marginBottom: '0.7rem',
          color: ahead ? 'var(--text-green-700)' : 'var(--text-red-700)',
        }}
      >
        {ahead ? `So far we are ${money(cash.net)} ahead.` : `So far we are carrying ${money(-cash.net)}.`}{' '}
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
          {money(cash.in.paid)} came in from {project.owner}. {money(cash.out.paid)} went out to the trades.
        </span>
      </div>
      <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))' }}>
        <div>
          {heading(`In, from ${project.owner}`)}
          {row('Paid us', cash.in.paid, true)}
          {row('Owes us now', cash.in.owed)}
          {row('Holds until the end', cash.in.held)}
        </div>
        <div>
          {heading('Out, to the trades')}
          {row('We paid', cash.out.paid, true)}
          {row('Approved, not paid yet', cash.out.approved)}
          {row('Asked for, waiting on us', cash.out.asked)}
          {row('We hold until the end', cash.out.held)}
        </div>
      </div>
      {byTrade && (
        <div style={{ overflowX: 'auto', marginTop: '0.75rem', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Trade</th>
                <th style={{ ...th, textAlign: 'right' }}>We paid</th>
                <th style={{ ...th, textAlign: 'right' }}>Approved</th>
                <th style={{ ...th, textAlign: 'right' }}>Asked for</th>
                <th style={{ ...th, textAlign: 'right' }}>We hold</th>
              </tr>
            </thead>
            <tbody>
              {cash.byTrade.map((t) => (
                <tr key={t.packageId}>
                  <td style={td}>
                    <strong>{t.company}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{t.trade}</div>
                  </td>
                  <td style={num}>{money(t.paid)}</td>
                  <td style={num}>{t.approved === 0 ? '—' : money(t.approved)}</td>
                  <td style={num}>{t.asked === 0 ? '—' : money(t.asked)}</td>
                  <td style={num}>{t.held === 0 ? '—' : money(t.held)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cash.ownCrew.length > 0 && (
        <div style={{ marginTop: '0.6rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Our own crew on {cash.ownCrew.join(' and ').toLowerCase()} is paid through payroll, so it is not here. Neither are our
          general conditions.
        </div>
      )}
    </Card>
  )
}
