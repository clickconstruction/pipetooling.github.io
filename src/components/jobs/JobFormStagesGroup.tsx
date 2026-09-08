/**
 * Edit Job → Stages (Stage Plan PR 4): the read-out above the job details.
 * Collapsed, one line — "4 in order · 2 any time · 5 shown to Summit". Open,
 * the In order and Any time lists from the plan with where each stands and
 * the eye (does the GC see this row). Two doors: See it as the customer (the
 * drawer) and Set stages on Bill → (the ① Line Items selector). No grips, no
 * kind switch — order and kind are set on Bill; this tab reads them.
 */
import { useState } from 'react'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { stageSpanShort, type StagePlan, type StagePlanRow } from '../../lib/jobs/stagePlan'
import { StageKindBadge } from './StageKindControls'

type JobFormStagesGroupProps = {
  plan: StagePlan
  gcName: string | null
  /** The job-level switch (Edit Job → GC/Builder → Share stage dates). The eyes still set; the portal shows nothing until it is on. */
  sharesWithGc: boolean
  onToggleShared: (fixtureId: string, shared: boolean) => void
  onSeeAsCustomer: () => void
  onGoToBill?: () => void
  defaultOpen?: boolean
}

function EyeIcon({ on }: { on: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" fill={on ? 'currentColor' : 'none'} />
      {!on ? <path d="M4 4l16 16" /> : null}
    </svg>
  )
}

/** The chip at the right of a row: where the work stands, in a few words. */
function standing(r: StagePlanRow): { text: string; tone: 'green' | 'blue' | 'plain' | 'muted' } {
  switch (r.work) {
    case 'passed':
      return { text: r.passedOn ? `passed ${stageSpanShort({ start: r.passedOn, end: r.passedOn })}` : 'passed', tone: 'green' }
    case 'inspection':
      return { text: 'inspection next', tone: 'blue' }
    case 'working':
      return { text: `${r.pick ? stageSpanShort(r.pick) : 'on site'}${r.pct != null ? ` · ${Math.round(r.pct)}%` : ''}`, tone: 'blue' }
    case 'scheduled':
      return { text: r.pick ? stageSpanShort(r.pick) : 'scheduled', tone: 'blue' }
    case 'offered':
    case 'window':
      return { text: r.window ? stageSpanShort(r.window) : 'window', tone: 'plain' }
    default:
      return { text: r.kind === 'order' ? 'no window yet' : 'not scheduled', tone: 'muted' }
  }
}

const TONE: Record<'green' | 'blue' | 'plain' | 'muted', { color: string; background: string; border: string }> = {
  green: { color: 'var(--text-green-700)', background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)' },
  blue: { color: 'var(--text-blue-700)', background: 'var(--bg-blue-tint)', border: '1px solid var(--border)' },
  plain: { color: 'var(--text-700)', background: 'var(--surface)', border: '1px solid var(--border-strong)' },
  muted: { color: 'var(--text-muted)', background: 'transparent', border: '1px dashed var(--border)' },
}

export function JobFormStagesGroup({ plan, gcName, sharesWithGc, onToggleShared, onSeeAsCustomer, onGoToBill, defaultOpen }: JobFormStagesGroupProps) {
  const [open, setOpen] = useState(defaultOpen ?? plan.orderCount > 0)
  const gc = gcName?.trim() || 'the GC'
  const orders = plan.rows.filter((r) => r.kind === 'order')
  const anys = plan.rows.filter((r) => r.kind === 'any')
  const shown = plan.rows.filter((r) => r.sharedWithGc && r.kind !== null).length
  const summary = plan.rows.length === 0 ? 'none yet' : [`${orders.length} in order`, `${anys.length} any time`, `${shown} shown to ${gc}`].join(' · ')

  const row = (r: StagePlanRow) => {
    const s = standing(r)
    const sub = r.kind === 'order' ? `${r.drawNumber != null ? `draw ${r.drawNumber} · ` : 'no draw · '}$${formatCurrency(r.amount)}` : `$${formatCurrency(r.amount)}`
    return (
      <div key={r.fixtureId} data-testid={`stages-group-row-${r.kind}`} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, background: r.badge === 'live' ? 'var(--bg-blue-tint)' : 'var(--surface)' }}>
        <StageKindBadge row={r} size={24} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub}</div>
        </div>
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1rem 0.5rem', borderRadius: 999, whiteSpace: 'nowrap', ...TONE[s.tone] }}>{s.text}</span>
        <button
          type="button"
          role="switch"
          aria-checked={r.sharedWithGc}
          aria-label={r.sharedWithGc ? `Shown to ${gc} — hide ${r.name}` : `Hidden from ${gc} — show ${r.name}`}
          title={r.sharedWithGc ? `${gc} sees this stage on their portal · click to hide` : `${gc} does not see this stage · click to show`}
          onClick={() => onToggleShared(r.fixtureId, !r.sharedWithGc)}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 24, borderRadius: 999, border: `1px solid ${r.sharedWithGc ? 'var(--border-strong)' : 'var(--border)'}`, background: r.sharedWithGc ? 'var(--bg-200)' : 'transparent', color: r.sharedWithGc ? 'var(--text-700)' : 'var(--text-faint)', cursor: 'pointer', flexShrink: 0 }}
        >
          <EyeIcon on={r.sharedWithGc} />
        </button>
      </div>
    )
  }

  return (
    <div data-testid="stages-group" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem 0.75rem', marginBottom: '0.75rem', background: 'var(--bg-subtle)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-700)' }}>Stages</span>
        <span data-testid="stages-group-summary" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {summary}
        </span>
        <span aria-hidden style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
          {plan.rows.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No line items yet — add them on Bill → ① Line Items and flip the stages to Order.</div>
          ) : null}
          {orders.length > 0 ? (
            <>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text-700)' }}>In order</strong> · each starts when the one before it passes
              </div>
              {orders.map(row)}
            </>
          ) : null}
          {anys.length > 0 ? (
            <>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: orders.length > 0 ? '0.25rem' : 0 }}>
                <strong style={{ color: 'var(--text-700)' }}>◆ Any time</strong> · change orders and extras — their own dates
              </div>
              {anys.map(row)}
            </>
          ) : null}
          {!sharesWithGc && shown > 0 ? (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>Stage dates are not shared with {gc} yet — turn on the switch under GC/Builder and the eyes take effect.</div>
          ) : null}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            <button type="button" onClick={onSeeAsCustomer} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
              See it as the customer
            </button>
            {onGoToBill ? (
              <button type="button" onClick={onGoToBill} style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, background: 'transparent', color: 'var(--text-link)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer' }}>
                Set stages on Bill →
              </button>
            ) : null}
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-700)' }}>Numbered</strong> waits for the one above it · <strong style={{ color: 'var(--text-700)' }}>◆</strong> can happen whenever · the eye = on the portal. Order and kind are set on Bill → ① Line Items.
          </div>
        </div>
      ) : null}
    </div>
  )
}
