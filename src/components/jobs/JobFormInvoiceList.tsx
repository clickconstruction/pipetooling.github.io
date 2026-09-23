import { attributeJobPayments } from '../../lib/jobs/paymentAttribution'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsLedgerInvoiceRow, PaymentRow } from '../../lib/jobs/jobFormTypes'
import { ensureRemainderResyncOutcome } from '../../lib/jobs/ensureRtbRemainderResult'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { billToDisplayLabel, invoiceBillToFromRow } from '../../lib/jobs/invoiceBillTo'
import { effectiveInvoiceParty, invoicePartyChip, type InvoiceBillToParty } from '../../lib/jobs/billToParty'
import { parseShownToParty, shownToChipText, type ShownToParty } from '../../lib/jobs/billVisibility'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { setReturnEditJobFromStages } from '../../lib/returnEditJobFromStages'
import { sendBackBlockedByPayments } from '../../lib/jobs/editJobInvoiceSendBack'
import {
  ensureLedgerInvoiceRemovedAfterStripeSendBack,
  invoiceNeedsStripeVoidForRevert,
  invokeVoidStripeInvoiceForRevert,
  stripeModeForBillingFromRole,
} from '../../lib/voidStripeInvoiceForRevert'
import { syncJobToReadyToBillIfNoBilledInvoicesRemain } from '../../lib/syncJobToReadyToBillIfNoBilledInvoicesRemain'
import { getAccessTokenForEdgeFunctions } from '../../lib/supabaseAccessTokenForEdge'
import { useAuth } from '../../hooks/useAuth'
import type { JobBillingContext } from '../../lib/jobBillingContext'
import type { InvoiceWithJobForBillView } from './BilledBillViewModal'
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'
import { convertToStripeEligibility } from '../../lib/jobs/convertBillToStripe'
import { ConvertBillToStripeModal } from './ConvertBillToStripeModal'
import { compareInvoiceLedgerRows, invoiceLedgerRow, invoiceLedgerTotals, type InvoiceLedgerState, ledgerDollars } from '../../lib/jobs/invoiceLedgerRow'
import { useJobBilledExpectedPay } from '../../hooks/useJobBilledExpectedPay'
import { invoiceRowMenuSide, type InvoiceRowMenuSide } from '../../lib/jobs/invoiceRowMenuSide'

type JobFormInvoiceListProps = {
  editing: JobWithDetails
  payments: PaymentRow[]
  canApplyAgreedWriteDown: boolean
  /** Invoice ids that are hazmat riders (from job_hazmat_incidents) — get a ☣ label. */
  hazmatInvoiceIds?: Set<string>
  onClose: () => void
  onSavedRef: RefObject<(() => void) | undefined>
  setEditing: (job: JobWithDetails) => void
  setBillViewInvoice: (inv: InvoiceWithJobForBillView) => void
  setAgreedWriteDownInvoice: (inv: JobsLedgerInvoiceRow) => void
  refreshEditingJobAndHydratePayments: (jobId: string) => void
  /**
   * After a draft is deleted, the shell clears any local fixture rows still
   * pointing at it (DB rows are released by ON DELETE SET NULL, but a later
   * save would otherwise reinsert the stale invoice_id → FK error). v2.1072.
   */
  onInvoiceDeleted: (invoiceId: string) => void
  /** Open the shell-owned Bill-to editor for a draft invoice (v2.1086). */
  onEditBillTo: (inv: JobsLedgerInvoiceRow) => void
  /** z-index for the delete-draft confirm overlay (above the Edit Job modal). */
  nestedOverlayZIndex: number
  /** Stage Plan (PR 2): "Draw 2 · Top-out" under the status chip, by the rows the invoice bills. */
  drawLabelByInvoiceId?: Record<string, string>
  /**
   * Discount line items (v2.3256): on a DRAFT row, "Add discount" adds a
   * discount row in ① Line Items (the discount prints on this and every bill
   * that carries its work). Billed rows keep the agreed write-down.
   */
  onAddDiscountLine?: () => void
  /** Discount tools (v2.3268): Bill Customer added a discount row — the form re-reads its line items from the DB. */
  onFixturesChangedOutside?: (jobId: string) => Promise<void>
  /**
   * v2.3692: Record payment on an open bill — the host opens the Record a
   * cash or check payment window for it (a Stripe bill is marked paid at
   * Stripe; a plain bill goes through mark_invoice_paid).
   */
  onRecordPayment?: (inv: JobsLedgerInvoiceRow) => void
}

/**
 * The "Invoices" list in the Edit-Job billing section (v2.3478): one row per
 * bill — drafts (ready_to_bill), open bills (billed) and paid bills — each
 * three lines: chip · amount · actions / who / money (`invoiceLedgerRow`).
 * The action follows the money: a draft gets Send bill…, an open Stripe bill
 * the Text · Copy link · Email cluster, a paid bill just View; everything rare
 * or destructive sits under ⋯. Layout is decided by a container query in
 * index.css (`.jobInvoiceLedger`), not the viewport. Self-sources its
 * router/toast/bill-customer hooks, takes the job + payments + a few setters
 * as props.
 */
