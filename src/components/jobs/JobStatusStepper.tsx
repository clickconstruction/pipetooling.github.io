import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { setJobCollectionsFlag } from '../../lib/setJobCollectionsFlag'
import { stripeModeForBillingFromRole } from '../../lib/voidStripeInvoiceForRevert'
import BilledPaymentConfirmationModal from './BilledPaymentConfirmationModal'
import {
  JOB_STEPPER_LABELS,
  JOB_STEPPER_ORDER,
  billedMoveNeedsShellGuard,
  jobStepperMoveDisabledReason,
  type JobStepperStatus,
} from '../../lib/jobs/jobStatusStepper'
import { formatUsdNoCents } from '../../lib/jobs/jobFormatting'
import { calendarYmdInAppTzFromIso } from '../../utils/dateUtils'

/**
 * Tappable status strip for the Edit tab (v2.1773, mockup-approved): the Job
 * pane's read-only Waiting → … → Paid line, but every pill moves the job.
 * Moves go through the same update_job_status RPC as the Pipeline board's
 * buttons (server rules + activity-thread status entries), Paid routes
 * through the Record payment window (mark_job_paid rules, v2.1758), and
 * Collections is the flag it really is — a toggle beside the strip, armed
 * only on Billed jobs, with the board's note-on-flag behavior.
 */

export type JobStatusStepperJob = {
  id: string
  status: string | null
  collections_at?: string | null
  hcp_number: string | null
  click_number?: string | null
  job_name: string | null
  revenue: number | null
  payments_made: number | null
}

