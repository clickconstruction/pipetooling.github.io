import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { commitmentBalance, commitmentRail, nextCommitmentActions } from '../../lib/workflow/stepCommitments'
import type { StepCommitmentRow } from '../../lib/workflow/stepCommitments'
import { formatWorkOrderWindow, notifyWorkOrderOffered } from '../../lib/workflow/workOrderNotifications'
import { pickerComplianceSummary, type ComplianceDocInput } from '../../lib/people/subCompliance'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/**
 * Sub work-order panel on an expanded step card (RUN_SUBS_PLAN Phase 2,
 * PR 2.2 — Option B of the approved mockups; first component in
 * src/components/workflow/). Lists this step's commitments with the merged
 * money/work rail, balance figures off the linked sub sheet, and the
 * office transitions. Phase 4 (PR 4.4): offers carry a proposed work
 * window (seeded from the step's expected dates) and notify the sub; the
 * rail shows Awaiting answer; declines surface their reason with re-offer
 * paths; Withdraw returns an unanswered offer to draft; Nudge resends.
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
  stepName,
  stepScheduledStart,
  stepScheduledEnd,
  projectId,
  projectName,
  offeredByName,
  commitments,
  paymentsByLaborJobId,
  roster,
  isSuperintendentOnly,
  onChanged,
  onError,
}: {
  stepId: string
  stepStatus: string
  stepName: string
  stepScheduledStart: string | null
  stepScheduledEnd: string | null
  projectId: string
  projectName: string
  offeredByName: string
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
  const [offerEditor, setOfferEditor] = useState<{ commitmentId: string; start: string; end: string; amount: string; scope: string; expires: string; isReoffer: boolean } | null>(null)
  const [complianceByPerson, setComplianceByPerson] = useState<Record<string, ComplianceDocInput[]>>({})

  /** Load a person's compliance docs once (fail-soft — chips just don't render pre-migration). */
  async function loadCompliance(personId: string) {
    if (complianceByPerson[personId]) return
    const { data, error } = await supabase
      .from('person_contract_documents')
      .select('doc_type, status, expires_at')
      .eq('person_id', personId)
    if (error) return
    setComplianceByPerson((prev) => ({ ...prev, [personId]: (data ?? []) as ComplianceDocInput[] }))
  }

  function complianceChip(personId: string | null, windowEndYmd?: string | null) {
    if (!personId) return null
    const docs = complianceByPerson[personId]
    if (!docs) return null
    const summary = pickerComplianceSummary(docs, calendarYmdInAppTzFromIso(new Date().toISOString()), windowEndYmd)
    const style =
      summary.state === 'ok'
        ? { background: 'var(--bg-green-tint)', color: 'var(--text-green-600)' }
        : summary.state === 'warn'
          ? { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)' }
          : { background: 'var(--bg-red-tint)', color: 'var(--text-red-700)' }
    return (
      <span style={{ ...style, fontSize: '0.7rem', fontWeight: 650, borderRadius: 999, padding: '0.08rem 0.5rem', whiteSpace: 'nowrap' }}>
        {summary.state === 'ok' ? '✓ ' : '⚠ '}
        {summary.label}
      </span>
    )
  }

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

  async function transition(commitment: StepCommitmentRow, action: 'accept' | 'withdraw' | 'cancel') {
    setSaving(true)
    const nowIso = new Date().toISOString()
    const update: Record<string, unknown> =
      action === 'accept'
        ? { status: 'accepted', accepted_at: nowIso }
        : action === 'withdraw'
          ? { status: 'draft', offered_at: null }
          : { status: 'cancelled' }
    const { error } = await supabase.from('step_commitments').update(update).eq('id', commitment.id)
    setSaving(false)
    if (error) {
      onError(`Failed to update work order: ${error.message}`)
      return
    }
    onChanged()
  }

  /** Sub contact for the offer notification: roster email, else the linked account's. Office RLS reads both. */
  async function notifyOffer(commitment: StepCommitmentRow, proposedStart: string | null, proposedEnd: string | null, amount: number) {
    const { data: person } = await supabase
      .from('people')
      .select('email, account_user_id')
      .eq('id', commitment.person_id)
      .maybeSingle()
    let email = person?.email ?? null
    const userId = person?.account_user_id ?? null
    if (!email && userId) {
      const { data: u } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
      email = u?.email ?? null
    }
    void notifyWorkOrderOffered({
      stepId,
      projectId,
      projectName,
      stepName,
      offeredByName,
      recipientName: commitment.display_name,
      recipientEmail: email,
      recipientUserId: userId,
      amount,
      proposedStart,
      proposedEnd,
    })
  }

  function openOfferEditor(commitment: StepCommitmentRow, isReoffer: boolean) {
    void loadCompliance(commitment.person_id)
    // Sub-portal columns (offer_scope_snapshot / offer_expires_at) land with
    // the sub-portal migration; cast until types regenerate.
    const extra = commitment as StepCommitmentRow & {
      offer_scope_snapshot?: { lines?: Array<{ label?: string }> } | null
      offer_expires_at?: string | null
    }
    const scopeLines = (extra.offer_scope_snapshot?.lines ?? [])
      .map((l) => (l?.label ?? '').trim())
      .filter(Boolean)
    const defaultExpires = new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-CA')
    setOfferEditor({
      commitmentId: commitment.id,
      start: commitment.proposed_start ?? stepScheduledStart ?? '',
      end: commitment.proposed_end ?? stepScheduledEnd ?? '',
      amount: String(commitment.amount ?? ''),
      scope: scopeLines.join('\n'),
      expires: extra.offer_expires_at ?? defaultExpires,
      isReoffer,
    })
  }

  async function sendOffer(commitment: StepCommitmentRow) {
    if (!offerEditor) return
    const amount = Number(offerEditor.amount)
    if (!Number.isFinite(amount) || amount < 0) return
    setSaving(true)
    // Freeze what the sub signs (sub-portal train): the scope lines + window
    // label at offer time. Re-pricing after an offer = withdraw + re-offer.
    const scopeLines = offerEditor.scope
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const windowLabel = formatWorkOrderWindow(offerEditor.start || null, offerEditor.end || null)
    const update: Record<string, unknown> = {
      status: 'offered',
      offered_at: new Date().toISOString(),
      proposed_start: offerEditor.start || null,
      proposed_end: offerEditor.end || null,
      amount,
      declined_at: null,
      decline_reason: null,
      offer_scope_snapshot:
        scopeLines.length > 0 || windowLabel
          ? {
              lines: scopeLines.map((label) => ({ label, amount: null })),
              startsLabel: offerEditor.start ? `Starts ${windowLabel}` : null,
            }
          : null,
      offer_expires_at: offerEditor.expires || null,
    }
    const { error } = await supabase.from('step_commitments').update(update).eq('id', commitment.id)
    setSaving(false)
    if (error) {
      onError(`Failed to send offer: ${error.message}`)
      return
    }
    void notifyOffer(commitment, offerEditor.start || null, offerEditor.end || null, amount)
    setOfferEditor(null)
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

            {(c.status === 'offered' || c.status === 'accepted') && (c.proposed_start || c.proposed_end) && (
              <div style={{ fontSize: '0.8125rem', marginBottom: '0.45rem' }}>
                📅 {c.status === 'offered' ? 'Proposed' : 'Agreed'} window{' '}
                <strong>{formatWorkOrderWindow(c.proposed_start ?? null, c.proposed_end ?? null)}</strong>
                {c.status === 'offered' && c.offered_at && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}· offered {new Date(c.offered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {c.status === 'accepted' &&
                  (stepScheduledStart || stepScheduledEnd) &&
                  (stepScheduledStart !== (c.proposed_start ?? null) || stepScheduledEnd !== (c.proposed_end ?? null)) && (
                    <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 650, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 999, padding: '0.08rem 0.5rem' }}>
                      ⚠ differs from the step's expected dates
                    </span>
                  )}
              </div>
            )}

            {(() => {
              // Portal sign-to-accept audit line (sub-portal train) — cast
              // until types regenerate with the signer columns.
              const signed = c as StepCommitmentRow & {
                signed_at?: string | null
                signer_printed_name?: string | null
                signer_signature_mode?: string | null
              }
              if (!signed.signed_at || (c.status !== 'accepted' && c.status !== 'approved' && c.status !== 'settled')) {
                return null
              }
              return (
                <div style={{ fontSize: '0.8125rem', background: 'var(--bg-green-tint, var(--bg-subtle))', borderRadius: 6, padding: '0.45rem 0.6rem', marginBottom: '0.55rem' }}>
                  ✍ Signed &amp; accepted
                  {signed.signer_printed_name ? <> by <strong>{signed.signer_printed_name}</strong></> : null}
                  {' '}· {new Date(signed.signed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {' '}· from their portal{signed.signer_signature_mode === 'draw' ? ' (drawn signature on file)' : ''}
                </div>
              )
            })()}

            {c.status === 'declined' && (
              <div style={{ fontSize: '0.8125rem', background: 'var(--bg-red-tint)', borderRadius: 6, padding: '0.45rem 0.6rem', marginBottom: '0.55rem' }}>
                Declined{c.decline_reason ? <> — <strong>“{c.decline_reason}”</strong></> : null}
                {c.declined_at && (
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}· {new Date(c.declined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            )}

            {(actions.length > 0 || (!isSuperintendentOnly && (c.status === 'accepted' || c.status === 'approved'))) && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {c.status !== 'draft' && (
                  <a href={`/jobs?tab=work_orders&wo=${c.id}`} style={{ fontSize: '0.75rem', color: 'var(--text-link)', textDecoration: 'none', whiteSpace: 'nowrap' }} title="Open this work order on Jobs → Work Orders">
                    Work Orders ›
                  </a>
                )}
                {actions.includes('offer') && (
                  <button type="button" className="wf-btn-primary" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => openOfferEditor(c, false)}>
                    Offer to {c.display_name}…
                  </button>
                )}
                {actions.includes('reoffer') && !isSuperintendentOnly && (
                  <button type="button" className="wf-btn-primary" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => openOfferEditor(c, true)}>
                    Re-offer…
                  </button>
                )}
                {actions.includes('accept') && (
                  <button type="button" className="wf-btn-primary" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => transition(c, 'accept')} title="Fallback when the sub told you directly instead of answering in the app">
                    Mark accepted
                  </button>
                )}
                {actions.includes('withdraw') && !isSuperintendentOnly && (
                  <button type="button" className="wf-btn-ghost" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => transition(c, 'withdraw')}>
                    Withdraw offer
                  </button>
                )}
                {c.status === 'offered' && !isSuperintendentOnly && (
                  <button
                    type="button"
                    className="wf-btn-ghost"
                    style={{ fontSize: '0.78rem' }}
                    disabled={saving}
                    onClick={() => void notifyOffer(c, c.proposed_start ?? null, c.proposed_end ?? null, Number(c.amount))}
                    title="Resend the offer notification"
                  >
                    Nudge
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

            {offerEditor?.commitmentId === c.id && (
              <div style={{ marginTop: '0.55rem', border: '1px solid var(--border-strong)', borderRadius: 8, padding: '0.6rem 0.7rem', background: 'var(--bg-blue-tint)', fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>
                  {offerEditor.isReoffer ? `Re-offer to ${c.display_name}` : `Offer to ${c.display_name}`}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    $
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={offerEditor.amount}
                      onChange={(e) => setOfferEditor((prev) => (prev ? { ...prev, amount: e.target.value } : prev))}
                      style={{ width: '6.5rem', padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8125rem' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    from
                    <input
                      type="date"
                      value={offerEditor.start}
                      onChange={(e) => setOfferEditor((prev) => (prev ? { ...prev, start: e.target.value } : prev))}
                      style={{ padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8125rem' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    to
                    <input
                      type="date"
                      value={offerEditor.end}
                      onChange={(e) => setOfferEditor((prev) => (prev ? { ...prev, end: e.target.value } : prev))}
                      style={{ padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8125rem' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    offer good through
                    <input
                      type="date"
                      value={offerEditor.expires}
                      onChange={(e) => setOfferEditor((prev) => (prev ? { ...prev, expires: e.target.value } : prev))}
                      style={{ padding: '0.25rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8125rem' }}
                    />
                  </label>
                  <button type="button" className="wf-btn-primary" style={{ fontSize: '0.78rem' }} disabled={saving || offerEditor.amount.trim() === ''} onClick={() => void sendOffer(c)}>
                    Send offer
                  </button>
                  <button type="button" className="wf-btn-ghost" style={{ fontSize: '0.78rem' }} disabled={saving} onClick={() => setOfferEditor(null)}>
                    Cancel
                  </button>
                </div>
                <div style={{ marginTop: '0.45rem' }}>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 3 }}>
                    Scope — frozen into the offer, one line each (what the sub signs)
                  </label>
                  <textarea
                    value={offerEditor.scope}
                    onChange={(e) => setOfferEditor((prev) => (prev ? { ...prev, scope: e.target.value } : prev))}
                    rows={2}
                    placeholder={'e.g. Rough-in — 22 fixtures per plan sheet P-2\nWater/gas stub-outs, garage'}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8125rem', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>
                <div style={{ marginTop: '0.35rem' }}>{complianceChip(c.person_id, offerEditor.end || null)}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Dates pre-fill from the step's expected dates. The sub gets a push + email and answers from their
                  dashboard — or signs to accept on their portal, which binds this scope and price under their Master
                  Subcontract Agreement.
                </div>
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
            onChange={(e) => {
              setAddPersonId(e.target.value)
              if (e.target.value) void loadCompliance(e.target.value)
            }}
            style={{ padding: '0.3rem 0.4rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8125rem', maxWidth: '14rem' }}
          >
            <option value="">Pick a sub…</option>
            {roster.map((r) => (
              <option key={r.personId} value={r.personId}>
                {r.name}
              </option>
            ))}
          </select>
          {addPersonId ? complianceChip(addPersonId) : null}
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
