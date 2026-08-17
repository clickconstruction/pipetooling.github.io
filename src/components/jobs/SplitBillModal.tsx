import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { formatErrorMessage } from '../../utils/errorHandling'
import { denverCalendarDayKey } from '../../utils/dateUtils'
import {
  ensureLedgerInvoiceRemovedAfterStripeSendBack,
  invokeVoidStripeInvoiceForRevert,
  stripeModeForBillingFromRole,
} from '../../lib/voidStripeInvoiceForRevert'
import { syncJobToReadyToBillIfNoBilledInvoicesRemain } from '../../lib/syncJobToReadyToBillIfNoBilledInvoicesRemain'
import { maybePromoteJobToBilledAfterCustomerInvoice } from '../../lib/promoteJobToBilledIfFullyInvoiced'
import {
  MAX_SPLIT_BILL_PARTS,
  dollarsInputToCents,
  formatCentsAsDollars,
  splitBillIssuedAtMs,
  splitBillPartMemo,
  splitBillRemainderCents,
  validateSplitBillParts,
} from '../../lib/splitBillParts'
import type { StripeInvoiceDetailsSuccess } from '../../lib/stripeInvoiceDetailsResponse'
import type { InvoiceWithJobForBillView } from './HostedStripeBillPanel'

const inputStyle = {
  padding: '0.4rem 0.6rem',
  fontSize: '0.875rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 6,
  background: 'var(--surface)',
  color: 'var(--text-base)',
  boxSizing: 'border-box' as const,
  fontVariantNumeric: 'tabular-nums' as const,
}

/**
 * Split one billed hosted Stripe bill into 2–4 bills so a customer can pay with
 * multiple cards (v2.1520, mockup Option A). Voids the current Stripe invoice via
 * the existing send-back path, inserts one Ready-to-Bill partial row per part, then
 * creates a hosted Stripe bill per row (issued_at_ms staggered so the generated
 * invoice numbers never collide) and promotes the job back to billed.
 */
