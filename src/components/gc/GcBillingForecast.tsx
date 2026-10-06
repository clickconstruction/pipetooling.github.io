/**
 * GC mode design spike: what we expect to bill each month as the schedule stands, the Gantt's
 * Phase 4 (G-97; mock-up `to-dos/gc-mode/mockups/G-97.md`). Three pictures of one forecast
 * (`gcBillingForecast.ts`): the job's months on Bill the customer, under the draft they continue;
 * every job's months on the Money tab, under the next six weeks; and the customer's bills ahead in
 * their portal, rounded, with no trade in sight. Each says what this week's moves did to it.
 */
import { Fragment, useState } from 'react'
import { money, shortDate, weekdayDate, type GcProject, type GcState } from '../../lib/gcMode/gcModel'
import { aboutMoney, billingByMonth, billingForecast, customerShiftWords, weekBillingShift, type ForecastShift } from '../../lib/gcMode/gcBillingForecast'
import { Card, num, td, th } from './gcUi'

const muted = { color: 'var(--text-muted)', fontSize: '0.875rem' } as const

/** "−$6,600", "+$6,600", or nothing. */
function shiftCell(shifts: ForecastShift[], on: string): string {
  const s = shifts.find((x) => x.on === on)
  return s ? `${s.delta > 0 ? '+' : '−'}${money(Math.abs(s.delta))}` : ''
}