export default function JobStatusStepper({ job, authRole, onChanged }: {
  job: JobStatusStepperJob
  authRole: string | null
  /** Fires after any successful move/flag change — parents refresh their job data. */
  onChanged: () => void
}) {
  const { showToast } = useToastContext()
  const initialStatus = (job.status ?? 'working') as JobStepperStatus
  const [status, setStatus] = useState<JobStepperStatus>(
    JOB_STEPPER_ORDER.includes(initialStatus) ? initialStatus : 'working',
  )
  const [inCollections, setInCollections] = useState(job.collections_at != null)
  const [busy, setBusy] = useState(false)
  const [paidModalOpen, setPaidModalOpen] = useState(false)
  const [collectionsConfirm, setCollectionsConfirm] = useState<null | 'to' | 'from'>(null)
  const [collectionsNote, setCollectionsNote] = useState('')
  /** Shell guard (v2.1935): open dollars that would land on no bill line if the to-Billed flip proceeds. */
  const [shellGuardOpen, setShellGuardOpen] = useState<number | null>(null)

  // Re-sync when the parent hands us a fresh job (window refresh after saves).
  useEffect(() => {
    const s = (job.status ?? 'working') as JobStepperStatus
    if (JOB_STEPPER_ORDER.includes(s)) setStatus(s)
    setInCollections(job.collections_at != null)
  }, [job.status, job.collections_at])

  async function moveTo(to: JobStepperStatus) {
    if (busy) return
    if (to === 'paid') {
      // Never a raw flip — the Record payment window enforces mark_job_paid's
      // rules (one-click Move to Paid when the balance is already $0).
      setPaidModalOpen(true)
      return
    }
    if (to === 'billed' && shellGuardOpen == null) {
      // Shell guard (v2.1935): a raw flip to Billed with open money and no
      // billed line mints a row that can't age, be chased, or be forecast.
      // Cheap existence probe; a probe failure falls through to the plain flip.
      const open = Math.max(0, Number(job.revenue ?? 0) - Number(job.payments_made ?? 0))
      setBusy(true)
      let guard = false
      try {
        const { count, error } = await supabase
          .from('jobs_ledger_invoices')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', job.id)
          .eq('status', 'billed')
        if (!error) guard = billedMoveNeedsShellGuard({ to, openAmount: open, hasBilledLine: (count ?? 0) > 0 })
      } catch {
        // fail open — server rules still apply to the flip itself
      } finally {
        setBusy(false)
      }
      if (guard) {
        setShellGuardOpen(open)
        return
      }
    }
    setShellGuardOpen(null)
    setBusy(true)
    try {
      const data = await withSupabaseRetry(
        async () => supabase.rpc('update_job_status', { p_job_id: job.id, p_to_status: to }),
        'stepper update_job_status',
      )
      const result = data as { error?: string } | null
      if (result?.error) {
        showToast(result.error, 'error')
        return
      }
      setStatus(to)
      if (to !== 'billed') setInCollections(false)
      showToast(`Moved to ${JOB_STEPPER_LABELS[to]}.`, 'success')
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not move the job', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** Guard's primary path: flip to Billed, then materialize the bill line dated today. */
  async function billWithLine() {
    if (busy) return
    setBusy(true)
    try {
      const data = await withSupabaseRetry(
        async () => supabase.rpc('update_job_status', { p_job_id: job.id, p_to_status: 'billed' }),
        'stepper update_job_status',
      )
      const result = data as { error?: string } | null
      if (result?.error) {
        showToast(result.error, 'error')
        return
      }
      setStatus('billed')
      setShellGuardOpen(null)
      try {
        const { error } = await supabase.rpc('create_billed_shell_invoice' as never, {
          p_job_id: job.id,
          p_billed_on: calendarYmdInAppTzFromIso(new Date().toISOString()),
        } as never)
        if (error) throw error
        showToast('Marked Billed — bill line created, dated today.', 'success')
      } catch (e) {
        showToast(
          e instanceof Error
            ? `Marked Billed, but the bill line failed: ${e.message}`
            : 'Marked Billed, but the bill line could not be created',
          'error',
        )
      }
      onChanged()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not move the job', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function commitCollections(direction: 'to' | 'from') {
    setBusy(true)
    try {
      const res = await setJobCollectionsFlag(job.id, direction === 'to', direction === 'to' ? collectionsNote : undefined)
      if (!res.ok) {
        showToast(res.error ?? 'Could not update Collections.', 'error')
        return
      }
      setInCollections(direction === 'to')
      setCollectionsConfirm(null)
      setCollectionsNote('')
      showToast(direction === 'to' ? 'Job moved to Collections.' : 'Job returned to Billed Awaiting Payment.', 'success')
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const pillBase: React.CSSProperties = {
    fontSize: '0.8125rem',
    padding: '0.3rem 0.75rem',
    borderRadius: 999,
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ marginTop: '1.25rem', paddingTop: '0.9rem', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Status</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexWrap: 'wrap' }}>
        {JOB_STEPPER_ORDER.map((s, i) => {
          const active = s === status
          const reason = jobStepperMoveDisabledReason(status, s)
          const disabled = busy || (!active && reason != null)
          return (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
              <button
                type="button"
                onClick={() => (!active && reason == null ? void moveTo(s) : undefined)}
                disabled={disabled && !active}
                aria-pressed={active}
                title={active ? 'Current stage' : reason ?? `Move to ${JOB_STEPPER_LABELS[s]}`}
                style={{
                  ...pillBase,
                  border: active ? 'none' : '1px solid transparent',
                  background: active ? 'var(--text-strong)' : 'transparent',
                  color: active ? 'var(--surface)' : reason == null ? 'var(--text-700)' : 'var(--text-faint)',
                  fontWeight: active ? 700 : 500,
                  cursor: active ? 'default' : reason == null && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                {JOB_STEPPER_LABELS[s]}
              </button>
              {i < JOB_STEPPER_ORDER.length - 1 ? (
                <span aria-hidden style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>→</span>
              ) : null}
            </span>
          )
        })}
        <span aria-hidden style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 0.35rem' }} />
        <button
          type="button"
          onClick={() => (status === 'billed' ? setCollectionsConfirm(inCollections ? 'from' : 'to') : undefined)}
          disabled={busy || status !== 'billed'}
          aria-pressed={inCollections}
          title={
            status !== 'billed'
              ? 'Collections applies to Billed jobs'
              : inCollections
                ? 'Return the job to plain Billed Awaiting Payment'
                : 'Flag as difficult to collect — moves to the Collections section'
          }
          style={{
            ...pillBase,
            border: inCollections ? '1px solid var(--border-red)' : '1px solid transparent',
            background: inCollections ? 'var(--bg-red-100)' : 'transparent',
            color: status === 'billed' ? 'var(--text-red-700)' : 'var(--text-faint)',
            fontWeight: inCollections ? 700 : 500,
            cursor: busy || status !== 'billed' ? 'not-allowed' : 'pointer',
          }}
        >
          {inCollections ? 'In Collections' : 'Collections'}
        </button>
      </div>

      {shellGuardOpen != null ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>
            No bill line — {formatUsdNoCents(shellGuardOpen)} open would not age, be chased, or show in the payment
            forecast.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void billWithLine()}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {busy ? '…' : 'Create line & mark Billed'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void moveTo('billed')}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-700)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
          >
            Mark Billed only
          </button>
          <button
            type="button"
            onClick={() => setShellGuardOpen(null)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {collectionsConfirm ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {collectionsConfirm === 'to' ? (
            <input
              type="text"
              value={collectionsNote}
              onChange={(e) => setCollectionsNote(e.target.value)}
              placeholder="Collections note (why it's hard to collect)…"
              maxLength={500}
              style={{ flex: '1 1 14rem', minWidth: 0, padding: '0.35rem 0.5rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
            />
          ) : (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-700)' }}>Return this job to Billed Awaiting Payment?</span>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void commitCollections(collectionsConfirm)}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {busy ? '…' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => {
              setCollectionsConfirm(null)
              setCollectionsNote('')
            }}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem', background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {paidModalOpen ? (
        <BilledPaymentConfirmationModal
          mode="job"
          invoice={null}
          payments={undefined}
          job={{
            id: job.id,
            hcp_number: job.hcp_number,
            click_number: job.click_number,
            job_name: job.job_name,
            revenue: job.revenue,
            payments_made: job.payments_made,
          }}
          stripeModeForBilling={stripeModeForBillingFromRole(authRole)}
          onClose={() => setPaidModalOpen(false)}
          onSuccess={() => {
            setStatus('paid')
            setInCollections(false)
            onChanged()
          }}
        />
      ) : null}
    </div>
  )
}
