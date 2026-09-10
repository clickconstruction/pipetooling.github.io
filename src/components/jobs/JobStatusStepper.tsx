import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { sendBackReasonError } from '../../lib/jobs/jobSendBackNote'
import { postSendBackReasonNote } from '../../lib/jobs/postSendBackReasonNote'
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
  const { user: authUser } = useAuth()
  const initialStatus = (job.status ?? 'working') as JobStepperStatus
  const [status, setStatus] = useState<JobStepperStatus>(
    JOB_STEPPER_ORDER.includes(initialStatus) ? initialStatus : 'working',
  )
  const [inCollections, setInCollections] = useState(job.collections_at != null)
  const [busy, setBusy] = useState(false)
  const [paidModalOpen, setPaidModalOpen] = useState(false)
  const [collectionsConfirm, setCollectionsConfirm] = useState<null | 'to' | 'from'>(null)
  const [collectionsNote, setCollectionsNote] = useState('')
  /** RTB → Working needs a reason (v2.2065): null = closed, string = the reason being typed. */
  const [sendBackReason, setSendBackReason] = useState<string | null>(null)
  /** v2.3240: why a dashed stage cannot be reached from here — shown under the rail for a few seconds on tap. */
  const [lockedNote, setLockedNote] = useState<string | null>(null)
  const lockedNoteTimer = useRef<number | null>(null)
  const showLockedNote = (text: string) => {
    setLockedNote(text)
    if (lockedNoteTimer.current != null) window.clearTimeout(lockedNoteTimer.current)
    lockedNoteTimer.current = window.setTimeout(() => setLockedNote(null), 5000)
  }
  useEffect(() => () => { if (lockedNoteTimer.current != null) window.clearTimeout(lockedNoteTimer.current) }, [])
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
    if (
      to === 'working' &&
      status === 'ready_to_bill' &&
      (sendBackReason == null || sendBackReasonError(sendBackReason) != null)
    ) {
      // Sending a finished job back to the crew needs a reason (v2.2065) —
      // it lands on their My Schedule card so the send-back isn't a mystery.
      if (sendBackReason == null) setSendBackReason('')
      return
    }
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
      if (to === 'working' && status === 'ready_to_bill' && sendBackReason != null) {
        const noted = await postSendBackReasonNote(job.id, authUser?.id, sendBackReason)
        if (!noted) showToast('Sent back, but the reason note could not be posted — add it in Job activity.', 'warning')
      }
      setSendBackReason(null)
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

  // v2.3240 (mockup-approved "rail"): three states with three looks — black =
  // the job is here, blue outline = one tap away, dashed grey = not reachable
  // from here (tap it and the reason shows under the rail instead of hiding in
  // a tooltip). Collections is the on/off switch it really is, on its own row.
  const currentIdx = JOB_STEPPER_ORDER.indexOf(status)
  const last = JOB_STEPPER_ORDER.length - 1
  const stepBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.35rem 0.8rem 0.35rem 0.5rem',
    borderRadius: 999,
    fontSize: '0.875rem',
    font: 'inherit',
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
  }
  const bubbleBase: React.CSSProperties = {
    width: 20,
    height: 20,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontSize: '0.7rem',
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  }

  return (
    <div>
      <div style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>Status</div>
      <div role="group" aria-label="Job status" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '0.5rem' }}>
        {JOB_STEPPER_ORDER.map((s, i) => {
          const active = s === status
          const reason = jobStepperMoveDisabledReason(status, s)
          const reachable = !active && reason == null
          const state: 'current' | 'reachable' | 'locked' = active ? 'current' : reachable ? 'reachable' : 'locked'
          const label = JOB_STEPPER_LABELS[s]
          const bubble = reachable ? (i < currentIdx ? '←' : '→') : String(i + 1)
          const stepStyle: React.CSSProperties =
            state === 'current'
              ? { ...stepBase, background: 'var(--text-strong)', color: 'var(--surface)', border: '1px solid var(--text-strong)', fontWeight: 700, cursor: 'default' }
              : state === 'reachable'
                ? { ...stepBase, background: 'var(--surface)', color: 'var(--text-link)', border: '1px solid #2563eb', fontWeight: 600, cursor: busy ? 'progress' : 'pointer' }
                : { ...stepBase, background: 'transparent', color: 'var(--text-faint)', border: '1px dashed var(--border)', fontWeight: 500, cursor: 'help' }
          const bubbleStyle: React.CSSProperties =
            state === 'current'
              ? { ...bubbleBase, background: 'var(--surface)', color: 'var(--text-strong)' }
              : state === 'reachable'
                ? { ...bubbleBase, background: '#2563eb', color: '#fff' }
                : { ...bubbleBase, border: '1px dashed var(--border)', color: 'var(--text-faint)' }
          return (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <button
                type="button"
                data-state={state}
                aria-pressed={active}
                aria-disabled={state === 'locked' ? true : undefined}
                onClick={() => {
                  if (busy) return
                  if (reachable) void moveTo(s)
                  else if (!active && reason) showLockedNote(reason)
                }}
                title={active ? 'Current stage' : reason ?? `Move to ${label}`}
                style={stepStyle}
              >
                <span aria-hidden style={bubbleStyle}>{bubble}</span>
                {label}
              </button>
              {i < last ? <span aria-hidden style={{ width: 14, height: 2, background: i < currentIdx ? 'var(--text-muted)' : 'var(--border)', flexShrink: 0 }} /> : null}
            </span>
          )
        })}
      </div>
      {lockedNote ? (
        <div role="status" style={{ marginTop: '0.4rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {lockedNote}
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem', fontSize: '0.875rem' }}>
        <button
          type="button"
          role="switch"
          aria-checked={inCollections}
          aria-label={inCollections ? 'In Collections — switch off to return the job to plain Billed' : 'Collections — flag as difficult to collect'}
          disabled={busy || status !== 'billed'}
          onClick={() => (status === 'billed' ? setCollectionsConfirm(inCollections ? 'from' : 'to') : undefined)}
          title={
            status !== 'billed'
              ? 'Collections applies to Billed jobs'
              : inCollections
                ? 'Return the job to plain Billed Awaiting Payment'
                : 'Flag as difficult to collect — moves to the Collections section'
          }
          style={{
            position: 'relative',
            width: 34,
            height: 20,
            borderRadius: 999,
            border: `1px solid ${inCollections ? '#dc2626' : 'var(--border-strong)'}`,
            background: inCollections ? '#dc2626' : 'var(--bg-muted)',
            cursor: busy || status !== 'billed' ? 'not-allowed' : 'pointer',
            opacity: status !== 'billed' ? 0.55 : 1,
            padding: 0,
            flexShrink: 0,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 2,
              left: inCollections ? 16 : 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--surface)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
              transition: 'left 0.15s ease',
            }}
          />
        </button>
        <span style={{ color: inCollections ? 'var(--text-red-700)' : status === 'billed' ? 'var(--text-700)' : 'var(--text-muted)', fontWeight: inCollections ? 700 : 500 }}>
          {inCollections ? 'In Collections' : 'Collections'}
        </span>
        {status !== 'billed' ? <span style={{ color: 'var(--text-faint)', fontSize: '0.8125rem' }}>· applies once the job is Billed</span> : null}
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

      {sendBackReason != null ? (
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.5rem' }}>
          <input
            type="text"
            value={sendBackReason}
            onChange={(e) => setSendBackReason(e.target.value)}
            placeholder="Why is it going back? (required — the crew sees this)"
            maxLength={500}
            style={{ flex: '1 1 16rem', minWidth: 0, padding: '0.35rem 0.5rem', fontSize: '0.8125rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-strong)' }}
          />
          <button
            type="button"
            disabled={busy || sendBackReasonError(sendBackReason) != null}
            title={sendBackReasonError(sendBackReason) ?? undefined}
            onClick={() => void moveTo('working')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              background: sendBackReasonError(sendBackReason) == null && !busy ? '#3b82f6' : 'var(--bg-muted)',
              color: sendBackReasonError(sendBackReason) == null && !busy ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: 6,
              cursor: sendBackReasonError(sendBackReason) == null && !busy ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? '…' : 'Send back to Working'}
          </button>
          <button
            type="button"
            onClick={() => setSendBackReason(null)}
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
