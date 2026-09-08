/**
 * Stage Plan (PR 2): the draws still to come, under the ② Invoices strip —
 * one row per uninvoiced line item with money on it, in plan order. A row
 * that is ready (an Order stage that passed with everything above it
 * invoiced; an Any stage whose work is done) carries **Bill it**, which
 * breaks off that one row's invoice through the existing segment-invoice
 * path. Everything else says what it is waiting on. Pure render.
 */
import type { StagePlan, StagePlanRow } from '../../lib/jobs/stagePlan'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { drawRowLabel, upcomingDrawRows } from '../../lib/jobs/stagePlanForm'
import { StageKindBadge } from './StageKindControls'

type JobFormUpcomingDrawsProps = {
  plan: StagePlan
  onBillRow: (fixtureId: string) => void
  billingFixtureId: string | null
  disabled?: boolean
}

function waitingWords(r: StagePlanRow, plan: StagePlan): string {
  if (r.draw === 'ready') {
    if (r.kind === 'order') return `passed${r.passedOn ? ' inspection' : ''} · not yet billed`
    return `done${r.doneOn ? '' : ''} · not yet billed`
  }
  if (r.draw === 'waits') {
    const blocker = plan.rows.find((p) => p.kind === 'order' && p.number != null && r.number != null && p.number < r.number && !p.invoiceId && p.amount > 0)
    return blocker ? `passed · waits on stage ${blocker.number}` : 'passed · waits on the stage above'
  }
  if (r.kind === 'order') return r.work === 'passed' ? 'after the stage above' : 'after it passes inspection'
  if (r.kind === 'any') return 'bills when the work is done'
  return 'with the final draw'
}

export function JobFormUpcomingDraws({ plan, onBillRow, billingFixtureId, disabled = false }: JobFormUpcomingDrawsProps) {
  const rows = upcomingDrawRows(plan)
  if (rows.length === 0) return null
  return (
    <div data-testid="upcoming-draws" style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
        Still to bill
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {rows.map((r, i) => {
          const ready = r.draw === 'ready'
          const busy = billingFixtureId === r.fixtureId
          return (
            <div
              key={r.fixtureId}
              data-testid={`draw-row-${r.draw}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.45rem 0.75rem',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                background: ready ? 'var(--bg-amber-tint)' : 'transparent',
              }}
            >
              <StageKindBadge row={r} size={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{drawRowLabel(r)}</div>
                <div style={{ fontSize: '0.75rem', color: ready ? 'var(--text-amber-800)' : 'var(--text-muted)' }}>{waitingWords(r, plan)}</div>
              </div>
              {ready ? (
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => onBillRow(r.fixtureId)}
                  style={{
                    padding: '0.3rem 0.7rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: disabled || busy ? 'default' : 'pointer',
                    opacity: disabled || busy ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {busy ? 'Billing…' : 'Bill it'}
                </button>
              ) : (
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.05rem 0.45rem', borderRadius: 999, background: 'var(--bg-200)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {r.draw === 'waits' ? 'Waits' : 'Later'}
                </span>
              )}
              <span style={{ fontSize: '0.875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)', whiteSpace: 'nowrap', minWidth: '5.5rem', textAlign: 'right' }}>
                ${formatCurrency(r.amount)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
