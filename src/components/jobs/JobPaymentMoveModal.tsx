/**
 * Move this payment — a customer payment to the right job (v2.3576, PR 3 of the payment
 * move/remove train; the sub-sheet twin is `SubLaborPaymentMoveRemoveModals`). Search the
 * destination the way Reassign costs does (`search_jobs_ledger`), read both jobs' paid and
 * open before and after, give a reason (*wrong job* unless one is typed), then one RPC —
 * `move_jobs_ledger_payment` — re-points the live row and writes the trace event.
 *
 * v2.4803: a check Stripe holds as paid (our out-of-band mark) moves through the same window.
 * Stripe never reopens a paid invoice, so the window runs the four steps in order — the
 * credit note (`reverse-stripe-invoice-out-of-band-payment`), the send-back
 * (`sendBackStripeBilledLine`), the landing on the other job (`mark_invoice_paid` on its one
 * open bill with room, else a plain row), the `moved` event — and, when a step after the
 * credit note fails, says exactly what is done and what is left by hand
 * (`stripeHeldPaymentMove.ts`).
 *
 * v2.4822: the window names a check only when it is one, and the landing on another job's
 * Stripe bill follows Mark Paid's rules (`heldLandingWrite`) so no Stripe invoice is left open
 * behind a bill the app reads Paid.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry, formatPostgrestOrUnknownError } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../lib/format'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import { PAYMENT_MOVE_DEFAULT_REASON, paymentMoveReason, planJobPaymentMove } from '../../lib/jobs/jobPaymentMove'
import {
  heldLandingWrite,
  heldMoveBill,
  heldMoveEventRow,
  heldMoveNoun,
  planHeldLanding,
  stripeHeldMoveDoneWords,
  stripeHeldMoveIntro,
  stripeHeldMoveOffered,
  stripeHeldMoveReason,
  stripeHeldMoveSteps,
  stripeHeldMoveStoppedWords,
  stripeHeldMoveTitle,
  type HeldLanding,
} from '../../lib/jobs/stripeHeldPaymentMove'
import { invoiceRecordsThroughStripe } from '../../lib/jobs/paymentInvoiceLinking'
import { todayYmdInAppTz } from '../../utils/dateUtils'
import type { BillingStripeModePref } from '../../lib/billingStripeModePref'
import { stripeModeInvokeBody } from '../../lib/billingStripeModePref'
import { readEdgeFunctionErrorBody } from '../../lib/readEdgeFunctionErrorBody'
import { sendBackStripeBilledLine } from '../../lib/voidStripeInvoiceForRevert'
import type { PaymentRow } from '../../lib/jobs/jobFormTypes'
import type { JobWithDetails } from '../../types/jobWithDetails'

// The RPC and the destination read go through the untyped client until the types regenerate.
const db = supabase as unknown as SupabaseClient

type Candidate = { id: string; hcp_number: string | null; click_number?: string | null; job_name: string | null; job_address: string | null }
type Destination = Candidate & { revenueUsd: number; paidUsd: number; status: string | null }

const overlay: CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'calc(16px + var(--app-top-chrome, 0px)) 16px 16px', zIndex: 1300, overflowY: 'auto' }
const card: CSSProperties = { background: 'var(--surface)', color: 'var(--text-base)', borderRadius: 10, width: 'min(560px, 100%)', maxHeight: 'min(92vh, 100%)', overflow: 'auto', boxShadow: '0 22px 50px rgba(0,0,0,.25)', padding: '1.1rem 1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }
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
  stripeModeForBilling = 'live',
  onClose,
  onMoved,
}: {
  open: boolean
  payment: PaymentRow | null
  fromJob: JobWithDetails | null
  /** v2.4803: the Stripe mode the held-check steps run in (the host's role decides). */
  stripeModeForBilling?: BillingStripeModePref
  onClose: () => void
  /** After the RPC wrote — the form re-reads the job. */
  onMoved: () => void
}) {
  const { showToast } = useToastContext()
  const { user: authUser, profileName } = useAuth()
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [dest, setDest] = useState<Destination | null>(null)
  const [landing, setLanding] = useState<HeldLanding | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  /** A held-check step after the credit note failed: what is done and what is left by hand. */
  const [stopped, setStopped] = useState<string | null>(null)
  // Stripe holds this payment as paid: the four-step path instead of the one RPC.
  const held = Boolean(payment && fromJob && stripeHeldMoveOffered(payment, fromJob))
  const heldBill = payment ? heldMoveBill(payment, fromJob) : null
  const noun = heldMoveNoun(payment ?? { payment_type: null })

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCandidates([])
    setDest(null)
    setLanding(null)
    setReason('')
    setBusy(false)
    setStopped(null)
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
          const raw = await withSupabaseRetry(async () => supabase.rpc('search_jobs_ledger', { search_text: q, include_billing_only: true }), 'move payment · job search')
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
    if (held && payment) setLanding(await readHeldLanding(c.id, Number(payment.amount ?? 0)))
  }

  /** Where a held payment lands on the other job: its bills, what each already holds, and which are Stripe's. */
  async function readHeldLanding(jobId: string, amount: number): Promise<HeldLanding> {
    try {
      const [{ data: bills }, { data: pays }] = await Promise.all([
        db.from('jobs_ledger_invoices').select('id, status, amount, stripe_invoice_id, external_send_channel').eq('job_id', jobId),
        db.from('jobs_ledger_payments').select('invoice_id, amount').eq('job_id', jobId),
      ])
      const applied = new Map<string, number>()
      for (const p of (pays ?? []) as Array<{ invoice_id: string | null; amount: number | null }>) {
        if (p.invoice_id) applied.set(p.invoice_id, (applied.get(p.invoice_id) ?? 0) + Number(p.amount ?? 0))
      }
      type BillRow = { id: string; status: string | null; amount: number | null; stripe_invoice_id: string | null; external_send_channel: string | null }
      const rows = ((bills ?? []) as BillRow[]).map((b) => ({ id: b.id, status: b.status, amount: b.amount, applied: applied.get(b.id) ?? 0, stripeHosted: invoiceRecordsThroughStripe(b) }))
      return planHeldLanding(rows, amount)
    } catch {
      return { kind: 'job' }
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

  /**
   * v2.4803 — a payment Stripe holds, in order. The credit note writes nothing on failure, so
   * a refusal there is a plain error; after it every stop leaves words on screen and the
   * form re-reads the job.
   */
  async function confirmHeld(): Promise<void> {
    if (!payment || !dest || !fromJob || !heldBill) return
    const fromLabel = jobLabel(fromJob).split(' · ')[0] ?? 'this job'
    const toLabel = jobLabel(dest).split(' · ')[0] ?? 'that job'
    const why = stripeHeldMoveReason(toLabel, paymentMoveReason(reason))
    const amount = Number(payment.amount ?? 0)
    const paidOnYmd = payment.paid_on ? String(payment.paid_on).slice(0, 10) : null
    const paymentType = (payment.payment_type ?? '').trim()
    const referenceNumber = (payment.reference_number ?? '').trim()
    const stopArgs = { fromLabel, toLabel, amount, paidOn: paidOnYmd, reference: referenceNumber || null, noun }
    const snapshot = { amount: payment.amount, paid_on: payment.paid_on, sent_on: payment.sent_on, note: payment.note, payment_type: payment.payment_type, reference_number: payment.reference_number, invoice_id: payment.invoice_id }
    setBusy(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not signed in')

      // 1. The credit note reverses the mark; the RPC behind it takes the payments off the bill.
      const { data: rev, error: revErr } = await supabase.functions.invoke('reverse-stripe-invoice-out-of-band-payment', {
        headers: { Authorization: `Bearer ${token}` },
        body: { jobs_ledger_invoice_id: heldBill.id, reason: why, ...stripeModeInvokeBody(stripeModeForBilling) },
      })
      if (revErr) {
        const detail = await readEdgeFunctionErrorBody(revErr)
        throw new Error(detail ?? (revErr instanceof Error ? revErr.message : 'Could not reverse the Stripe mark'))
      }
      const revPayload = rev as { error?: string; warning?: string } | null
      if (revPayload && typeof revPayload === 'object' && typeof revPayload.error === 'string' && revPayload.error) {
        throw new Error(revPayload.warning ? `${revPayload.error} (${revPayload.warning})` : revPayload.error)
      }

      // 2. The bill goes back; the job is Ready to Bill for a fresh one.
      const back = await sendBackStripeBilledLine({ invoiceId: heldBill.id, jobId: fromJob.id, stripeModeForBilling, accessToken: token, reason: why })
      if (!back.ok) {
        setStopped(stripeHeldMoveStoppedWords('send_back', { ...stopArgs, message: back.message }))
        onMoved()
        return
      }

      // 3. The payment lands on the other job — its one open bill with room, else the job. On a
      // Stripe bill it is written the way Mark Paid would write it there (`heldLandingWrite`).
      const land = landing ?? (await readHeldLanding(dest.id, amount))
      let landedPaymentId: string | null = null
      /** A whole non-check payment on a Stripe bill: the bill is paid here, Stripe must close too. */
      let closeStripeAfter: string | null = null
      // The Stripe calls below carry no mode: the bill's own row decides it, as Accounts Receivable's close does.
      const oobBody = (invoiceId: string) => ({
        jobs_ledger_invoice_id: invoiceId,
        amount_dollars: amount,
        paid_on: paidOnYmd ?? todayYmdInAppTz(),
        payment_type: paymentType || 'Other',
        ...(referenceNumber ? { reference_number: referenceNumber } : {}),
        internal_note: `Moved from ${fromLabel}`,
      })
      const invokeOob = async (body: Record<string, unknown>): Promise<{ payment_id?: string }> => {
        const { data, error } = await supabase.functions.invoke('record-stripe-invoice-out-of-band-payment', { headers: { Authorization: `Bearer ${token}` }, body })
        if (error) {
          const detail = await readEdgeFunctionErrorBody(error)
          throw new Error(detail ?? (error instanceof Error ? error.message : 'Stripe did not answer'))
        }
        const payload = data as { error?: string; payment_id?: string } | null
        if (payload && typeof payload === 'object' && typeof payload.error === 'string' && payload.error) throw new Error(payload.error)
        return payload ?? {}
      }
      try {
        const write = land.kind === 'bill' ? heldLandingWrite(land, paymentType, amount) : null
        if (land.kind === 'bill' && write === 'stripe_part') {
          // Under the open balance on a Stripe bill: the credit note lowers the pay link and the function writes the row.
          const res = await invokeOob(oobBody(land.invoiceId))
          landedPaymentId = typeof res.payment_id === 'string' ? res.payment_id : null
        } else if (land.kind === 'bill') {
          const data = await withSupabaseRetry(
            async () =>
              supabase.rpc('mark_invoice_paid', {
                p_invoice_id: land.invoiceId,
                p_amount: amount,
                p_paid_on: paidOnYmd ?? undefined,
                p_note: (payment.note ?? '').trim() || undefined,
                p_payment_type: paymentType || undefined,
                p_reference_number: referenceNumber || undefined,
              }),
            'mark_invoice_paid · moved payment',
          )
          const result = data as { error?: string } | null
          if (result && typeof result === 'object' && result.error) throw new Error(result.error)
          const { data: newest } = await db.from('jobs_ledger_payments').select('id').eq('invoice_id', land.invoiceId).order('created_at', { ascending: false }).limit(1).maybeSingle()
          landedPaymentId = (newest as { id?: string } | null)?.id ?? null
          if (write === 'mark_paid_then_close') closeStripeAfter = land.invoiceId
        } else {
          const { data: last } = await db.from('jobs_ledger_payments').select('sequence_order').eq('job_id', dest.id).order('sequence_order', { ascending: false }).limit(1).maybeSingle()
          const next = Number((last as { sequence_order?: number | null } | null)?.sequence_order ?? -1) + 1
          const { data: inserted, error: insErr } = await db
            .from('jobs_ledger_payments')
            .insert({
              job_id: dest.id,
              amount,
              sequence_order: next,
              paid_on: payment.paid_on ? String(payment.paid_on).slice(0, 10) : null,
              sent_on: payment.sent_on ?? null,
              note: (payment.note ?? '').trim() || null,
              payment_type: (payment.payment_type ?? '').trim() || null,
              reference_number: (payment.reference_number ?? '').trim() || null,
            })
            .select('id')
            .single()
          if (insErr) throw insErr
          landedPaymentId = (inserted as { id?: string } | null)?.id ?? null
        }
      } catch (e) {
        setStopped(stripeHeldMoveStoppedWords('land', { ...stopArgs, message: formatPostgrestOrUnknownError(e, 'the write was refused') }))
        onMoved()
        return
      }

      // 3b. The bill reads Paid here; close its Stripe invoice too, so its pay link cannot be paid again.
      let closeError: string | null = null
      if (closeStripeAfter) {
        try {
          await invokeOob({ ...oobBody(closeStripeAfter), allow_app_paid: true })
        } catch (e) {
          closeError = e instanceof Error ? e.message : 'Stripe did not answer'
        }
      }

      // 4. The grey line on both jobs — the office's reason alone; the line names the job itself.
      const { error: evErr } = await db.from('jobs_ledger_payment_events').insert(
        heldMoveEventRow({ snapshot, fromJobId: fromJob.id, toJobId: dest.id, landedPaymentId, reason: paymentMoveReason(reason), actorUserId: authUser?.id ?? null, actorName: profileName }),
      )
      if (closeError) {
        setStopped(stripeHeldMoveStoppedWords('close', { ...stopArgs, message: closeError }))
        onMoved()
        return
      }
      if (evErr) showToast(stripeHeldMoveStoppedWords('trace', { ...stopArgs, message: evErr.message }), 'warning')
      showToast(stripeHeldMoveDoneWords(noun, fromLabel, toLabel), 'success')
      onMoved()
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : `Could not move the ${noun}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!payment || !dest) return
    if (held) {
      await confirmHeld()
      return
    }
    setBusy(true)
    try {
      const { data, error } = await db.rpc('move_jobs_ledger_payment', { p_payment_id: payment.id, p_to_job_id: dest.id, p_reason: paymentMoveReason(reason) })
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
  const heldSteps = held && fromJob
    ? stripeHeldMoveSteps({
        fromLabel: jobLabel(fromJob).split(' · ')[0] ?? 'this job',
        toLabel: dest ? (jobLabel(dest).split(' · ')[0] ?? 'that job') : 'the job you pick',
        amount: Number(payment.amount ?? 0),
        billAmount: Number(heldBill?.amount ?? 0),
        landing: dest ? landing : null,
        noun,
        paymentType: payment.payment_type,
        paidOnYmd: payment.paid_on ? String(payment.paid_on).slice(0, 10) : null,
        todayYmd: todayYmdInAppTz(),
      })
    : null

  if (stopped) {
    return (
      <div role="presentation" style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
        <div role="dialog" aria-modal="true" aria-label="The move stopped part way" style={card} onMouseDown={(e) => e.stopPropagation()}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>The move stopped part way</h3>
          <p data-testid="held-move-stopped" style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{stopped}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={blue}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div role="presentation" style={overlay} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Move this payment" style={card} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{held ? stripeHeldMoveTitle(noun) : 'Move this payment'}</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{amount}{payment.paid_on ? ` · ${payment.paid_on}` : ''}{(payment.reference_number ?? '').trim() ? ` · ref ${payment.reference_number}` : ''}</span>
        </div>
        {held ? (
          <p data-testid="held-move-intro" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {stripeHeldMoveIntro(noun, fromJob ? jobLabel(fromJob) : 'this job')}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            The payment keeps its date, amount, memo and bank-deposit link; it leaves {fromJob ? jobLabel(fromJob) : 'this job'} and lands on the job you pick, where it counts toward that job's balance from now on.
          </p>
        )}
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
        {heldSteps ? (
          <div data-testid="held-move-steps" style={{ border: '1px solid var(--border-blue)', borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--bg-blue-tint)' }}>
            <div style={label}>What happens, in order</div>
            <ol style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: '0.85rem', lineHeight: 1.5 }}>
              {heldSteps.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ol>
          </div>
        ) : null}
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
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={PAYMENT_MOVE_DEFAULT_REASON} aria-label="Reason" style={{ ...input, marginTop: 4 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} disabled={busy} style={ghost}>Cancel</button>
          <button type="button" onClick={() => void confirm()} disabled={!dest || busy} style={!dest || busy ? { ...blue, opacity: 0.55, cursor: 'not-allowed' } : blue}>
            {busy ? (held ? 'Reversing and moving…' : 'Moving…') : dest ? `Move ${amount} to ${jobLabel(dest).split(' · ')[0]}` : 'Pick a job'}
          </button>
        </div>
      </div>
    </div>
  )
}
