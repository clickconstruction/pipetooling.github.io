import { useEffect, useState, type CSSProperties } from 'react'
import { supabase } from '../lib/supabase'
import { useToastContext } from '../contexts/ToastContext'
import { notifyDispatchRequestsChanged } from '../lib/dispatchRequestHelpers'
import { parseTurnawayReason, turnawayReasonLabel } from '../lib/turnaway'
import {
  BILLABLE_TURNAWAY_REASONS,
  buildTripChargeMemo,
  isBillableTurnawayReason,
  resolveTripChargeDefaultAmount,
  tripChargeSettingsKey,
  type BillableTurnawayReason,
} from '../lib/turnawayTripCharge'

export type CreateTripChargeTarget = {
  requestId: string
  jobId: string
  referenceSummary: string | null
}

type Props = {
  target: CreateTripChargeTarget
  onClose: () => void
  /** Called after the charge is created (and the dispatch request auto-closed). */
  onCreated: () => void
}

type SettingsRow = { key: string; value_num: number | null }

type JobRow = {
  id: string
  hcp_number: string | null
  job_name: string | null
  customer_id: string | null
}

export default function CreateTripChargeModal({ target, onClose, onCreated }: Props) {
  const { showToast } = useToastContext()
  const [settingsRows, setSettingsRows] = useState<SettingsRow[]>([])
  const [job, setJob] = useState<JobRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [reason, setReason] = useState<BillableTurnawayReason | null>(() => {
    const parsed = parseTurnawayReason(target.referenceSummary)
    return isBillableTurnawayReason(parsed) ? parsed : null
  })
  const [amountStr, setAmountStr] = useState('')
  const [amountTouched, setAmountTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      const [settingsRes, jobRes] = await Promise.all([
        supabase
          .from('app_settings')
          .select('key, value_num')
          .in('key', BILLABLE_TURNAWAY_REASONS.map((r) => tripChargeSettingsKey(r))),
        supabase
          .from('jobs_ledger')
          .select('id, hcp_number, job_name, customer_id')
          .eq('id', target.jobId)
          .maybeSingle(),
      ])
      if (cancelled) return
      setSettingsRows((settingsRes.data as SettingsRow[]) ?? [])
      setJob((jobRes.data as JobRow | null) ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [target.jobId])

  // Pre-fill the amount from the per-reason setting until the office edits it.
  useEffect(() => {
    if (amountTouched || !reason) return
    const preset = resolveTripChargeDefaultAmount(reason, settingsRows)
    setAmountStr(preset != null ? String(preset) : '')
  }, [reason, settingsRows, amountTouched])

  const amount = Number(amountStr)
  const amountValid = Number.isFinite(amount) && amount > 0
  const canSubmit = !!reason && amountValid && !submitting && !loading

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason || !amountValid) return
    setSubmitting(true)
    setError(null)
    const { data, error: rpcErr } = await supabase.rpc('create_turnaway_trip_charge', {
      p_job_id: target.jobId,
      p_amount: amount,
      p_reason: reason,
      p_dispatch_request_id: target.requestId,
    })
    setSubmitting(false)
    if (rpcErr) {
      setError(rpcErr.message)
      return
    }
    const result = (data ?? {}) as { ok?: boolean; error?: string; duplicate?: boolean }
    if (result.error) {
      setError(result.error)
      return
    }
    if (result.duplicate) {
      showToast('Trip charge already created for this request.', 'info')
    } else {
      showToast(`Trip charge created — it's in Ready to Bill now.`, 'success')
    }
    notifyDispatchRequestsChanged()
    onCreated()
  }

  const jobLabel = [job?.hcp_number?.trim(), job?.job_name?.trim()].filter(Boolean).join(' ')

  function reasonChipStyles(r: BillableTurnawayReason): CSSProperties {
    const selected = reason === r
    return {
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
      borderRadius: 6,
      cursor: 'pointer',
      border: selected ? '2px solid #d97706' : '1px solid var(--border-strong)',
      background: selected ? 'var(--bg-amber-tint)' : 'var(--surface)',
      fontWeight: selected ? 600 : 400,
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 65,
      }}
    >
      <div style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 480, maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Create trip charge</h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', fontWeight: 500 }}>
              {loading ? 'Loading…' : jobLabel || 'Job'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }} aria-label="Close">×</button>
        </div>

        {!loading && job && !job.customer_id && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>
            This job has no linked customer — the charge will sit in Ready to Bill until a customer is linked.
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Reason</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {BILLABLE_TURNAWAY_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} style={reasonChipStyles(r)}>
                  {turnawayReasonLabel(r)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="trip-charge-amount" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
              Amount ($)
            </label>
            <input
              id="trip-charge-amount"
              type="number"
              min={0.01}
              step={0.01}
              value={amountStr}
              onChange={(e) => {
                setAmountTouched(true)
                setAmountStr(e.target.value)
              }}
              placeholder="e.g. 95"
              style={{ width: 140, padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
            />
            {reason && (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Bills as “{buildTripChargeMemo(reason)}”. Default amounts live in Settings → Jobs &amp; dispatch.
              </p>
            )}
          </div>

          {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{ padding: '0.5rem 1rem', background: canSubmit ? '#d97706' : '#9ca3af', color: 'white', border: 'none', borderRadius: 4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            >
              {submitting ? 'Creating…' : 'Create trip charge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
