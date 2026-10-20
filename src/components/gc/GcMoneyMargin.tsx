import { useState } from 'react'
import { useMatchMedia } from '../../hooks/useMatchMedia'
import { Btn, Card, Chip, num, td, th } from './gcUi'
import { allJobsMargin, type JobMargin } from '../../lib/gc/ownerBillingMargin'
import { crewCostWords, generalConditionsWords, type OwnWorkCosts } from '../../lib/gc/ownWorkCost'
import type { GcState } from '../../lib/gc/types'
import { money } from '../../lib/gc/words'

/**
 * GC mode, the real build, Owner Billing's O6a: what each job makes us, on the Money lens. Ported from the prototype's
 * `GcOwnerBillingMargin.tsx` (branch spike/gc-mode), read only.
 * The fee, what buying out saved, the change orders' margin; how much is earned so far, as billed;
 * contingency not spent, apart. Each job opens to its trades: what the customer signed for each
 * beside what it costs us. For the owner and the controller only. Since O11b, general conditions count at their
 * Pipeline job's real spend when our number names one, and since O11a our own crew at its Pipeline job's cost (`own`,
 * read by the page), as **Our own work**.
 */
export function GcMoneyMargin({ state, own }: { state: GcState; own?: OwnWorkCosts }) {
  const all = allJobsMargin(state, own)
  const narrow = useMatchMedia('(max-width: 640px)')
  const [openId, setOpenId] = useState<string | null>(null)
  const pct = all.price > 0 ? (all.margin / all.price) * 100 : 0
  const signed = (n: number) => (Math.round(n) === 0 ? '—' : `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`)

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ padding: '0.75rem 1rem 0.4rem', fontWeight: 700, fontSize: '1rem' }}>What each job makes us</div>
      <div style={{ padding: '0 1rem 0.6rem', fontSize: '0.9rem' }}>
        <strong>
          Across our {all.jobs.length === 1 ? '1 job' : `${all.jobs.length} jobs`} we make {money(all.margin)} on {money(all.price)}, {pct.toFixed(1)}%.
        </strong>{' '}
        <span style={{ color: 'var(--text-muted)' }}>
          {money(all.earned)} of it is earned so far, as billed. Contingency not spent: {money(all.contingency)}.
        </span>
      </div>

      {narrow ? (
        <div style={{ display: 'grid' }}>
          {all.jobs.map((j) => (
            <div key={j.project.id} style={{ borderTop: '1px solid var(--border)', padding: '0.55rem 1rem', display: 'grid', gap: '0.2rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
                <strong style={{ flex: 1, minWidth: 0 }}>{j.project.name}</strong>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{money(j.margin)}</strong>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                {j.marginPct.toFixed(1)}% of {money(j.price)} · {money(j.earned)} earned so far
              </div>
              <Breakdown j={j} signed={signed} open={openId === j.project.id} onToggle={() => setOpenId(openId === j.project.id ? null : j.project.id)} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Job</th>
                <th style={{ ...th, textAlign: 'right' }}>Price</th>
                <th style={{ ...th, textAlign: 'right' }}>Our fee</th>
                <th style={{ ...th, textAlign: 'right' }}>Buying out</th>
                <th style={{ ...th, textAlign: 'right' }}>Change orders</th>
                <th style={{ ...th, textAlign: 'right' }}>Our own work</th>
                <th style={{ ...th, textAlign: 'right' }}>Makes us</th>
                <th style={{ ...th, textAlign: 'right' }}>Earned so far</th>
              </tr>
            </thead>
            <tbody>
              {all.jobs.map((j) => (
                <tr key={j.project.id}>
                  <td style={td}>
                    <strong>{j.project.name}</strong>
                    <Breakdown j={j} signed={signed} open={openId === j.project.id} onToggle={() => setOpenId(openId === j.project.id ? null : j.project.id)} />
                  </td>
                  <td style={num}>{money(j.price)}</td>
                  <td style={num}>{money(j.fee)}</td>
                  <td style={{ ...num, color: j.buyout < -0.5 ? 'var(--text-red-700)' : undefined }}>{signed(j.buyout)}</td>
                  <td style={num}>{j.changeOrders.count === 0 ? '—' : signed(j.changeOrders.margin)}</td>
                  <td style={{ ...num, color: j.ownWork < -0.5 ? 'var(--text-red-700)' : undefined }}>{signed(j.ownWork)}</td>
                  <td style={{ ...num, fontWeight: 700 }}>
                    {money(j.margin)}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400 }}>{j.marginPct.toFixed(1)}%</div>
                  </td>
                  <td style={num}>
                    {money(j.earned)}
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{Math.round(j.billedShare * 100)}% billed</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ padding: '0.5rem 1rem 0.8rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        Our own crew counts at its Pipeline job’s cost at today’s pace, and at what it cost once done. General conditions count at
        their Pipeline job’s spend once it passes their budget, and at what they cost once the job closes. One with no Pipeline job
        counts at its price or budget, as before. A trade not bought out yet counts at what we carry for it.
      </div>
    </Card>
  )
}

function Breakdown({ j, signed, open, onToggle }: { j: JobMargin; signed: (n: number) => string; open: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginTop: '0.2rem' }}>
      <Btn kind="quiet" onClick={onToggle}>
        {open ? 'Hide each trade' : 'See each trade'}
      </Btn>
      {open && (
        <div style={{ display: 'grid', gap: '0.2rem', marginTop: '0.3rem', fontSize: '0.8rem' }}>
          {j.trades.map((t) => (
            <div key={t.packageId} style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ minWidth: '8rem' }}>{t.trade}</span>
              <span style={{ color: 'var(--text-muted)' }} {...(t.crew ? { 'data-gc-margin-crew': t.packageId } : {})}>
                {t.crew ? crewCostWords(t.crew) : `${t.company ?? 'not awarded'} · signed for ${money(t.signed)}, costs us ${money(t.cost)}`}
              </span>
              {!t.boughtOut && !t.ownCrew && <Chip tone="amber">not bought out yet</Chip>}
              <span style={{ flex: 1 }} />
              <span style={{ fontVariantNumeric: 'tabular-nums', color: t.saved < -0.5 ? 'var(--text-red-700)' : undefined }}>{signed(t.saved)}</span>
            </div>
          ))}
          {j.changeOrders.count > 0 && (
            <div style={{ color: 'var(--text-muted)' }}>
              {j.changeOrders.count === 1 ? '1 signed change order' : `${j.changeOrders.count} signed change orders`}: {money(j.changeOrders.price)} on the price, costs
              us {money(j.changeOrders.cost)}.
            </div>
          )}
          <div data-gc-margin-general-conditions style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'baseline', color: 'var(--text-muted)' }}>
            <span>{generalConditionsWords(j.generalConditionsCost)}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontVariantNumeric: 'tabular-nums', color: j.ownWork < -0.5 ? 'var(--text-red-700)' : undefined }}>{signed(j.ownWork)}</span>
          </div>
          <div style={{ color: 'var(--text-muted)' }}>
            Fee {money(j.fee)} · contingency not spent {money(j.contingency)}
          </div>
        </div>
      )}
    </div>
  )
}
