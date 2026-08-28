import { Fragment, useState, type CSSProperties, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsLedgerInvoiceRow, PaymentRow } from '../../lib/jobs/jobFormTypes'
import { ensureRemainderResyncOutcome } from '../../lib/jobs/ensureRtbRemainderResult'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { invoiceCreatedCalendarDayOffset } from '../../lib/invoiceCreatedRelative'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { billToDisplayLabel, invoiceBillToFromRow } from '../../lib/jobs/invoiceBillTo'
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
}

/**
 * The unified "Invoices" table in the Edit-Job billing section — one list of the
 * job's drafts (ready_to_bill) and sent bills (billed) with a Status/Date/Amount/
 * Actions layout. Drafts get an inline "Send bill…"; billed rows keep view/share/
 * discount. Extracted verbatim from JobFormModal; self-sources its router/toast/
 * bill-customer hooks, takes the job + payments + a few setters as props.
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
  const invoices = editing.invoices ?? []
  if (!invoices.some((i) => i.status === 'ready_to_bill' || i.status === 'billed')) return null

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

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse', fontSize: '0.875rem', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '15%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '47%' }} />
          </colgroup>
          <thead style={{ background: 'var(--bg-subtle)' }}>
            <tr>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Date</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Amount</th>
              <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...invoices]
              .filter((i) => i.status === 'ready_to_bill' || i.status === 'billed')
              .sort((a, b) => (a.status === 'ready_to_bill' ? 0 : 1) - (b.status === 'ready_to_bill' ? 0 : 1))
              .map((inv, idx, arr) => {
                const isDraft = inv.status === 'ready_to_bill'
                const sent =
                  inv.sent_to_customer_at != null && String(inv.sent_to_customer_at).trim()
                    ? String(inv.sent_to_customer_at).slice(0, 10)
                    : '—'
                const hasStripeShare =
                  (inv.stripe_invoice_id ?? '').trim().length > 0 && (inv.hosted_invoice_url ?? '').trim().length > 0
                const createdDayOffset = invoiceCreatedCalendarDayOffset(inv.created_at)
                const noteLine = (inv.external_send_note ?? '').trim()
                const memoLine = (inv.stripe_invoice_memo ?? '').trim()
                const footerLine = (inv.stripe_invoice_footer ?? '').trim()
                // Drafts show their memo too: riders (hazmat fee, trip charge) pre-set it,
                // and it is the only thing distinguishing them from an ordinary draft.
                const hasDetailLine = isDraft ? Boolean(memoLine) : Boolean(noteLine || memoLine || footerLine)
                const isHazmatRider = hazmatInvoiceIds?.has(inv.id) ?? false
                const billTo = invoiceBillToFromRow(inv)
                const rowSep = idx < arr.length - 1 ? '1px solid var(--border)' : 'none'
                const parentCellPad = hasDetailLine ? '0.5rem 0.75rem 0.1rem' : '0.5rem 0.75rem'
                const paidOnInv = payments.filter((p) => p.invoice_id === inv.id).reduce((s, p) => s + (Number(p.amount) || 0), 0)
                const writeDownRoom = Number(inv.amount ?? 0) - paidOnInv
                const btnGray: CSSProperties = { padding: '0.15rem 0.45rem', fontSize: '0.75rem', background: 'var(--bg-200)', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 500 }
                const dateText = isDraft
                  ? 'not sent'
                  : sent === '—'
                    ? '—'
                    : createdDayOffset !== null
                      ? `${formatWorkDateYmdMonthDayShort(sent)} (+${createdDayOffset})`
                      : formatWorkDateYmdMonthDayShort(sent)
                return (
                  <Fragment key={inv.id}>
                    <tr style={{ borderBottom: hasDetailLine ? 'none' : rowSep }}>
                      <td style={{ padding: parentCellPad, verticalAlign: 'top' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.05rem 0.4rem',
                            borderRadius: 999,
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            background: isDraft ? 'var(--bg-amber-tint)' : 'var(--bg-blue-tint)',
                            color: isDraft ? 'var(--text-amber-800)' : 'var(--text-blue-800)',
                          }}
                        >
                          {isDraft ? 'Draft' : 'Billed'}
                        </span>
                        {isHazmatRider ? (
                          <span
                            title="Hazmat rider — biohazard remediation fee (see Riders above)"
                            style={{
                              display: 'inline-block',
                              marginLeft: '0.3rem',
                              padding: '0.05rem 0.4rem',
                              borderRadius: 999,
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: 'var(--bg-red-tint)',
                              color: 'var(--text-red-600)',
                              border: '1px solid #dc2626',
                            }}
                          >
                            ☣ Hazmat
                          </span>
                        ) : null}
                        {billTo ? (
                          <span
                            title={`This invoice bills ${billToDisplayLabel(billTo)} — not the job customer${editing.customer_name ? ` (${editing.customer_name})` : ''}.`}
                            style={{
                              display: 'inline-block',
                              marginTop: '0.2rem',
                              padding: '0.05rem 0.4rem',
                              borderRadius: 999,
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              background: 'var(--bg-amber-tint)',
                              color: 'var(--text-amber-800)',
                              border: '1px solid var(--border-strong)',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              verticalAlign: 'bottom',
                            }}
                          >
                            → {billTo.name ?? billTo.email}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: parentCellPad, verticalAlign: 'top', wordBreak: 'break-word', color: isDraft ? 'var(--text-muted)' : undefined }}>{dateText}</td>
                      <td style={{ padding: parentCellPad, textAlign: 'right', verticalAlign: 'top' }}>${formatCurrency(Number(inv.amount ?? 0))}</td>
                      <td style={{ padding: parentCellPad, verticalAlign: 'top', textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                          {isDraft ? (
                            <button
                              type="button"
                              onClick={() => {
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
                                })
                              }}
                              style={{ padding: '0.15rem 0.55rem', fontSize: '0.75rem', background: '#2563eb', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#ffffff', fontWeight: 600 }}
                            >
                              Send bill…
                            </button>
                          ) : null}
                          {isDraft ? (
                            <button
                              type="button"
                              onClick={() => onEditBillTo(inv)}
                              title={
                                billTo
                                  ? `Billed to ${billToDisplayLabel(billTo)} — change or remove`
                                  : 'Bill this invoice to someone other than the job customer (e.g. a tenant)'
                              }
                              style={btnGray}
                            >
                              Bill to…
                            </button>
                          ) : null}
                          {!isDraft && hasStripeShare ? (
                            <button type="button" onClick={() => { if (!editing) return; setBillViewInvoice({ ...inv, job: editing }) }} style={btnGray}>Bill</button>
                          ) : null}
                          {!isDraft && hasStripeShare ? (
                            <StripeInvoiceSharePanel
                              hostedInvoiceUrl={inv.hosted_invoice_url!.trim()}
                              stripeInvoiceId={(inv.stripe_invoice_id ?? '').trim()}
                              customerEmail={editing.customer_email}
                              customerName={editing.customer_name}
                              jobName={editing.job_name}
                              hcpNumber={editing.hcp_number}
                              amountLabel={`$${formatCurrency(Number(inv.amount ?? 0))}`}
                              compact
                              paymentLinkActionsAsIcons
                              omitPaymentLinksLabel
                              unboxed
                              inlineRow
                              omitCustomerPayPage
                              omitOpenInStripe
                            />
                          ) : null}
                          {!isDraft && canApplyAgreedWriteDown ? (
                            <button
                              type="button"
                              disabled={writeDownRoom <= 0.005}
                              title={
                                writeDownRoom <= 0.005
                                  ? 'No room for a discount (billed amount equals payments on this line).'
                                  : 'Lower billed amount (agreed discount; Stripe uses a credit note).'
                              }
                              onClick={() => setAgreedWriteDownInvoice(inv)}
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem', borderRadius: 4, border: 'none', fontWeight: 600, cursor: writeDownRoom <= 0.005 ? 'not-allowed' : 'pointer', background: writeDownRoom <= 0.005 ? '#93c5fd' : '#2563eb', color: '#ffffff', opacity: writeDownRoom <= 0.005 ? 0.85 : 1 }}
                            >
                              Add discount
                            </button>
                          ) : null}
                          {!isDraft && !inv.stripe_invoice_id && inv.external_send_channel !== 'stripe' && inv.status === 'billed' ? (
                            (() => {
                              // v2.2045: one button turns a non-Stripe bill into a hosted
                              // Stripe invoice — billed date preserved by construction.
                              const elig = convertToStripeEligibility(inv, payments, editing)
                              return (
                                <button
                                  type="button"
                                  disabled={!elig.ok}
                                  title={
                                    elig.ok
                                      ? 'Create the hosted Stripe invoice for this bill — pay link, card payment. Billed date stays put; nothing is emailed.'
                                      : elig.reason
                                  }
                                  onClick={() => setConvertInvoice(inv)}
                                  style={{ padding: '0.15rem 0.55rem', fontSize: '0.75rem', background: '#635bff', border: 'none', borderRadius: 4, cursor: elig.ok ? 'pointer' : 'not-allowed', color: '#ffffff', fontWeight: 600, opacity: elig.ok ? 1 : 0.55 }}
                                >
                                  ⚡ Make Stripe bill
                                </button>
                              )
                            })()
                          ) : null}
                          {!isDraft ? (
                            (() => {
                              const blocked = sendBackBlockedByPayments(inv.id, payments)
                              return (
                                <button
                                  type="button"
                                  disabled={blocked}
                                  title={
                                    blocked
                                      ? 'Payments are applied to this bill — unlink them first (Payments received below).'
                                      : 'Remove this bill and return its amount to unbilled. A Stripe payment link is voided so the customer cannot pay it.'
                                  }
                                  onClick={() => {
                                    setSendBackAcknowledged(false)
                                    setConfirmSendBackInvoice(inv)
                                  }}
                                  style={{ ...btnGray, cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.6 : 1 }}
                                >
                                  Send back
                                </button>
                              )
                            })()
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              if (editing?.id && isDraft) setReturnEditJobFromStages(editing.id)
                              onClose()
                              navigate(`/jobs?tab=stages&stagesInvoice=${encodeURIComponent(inv.id)}`)
                            }}
                            title="Go to this invoice row on Pipeline"
                            // Same green as the Stages board's invoice jump chips this lands on.
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem', background: '#16a34a', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#ffffff', fontWeight: 600 }}
                          >
                            See in Pipeline
                          </button>
                          {isDraft && inv.is_primary_rtb_bundle ? (
                            // The auto-maintained remainder bundle has no delete ✕ on
                            // purpose — say so instead of leaving a silent gap (v2.1134).
                            <span
                              title="Auto-maintained remainder — the part of the job not on any other bill. It resizes as other bills change and can't be deleted while the job is Ready to Bill; send it, or bill the rest another way and it shrinks on its own."
                              style={{
                                fontSize: '0.6875rem',
                                fontWeight: 600,
                                color: 'var(--text-muted)',
                                background: 'var(--bg-subtle)',
                                border: '1px solid var(--border)',
                                borderRadius: 999,
                                padding: '0.05rem 0.5rem',
                                whiteSpace: 'nowrap',
                                cursor: 'help',
                              }}
                            >
                              auto
                            </span>
                          ) : null}
                          {isDraft && !inv.is_primary_rtb_bundle ? (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteInvoice(inv)}
                              title="Delete this draft invoice"
                              aria-label={`Delete draft invoice for $${formatCurrency(Number(inv.amount ?? 0))}`}
                              style={{
                                padding: '0.15rem 0.4rem',
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                lineHeight: 1,
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 4,
                                cursor: 'pointer',
                                color: 'var(--text-red-600)',
                              }}
                            >
                              ✕
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {hasDetailLine ? (
                      <tr style={{ borderBottom: rowSep }}>
                        <td colSpan={4} style={{ paddingTop: 0, paddingRight: '0.75rem', paddingBottom: '0.5rem', paddingLeft: '3.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-word', lineHeight: 1.35 }}>
                          {noteLine ? (<div style={{ marginBottom: memoLine || footerLine ? '0.15rem' : 0 }}><span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Note: </span>{noteLine}</div>) : null}
                          {memoLine ? (<div style={{ marginBottom: footerLine ? '0.15rem' : 0 }}><span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Memo: </span>{memoLine}</div>) : null}
                          {footerLine ? (<div><span style={{ fontWeight: 600, color: 'var(--text-600)' }}>Footer: </span>{footerLine}</div>) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
          </tbody>
        </table>
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
