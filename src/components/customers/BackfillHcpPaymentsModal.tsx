import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { parseCsv } from '../../lib/parseCsv'
import {
  backfillPaymentNote,
  parseHcpJobsExport,
  planHcpPaymentBackfill,
  type BackfillDateSource,
  type BackfillJobInput,
  type BackfillPlanRow,
} from '../../lib/customers/backfillHcpPayments'

/**
 * HCP payment backfill sweep (money-rail follow-up): jobs imported from
 * HouseCall Pro as Paid carry no payment rows, so "collected" reads $0 for
 * them. The user picks the HCP jobs export (parsed in the browser — the file
 * never leaves the machine), reviews one synthetic payment per job with its
 * real HCP collection date, and one Apply inserts the rows. The B3 trigger
 * keeps payments_made in sync automatically.
 */

const INSERT_CHUNK = 100

function dateSourceBadge(src: BackfillDateSource): { label: string; bg: string; fg: string } {
  switch (src) {
    case 'hcp_paid':
      return { label: 'HCP paid date', bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' }
    case 'hcp_completed':
      return { label: 'completed date', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
    case 'hcp_created':
      return { label: 'HCP created date', bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' }
    case 'ledger_created':
      return { label: 'job created date', bg: 'var(--bg-muted)', fg: 'var(--text-muted)' }
  }
}

export default function BackfillHcpPaymentsModal({
  onClose,
  onApplied,
}: {
  onClose: () => void
  onApplied: () => void
}) {
  const { showToast } = useToastContext()
  const [jobs, setJobs] = useState<BackfillJobInput[] | null>(null)
  const [jobIdsWithPayments, setJobIdsWithPayments] = useState<Set<string> | null>(null)
  const [plan, setPlan] = useState<BackfillPlanRow[] | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [skipped, setSkipped] = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [jobRows, paymentRows] = await Promise.all([
          withSupabaseRetry(
            async () =>
              supabase
                .from('jobs_ledger')
                .select('id, hcp_number, click_number, job_name, customer_name, status, revenue, created_at')
                .eq('status', 'paid')
                .gt('revenue', 0),
            'payment backfill: paid jobs',
          ),
          withSupabaseRetry(
            async () => supabase.from('jobs_ledger_payments').select('job_id'),
            'payment backfill: payment rows',
          ),
        ])
        if (cancelled) return
        setJobs((jobRows ?? []) as BackfillJobInput[])
        setJobIdsWithPayments(new Set(((paymentRows ?? []) as Array<{ job_id: string }>).map((p) => p.job_id)))
      } catch (e: unknown) {
        if (!cancelled) setError(formatErrorMessage(e, 'Could not load paid jobs'))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const candidateCount = useMemo(() => {
    if (!jobs || !jobIdsWithPayments) return null
    return jobs.filter((j) => !jobIdsWithPayments.has(j.id)).length
  }, [jobs, jobIdsWithPayments])

  function onFilePicked(file: File) {
    setFileError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const exportRows = parseHcpJobsExport(parseCsv(String(reader.result ?? '')))
      if (!exportRows) {
        setFileError('That file is missing the HCP export columns (Job #, Job created date, Job paid in full date) — pick the jobs export downloaded from HouseCall Pro.')
        return
      }
      setPlan(planHcpPaymentBackfill(jobs ?? [], exportRows, jobIdsWithPayments ?? new Set()))
      setSkipped({})
    }
    reader.onerror = () => setFileError('Could not read that file.')
    reader.readAsText(file)
  }

  const applyRows = useMemo(() => (plan ?? []).filter((r) => !skipped[r.jobId]), [plan, skipped])
  const applyTotal = applyRows.reduce((sum, r) => sum + r.amount, 0)
  const exactDates = applyRows.filter((r) => r.dateSource === 'hcp_paid').length

  async function apply() {
    if (applyRows.length === 0) return
    setSaving(true)
    let inserted = 0
    let failure: string | null = null
    for (let i = 0; i < applyRows.length && !failure; i += INSERT_CHUNK) {
      const chunk = applyRows.slice(i, i + INSERT_CHUNK).map((r) => ({
        job_id: r.jobId,
        amount: r.amount,
        paid_on: r.paidOn,
        payment_type: 'HCP import',
        note: backfillPaymentNote(r),
      }))
      const { error: err } = await supabase.from('jobs_ledger_payments').insert(chunk)
      if (err) failure = err.message
      else inserted += chunk.length
    }
    if (!failure) {
      showToast(`Recorded ${inserted} payment${inserted === 1 ? '' : 's'} from HCP history.`, 'success')
    } else {
      showToast(
        `Recorded ${inserted} payment${inserted === 1 ? '' : 's'}, then stopped — ${failure}. Re-open the tool to continue; jobs already filled are skipped automatically.`,
        'error',
      )
    }
    onApplied()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Backfill payment history from HouseCall Pro"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}
      onClick={() => {
        if (!saving) onClose()
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, width: 'min(720px, 100%)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text-strong)', fontSize: '0.98rem' }}>
            Backfill payment history from HouseCall Pro
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Jobs imported as Paid have no payment records, so "collected" reads $0 for them. Pick the HCP jobs
            export and each gets one payment for its billed amount, dated when HCP says it was collected. The file
            is read on this device only — nothing uploads.
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {error ? (
            <p style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-red-600)' }}>{error}</p>
          ) : jobs == null || jobIdsWithPayments == null ? (
            <p role="status" style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Finding paid jobs with no payment record…
            </p>
          ) : candidateCount === 0 ? (
            <p style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Every paid job already has a payment record. 🎉
            </p>
          ) : plan == null ? (
            <div style={{ padding: '14px 16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--text-700)' }}>
                <strong style={{ color: 'var(--text-strong)' }}>{candidateCount}</strong> paid job
                {candidateCount === 1 ? '' : 's'} have no payment record. Choose the HouseCall Pro jobs export
                (.csv) to date them accurately.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="HouseCall Pro jobs export CSV"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onFilePicked(f)
                }}
                style={{ fontSize: '0.8rem', color: 'var(--text-700)' }}
              />
              {fileError ? (
                <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--text-red-600)' }}>{fileError}</p>
              ) : null}
            </div>
          ) : plan.length === 0 ? (
            <p style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Nothing to fill — every paid job either has a payment record already or carries no billed amount.
            </p>
          ) : (
            plan.map((r) => {
              const badge = dateSourceBadge(r.dateSource)
              const mismatch = r.hcpPaid != null && Math.abs(r.hcpPaid - r.amount) > 0.005
              return (
                <div key={r.jobId} style={{ borderBottom: '1px solid var(--border)', padding: '6px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                    <input
                      type="checkbox"
                      checked={!skipped[r.jobId]}
                      aria-label={`Record payment for job ${r.label}`}
                      onChange={(e) => setSkipped((prev) => ({ ...prev, [r.jobId]: !e.target.checked }))}
                      style={{ margin: 0, cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>{r.label}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>
                      {r.customerName || r.jobName || '(unnamed)'}
                      {r.jobName && r.customerName && r.jobName !== r.customerName ? (
                        <span style={{ color: 'var(--text-faint)' }}> · {r.jobName}</span>
                      ) : null}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>
                      ${r.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>{r.paidOn}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 9999, fontSize: '0.64rem', fontWeight: 700, background: badge.bg, color: badge.fg, whiteSpace: 'nowrap' }}>
                      {badge.label}
                    </span>
                  </div>
                  {mismatch ? (
                    <p style={{ margin: '2px 0 0 26px', fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>
                      HCP recorded ${r.hcpPaid!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} collected — the payment uses this job's billed amount; the HCP figure is kept in the payment note.
                    </p>
                  ) : null}
                </div>
              )
            })
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {plan == null
              ? 'Nothing is written until you press Record.'
              : `${applyRows.length} payment${applyRows.length === 1 ? '' : 's'} · $${Math.round(applyTotal).toLocaleString('en-US')} · ${exactDates} with exact HCP paid dates`}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{ padding: '0.4rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void apply()}
              disabled={saving || applyRows.length === 0}
              style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: 5, background: '#2563eb', color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: applyRows.length === 0 ? 0.6 : 1 }}
            >
              {saving ? 'Recording…' : `Record ${applyRows.length} payment${applyRows.length === 1 ? '' : 's'}`}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
