import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { subLaborJobBalance } from '../../lib/subLaborOutstanding'
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
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function DashboardSubMoneySection({ visible }: { visible: boolean }) {
  const [sheets, setSheets] = useState<SheetLine[]>([])
  const [commitments, setCommitments] = useState<CommitmentLine[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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
      const { data: cRows, error: cErr } = await supabase
        .from('step_commitments')
        .select('id, amount, status, step_id')
        .in('status', ['offered', 'accepted', 'approved'])
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
          })),
        )
      }
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [visible])

  if (!visible || !loaded) return null
  if (sheets.length === 0 && commitments.length === 0) return null

  const totalBalance = sheets.reduce((s, sheet) => s + Math.max(0, sheet.balance), 0)

  return (
    <DashboardGroupCard id="dash-sub-money" title="Your money">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Balance owed to you</span>
        <span style={{ fontSize: '1.35rem', fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}>{money(totalBalance)}</span>
      </div>

      {commitments.length > 0 && (
        <div style={{ marginBottom: '0.9rem' }}>
          <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-faint)' }}>
            Committed work
          </h4>
          {commitments.map((c) => (
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
