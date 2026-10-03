import { drawPayDays, drawsToPay, money, PAY_WITHIN_DAYS, shortDate, type Draw, type GcProject, type GcState, type TradePackage } from '../../lib/gcMode/gcModel'
import { Card, Chip } from './gcUi'

/**
 * GC mode design spike: when we pay a trade's draw, on the Draws tab (owner, 2026-10-03: an
 * approved pay application is paid within PAY_WITHIN_DAYS; a retainage release on the day it opens).
 * The days come from drawPayDays in gcBuildingPay.ts.
 */

const late = (days: number) => `${days} ${days === 1 ? 'day' : 'days'} late`

/** A draw's days on its row: approved and pay by, or approved and paid, and how late. */
export function GcBuildingDrawDays({ project, pkg, draw, today }: { project: GcProject; pkg: TradePackage; draw: Draw; today: string }) {
  const days = drawPayDays(project, pkg, draw, today)
  if (!days.approvedOn) return null
  return (
    <span style={{ color: 'var(--text-muted)' }}>
      approved {shortDate(days.approvedOn)}
      {days.paidOn ? (
        <>
          {' '}
          · paid {shortDate(days.paidOn)}
          {days.daysLate > 0 && <span style={{ color: 'var(--text-amber-800)' }}> · {late(days.daysLate)}</span>}
        </>
      ) : days.payBy ? (
        <>
          {' '}
          ·{' '}
          <strong style={{ color: days.daysLate > 0 ? 'var(--text-red-700)' : 'var(--text-base)' }}>
            pay by {shortDate(days.payBy)}
            {days.daysLate > 0 ? ` · ${late(days.daysLate)}` : days.payBy === today ? ' · today' : ''}
          </strong>
        </>
      ) : null}
    </span>
  )
}

/** Approved draws not paid yet on the project, late first, then soonest: what to pay and by when. */
export function GcBuildingToPay({ state, project }: { state: GcState; project: GcProject }) {
  const list = drawsToPay(state, project)
  if (list.length === 0) return null
  const total = list.reduce((s, d) => s + d.draw.net, 0)
  const lateCount = list.filter((d) => d.daysLate > 0).length
  return (
    <Card>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
        <strong>To pay</strong>
        <span style={{ color: 'var(--text-muted)' }}>
          {list.length} approved {list.length === 1 ? 'draw' : 'draws'}, {money(total)}
        </span>
        {lateCount > 0 && <Chip tone="red">{lateCount} late</Chip>}
      </div>
      <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.875rem' }}>
        {list.map(({ pkg, company, draw, payBy, daysLate }) => (
          <div key={draw.id}>
            {company} · {pkg.trade} {draw.final ? 'retainage release' : `draw ${draw.number}`} · <strong>{money(draw.net)}</strong>
            {payBy && (
              <span style={{ color: daysLate > 0 ? 'var(--text-red-700)' : 'var(--text-muted)' }}>
                {' '}
                · pay by {shortDate(payBy)}
                {daysLate > 0 ? ` · ${late(daysLate)}` : payBy === state.today ? ' · today' : ''}
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        We pay an approved draw within {PAY_WITHIN_DAYS} days. A retainage release is paid on the day it opens.
      </div>
    </Card>
  )
}
