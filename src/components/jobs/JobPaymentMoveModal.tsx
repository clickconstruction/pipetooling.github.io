/**
 * Move this payment — a customer payment to the right job (v2.3576, PR 3 of the payment
 * move/remove train; the sub-sheet twin is `SubLaborPaymentMoveRemoveModals`). Search the
 * destination the way Reassign costs does (`search_jobs_ledger`), read both jobs' paid and
 * open before and after, give a reason (seeded *wrong job*), then one RPC —
 * `move_jobs_ledger_payment` — re-points the live row and writes the trace event.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatPostgrestOrUnknownError } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { formatCurrency } from '../../lib/format'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { planJobPaymentMove } from '../../lib/jobs/jobPaymentMove'
import type { PaymentRow } from '../../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

// The RPC and the destination read go through the untyped client until the types regenerate.
const db = supabase as unknown as SupabaseClient

type Candidate = { id: string; hcp_number: string | null; click_number?: string | null; job_name: string | null; job_address: string | null }
type Destination = Candidate & { revenueUsd: number; paidUsd: number; status: string | null }

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1300, overflowY: 'auto' }
const card: CSSProperties = { background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(560px, 100%)', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 22px 50px rgba(0,0,0,.25)', padding: '1.1rem 1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }
const label: CSSProperties = { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 6, font: 'inherit', background: 'var(--surface)', color: 'var(--text-base)' }
const ghost: CSSProperties = { font: 'inherit', padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }
const blue: CSSProperties = { font: 'inherit', padding: '0.45rem 1rem', border: 'none', borderRadius: 6, background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600 }

function jobLabel(j: Pick<Candidate, 'hcp_number' | 'click_number' | 'job_name'>): string {
  const n = effectiveJobLedgerNumber(j.hcp_number, j.click_number)
  return [n ? `J${n}` : null, (j.job_name ?? '').trim() || null].filter(Boolean).join(' · ') || 'this job'
}

export function JobPaymentMoveModal({
  open,
  payment,
  fromJob,
  onClose,
  onMoved,
}: {
  open: boolean
  payment: PaymentRow | null
  fromJob: JobWithDetails | null
  onClose: () => void
  /** After the RPC wrote — the form re-reads the job. */
  onMoved: () => void
}) {
  const { showToast } = useToastContext()
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [dest, setDest] = useState<Destination | null>(null)
  const [reason, setReason] = useState('wrong job')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCandidates([])
    setDest(null)
    setReason('wrong job')
    setBusy(false)
  }, [open, payment?.id])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 2) {
      setCandidates([])
      setSearching(false)
      return
    }
    setSearching(true)
    let cancelled = false
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const raw = await withSupabaseRetry(async () => supabase.rpc('search_jobs_ledger', { search_text: q }), 'move payment · job search')
          if (cancelled) return
          setCandidates(((raw ?? []) as Candidate[]).filter((r) => r.id !== fromJob?.id).slice(0, 20))
        } catch {
          if (!cancelled) setCandidates([])
        } finally {
          if (!cancelled) setSearching(false)
        }
      })()
    }, 280)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [open, query, fromJob?.id])

  async function pick(c: Candidate) {
    try {
      const { data } = await db.from('jobs_ledger').select('id, revenue, payments_made, status').eq('id', c.id).maybeSingle()
      const j = (data ?? {}) as { revenue?: number | null; payments_made?: number | null; status?: string | null }
      setDest({ ...c, revenueUsd: Number(j.revenue ?? 0), paidUsd: Number(j.payments_made ?? 0), status: j.status ?? null })
    } catch {
      setDest({ ...c, revenueUsd: 0, paidUsd: 0, status: null })
    }
  }

  const plan = useMemo(() => {
    if (!payment || !fromJob || !dest) return null
    const paid = (fromJob.payments ?? []).reduce((a, p) => a + Number((p as { amount?: number | null }).amount ?? 0), 0)
    return planJobPaymentMove({
      amountUsd: Number(payment.amount ?? 0),
      from: { label: jobLabel(fromJob), revenueUsd: Number(fromJob.revenue ?? 0), paidUsd: paid },
      to: { label: jobLabel(dest), revenueUsd: dest.revenueUsd, paidUsd: dest.paidUsd },
    })
  }, [payment, fromJob, dest])

  async function confirm() {
    if (!payment || !dest) return
    setBusy(true)
    try {
      const { data, error } = await db.rpc('move_jobs_ledger_payment', { p_payment_id: payment.id, p_to_job_id: dest.id, p_reason: reason.trim() || null })
      if (error) throw error
      const payload = (data ?? {}) as { error?: string; ok?: boolean; warning?: string }
      if (payload.error) {
        showToast(payload.error, 'error')
        return
      }
      showToast(payload.warning ? `Payment moved to ${jobLabel(dest)}. ${payload.warning}` : `Payment moved to ${jobLabel(dest)}.`, payload.warning ? 'warning' : 'success')
      onMoved()
      onClose()
    } catch (e) {
      showToast(formatPostgrestOrUnknownError(e, 'Could not move the payment'), 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!open || !payment) return null
  const amount = `$${formatCurrency(Number(payment.amount ?? 0))}`

  return (
    <div role="presentation" style={overlay} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Move this payment" style={card} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Move this payment</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{amount}{payment.paid_on ? ` · ${payment.paid_on}` : ''}{(payment.reference_number ?? '').trim() ? ` · ref ${payment.reference_number}` : ''}</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          The payment keeps its date, amount, memo and bank-deposit link; it leaves {fromJob ? jobLabel(fromJob) : 'this job'} and lands on the job you pick, where it counts toward that job's balance from now on.
        </p>
        <div>
          <div style={label}>To which job</div>
          {dest ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, padding: '0.5rem 0.6rem', border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 6 }}>
              <span style={{ fontWeight: 600 }}>{jobLabel(dest)}</span>
              {dest.job_address ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dest.job_address}</span> : null}
              <button type="button" onClick={() => setDest(null)} style={{ ...ghost, marginLeft: 'auto', padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}>Change</button>
            </div>
          ) : (
            <>
              <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by job number, name or address…" aria-label="Search jobs" autoFocus style={{ ...input, marginTop: 4 }} />
              {query.trim().length >= 2 ? (
                <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {searching && candidates.length === 0 ? (
                    <div style={{ padding: '0.5rem 0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Searching…</div>
                  ) : candidates.length === 0 ? (
                    <div style={{ padding: '0.5rem 0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>No job matches.</div>
                  ) : (
                    candidates.map((c) => (
                      <button key={c.id} type="button" onClick={() => void pick(c)} style={{ display: 'block', width: '100%', textAlign: 'left', font: 'inherit', padding: '0.45rem 0.6rem', border: 'none', borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer' }}>
                        <span style={{ fontWeight: 600 }}>{jobLabel(c)}</span>
                        {c.job_address ? <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.job_address}</span> : null}
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
        {plan ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--bg-subtle)' }}>
            <div style={label}>What changes</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: 4 }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                  <th style={{ textAlign: 'left', fontWeight: 600, padding: '2px 0' }}></th>
                  <th style={{ textAlign: 'right', fontWeight: 600, padding: '2px 0' }}>Paid</th>
                  <th style={{ textAlign: 'right', fontWeight: 600, padding: '2px 0' }}>Open</th>
                </tr>
              </thead>
              <tbody>
                {[plan.from, plan.to].map((s, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 0' }}>{s.label}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${formatCurrency(s.paidBefore)} → <strong>${formatCurrency(s.paidAfter)}</strong></td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${formatCurrency(s.openBefore)} → <strong>${formatCurrency(s.openAfter)}</strong>{i === 1 && plan.toPaidInFull ? <span style={{ marginLeft: 6, color: 'var(--text-green-700)', fontSize: '0.75rem' }}>paid in full</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div>
          <div style={label}>Why</div>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" style={{ ...input, marginTop: 4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={busy} style={ghost}>Cancel</button>
          <button type="button" onClick={() => void confirm()} disabled={!dest || busy} style={!dest || busy ? { ...blue, opacity: 0.55, cursor: 'not-allowed' } : blue}>
            {busy ? 'Moving…' : dest ? `Move ${amount} to ${jobLabel(dest).split(' · ')[0]}` : 'Pick a job'}
          </button>
        </div>
      </div>
    </div>
  )
}
