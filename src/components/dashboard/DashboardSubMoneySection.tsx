import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { subLaborJobBalance } from '../../lib/subLaborOutstanding'
import { formatWorkOrderWindow, notifyWorkOrderAnswered } from '../../lib/workflow/workOrderNotifications'
import type { LaborJob, LaborJobPayment } from '../../types/laborJob'
import { DashboardGroupCard } from './DashboardGroupCard'

/**
 * "Your money" card for subcontractor-like roles (RUN_SUBS_PLAN Phase 3,
 * PR 3.2 — Option D of the approved mockups). Shows the sub their own
 * balance, per-sheet lines, payment/backcharge history, and accepted work
 * orders — everything RLS-scoped to their own rows (PR 3.1's policies plus
 * the step_commitments own-row read from 2.1).
 *
 * Fail-soft everywhere: if the RLS migration isn't applied yet (or the sub
 * has nothing), every query returns empty and the card renders nothing, so
 * client and migration deploy in either order.
 */

type SheetLine = {
  id: string
  label: string
  totalCost: number
  paid: number
  backcharges: number
  balance: number
  payments: LaborJobPayment[]
  projectId: string | null
  stepId: string | null
}

type CommitmentLine = {
  id: string
  amount: number
  status: string
  stepName: string | null
  projectName: string | null
  proposedStart: string | null
  proposedEnd: string | null
  retainagePct: number
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function DashboardSubMoneySection({ visible }: { visible: boolean }) {
  const [sheets, setSheets] = useState<SheetLine[]>([])
  const [commitments, setCommitments] = useState<CommitmentLine[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')
  const [answering, setAnswering] = useState(false)
  const [answerError, setAnswerError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  useEffect(() => {
    if (!visible) return
    let cancelled = false
    ;(async () => {
      // Own sheets (RLS-scoped). Legacy column list keeps this working even
      // if a fail-soft situation ever strips the anchor columns.
      const { data: jobs, error } = await supabase
        .from('people_labor_jobs')
        .select('id, assigned_to_name, address, job_number, labor_rate, job_date, created_at, project_id, step_id')
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error || !jobs || jobs.length === 0) {
        setSheets([])
      } else {
        const jobIds = jobs.map((j) => j.id)
        const [itemsRes, paymentsRes] = await Promise.all([
          supabase
            .from('people_labor_job_items')
            .select('job_id, fixture, count, hrs_per_unit, is_fixed, labor_rate, direct_labor_amount')
            .in('job_id', jobIds),
          supabase
            .from('people_labor_job_payments')
            .select('id, job_id, amount, memo, created_at')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false }),
        ])
        if (cancelled) return
        const itemsByJob = new Map<string, NonNullable<LaborJob['items']>>()
        for (const it of (itemsRes.data ?? []) as Array<{ job_id: string; fixture: string; count: number; hrs_per_unit: number; is_fixed?: boolean; labor_rate?: number | null; direct_labor_amount?: number | null }>) {
          ;(itemsByJob.get(it.job_id) ?? itemsByJob.set(it.job_id, []).get(it.job_id)!).push(it)
        }
        const paymentsByJob = new Map<string, LaborJobPayment[]>()
        for (const p of (paymentsRes.data ?? []) as Array<{ id: string; job_id: string; amount: number; memo: string | null; created_at: string }>) {
          ;(paymentsByJob.get(p.job_id) ?? paymentsByJob.set(p.job_id, []).get(p.job_id)!).push({
            id: p.id,
            amount: Number(p.amount),
            memo: p.memo,
            created_at: p.created_at,
          })
        }
        setSheets(
          (jobs as Array<{ id: string; address: string; job_number: string | null; labor_rate: number | null; job_date: string | null; project_id?: string | null; step_id?: string | null }>).map((j) => {
            const items = itemsByJob.get(j.id) ?? []
            const payments = paymentsByJob.get(j.id) ?? []
            const balance = subLaborJobBalance({ labor_rate: j.labor_rate, items, payments })
            return {
              id: j.id,
              label: [j.job_number, j.address].filter(Boolean).join(' · ') || (j.job_date ?? 'Sub sheet'),
              totalCost: balance.totalCost,
              paid: balance.paid,
              backcharges: balance.backcharges,
              balance: balance.balance,
              payments,
              projectId: j.project_id ?? null,
              stepId: j.step_id ?? null,
            }
          }),
        )
      }

      // Accepted/offered work orders (own rows via the 2.1 SELECT policy),
      // enriched with step + project names for context.
      type CommitmentQueryRow = { id: string; amount: number; status: string; step_id: string; proposed_start?: string | null; proposed_end?: string | null; retainage_pct?: number }
      let cRows: CommitmentQueryRow[] | null = null
      let cErr: { message: string } | null = null
      {
        const withWindow = await supabase
          .from('step_commitments')
          .select('id, amount, status, step_id, proposed_start, proposed_end, retainage_pct')
          .in('status', ['offered', 'accepted', 'approved'])
        if (withWindow.error) {
          const legacy = await supabase
            .from('step_commitments')
            .select('id, amount, status, step_id')
            .in('status', ['offered', 'accepted', 'approved'])
          cRows = legacy.data as CommitmentQueryRow[] | null
          cErr = legacy.error
        } else {
          cRows = withWindow.data as CommitmentQueryRow[] | null
        }
      }
      if (cancelled) return
      if (cErr || !cRows || cRows.length === 0) {
        setCommitments([])
      } else {
        const stepIds = [...new Set(cRows.map((c) => c.step_id))]
        const { data: stepRows } = await supabase
          .from('project_workflow_steps')
          .select('id, name, project_workflows(projects(name))')
          .in('id', stepIds)
        if (cancelled) return
        const stepInfo = new Map<string, { stepName: string; projectName: string | null }>()
        for (const s of (stepRows ?? []) as Array<{ id: string; name: string; project_workflows: { projects: { name: string } | { name: string }[] | null } | { projects: { name: string } | { name: string }[] | null }[] | null }>) {
          const wf = Array.isArray(s.project_workflows) ? s.project_workflows[0] : s.project_workflows
          const proj = wf ? (Array.isArray(wf.projects) ? wf.projects[0] : wf.projects) : null
          stepInfo.set(s.id, { stepName: s.name, projectName: proj?.name ?? null })
        }
        setCommitments(
          cRows.map((c) => ({
            id: c.id,
            amount: Number(c.amount),
            status: c.status,
            stepName: stepInfo.get(c.step_id)?.stepName ?? null,
            projectName: stepInfo.get(c.step_id)?.projectName ?? null,
            proposedStart: c.proposed_start ?? null,
            proposedEnd: c.proposed_end ?? null,
            retainagePct: Number(c.retainage_pct ?? 0),
          })),
        )
      }
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [visible, reloadNonce])

  async function answerOffer(offer: CommitmentLine, accept: boolean) {
    setAnswering(true)
    setAnswerError(null)
    const { data, error } = await supabase.rpc('respond_to_work_order', {
      p_commitment_id: offer.id,
      p_accept: accept,
      p_reason: accept ? null : declineReason.trim(),
    })
    setAnswering(false)
    if (error) {
      setAnswerError(error.message)
      return
    }
    setDecliningId(null)
    setDeclineReason('')
    // Fire-and-forget office notification using the context the RPC returned.
    const { data: authData } = await supabase.auth.getUser()
    const responderName = authData.user?.email ?? 'A sub'
    void notifyWorkOrderAnswered({
      accepted: accept,
      responderName,
      reason: accept ? null : declineReason.trim(),
      report: (data ?? {}) as Parameters<typeof notifyWorkOrderAnswered>[0]['report'],
    })
    // Reload by flipping loaded off; the effect refetches on next visible pass.
    setLoaded(false)
    setSheets([])
    setCommitments([])
    setReloadNonce((n) => n + 1)
  }

  if (!visible || !loaded) return null
  if (sheets.length === 0 && commitments.length === 0) return null

  const totalBalance = sheets.reduce((s, sheet) => s + Math.max(0, sheet.balance), 0)

  return (
    <DashboardGroupCard id="dash-sub-money" title="Your money">
      {commitments.filter((c) => c.status === 'offered').map((offer) => (
        <div key={offer.id} style={{ border: '1.5px solid var(--border-strong)', borderRadius: 10, padding: '0.7rem 0.8rem', marginBottom: '0.7rem', background: 'var(--bg-blue-tint)' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-link)', fontWeight: 700, marginBottom: 2 }}>
            New offer
          </div>
          <div style={{ fontWeight: 700 }}>
            {offer.stepName ?? 'Step'}
            {offer.projectName ? <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> — {offer.projectName}</span> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', margin: '0.25rem 0' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{money(offer.amount)}</span>
            {offer.retainagePct > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{offer.retainagePct}% retainage</span>}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            📅 Proposed: <strong style={{ color: 'var(--text-strong)' }}>{formatWorkOrderWindow(offer.proposedStart, offer.proposedEnd)}</strong>
          </div>
          {decliningId === offer.id ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Why? (required)"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                autoFocus
                style={{ flex: 1, minWidth: '10rem', padding: '0.35rem 0.5rem', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.8125rem' }}
              />
              <button
                type="button"
                disabled={answering || !declineReason.trim()}
                onClick={() => void answerOffer(offer, false)}
                style={{ padding: '0.35rem 0.8rem', borderRadius: 7, border: 'none', background: '#dc2626', color: 'white', fontSize: '0.8125rem', fontWeight: 650, cursor: 'pointer' }}
              >
                Decline
              </button>
              <button
                type="button"
                disabled={answering}
                onClick={() => { setDecliningId(null); setDeclineReason('') }}
                style={{ padding: '0.35rem 0.6rem', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '0.8125rem', cursor: 'pointer' }}
              >
                Back
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={answering}
                onClick={() => void answerOffer(offer, true)}
                style={{ flex: 1, padding: '0.45rem', borderRadius: 8, border: 'none', background: '#059669', color: 'white', fontSize: '0.875rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Accept
              </button>
              <button
                type="button"
                disabled={answering}
                onClick={() => { setDecliningId(offer.id); setAnswerError(null) }}
                style={{ flex: 1, padding: '0.45rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-red-700)', fontSize: '0.875rem', fontWeight: 650, cursor: 'pointer' }}
              >
                Decline…
              </button>
            </div>
          )}
          {answerError && <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--text-red-700)' }}>{answerError}</div>}
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Balance owed to you</span>
        <span style={{ fontSize: '1.35rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{money(totalBalance)}</span>
      </div>

      {commitments.some((c) => c.status !== 'offered') && (
        <div style={{ marginBottom: '0.9rem' }}>
          <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)' }}>
            Committed work
          </h4>
          {commitments.filter((c) => c.status !== 'offered').map((c) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.875rem', padding: '0.25rem 0', borderBottom: '1px dashed var(--border)' }}>
              <span>
                {c.stepName ?? 'Step'}
                {c.projectName ? <span style={{ color: 'var(--text-muted)' }}> — {c.projectName}</span> : null}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: '0.7rem',
                    fontWeight: 650,
                    borderRadius: 999,
                    padding: '0.05rem 0.5rem',
                    background: c.status === 'offered' ? 'var(--bg-amber-tint)' : 'var(--bg-green-tint)',
                    color: c.status === 'offered' ? 'var(--text-amber-800)' : 'var(--text-green-600)',
                  }}
                >
                  {c.status}
                </span>
              </span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 650 }}>{money(c.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {sheets.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)' }}>
            Your sheets
          </h4>
          {sheets.map((s) => (
            <div key={s.id} style={{ borderBottom: '1px dashed var(--border)', padding: '0.25rem 0' }}>
              <button
                type="button"
                onClick={() => setExpandedId((prev) => (prev === s.id ? null : s.id))}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: 'var(--text-strong)',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >
                <span>
                  {expandedId === s.id ? '▼' : '▶'} {s.label}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: s.balance > 0 ? 700 : 400 }}>
                  {s.balance > 0 ? `${money(s.balance)} open` : 'settled'}
                </span>
              </button>
              {expandedId === s.id && (
                <div style={{ padding: '0.35rem 0 0.35rem 1.1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <div>
                    Total {money(s.totalCost)} · paid {money(s.paid)}
                    {s.backcharges > 0 ? <> · backcharges {money(s.backcharges)}</> : null}
                  </div>
                  {s.payments.length > 0 && (
                    <div style={{ marginTop: '0.25rem' }}>
                      {s.payments.map((p) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <span>{p.memo || (Number(p.amount) < 0 ? 'Backcharge' : 'Payment')}</span>
                          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {Number(p.amount) < 0 ? '−' : '+'}
                            {money(Math.abs(Number(p.amount)))} · {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </DashboardGroupCard>
  )
}