export function SplitBillModal({
  open,
  invoice,
  stripeDetail,
  overlayZIndex = 121,
  onClose,
  onDone,
}: {
  open: boolean
  invoice: InvoiceWithJobForBillView
  stripeDetail: StripeInvoiceDetailsSuccess
  /** Above the hosting modal (View bill etc.), like the void-confirm overlay. */
  overlayZIndex?: number
  onClose: () => void
  /** Runs after any DB mutation (success OR partial failure) so the parent closes and refreshes. */
  onDone: () => void | Promise<void>
}) {
  const { role: authRole } = useAuth()
  const { showToast } = useToastContext()
  const inv = invoice
  const job = invoice.job

  const totalCents = Math.round(Number(inv.amount ?? 0) * 100)

  /** Parts 1..N-1 as typed; the last part is always the auto remainder. */
  const [partInputs, setPartInputs] = useState<string[]>([''])
  const [dueDate, setDueDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [didMutate, setDidMutate] = useState(false)

  useEffect(() => {
    if (!open) return
    setPartInputs([''])
    setBusy(false)
    setError(null)
    setDidMutate(false)
    const dueSec = stripeDetail.due_date
    const fallback = denverCalendarDayKey(Date.now() + 7 * 86400000)
    const fromStripe = dueSec != null ? denverCalendarDayKey(dueSec * 1000) : null
    const today = denverCalendarDayKey(Date.now())
    setDueDate(fromStripe && fromStripe >= today ? fromStripe : fallback)
  }, [open, stripeDetail.due_date])

  const closeRespectingMutation = useMemo(
    () => () => {
      if (busy) return
      if (didMutate) void onDone()
      else onClose()
    },
    [busy, didMutate, onDone, onClose],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeRespectingMutation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, closeRespectingMutation])

  if (!open) return null

  const enteredCents = partInputs.map((s) => dollarsInputToCents(s))
  const remainderCents = splitBillRemainderCents(totalCents, enteredCents)
  const partCount = partInputs.length + 1
  const validation = validateSplitBillParts(totalCents, enteredCents)
  const dueDateOk = /^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())
  const canSubmit = validation.ok && dueDateOk && !busy

  const runSplit = async () => {
    if (!validation.ok || busy) return
    const partsCents = validation.partsCents
    const m = partsCents.length
    setBusy(true)
    setError(null)
    try {
      const token = await getAccessTokenForEdgeFunctions()
      if (!token) {
        setError('Not signed in')
        return
      }
      if (!job.customer_id) {
        setError('Job has no linked customer.')
        return
      }
      const customerEmail = (job.customer_email ?? '').trim() || (stripeDetail.customer_email ?? '').trim()
      if (!customerEmail) {
        setError('No customer email on the job or the Stripe bill.')
        return
      }
      const customerName =
        (job.customer_name ?? '').trim() || (stripeDetail.customer_name ?? '').trim() || 'Customer'
      const rowMode =
        inv.stripe_mode === 'test' || inv.stripe_mode === 'live'
          ? inv.stripe_mode
          : stripeModeForBillingFromRole(authRole)
      const originalMemo = (inv.stripe_invoice_memo ?? '').trim() || (stripeDetail.memo ?? '').trim() || null
      const footer = (inv.stripe_invoice_footer ?? '').trim() || (stripeDetail.footer ?? '').trim() || undefined

      // 1) Void the current Stripe bill and remove its ledger line (existing send-back path).
      const voided = await invokeVoidStripeInvoiceForRevert({
        invoiceId: inv.id,
        stripeModeForBilling: rowMode,
        accessToken: token,
      })
      if (!voided.ok) {
        setError(voided.message)
        return
      }
      setDidMutate(true)
      const cleaned = await ensureLedgerInvoiceRemovedAfterStripeSendBack(inv.id)
      if (!cleaned.ok) {
        setError(cleaned.message)
        return
      }
      const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, job.id)
      if (!sync.ok) {
        setError(sync.message)
        return
      }

      // 2) One Ready-to-Bill partial row per part.
      const baseOrder = (job.invoices ?? []).length
      const { data: created, error: insErr } = await supabase
        .from('jobs_ledger_invoices')
        .insert(
          partsCents.map((cents, i) => ({
            job_id: job.id,
            amount: cents / 100,
            status: 'ready_to_bill',
            sequence_order: baseOrder + i,
            estimated_bill_date: null,
            is_primary_rtb_bundle: false,
            stripe_invoice_memo: splitBillPartMemo(originalMemo, i + 1, m),
          })),
        )
        .select('id')
      if (insErr || !created || created.length !== m) {
        setError(
          `${insErr?.message ?? 'Could not create the split billing lines.'} The original bill was voided — the job is back at Ready to Bill; bill it again from Bill Customer.`,
        )
        return
      }

      // 3) A hosted Stripe bill per row; issued_at_ms staggered so numbers never collide.
      const baseMs = Date.now()
      for (let i = 0; i < m; i++) {
        const rowId = (created[i] as { id: string }).id
        const { data: raw, error: fnErr } = await supabase.functions.invoke('create-stripe-invoice', {
          body: {
            jobs_ledger_invoice_id: rowId,
            customer_id: job.customer_id,
            amount_dollars: partsCents[i]! / 100,
            customer_email: customerEmail,
            customer_name: customerName,
            due_date: dueDate.trim(),
            memo: splitBillPartMemo(originalMemo, i + 1, m),
            ...(footer ? { footer } : {}),
            issued_at_ms: splitBillIssuedAtMs(baseMs, i),
            ...stripeModeInvokeBody(rowMode),
          },
          headers: { Authorization: `Bearer ${token}` },
        })
        const body = raw as Record<string, unknown> | null
        const failMsg = fnErr
          ? ((await readEdgeFunctionErrorBody(fnErr)) ?? formatErrorMessage(fnErr, 'Stripe invoice failed'))
          : body && typeof body.error === 'string' && body.error
            ? body.error
            : null
        if (failMsg) {
          setError(
            `Part ${i + 1} of ${m} failed: ${failMsg} Parts ${i + 1}–${m} stayed as Ready-to-Bill drafts — bill them from Bill Customer.`,
          )
          return
        }
      }

      // 4) All parts billed — put the job back in Billed.
      const promoted = await maybePromoteJobToBilledAfterCustomerInvoice(job.id)
      if (!promoted.ok) {
        setError(`Bills created, but the job status update failed: ${promoted.error}`)
        return
      }
      showToast(`Split into ${m} bills. Each has its own pay link.`, 'success')
      await onDone()
    } finally {
      setBusy(false)
    }
  }

  const partRow = (label: string, value: string, onChange?: (v: string) => void) => (
    <div
      key={label}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.5rem' }}
    >
      <span style={{ fontSize: '0.875rem' }}>{label}</span>
      {onChange ? (
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          aria-label={`${label} amount`}
          style={{ ...inputStyle, width: '8.5rem', textAlign: 'right' }}
        />
      ) : (
        <span
          aria-label={`${label} amount (remainder)`}
          style={{ ...inputStyle, width: '8.5rem', textAlign: 'right', background: 'var(--bg-subtle)', color: 'var(--text-700)' }}
        >
          ${value}
        </span>
      )}
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed',
        padding: 'calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px))',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: overlayZIndex,
      }}
      onClick={closeRespectingMutation}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={`Split bill of $${formatCentsAsDollars(totalCents)}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          padding: '1.25rem',
          borderRadius: 8,
          width: 'min(420px, calc(100vw - 1.5rem))',
          maxHeight: 'min(90vh, 100%)',
          overflowY: 'auto',
          margin: '0.75rem',
          boxSizing: 'border-box',
        }}
      >
        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1.15rem' }}>
          Split bill — ${formatCentsAsDollars(totalCents)}
        </h2>
        <p style={{ margin: '0 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Each part becomes its own Stripe bill with its own pay link, so the customer can pay each with a
          different card.
        </p>
        {partInputs.map((v, i) =>
          partRow(`Part ${i + 1}`, v, (next) =>
            setPartInputs((prev) => prev.map((p, j) => (j === i ? next : p))),
          ),
        )}
        {partRow(`Part ${partCount} (remainder)`, formatCentsAsDollars(Math.max(0, remainderCents)))}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.35rem' }}>
          {partCount < MAX_SPLIT_BILL_PARTS ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPartInputs((prev) => [...prev, ''])}
              style={{ border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', padding: 0, fontSize: '0.8125rem' }}
            >
              + Add another part
            </button>
          ) : null}
          {partCount > 2 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => setPartInputs((prev) => prev.slice(0, -1))}
              style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '0.8125rem' }}
            >
              Remove a part
            </button>
          ) : null}
        </div>
        <p style={{ margin: '0 0 0.85rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Parts must add up to ${formatCentsAsDollars(totalCents)}. The last part fills in automatically.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', marginBottom: '0.85rem' }}>
          <label htmlFor="split-bill-due-date" style={{ fontSize: '0.875rem' }}>
            Due date (all parts)
          </label>
          <input
            id="split-bill-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ ...inputStyle, width: '10rem' }}
          />
        </div>
        <div
          role="note"
          style={{
            background: 'var(--bg-amber-tint)',
            border: '1px solid var(--border-amber-soft)',
            color: 'var(--text-amber-800)',
            borderRadius: 6,
            padding: '0.5rem 0.65rem',
            fontSize: '0.8125rem',
            lineHeight: 1.4,
            marginBottom: '0.85rem',
          }}
        >
          The current Stripe bill will be <strong>voided</strong> and replaced by {partCount} new bills.
          Nothing is emailed until you send each one.
        </div>
        {error ? (
          <p style={{ margin: '0 0 0.85rem', fontSize: '0.8125rem', color: 'var(--text-red-700)', lineHeight: 1.4 }}>
            {error}
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button
            type="button"
            disabled={busy}
            onClick={closeRespectingMutation}
            style={{
              padding: '0.5rem 1rem',
              border: '1px solid var(--border-strong)',
              background: 'var(--surface)',
              borderRadius: 4,
              cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {didMutate ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void runSplit()}
            style={{
              padding: '0.5rem 1rem',
              background: canSubmit ? '#15803d' : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {busy ? 'Splitting…' : `Split into ${partCount} bills`}
          </button>
        </div>
      </div>
    </div>
  )
}
