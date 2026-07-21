import { Fragment, type CSSProperties, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToastContext } from '../../contexts/ToastContext'
import { useBillCustomerModal } from '../../contexts/BillCustomerModalContext'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { JobsLedgerInvoiceRow, PaymentRow } from '../../lib/jobs/jobFormTypes'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { invoiceCreatedCalendarDayOffset } from '../../lib/invoiceCreatedRelative'
import { jobLedgerHasCustomerForBilling } from '../../lib/jobLedgerCustomerForBilling'
import { fetchJobWithDetailsById } from '../../lib/fetchJobWithDetailsById'
import { setReturnEditJobFromStages } from '../../lib/returnEditJobFromStages'
import type { JobBillingContext } from '../../lib/jobBillingContext'
import type { InvoiceWithJobForBillView } from './BilledBillViewModal'
import { StripeInvoiceSharePanel } from './StripeInvoiceSharePanel'

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
}: JobFormInvoiceListProps) {
  const navigate = useNavigate()
  const { showToast } = useToastContext()
  const billCustomer = useBillCustomerModal()
  const invoices = editing.invoices ?? []
  if (!invoices.some((i) => i.status === 'ready_to_bill' || i.status === 'billed')) return null

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
                                  payload: { kind: 'invoice', job: ctx, invoice: { id: inv.id, amount: inv.amount, status: inv.status } },
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
                          <button
                            type="button"
                            onClick={() => {
                              if (editing?.id && isDraft) setReturnEditJobFromStages(editing.id)
                              onClose()
                              navigate(`/jobs?tab=stages&stagesInvoice=${encodeURIComponent(inv.id)}`)
                            }}
                            title="Go to this invoice row on Stages"
                            // Same green as the Stages board's invoice jump chips this lands on.
                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.75rem', background: '#16a34a', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#ffffff', fontWeight: 600 }}
                          >
                            See in Stages
                          </button>
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
    </div>
  )
}