/** The job's months, on Bill the customer under the draft (G-97). */
export function GcBillingForecastCard({ state, project }: { state: GcState; project: GcProject }) {
  const [open, setOpen] = useState<string | null>(null)
  const f = billingForecast(state, project)
  const week = f.months.length > 0 ? weekBillingShift(state, project) : []
  const first = f.months[0]
  return (
    <Card dataTour="gc-billing-forecast">
      <strong style={{ fontSize: '1.05rem' }}>What we expect to bill</strong>
      <div style={{ ...muted, margin: '0.2rem 0 0.6rem' }}>
        As the schedule stands today. Each bar&rsquo;s work counts on the bill day it is done by. When a bar moves, its money moves with it.
      </div>
      {f.none === 'noSchedule' && <div style={{ fontSize: '0.875rem' }}>Draw the schedule and the months show here.</div>}
      {f.none === 'allBilled' && (
        <div style={{ fontSize: '0.875rem' }}>
          All the work is billed. The {money(f.heldAtEnd)} they hold comes with the final bill.
        </div>
      )}
      {f.months.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={th}>Bill day</th>
                <th style={{ ...th, textAlign: 'right' }}>Done by then</th>
                <th style={{ ...th, textAlign: 'right' }}>We bill</th>
                {week.length > 0 && <th style={{ ...th, textAlign: 'right' }}>Moved this week</th>}
              </tr>
            </thead>
            <tbody>
              {f.months.map((m) => {
                const shown = open === m.on
                return (
                  <Fragment key={m.on}>
                    <tr>
                      <td style={td}>
                        <button
                          type="button"
                          aria-expanded={shown}
                          onClick={() => setOpen(shown ? null : m.on)}
                          title="The trades whose work this bill carries, with our costs and fee spread in."
                          style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          <span aria-hidden>{shown ? '▾' : '▸'}</span> {weekdayDate(m.on)}
                        </button>
                      </td>
                      <td style={num}>{m.pct}%</td>
                      <td style={{ ...num, fontWeight: 700 }}>{money(m.bill)}</td>
                      {week.length > 0 && <td style={{ ...num, color: 'var(--text-muted)' }}>{shiftCell(week, m.on)}</td>}
                    </tr>
                    {shown && (
                      <tr>
                        <td colSpan={week.length > 0 ? 4 : 3} style={{ ...td, paddingTop: 0 }}>
                          <div style={{ display: 'flex', gap: '0.3rem 0.9rem', flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-600)' }}>
                            {m.byTrade.map((t) => (
                              <span key={t.label} style={{ whiteSpace: 'nowrap' }}>
                                {t.label} {money(t.amount)}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {f.months.length > 0 && (
        <div style={{ ...muted, marginTop: '0.6rem', display: 'grid', gap: '0.25rem' }}>
          <span>
            Then the {money(f.heldAtEnd)} {project.owner} holds comes with the final bill, once they accept the work.
          </span>
          {first && first.on === f.draft.on && Math.abs(first.bill - f.draft.due) >= 1 && (
            <span>
              The draft above bills the work reported so far, {money(f.draft.due)}. {shortDate(first.on)} comes to about {money(first.bill)} if the trades report the
              work the schedule has done by then.
            </span>
          )}
          {f.unplaced >= 1 && <span>{money(f.unplaced)} of the price is not on the schedule yet, so it is not in the months.</span>}
          {week.length > 0 && <span>Moved this week is what this week&rsquo;s moves on the schedule changed.</span>}
        </div>
      )}
    </Card>
  )
}

/** Every job's months, on the Money tab under the next six weeks (G-97). */
export function GcBillingForecastMoney({ state, onOpenBill }: { state: GcState; onOpenBill: (projectId: string) => void }) {
  const all = billingByMonth(state)
  if (all.months.length === 0 && all.noSchedule.length === 0) return null
  return (
    <Card style={{ padding: 0 }} dataTour="gc-billing-by-month">
      <div style={{ padding: '0.75rem 1rem 0.2rem', fontWeight: 700, fontSize: '1rem' }}>What we bill, month by month</div>
      <div style={{ ...muted, padding: '0 1rem 0.5rem' }}>As each job&rsquo;s schedule stands today. A bar that moves moves its money to another month.</div>
      <div style={{ display: 'grid' }}>
        {all.months.map((m) => (
          <div key={m.on} style={{ display: 'flex', gap: '0.4rem 1rem', alignItems: 'baseline', flexWrap: 'wrap', padding: '0.45rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }}>
            <span style={{ minWidth: '6.5rem' }}>{weekdayDate(m.on)}</span>
            <strong style={{ minWidth: '6rem', fontVariantNumeric: 'tabular-nums' }}>{money(m.total)}</strong>
            <span style={{ display: 'flex', gap: '0.2rem 0.9rem', flexWrap: 'wrap', minWidth: 0 }}>
              {m.jobs.map((j) => (
                <button
                  key={j.project.id}
                  type="button"
                  onClick={() => onOpenBill(j.project.id)}
                  title="Open its Bill the customer tab."
                  style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }}
                >
                  {j.project.name} {money(j.bill)}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
      <div style={{ ...muted, padding: '0.55rem 1rem 0.8rem', display: 'grid', gap: '0.2rem', borderTop: '1px solid var(--border)' }}>
        {all.heldAtEnd >= 1 && <span>Customers hold {money(all.heldAtEnd)} until the final bills.</span>}
        {all.noSchedule.map((p) => (
          <span key={p.id}>{p.name} has no schedule yet, so its bills are not here.</span>
        ))}
        {all.unplaced.map((u) => (
          <span key={u.project.id}>
            {money(u.amount)} of {u.project.name}&rsquo;s price is not on its schedule yet.
          </span>
        ))}
      </div>
    </Card>
  )
}

/** The customer's bills ahead, in their portal's Your bills (G-97): rounded, by bill day, never by trade. */
export function GcBillingForecastPortal({ state, project }: { state: GcState; project: GcProject }) {
  const f = billingForecast(state, project)
  if (f.months.length === 0) return null
  const week = customerShiftWords(weekBillingShift(state, project))
  const about = aboutMoney(f.unplaced)
  return (
    <div data-portal-forecast style={{ display: 'grid', gap: '0.3rem', fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: '0.45rem' }}>
      <div style={{ fontWeight: 600 }}>What we expect to bill you, as the schedule stands today</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.15rem 0.75rem' }}>
        {f.months.map((m) => (
          <Fragment key={m.on}>
            <span>{weekdayDate(m.on)}</span>
            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{aboutMoney(m.bill)}</span>
          </Fragment>
        ))}
      </div>
      <div>What you hold, {aboutMoney(f.heldAtEnd)}, comes with the final bill.</div>
      {f.unplaced >= 50 && <div>{about.charAt(0).toUpperCase() + about.slice(1)} of the price is not on the schedule yet.</div>}
      {week && <div style={{ color: 'var(--text-muted)' }}>{week}</div>}
    </div>
  )
}
