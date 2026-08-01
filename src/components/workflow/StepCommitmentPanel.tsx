import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { commitmentBalance, commitmentRail, nextCommitmentActions } from '../../lib/workflow/stepCommitments'
import type { StepCommitmentRow } from '../../lib/workflow/stepCommitments'

/**
 * Sub work-order panel on an expanded step card (RUN_SUBS_PLAN Phase 2,
 * PR 2.2 — Option B of the approved mockups; first component in
 * src/components/workflow/). Lists this step's commitments with the merged
 * money/work rail, balance figures off the linked sub sheet, and the
 * office transitions (offer / mark accepted / cancel). Settlement (the
 * "Approve walk → release" button) lands in PR 2.3.
 *
 * Superintendents see the panel and may only mark accepted (decision 4 in
 * docs/RUN_SUBS_PLAN.md); amounts are visible to the same audience as line
 * items (the parent gates rendering on canManageStages).
 */
type SettleReport = {
  released_amount: number
  agreed_amount: number
  retainage_pct: number
  created_new_sheet: boolean
  job_number: string | null
}

export function StepCommitmentPanel({
  stepId,
  stepStatus,
  commitments,
  paymentsByLaborJobId,
  roster,
  isSuperintendentOnly,
  onChanged,
  onError,
}: {
  stepId: string
  stepStatus: string
  commitments: StepCommitmentRow[]
  /** Payments of linked sub sheets, keyed by people_labor_jobs.id (loaded by the parent alongside the commitments). */
  paymentsByLaborJobId: Record<string, Array<{ amount: number }>>
  /** People-sourced roster entries only (a commitment needs a person_id). */
  roster: Array<{ name: string; personId: string }>
  isSuperintendentOnly: boolean
  onChanged: () => void
  onError: (message: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [addPersonId, setAddPersonId] = useState('')
  const [addAmount, setAddAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [settlePreview, setSettlePreview] = useState<{ commitmentId: string; report: SettleReport } | null>(null)

  // The settlement preview IS the real settlement rolled back server-side
  // (p_dry_run sentinel), so Confirm can never do something different.
  async function requestSettle(commitment: StepCommitmentRow) {
    setSaving(true)
    const { data, error } = await supabase.rpc('settle_step_commitment', {
      p_commitment_id: commitment.id,
      p_dry_run: true,
    })
    setSaving(false)
    if (error) {
      onError(`Could not preview settlement: ${error.message}`)
      return
    }
    setSettlePreview({ commitmentId: commitment.id, report: data as unknown as SettleReport })
  }

  async function confirmSettle() {
    if (!settlePreview) return
    setSaving(true)
    const { error } = await supabase.rpc('settle_step_commitment', {
      p_commitment_id: settlePreview.commitmentId,
      p_dry_run: false,
    })
    setSaving(false)
    setSettlePreview(null)
    if (error) {
      onError(`Failed to settle work order: ${error.message}`)
      return
    }
    onChanged()
  }

  const live = commitments.filter((c) => c.status !== 'cancelled')

  async function transition(commitment: StepCommitmentRow, action: 'offer' | 'accept' | 'cancel') {
    setSaving(true)
    const nowIso = new Date().toISOString()
    const update: Record<string, unknown> =
      action === 'offer'
        ? { status: 'offered', offered_at: nowIso }
        : action === 'accept'
          ? { status: 'accepted', accepted_at: nowIso }
          : { status: 'cancelled' }
    const { error } = await supabase.from('step_commitments').update(update).eq('id', commitment.id)
    setSaving(false)
    if (error) {
      onError(`Failed to update work order: ${error.message}`)
      return
    }
    onChanged()
  }

  async function addCommitment() {
    const person = roster.find((r) => r.personId === addPersonId)
    const amount = Number(addAmount)
    if (!person || !Number.isFinite(amount) || amount < 0) return
    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    const { error } = await supabase.from('step_commitments').insert({
      step_id: stepId,
      person_id: person.personId,
      display_name: person.name,
      amount,
      created_by: authData.user?.id ?? null,
    })
    setSaving(false)
    if (error) {
      onError(`Failed to add work order: ${error.message}`)
      return
    }
    setAdding(false)
    setAddPersonId('')
    setAddAmount('')
    onChanged()
  }

  const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, margin: '0.75rem 0', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.45rem 0.7rem',
          background: 'var(--bg-subtle)',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}
      >
        🔧 Sub work order{live.length > 1 ? 's' : ''}
        <span style={{ flex: 1 }} />
        {!isSuperintendentOnly && !adding && (
          <button type="button" className="wf-btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setAdding(true)}>
            + Add
          </button>
        )}
      </div>

      {live.length === 0 && !adding && (
        <p style={{ margin: 0, padding: '0.6rem 0.7rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          No sub committed to this step yet.
        </p>
      )}

      {live.map((c) => {
        const rail = commitmentRail(c.status, stepStatus)
        const balance = commitmentBalance(c, c.labor_job_id ? paymentsByLaborJobId[c.labor_job_id] ?? [] : null)
        const actions = nextCommitmentActions(c.status).filter((a) => (isSuperintendentOnly ? a === 'accept' : true))
        return (
          <div key={c.id} style={{ padding: '0.6rem 0.7rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  background: 'var(--bg-blue-tint)',
                  color: 'var(--text-link)',
                  borderRadius: 999,
                  padding: '0.08rem 0.55rem',
                }}
              >
                {c.display_name}
              </span>
              <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(balance.agreed)}</span>
              {Number(c.retainage_pct) > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({Number(c.retainage_pct)}% retainage)</span>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', margin: '0.5rem 0' }}>
              {rail.map((seg, i) => (
                <span
                  key={seg.key}
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 650,
                    letterSpacing: '0.02em',
                    padding: '0.14rem 0.55rem',
                    border: '1px solid var(--border)',
                    borderLeftWidth: i === 0 ? 1 : 0,
                    borderRadius: i === 0 ? '999px 0 0 999px' : i === rail.length - 1 ? '0 999px 999px 0' : 0,
                    background: seg.state === 'done' ? 'var(--bg-green-tint)' : seg.state === 'now' ? 'var(--bg-orange-tint)' : 'var(--surface)',
                    color: seg.state === 'done' ? '#059669' : seg.state === 'now' ? '#E87600' : 'var(--text-faint)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {seg.label}
                </span>
              ))}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1.1rem', fontSize: '0.8125rem', marginBottom: actions.length > 0 ? '0.55rem' : 0 }}>
              <span>
                <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', display: 'block' }}>Paid to date</span>
                <span className="num" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(balance.paidToDate)}</span>
              </span>
              <span>
                <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', display: 'block' }}>Backcharges</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(balance.backcharges)}</span>
              </span>
              <span>
                <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', display: 'block' }}>Balance</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 650 }}>{money(balance.balanceRemaining)}</span>
              </span>
              {balance.retainageHeld > 0 && (
                <span>
                  <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', display: 'block' }}>Retainage held</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(balance.retainageHeld)}</span>
                </span>
              )}
            </div>

            {(actions.length > 0 || (!isSuperintendentOnly && (c.status === 'accepted' || c.status === 'approved'))) && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {actions.includes('offer') && (
                  <button type="button" className="wf-btn-primary" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => transition(c, 'offer')}>
                    Offer to {c.display_name}
                  </button>
                )}
                {actions.includes('accept') && (
                  <button type="button" className="wf-btn-primary" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => transition(c, 'accept')}>
                    Mark accepted
                  </button>
                )}
                {!isSuperintendentOnly && (c.status === 'accepted' || c.status === 'approved') && (
                  <button
                    type="button"
                    className="wf-btn-primary"
                    style={{ fontSize: '0.78rem' }}
                    disabled={saving || !(stepStatus === 'completed' || stepStatus === 'approved')}
                    title={
                      stepStatus === 'completed' || stepStatus === 'approved'
                        ? 'Create the Sub Labor sheet for the balance'
                        : 'The step must be complete or approved before releasing the money'
                    }
                    onClick={() => requestSettle(c)}
                  >
                    Settle → release {money(balance.agreed - balance.retainageHeld)}
                  </button>
                )}
                {actions.includes('cancel') && (
                  <button type="button" className="wf-btn-ghost" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => transition(c, 'cancel')}>
                    Cancel work order
                  </button>
                )}
              </div>
            )}

            {c.status === 'settled' && (
              <a href="/jobs?tab=sub_sheet_ledger" style={{ fontSize: '0.78rem', color: 'var(--text-link)' }}>
                Settled — view in Sub Labor →
              </a>
            )}

            {settlePreview?.commitmentId === c.id && (
              <div
                style={{
                  marginTop: '0.55rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 8,
                  padding: '0.6rem 0.7rem',
                  background: 'var(--bg-amber-tint)',
                  fontSize: '0.8125rem',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '0.3rem' }}>Release to Sub Labor?</div>
                <div>
                  {settlePreview.report.created_new_sheet ? 'Creates a new sub sheet' : 'Updates the linked sub sheet'} for{' '}
                  <strong>{c.display_name}</strong> with <strong>{money(Number(settlePreview.report.released_amount))}</strong>
                  {Number(settlePreview.report.retainage_pct) > 0 && (
                    <> ({Number(settlePreview.report.retainage_pct)}% retainage held back)</>
                  )}
                  {settlePreview.report.job_number ? <> · job #{settlePreview.report.job_number}</> : null}. Payments and
                  backcharges are then recorded in Jobs → Sub Labor as usual.
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <button type="button" className="wf-btn-primary" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={confirmSettle}>
                    Confirm — release {money(Number(settlePreview.report.released_amount))}
                  </button>
                  <button type="button" className="wf-btn-ghost" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => setSettlePreview(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {adding && (
        <div style={{ padding: '0.6rem 0.7rem', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <select
            value={addPersonId}
            onChange={(e) => setAddPersonId(e.target.value)}
            style={{ padding: '0.3rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8125rem', maxWidth: '14rem' }}
          >
            <option value="">Pick a sub…</option>
            {roster.map((r) => (
              <option key={r.personId} value={r.personId}>
                {r.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Amount"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            style={{ padding: '0.3rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8125rem', width: '7.5rem' }}
          />
          <button type="button" className="wf-btn-primary" style={{ fontSize: '0.78rem' }} disabled={saving || !addPersonId || addAmount.trim() === ''} onClick={addCommitment}>
            Add work order
          </button>
          <button type="button" className="wf-btn-ghost" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => { setAdding(false); setAddPersonId(''); setAddAmount('') }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