export function JobFormInvoiceList({
  editing,
  payments,
  canApplyAgreedWriteDown,
  hazmatInvoiceIds,
  onClose,
  onSavedRef,
  setEditing,
  setBillViewInvoice,
  setAgreedWriteDownInvoice,
  refreshEditingJobAndHydratePayments,
  onInvoiceDeleted,
  onEditBillTo,
  nestedOverlayZIndex,
  drawLabelByInvoiceId,
  onAddDiscountLine,
  onFixturesChangedOutside,
  onRecordPayment,
}: JobFormInvoiceListProps) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const { role: authRole } = useAuth()
  const billCustomer = useBillCustomerModal()
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState<JobsLedgerInvoiceRow | null>(null)
  const [deletingDraft, setDeletingDraft] = useState(false)
  const [confirmSendBackInvoice, setConfirmSendBackInvoice] = useState<JobsLedgerInvoiceRow | null>(null)
  const [sendBackAcknowledged, setSendBackAcknowledged] = useState(false)
  const [sendingBack, setSendingBack] = useState(false)
  const [convertInvoice, setConvertInvoice] = useState<JobsLedgerInvoiceRow | null>(null)
  /** Who pays (v2.3345): the "Bill to ▾" menu open on one draft row. */
  const [billToMenuFor, setBillToMenuFor] = useState<string | null>(null)
  const [billToPartySaving, setBillToPartySaving] = useState<string | null>(null)
  /** Share this bill (v2.3376): saving who else sees one row (now a ⋯ section). */
  const [shownToSaving, setShownToSaving] = useState<string | null>(null)
  const jobParty = {
    bill_to_party: (editing as { bill_to_party?: string | null }).bill_to_party,
    gc_customer_id: editing.gc_customer_id ?? null,
    customer_id: editing.customer_id,
  }
  const gcDistinct = Boolean(editing.gc_customer_id) && editing.gc_customer_id !== editing.customer_id
  const gcName = (editing.gcCustomer?.name ?? '').trim() || null
  const invoices = editing.invoices ?? []
  /** ⋯ open on one row; the memo/footer fold open on any rows. */
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [detailOpenFor, setDetailOpenFor] = useState<Set<string>>(() => new Set())
  const ledgerRef = useRef<HTMLDivElement | null>(null)
  /**
   * The ⋯ sits at the left of its row, so the menu opens rightward from the
   * button's left edge; measured once per open so a button near the right
   * edge (a narrow phone) flips it to open leftward instead of clipping.
   */
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [menuSide, setMenuSide] = useState<InvoiceRowMenuSide>('left')
  useLayoutEffect(() => {
    if (!menuFor) return
    const panel = menuRef.current
    const anchor = panel?.parentElement
    if (!panel || !anchor) return
    const a = anchor.getBoundingClientRect()
    const bounds = ledgerRef.current?.getBoundingClientRect()
    const boundsLeft = bounds?.left ?? 0
    const boundsRight = bounds && bounds.width > 0 ? bounds.right : (typeof window !== 'undefined' ? window.innerWidth : 0)
    if (boundsRight <= 0) return
    setMenuSide(invoiceRowMenuSide({ anchorLeft: a.left, anchorRight: a.right, menuWidth: panel.offsetWidth, boundsLeft, boundsRight }))
  }, [menuFor])
  useEffect(() => {
    if (!menuFor) return
    const onDown = (e: MouseEvent) => {
      const t = e.target
      if (t instanceof Element && t.closest('[data-inv-menu]')) return
      setMenuFor(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuFor])
  const expectedFor = useJobBilledExpectedPay({ id: editing.id, customer_id: editing.customer_id })
  if (!invoices.some((i) => i.status === 'ready_to_bill' || i.status === 'billed' || i.status === 'paid')) return null

  /**
   * Pick the party a draft bills (v2.3345). Writes the explicit pick and
   * clears any typed "someone else" recipient (and its Stripe customer, so a
   * later re-add starts fresh) — the same clearing the bill-to editor does.
   */
  async function pickInvoiceParty(inv: JobsLedgerInvoiceRow, party: InvoiceBillToParty) {
    setBillToMenuFor(null)
    setBillToPartySaving(inv.id)
    try {
      const { error } = await supabase
        .from('jobs_ledger_invoices')
        .update({ bill_to_party: party, bill_to_name: null, bill_to_email: null, bill_to_phone: null, bill_to_stripe_customer_id: null })
        .eq('id', inv.id)
        .eq('status', 'ready_to_bill')
      if (error) throw error
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) setEditing(found)
      onSavedRef.current?.()
      showToast(party === 'gc' ? `This bill goes to ${gcName ?? 'the GC'}.` : `This bill goes to ${editing.customer_name ?? 'the customer'}.`, 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not change who this bill goes to', 'error')
    } finally {
      setBillToPartySaving(null)
    }
  }

  /** Share this bill (v2.3376): who else sees this bill on their statement — the non-paying party, or nobody. Any row, draft or sent. */
  async function pickShownTo(inv: JobsLedgerInvoiceRow, shownTo: ShownToParty | null) {
    setShownToSaving(inv.id)
    try {
      const { error } = await supabase.from('jobs_ledger_invoices').update({ shown_to_party: shownTo }).eq('id', inv.id)
      if (error) throw error
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) setEditing(found)
      onSavedRef.current?.()
      const who = shownTo === 'gc' ? (gcName ?? 'the GC') : (editing.customer_name ?? 'the customer')
      showToast(shownTo ? `${who} will see this bill on their statement.` : 'Only the payer sees this bill now.', 'success')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not change who sees this bill', 'error')
    } finally {
      setShownToSaving(null)
    }
  }

  async function deleteDraftInvoice(inv: JobsLedgerInvoiceRow) {
    setDeletingDraft(true)
    try {
      const data = await withSupabaseRetry(
        async () => await supabase.rpc('delete_ready_to_bill_invoice', { p_invoice_id: inv.id }),
        'delete_ready_to_bill_invoice',
      )
      const result = data as { ok?: boolean; deleted?: boolean; error?: string } | null
      if (!result?.ok) {
        showToast(result?.error ?? 'Failed to delete draft invoice', 'error')
        return
      }
      onInvoiceDeleted(inv.id)
      // v2.1134: every other invoice mutation re-syncs the primary remainder
      // bundle — deletes must too, or the auto remainder goes stale (job 813:
      // deleting two drafts left it at $2,859.20 with $11,891.18 unallocated).
      // "Nothing left to bill" is benign here (job fully billed by the rest).
      if (editing.status === 'ready_to_bill') {
        try {
          const ensureRaw = await withSupabaseRetry(
            async () => await supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', { p_job_id: editing.id }),
            'ensure RTB remainder after draft delete',
          )
          const outcome = ensureRemainderResyncOutcome(ensureRaw)
          if (!outcome.ok) {
            showToast(`Draft deleted, but the remainder bill did not re-sync: ${outcome.error}`, 'error')
          }
        } catch {
          showToast('Draft deleted, but the remainder bill did not re-sync — reopen Bill Customer to fix it.', 'error')
        }
      }
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) setEditing(found)
      onSavedRef.current?.()
      showToast('Draft invoice deleted', 'success')
      setConfirmDeleteInvoice(null)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to delete draft invoice', 'error')
    } finally {
      setDeletingDraft(false)
    }
  }

  /**
   * Send back an unpaid billed row from inside Edit Job (v2.1653) — the same
   * primitives as the Pipeline/Dashboard send-backs: void the Stripe invoice
   * when one backs the bill (kills the customer's payment link), else delete
   * the billed row via RPC; both server paths hard-block if any payment
   * references the invoice. Demotes the job to Ready to Bill when the last
   * billed row is gone, then refreshes the modal in place.
   */
  async function sendBackBilledInvoice(inv: JobsLedgerInvoiceRow) {
    setSendingBack(true)
    try {
      if (invoiceNeedsStripeVoidForRevert(inv)) {
        const token = await getAccessTokenForEdgeFunctions()
        if (!token) {
          showToast('Not signed in', 'error')
          return
        }
        const r = await invokeVoidStripeInvoiceForRevert({
          invoiceId: inv.id,
          stripeModeForBilling: stripeModeForBillingFromRole(authRole),
          accessToken: token,
        })
        if (!r.ok) {
          showToast(r.message, 'error')
          return
        }
        const cleaned = await ensureLedgerInvoiceRemovedAfterStripeSendBack(inv.id)
        if (!cleaned.ok) {
          showToast(cleaned.message, 'error')
          return
        }
      } else {
        const data = await withSupabaseRetry(
          async () => await supabase.rpc('delete_billed_invoice_on_send_back', { p_invoice_id: inv.id }),
          'delete_billed_invoice_on_send_back',
        )
        const result = data as { ok?: boolean; error?: string } | null
        if (!result?.ok) {
          showToast(result?.error ?? 'Failed to send back the bill', 'error')
          return
        }
      }
      const sync = await syncJobToReadyToBillIfNoBilledInvoicesRemain(supabase, editing.id)
      if (!sync.ok) {
        showToast(sync.message, 'error')
        return
      }
      onInvoiceDeleted(inv.id)
      const found = await fetchJobWithDetailsById(editing.id)
      if (found) setEditing(found)
      onSavedRef.current?.()
      showToast(
        `Bill sent back — $${formatCurrency(Number(inv.amount ?? 0))} returned to unbilled.`,
        'success',
      )
      setConfirmSendBackInvoice(null)
      setSendBackAcknowledged(false)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to send back the bill', 'error')
    } finally {
      setSendingBack(false)
    }
  }

  // v2.3592: what each bill has been paid follows the one rule (oldest bill first), so the row
  // agrees with the bill's own paper and the demand letter; `invPayments` stays the linked list the
  // server's send-back guard keys on.
  const attribution = attributeJobPayments(invoices, payments)
  const rows = invoices
    .map((inv) => {
      const invPayments = payments.filter((p) => p.invoice_id === inv.id)
      const appliedSlices = attribution.byBill.get(inv.id)?.slices ?? []
      const party = effectiveInvoiceParty(jobParty, inv)
      const billTo = invoiceBillToFromRow(inv)
      const billsTo = invoicePartyChip(party, {
        customer: editing.customer_name,
        gc: gcName,
        other: billTo ? billTo.name ?? billTo.email : null,
      })
      const sentIso = (inv.sent_to_customer_at ?? inv.billed_at ?? '').trim()
      const row = invoiceLedgerRow({
        status: inv.status,
        amount: Number(inv.amount ?? 0),
        sentYmd: sentIso ? sentIso.slice(0, 10) : null,
        payments: appliedSlices.map((s) => ({ amount: s.amount, paidOnYmd: s.payment.paid_on ? String(s.payment.paid_on).slice(0, 10) : null })),
        billsTo,
        drawLabel: drawLabelByInvoiceId?.[inv.id] ?? null,
        isAutoRemainder: inv.status === 'ready_to_bill' && Boolean(inv.is_primary_rtb_bundle),
        expected: inv.status === 'billed' ? expectedFor(inv) : null,
      })
      return row ? { inv, row, party, billTo, invPayments, sentYmd: row.state === 'draft' ? null : sentIso.slice(0, 10) || null } : null
    })
    .filter((r): r is NonNullable<typeof r> => r != null)
    .sort((a, b) => compareInvoiceLedgerRows({ state: a.row.state, sentYmd: a.sentYmd }, { state: b.row.state, sentYmd: b.sentYmd }))
  const listedIds = new Set(rows.map((r) => r.inv.id))
  // Money on no listed bill: unlinked surplus the sent bills did not need, plus payments linked to a bill not listed here.
  const unappliedPaid = attribution.surplus + payments.reduce((s, p) => (p.invoice_id && !listedIds.has(p.invoice_id) ? s + (Number(p.amount) || 0) : s), 0)
  const totals = invoiceLedgerTotals(rows.map((r) => r.row), unappliedPaid)

  function openBillCustomerForDraft(inv: JobsLedgerInvoiceRow) {
    if (!editing) return
    if (!jobLedgerHasCustomerForBilling(editing.customer_id)) {
      showToast('Link this job to a customer before billing.', 'error')
      return
    }
    const ctx: JobBillingContext = {
      id: editing.id,
      master_user_id: editing.master_user_id,
      hcp_number: editing.hcp_number,
      click_number: editing.click_number,
      job_name: editing.job_name,
      customer_id: editing.customer_id,
      customer_name: editing.customer_name,
      customer_email: editing.customer_email,
      job_address: editing.job_address,
      customer_phone: editing.customer_phone,
      last_work_date: editing.last_work_date,
    }
    billCustomer?.openBillCustomer({
      payload: {
        kind: 'invoice',
        job: ctx,
        // Memo + bundle flag drive the modal's standalone-charge
        // pre-fill (riders: hazmat fee, trip charge).
        invoice: {
          id: inv.id,
          amount: inv.amount,
          status: inv.status,
          stripe_invoice_memo: inv.stripe_invoice_memo ?? null,
          is_primary_rtb_bundle: inv.is_primary_rtb_bundle ?? null,
        },
      },
      onSuccess: async () => {
        onSavedRef.current?.()
        const found = await fetchJobWithDetailsById(editing.id)
        if (found) setEditing(found)
      },
      onAfterEnsureSuccess: async () => {
        const found = await fetchJobWithDetailsById(editing.id)
        if (found) setEditing(found)
      },
      onAfterOobUnwindSuccess: async () => {
        refreshEditingJobAndHydratePayments(editing.id)
      },
      onDiscountApplied: async () => {
        await onFixturesChangedOutside?.(editing.id)
      },
    })
  }

  function goToPipeline(inv: JobsLedgerInvoiceRow, isDraft: boolean) {
    if (editing?.id && isDraft) setReturnEditJobFromStages(editing.id)
    onClose()
    navigate(`/jobs?tab=stages&stagesInvoice=${encodeURIComponent(inv.id)}`)
  }

  const chipStyle = (state: InvoiceLedgerState): CSSProperties => ({
    display: 'inline-block',
    padding: '0.05rem 0.45rem',
    borderRadius: 999,
    fontSize: '0.6875rem',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    background: state === 'draft' ? 'var(--bg-amber-tint)' : state === 'paid' ? 'var(--bg-green-100)' : 'var(--bg-blue-tint)',
    color: state === 'draft' ? 'var(--text-amber-800)' : state === 'paid' ? 'var(--text-green-800)' : 'var(--text-blue-800)',
  })
  const btnGray: CSSProperties = { padding: '0.2rem 0.5rem', fontSize: '0.75rem', background: 'var(--bg-200)', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }
  const menuPanel: CSSProperties = { position: 'absolute', ...(menuSide === 'right' ? { right: 0 } : { left: 0 }), top: '100%', marginTop: 4, zIndex: 20, minWidth: 240, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 6, boxShadow: '0 6px 16px rgba(0, 0, 0, 0.12)', padding: '0.25rem', textAlign: 'left' }
  const menuItem = (opts: { on?: boolean; danger?: boolean; disabled?: boolean; top?: boolean }): CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '0.4rem 0.5rem',
    // Longhands only — a `border` shorthand next to `borderTop` leaves a stray
    // 1px top edge on every item (the React inline-style shorthand gotcha).
    borderWidth: 0,
    borderTopWidth: opts.top ? 1 : 0,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--border)',
    background: opts.on ? 'var(--bg-subtle)' : 'transparent',
    borderRadius: 4,
    cursor: opts.disabled ? 'not-allowed' : 'pointer',
    opacity: opts.disabled ? 0.55 : 1,
    fontSize: '0.8125rem',
    color: opts.danger ? 'var(--text-red-600)' : undefined,
  })
  const menuSection: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', padding: '0.3rem 0.5rem 0.15rem' }
  const menuSub = (text: string) => <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontSize: '0.75rem' }}>{text}</span>

  return (
    <div className="jobInvoiceLedger" ref={ledgerRef}>
      <div className="jobInvoiceLedgerHdr">
        <span>Bills</span>
        <span>Next</span>
      </div>
      {rows.map(({ inv, row, party, billTo }) => {
        const isDraft = row.state === 'draft'
        const isPaid = row.state === 'paid'
        const hasStripeShare = (inv.stripe_invoice_id ?? '').trim().length > 0 && (inv.hosted_invoice_url ?? '').trim().length > 0
        const noteLine = (inv.external_send_note ?? '').trim()
        const memoLine = (inv.stripe_invoice_memo ?? '').trim()
        const footerLine = (inv.stripe_invoice_footer ?? '').trim()
        // Drafts show their memo too: riders (hazmat fee, trip charge) pre-set it,
        // and it is the only thing distinguishing them from an ordinary draft.
        const hasDetailLine = isDraft ? Boolean(memoLine) : Boolean(noteLine || memoLine || footerLine)
        const detailOpen = detailOpenFor.has(inv.id)
        const isHazmatRider = hazmatInvoiceIds?.has(inv.id) ?? false
        const shownTo = parseShownToParty(inv.shown_to_party)
        const shareOptions: ShownToParty[] = party === 'customer' ? (gcDistinct ? ['gc'] : []) : party === 'gc' ? ['customer'] : gcDistinct ? ['customer', 'gc'] : []
        const shownToText = shownToChipText(shownTo, { customer: editing.customer_name, gc: gcName })
        const writeDownRoom = row.amount - row.paid
        const sendBackBlocked = !isDraft && sendBackBlockedByPayments(inv.id, payments)
        const convertElig = !isDraft && !inv.stripe_invoice_id && inv.external_send_channel !== 'stripe' && inv.status === 'billed' ? convertToStripeEligibility(inv, payments, editing) : null
        const menuOpen = menuFor === inv.id
        const menuId = `invoice-menu-${inv.id}`
        return (
          <div key={inv.id} className="jobInvoiceRow" data-testid="invoice-row" data-state={row.state}>
            <span style={chipStyle(row.state)}>{isDraft ? 'Draft' : isPaid ? 'Paid' : 'Billed'}</span>
            {isHazmatRider ? (
              <span
                title="Hazmat rider — biohazard remediation fee (see Riders above)"
                style={{ display: 'inline-block', padding: '0.05rem 0.4rem', borderRadius: 999, fontSize: '0.6875rem', fontWeight: 700, background: 'var(--bg-red-tint)', color: 'var(--text-red-600)', border: '1px solid #dc2626' }}
              >
                ☣ Hazmat
              </span>
            ) : null}
            <span className={`jobInvoiceAmt${isPaid ? ' soft' : ''}`}>${formatCurrency(row.amount)}</span>
            <span className="jobInvoiceSp" />

            {isDraft ? (
              <button type="button" className="jobInvoiceSend" onClick={() => openBillCustomerForDraft(inv)} style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: '#2563eb', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#ffffff', fontWeight: 600 }}>
                Send bill…
              </button>
            ) : null}
            {isDraft ? (
              <span style={{ position: 'relative', display: 'inline-block' }} className="jobInvoiceBillTo">
                <button
                  type="button"
                  onClick={() => setBillToMenuFor((prev) => (prev === inv.id ? null : inv.id))}
                  disabled={billToPartySaving === inv.id}
                  aria-haspopup="menu"
                  aria-expanded={billToMenuFor === inv.id}
                  title={billTo ? `Billed to ${billToDisplayLabel(billTo)} — change or remove` : 'Choose who this invoice bills — the customer, the GC, or someone else (e.g. a tenant)'}
                  style={btnGray}
                >
                  {billToPartySaving === inv.id ? 'Saving…' : 'Bill to ▾'}
                </button>
                {billToMenuFor === inv.id ? (
                  <div role="menu" style={{ ...menuPanel, minWidth: 220 }}>
                    {(
                      [
                        { key: 'customer' as const, label: editing.customer_name?.trim() || 'The job customer', sub: 'Customer', on: party === 'customer' },
                        ...(gcDistinct ? [{ key: 'gc' as const, label: gcName ?? 'The GC', sub: 'GC on this job', on: party === 'gc' }] : []),
                      ] as Array<{ key: InvoiceBillToParty; label: string; sub: string; on: boolean }>
                    ).map((opt) => (
                      <button key={opt.key} type="button" role="menuitemradio" aria-checked={opt.on} onClick={() => void pickInvoiceParty(inv, opt.key)} style={menuItem({ on: opt.on })}>
                        <span style={{ fontWeight: 600 }}>{opt.on ? '✓ ' : ''}{opt.label}</span>
                        {menuSub(opt.sub)}
                      </button>
                    ))}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setBillToMenuFor(null)
                        onEditBillTo(inv)
                      }}
                      style={menuItem({ on: party === 'other', top: true })}
                    >
                      <span style={{ fontWeight: 600 }}>{party === 'other' ? '✓ ' : ''}Someone else…</span>
                      {menuSub(billTo ? billTo.name ?? billTo.email : 'a tenant, a property manager')}
                    </button>
                  </div>
                ) : null}
              </span>
            ) : null}

            {!isDraft && !isPaid && hasStripeShare ? (
              <StripeInvoiceSharePanel
                hostedInvoiceUrl={inv.hosted_invoice_url!.trim()}
                stripeInvoiceId={(inv.stripe_invoice_id ?? '').trim()}
                customerEmail={editing.customer_email}
                customerName={editing.customer_name}
                jobName={editing.job_name}
                hcpNumber={editing.hcp_number}
                amountLabel={`$${formatCurrency(row.amount)}`}
                labeledCluster
                invoiceId={inv.id}
                billLabel={`Bill ${ledgerDollars(row.amount)}`}
              />
            ) : null}
            {!isDraft && hasStripeShare ? (
              <button type="button" className="jobInvoiceLink" onClick={() => { if (!editing) return; setBillViewInvoice({ ...inv, job: editing }) }} title="Open this bill">
                View
              </button>
            ) : null}

            {!isDraft && !isPaid && onRecordPayment ? (
              <button
                type="button"
                className="jobInvoiceRecord"
                data-testid="invoice-record-payment"
                onClick={() => onRecordPayment(inv)}
                title={hasStripeShare ? 'Record a cash or check payment on this bill. Stripe marks the bill paid too, so the pay link stops working.' : 'Record a cash or check payment on this bill.'}
              >
                Record payment
              </button>
            ) : null}
            <span style={{ position: 'relative', display: 'inline-block' }} data-inv-menu>
              <button
                type="button"
                className="jobInvoiceMore"
                data-testid="invoice-row-menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuOpen ? menuId : undefined}
                aria-label={`More for the $${formatCurrency(row.amount)} ${isDraft ? 'draft' : 'bill'}`}
                onClick={() => setMenuFor((prev) => (prev === inv.id ? null : inv.id))}
              >
                ⋯
              </button>
              {menuOpen ? (
                <div role="menu" id={menuId} ref={menuRef} style={menuPanel}>
                  <div style={menuSection}>This bill</div>
                  {!isDraft && !isPaid && onRecordPayment ? (
                    <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onRecordPayment(inv) }} title="Record a cash or check payment on this bill" style={menuItem({})}>
                      Record payment{menuSub('cash, check')}
                    </button>
                  ) : null}
                  {isDraft && onAddDiscountLine ? (
                    <button type="button" role="menuitem" onClick={() => { setMenuFor(null); onAddDiscountLine() }} title="Add a discount row in ① Line Items — it prints on this and every bill that carries the work it applies to" style={menuItem({})}>
                      Add discount{menuSub('line item')}
                    </button>
                  ) : null}
                  {!isDraft && !isPaid && canApplyAgreedWriteDown ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={writeDownRoom <= 0.005}
                      aria-disabled={writeDownRoom <= 0.005}
                      title={writeDownRoom <= 0.005 ? 'No room for a discount (billed amount equals payments on this line).' : 'Lower billed amount (agreed discount; Stripe uses a credit note).'}
                      onClick={() => { setMenuFor(null); setAgreedWriteDownInvoice(inv) }}
                      style={menuItem({ disabled: writeDownRoom <= 0.005 })}
                    >
                      Add discount{menuSub('credit note')}
                    </button>
                  ) : null}
                  {convertElig ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!convertElig.ok}
                      title={convertElig.ok ? 'Create the hosted Stripe invoice for this bill — pay link, card payment. Billed date stays put; nothing is emailed.' : convertElig.reason}
                      onClick={() => { setMenuFor(null); setConvertInvoice(inv) }}
                      style={menuItem({ disabled: !convertElig.ok })}
                    >
                      ⚡ Make Stripe bill{menuSub('pay link')}
                    </button>
                  ) : null}
                  <button type="button" role="menuitem" onClick={() => { setMenuFor(null); goToPipeline(inv, isDraft) }} title="Go to this invoice row on Pipeline" style={menuItem({})}>
                    See in Pipeline
                  </button>
                  {hasDetailLine ? (
                    <button
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={detailOpen}
                      onClick={() => {
                        setMenuFor(null)
                        setDetailOpenFor((prev) => {
                          const next = new Set(prev)
                          if (next.has(inv.id)) next.delete(inv.id)
                          else next.add(inv.id)
                          return next
                        })
                      }}
                      style={menuItem({ on: detailOpen })}
                    >
                      {detailOpen ? 'Hide ' : 'Show '}{isDraft ? 'memo' : noteLine ? 'note' : 'memo & footer'}
                    </button>
                  ) : null}

                  {shareOptions.length > 0 ? (
                    <>
                      <div style={{ ...menuSection, borderTop: '1px solid var(--border)', marginTop: 2, paddingTop: '0.4rem' }}>Who else sees this bill</div>
                      {shareOptions.map((opt) => {
                        const label = opt === 'gc' ? (gcName ?? 'The GC') : editing.customer_name?.trim() || 'The job customer'
                        const on = shownTo === opt
                        return (
                          <button key={opt} type="button" role="menuitemradio" aria-checked={on} data-testid="invoice-shown-to-option" disabled={shownToSaving === inv.id} onClick={() => { setMenuFor(null); void pickShownTo(inv, opt) }} style={menuItem({ on })}>
                            <span style={{ fontWeight: 600 }}>{on ? '✓ ' : ''}Shown on {label}’s statement</span>
                            {menuSub(opt === 'gc' ? 'the GC, not billed' : 'the customer, not billed')}
                          </button>
                        )
                      })}
                      <button type="button" role="menuitemradio" aria-checked={shownTo == null} data-testid="invoice-shown-to-option" disabled={shownToSaving === inv.id} onClick={() => { setMenuFor(null); void pickShownTo(inv, null) }} style={menuItem({ on: shownTo == null })}>
                        <span style={{ fontWeight: 600 }}>{shownTo == null ? '✓ ' : ''}Only the payer</span>
                        {menuSub('hide it from their statement')}
                      </button>
                      <div style={{ color: 'var(--text-faint)', fontSize: '0.7rem', padding: '0.2rem 0.5rem 0.3rem' }}>Changes their portal on its next open. Never changes who pays or who was emailed.</div>
                    </>
                  ) : null}

                  {isDraft && !inv.is_primary_rtb_bundle ? (
                    <button type="button" role="menuitem" aria-label={`Delete draft invoice for $${formatCurrency(row.amount)}`} onClick={() => { setMenuFor(null); setConfirmDeleteInvoice(inv) }} style={menuItem({ danger: true, top: true })}>
                      Delete draft
                    </button>
                  ) : null}
                  {!isDraft && !isPaid ? (
                    <button
                      type="button"
                      role="menuitem"
                      disabled={sendBackBlocked}
                      title={sendBackBlocked ? 'Payments are applied to this bill — unlink them first (Payments received below).' : 'Remove this bill and return its amount to unbilled. A Stripe payment link is voided so the customer cannot pay it.'}
                      onClick={() => { setMenuFor(null); setSendBackAcknowledged(false); setConfirmSendBackInvoice(inv) }}
                      style={menuItem({ danger: true, top: true, disabled: sendBackBlocked })}
                    >
                      Send back{menuSub(`unbills $${formatCurrency(row.amount)}`)}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </span>

            <div className="jobInvoiceWords">
              <span className="l1">
                {row.whoLine}
                {row.whoNote ? <span className="mut" data-testid="invoice-draw-label"> · {row.whoNote}</span> : null}
                {shownToText ? <span className="mut" data-testid="invoice-shown-to-chip"> · 👁 {shownToText.replace(/^👁\s*/, '')}</span> : null}
              </span>
              <span className="l2">
                <span className="keep">
                  <b>{row.moneyLead}</b>
                  {row.moneyDetail ? <span className={row.moneyTone === 'late' ? 'late' : 'mut'}>{row.moneyDetail}</span> : null}
                </span>
                {row.promise ? <span className="said">{row.promise}</span> : null}
              </span>
            </div>
            {hasDetailLine && detailOpen ? (
              <div className="jobInvoiceDetail">
                {noteLine ? (<div><b>Note: </b>{noteLine}</div>) : null}
                {memoLine ? (<div><b>Memo: </b>{memoLine}</div>) : null}
                {footerLine ? (<div><b>Footer: </b>{footerLine}</div>) : null}
              </div>
            ) : null}
          </div>
        )
      })}
      <div className="jobInvoiceSum" data-testid="invoice-sum">
        {totals.toBill > 0 ? <span>to bill <b>${formatCurrency(totals.toBill)}</b></span> : null}
        {totals.paid > 0 ? <span>paid <b>${formatCurrency(totals.paid)}</b></span> : null}
        <span>open <b>${formatCurrency(totals.open)}</b></span>
        {totals.paid > 0 ? <span>= billed <b>${formatCurrency(totals.billed)}</b></span> : null}
        {totals.unapplied > 0 ? <span title="Money received on this job that is not applied to any bill listed here">+ <b>${formatCurrency(totals.unapplied)}</b> on no bill</span> : null}
      </div>
      {confirmDeleteInvoice ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: nestedOverlayZIndex,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !deletingDraft) setConfirmDeleteInvoice(null)
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete draft invoice"
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.25rem',
              maxWidth: 400,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-strong)' }}>Delete draft invoice?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
              This deletes the <strong>${formatCurrency(Number(confirmDeleteInvoice.amount ?? 0))}</strong> draft. Nothing has
              been sent to the customer. Any line-item segments on this draft go back to unbilled.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteInvoice(null)}
                disabled={deletingDraft}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--bg-subtle)', color: 'var(--text-700)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteDraftInvoice(confirmDeleteInvoice)}
                disabled={deletingDraft}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', fontWeight: 600, background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 6, cursor: deletingDraft ? 'default' : 'pointer', opacity: deletingDraft ? 0.7 : 1 }}
              >
                {deletingDraft ? 'Deleting…' : 'Delete draft'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmSendBackInvoice ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: nestedOverlayZIndex,
            padding: '1rem',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !sendingBack) {
              setConfirmSendBackInvoice(null)
              setSendBackAcknowledged(false)
            }
          }}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Send bill back"
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: '1.25rem',
              maxWidth: 440,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-strong)' }}>Send this bill back?</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
              The <strong>${formatCurrency(Number(confirmSendBackInvoice.amount ?? 0))}</strong> bill is removed and its
              amount returns to unbilled. If it was the job&rsquo;s only sent bill, the job moves back to Ready to Bill.
            </div>
            {invoiceNeedsStripeVoidForRevert(confirmSendBackInvoice) ? (
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 6, padding: '0.5rem 0.7rem' }}>
                This bill was sent via Stripe — the customer&rsquo;s payment link will be voided and can no longer be
                paid. If Stripe already shows a payment on it, the send-back will fail until that is resolved in Stripe.
              </div>
            ) : null}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input
                type="checkbox"
                checked={sendBackAcknowledged}
                onChange={(e) => setSendBackAcknowledged(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                I understand the customer can no longer pay or reference this bill, and I&rsquo;ll send a corrected bill
                if one is still owed.
              </span>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setConfirmSendBackInvoice(null)
                  setSendBackAcknowledged(false)
                }}
                disabled={sendingBack}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.8125rem', background: 'var(--bg-subtle)', color: 'var(--text-700)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendBackBilledInvoice(confirmSendBackInvoice)}
                disabled={sendingBack || !sendBackAcknowledged}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  background: sendingBack || !sendBackAcknowledged ? '#9ca3af' : '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: sendingBack || !sendBackAcknowledged ? 'not-allowed' : 'pointer',
                }}
              >
                {sendingBack ? 'Sending back…' : 'Send back'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {convertInvoice ? (
        <ConvertBillToStripeModal
          invoice={convertInvoice}
          job={editing}
          zIndex={nestedOverlayZIndex}
          onClose={() => setConvertInvoice(null)}
          onConverted={() => {
            setConvertInvoice(null)
            void (async () => {
              const found = await fetchJobWithDetailsById(editing.id)
              if (found) setEditing(found)
              onSavedRef.current?.()
            })()
          }}
        />
      ) : null}
    </div>
  )
}
