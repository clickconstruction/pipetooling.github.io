import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { fetchAllRows } from '../../lib/supabasePaging'
import { parseCsv } from '../../lib/parseCsv'
import {
  backfillPaymentNote,
  parseHcpJobsExport,
  planHcpPaymentBackfill,
  type BackfillDateSource,
  type BackfillJobInput,
  type BackfillPlanRow,
} from '../../lib/customers/backfillHcpPayments'
import {
  planHcpTipsSweep,
  tipPaymentNote,
  TIP_LINE_NAME,
  type TipsSweepJobInput,
  type TipsSweepRow,
} from '../../lib/customers/hcpTipsSweep'

/**
 * HCP payment backfill sweep (money-rail follow-up): jobs imported from
 * HouseCall Pro as Paid carry no payment rows, so "collected" reads $0 for
 * them. The user picks the HCP jobs export (parsed in the browser — the file
 * never leaves the machine), reviews one synthetic payment per job with its
 * real HCP collection date, and one Apply inserts the rows. The B3 trigger
 * keeps payments_made in sync automatically.
 *
 * Second pass, same file (v2.1800): HCP "Job amount" includes tips but jobs
 * were imported at the pre-tip figure, so tips are invisible here. The tips
 * section adds a "Tip (HCP)" line item + a matching tip payment per tipped
 * job, and flips fully-covered Billed jobs to Paid via mark_job_paid.
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

function tipStateChip(state: Exclude<TipsSweepRow['state'], 'add'>): { label: string; fg: string } {
  switch (state) {
    case 'done':
      return { label: 'already added ✓', fg: 'var(--text-green-600)' }
    case 'included':
      return { label: 'already in the job total', fg: 'var(--text-muted)' }
    case 'no_job':
      return { label: 'job not in the app', fg: 'var(--text-muted)' }
    case 'mismatch':
      return { label: "totals don't reconcile — review by hand", fg: 'var(--text-amber-800)' }
  }
}

function money(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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
  const [tipJobs, setTipJobs] = useState<TipsSweepJobInput[] | null>(null)
  const [tipLineJobIds, setTipLineJobIds] = useState<Set<string> | null>(null)
  const [plan, setPlan] = useState<BackfillPlanRow[] | null>(null)
  const [tipsPlan, setTipsPlan] = useState<TipsSweepRow[] | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [skipped, setSkipped] = useState<Record<string, boolean>>({})
  const [tipSkipped, setTipSkipped] = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Paged whole-set reads (Phase 4 #3(c)): the backfill decides "paid job with no
        // payment row" from these lists, so a silent 1,000-row cap would offer to mint
        // payments that already exist.
        const [jobRows, paymentRows, hcpJobRows, tipLineRows] = await Promise.all([
          fetchAllRows(
            async (from, to) => ({
              data: (await withSupabaseRetry(
                async () =>
                  supabase
                    .from('jobs_ledger')
                    .select('id, hcp_number, click_number, job_name, customer_name, status, revenue, created_at')
                    .eq('status', 'paid')
                    .gt('revenue', 0)
                    .order('id')
                    .range(from, to),
                'payment backfill: paid jobs',
              )) as BackfillJobInput[] | null,
              error: null,
            }),
            'payment backfill: paid jobs',
          ),
          fetchAllRows(
            async (from, to) => ({
              data: (await withSupabaseRetry(
                async () => supabase.from('jobs_ledger_payments').select('job_id').order('id').range(from, to),
                'payment backfill: payment rows',
              )) as Array<{ job_id: string }> | null,
              error: null,
            }),
            'payment backfill: payment rows',
          ),
          fetchAllRows(
            async (from, to) => ({
              data: (await withSupabaseRetry(
                async () =>
                  supabase
                    .from('jobs_ledger')
                    .select('id, hcp_number, click_number, job_name, customer_name, status, revenue, payments_made, created_at')
                    .not('hcp_number', 'is', null)
                    .neq('hcp_number', '')
                    .order('id')
                    .range(from, to),
                'tips sweep: HCP jobs',
              )) as TipsSweepJobInput[] | null,
              error: null,
            }),
            'tips sweep: HCP jobs',
          ),
          withSupabaseRetry(
            async () => supabase.from('jobs_ledger_fixtures').select('job_id').ilike('name', 'tip%'),
            'tips sweep: existing tip lines',
          ),
        ])
        if (cancelled) return
        setJobs((jobRows ?? []) as BackfillJobInput[])
        setJobIdsWithPayments(new Set(((paymentRows ?? []) as Array<{ job_id: string }>).map((p) => p.job_id)))
        setTipJobs((hcpJobRows ?? []) as TipsSweepJobInput[])
        setTipLineJobIds(new Set(((tipLineRows ?? []) as Array<{ job_id: string }>).map((f) => f.job_id)))
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
      setTipsPlan(planHcpTipsSweep(tipJobs ?? [], exportRows, tipLineJobIds ?? new Set()))
      setSkipped({})
      setTipSkipped({})
    }
    reader.onerror = () => setFileError('Could not read that file.')
    reader.readAsText(file)
  }

  const applyRows = useMemo(() => (plan ?? []).filter((r) => !skipped[r.jobId]), [plan, skipped])
  const applyTotal = applyRows.reduce((sum, r) => sum + r.amount, 0)
  const exactDates = applyRows.filter((r) => r.dateSource === 'hcp_paid').length
  const tipRows = useMemo(
    () => (tipsPlan ?? []).filter((r): r is TipsSweepRow & { jobId: string; paidOn: string } => r.state === 'add' && r.jobId != null && r.paidOn != null),
    [tipsPlan],
  )
  const tipApplyRows = useMemo(() => tipRows.filter((r) => !tipSkipped[r.jobId]), [tipRows, tipSkipped])
  const tipTotal = tipApplyRows.reduce((sum, r) => sum + r.tip, 0)
  const otherTipRows = useMemo(() => (tipsPlan ?? []).filter((r) => r.state !== 'add' && r.state !== 'done'), [tipsPlan])
  const applyCount = applyRows.length + tipApplyRows.length

  async function apply() {
    if (applyCount === 0) return
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

    // Tips: per-job (line item + revenue + payment [+ mark paid]), failures
    // isolated per job so one bad row never aborts the batch (v2.1789 rule).
    let tipsAdded = 0
    let flipped = 0
    const tipFailures: string[] = []
    if (tipApplyRows.length > 0) {
      const { data: seqRows } = await supabase
        .from('jobs_ledger_fixtures')
        .select('job_id, sequence_order')
        .in('job_id', tipApplyRows.map((r) => r.jobId))
      const nextSeq = new Map<string, number>()
      for (const f of (seqRows ?? []) as Array<{ job_id: string; sequence_order: number }>) {
        nextSeq.set(f.job_id, Math.max(nextSeq.get(f.job_id) ?? 0, f.sequence_order + 1))
      }
      for (const r of tipApplyRows) {
        try {
          const { error: lineErr } = await supabase.from('jobs_ledger_fixtures').insert({
            job_id: r.jobId,
            name: TIP_LINE_NAME,
            count: 1,
            line_unit_price: r.tip,
            sequence_order: nextSeq.get(r.jobId) ?? 0,
          })
          if (lineErr) throw new Error(lineErr.message)
          const { error: revErr } = await supabase.from('jobs_ledger').update({ revenue: r.revenueAfter }).eq('id', r.jobId)
          if (revErr) throw new Error(revErr.message)
          const { error: payErr } = await supabase.from('jobs_ledger_payments').insert({
            job_id: r.jobId,
            amount: r.tip,
            paid_on: r.paidOn,
            payment_type: 'HCP import',
            note: tipPaymentNote(r),
          })
          if (payErr) throw new Error(payErr.message)
          tipsAdded += 1
          if (r.markPaid) {
            const { data: flip, error: flipErr } = await supabase.rpc('mark_job_paid', { p_job_id: r.jobId, p_amount: 0 })
            const flipError = flipErr?.message ?? (flip as { error?: string } | null)?.error
            if (flipError) tipFailures.push(`${r.label}: tip added, but Mark Paid failed — ${flipError}`)
            else flipped += 1
          }
        } catch (e: unknown) {
          tipFailures.push(`${r.label}: ${formatErrorMessage(e, 'failed')}`)
        }
      }
    }

    const parts: string[] = []
    if (inserted > 0) parts.push(`${inserted} payment${inserted === 1 ? '' : 's'}`)
    if (tipsAdded > 0) parts.push(`${tipsAdded} tip${tipsAdded === 1 ? '' : 's'}`)
    if (flipped > 0) parts.push(`${flipped} job${flipped === 1 ? '' : 's'} moved to Paid`)
    const done = parts.length > 0 ? `Recorded ${parts.join(' · ')} from HCP history.` : 'Nothing was recorded.'
    if (!failure && tipFailures.length === 0) {
      showToast(done, 'success')
    } else {
      const problems = [failure, ...tipFailures].filter(Boolean).join(' · ')
      showToast(`${done} Then stopped — ${problems}. Re-open the tool to continue; rows already filled are skipped automatically.`, 'error')
    }
    onApplied()
    onClose()
  }

  const loading = jobs == null || jobIdsWithPayments == null || tipJobs == null || tipLineJobIds == null

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
            Pick the HCP jobs export and review two fixes: paid jobs with no payment record get one payment dated
            when HCP says it was collected, and tips HCP collected on top of the job total get a line item + matching
            payment. The file is read on this device only — nothing uploads.
          </div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {error ? (
            <p style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-red-600)' }}>{error}</p>
          ) : loading ? (
            <p role="status" style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Finding paid jobs with no payment record…
            </p>
          ) : plan == null || tipsPlan == null ? (
            <div style={{ padding: '14px 16px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'var(--text-700)' }}>
                {candidateCount === 0 ? (
                  <>Every paid job already has a payment record. Pick the export to check for HCP tips.</>
                ) : (
                  <>
                    <strong style={{ color: 'var(--text-strong)' }}>{candidateCount}</strong> paid job
                    {candidateCount === 1 ? '' : 's'} have no payment record. Choose the HouseCall Pro jobs export
                    (.csv) to date them accurately.
                  </>
                )}
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
          ) : (
            <>
              {plan.length === 0 && tipRows.length === 0 && otherTipRows.length === 0 ? (
                <p style={{ margin: 0, padding: '12px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Nothing to fill — payment records and tips are already caught up with the HCP export. 🎉
                </p>
              ) : null}

              {plan.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 16px 2px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                  <span>Payments — paid jobs with no record</span>
                  <button
                    type="button"
                    onClick={() => setSkipped(Object.fromEntries(plan.map((r) => [r.jobId, true])))}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}
                  >
                    none
                  </button>
                  <button
                    type="button"
                    onClick={() => setSkipped({})}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}
                  >
                    all
                  </button>
                </div>
              ) : null}
              {plan.map((r) => {
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
                        ${money(r.amount)}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>{r.paidOn}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 9999, fontSize: '0.64rem', fontWeight: 700, background: badge.bg, color: badge.fg, whiteSpace: 'nowrap' }}>
                        {badge.label}
                      </span>
                    </div>
                    {mismatch ? (
                      <p style={{ margin: '2px 0 0 26px', fontSize: '0.72rem', color: 'var(--text-amber-800)' }}>
                        HCP recorded ${money(r.hcpPaid!)} collected — the payment uses this job's billed amount; the HCP figure is kept in the payment note.
                      </p>
                    ) : null}
                  </div>
                )
              })}

              {tipRows.length > 0 || otherTipRows.length > 0 ? (
                <div style={{ padding: '10px 16px 2px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
                  Tips HCP collected on top of the job total
                </div>
              ) : null}
              {tipRows.map((r) => {
                const badge = dateSourceBadge(r.dateSource)
                return (
                  <div key={r.jobId} style={{ borderBottom: '1px solid var(--border)', padding: '6px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={!tipSkipped[r.jobId]}
                        aria-label={`Add tip for job ${r.label}`}
                        onChange={(e) => setTipSkipped((prev) => ({ ...prev, [r.jobId]: !e.target.checked }))}
                        style={{ margin: 0, cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap' }}>{r.label}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>
                        {r.customerName || r.jobName || '(unnamed)'}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>
                        +${money(r.tip)}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        ${money(r.revenueBefore)} → ${money(r.revenueAfter)}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)', whiteSpace: 'nowrap' }}>{r.paidOn}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 9999, fontSize: '0.64rem', fontWeight: 700, background: badge.bg, color: badge.fg, whiteSpace: 'nowrap' }}>
                        {badge.label}
                      </span>
                    </div>
                    {r.markPaid ? (
                      <p style={{ margin: '2px 0 0 26px', fontSize: '0.72rem', color: 'var(--text-green-600)' }}>
                        Fully collected once the tip lands — the job also moves to Paid.
                      </p>
                    ) : null}
                  </div>
                )
              })}
              {otherTipRows.map((r) => {
                const chip = tipStateChip(r.state as Exclude<TipsSweepRow['state'], 'add'>)
                return (
                  <div key={`${r.label}-${r.state}`} style={{ borderBottom: '1px solid var(--border)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span style={{ width: 13 }} />
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.label}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.customerName || r.jobName || '(unnamed)'}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>${money(r.tip)} tip</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: chip.fg, whiteSpace: 'nowrap' }}>{chip.label}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {plan == null
              ? 'Nothing is written until you press Record.'
              : [
                  `${applyRows.length} payment${applyRows.length === 1 ? '' : 's'} · $${Math.round(applyTotal).toLocaleString('en-US')} · ${exactDates} with exact HCP paid dates`,
                  tipApplyRows.length > 0 ? `${tipApplyRows.length} tip${tipApplyRows.length === 1 ? '' : 's'} · $${money(tipTotal)}` : null,
                ]
                  .filter(Boolean)
                  .join(' — ')}
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
              disabled={saving || applyCount === 0}
              style={{ padding: '0.4rem 0.9rem', border: 'none', borderRadius: 5, background: '#2563eb', color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: applyCount === 0 ? 0.6 : 1 }}
            >
              {saving
                ? 'Recording…'
                : `Record ${[
                    applyRows.length > 0 ? `${applyRows.length} payment${applyRows.length === 1 ? '' : 's'}` : null,
                    tipApplyRows.length > 0 ? `${tipApplyRows.length} tip${tipApplyRows.length === 1 ? '' : 's'}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '0 rows'}`}
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}
