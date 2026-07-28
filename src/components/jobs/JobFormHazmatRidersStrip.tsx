import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useToastContext } from '../../contexts/ToastContext'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  hazmatIncidentRowToDraft,
  hazmatNoticeJobInfoFromJob,
  hazmatNoticePublicUrl,
  type JobHazmatIncidentRow,
} from '../../lib/hazmatIncidents'
import { buildHazmatFeeNoticeHtml } from '../../lib/jobsDocuments/hazmatFeeNotice'
import {
  buildHazmatFeeNoticePdfBlob,
  hazmatNoticePdfFilename,
} from '../../lib/jobsDocuments/hazmatFeeNoticePdf'
import { formatCurrency } from '../../lib/jobs/jobFormMoney'
import { formatWorkDateYmdMonthDayShort } from '../../utils/dateUtils'
import { sendHazmatNoticeEmailToCustomer } from '../../lib/sendHazmatNoticeEmail'
import { useAuth } from '../../hooks/useAuth'
import {
  deleteHazmatFeeIncident,
  hazmatFeeMutationBlocker,
  hazmatFeeRemovalCapability,
  voidHazmatFeeIncident,
} from '../../lib/hazmatFeeEdit'
import { HazmatFeeEditDialog } from './HazmatFeeEditDialog'
import ConfirmDialog from '../ConfirmDialog'

/**
 * Rider rows for the ① Line Items table (v2.1029 — previously a standalone
 * "Riders" strip down in the ② Invoices area): one read-only, red-tinted table
 * row per hazmat incident, in the fixtures table's column rhythm — description
 * + status pill under "Line Item", the fee right-aligned under "Unit price" —
 * so riders visibly add to the Job Total. Fees are evidence-backed and change
 * only through the wizard, hence no edit affordances. The notice actions
 * (open/download/email/copy) sit on a quiet second line in the description
 * cell. Renders `<tr>`s — mount inside the fixtures `<tbody>` via
 * JobFormFixturesSection's `riderRows` slot.
 */
export function JobFormHazmatRiderRows({
  job,
  incidents,
  onChanged,
}: {
  job: JobWithDetails
  incidents: JobHazmatIncidentRow[]
  /** Re-fetch incidents after an edit/void/delete (v2.1038). */
  onChanged?: () => void
}) {
  const { showToast } = useToastContext()
  const { role } = useAuth()
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const [emailBusyId, setEmailBusyId] = useState<string | null>(null)
  const [editIncident, setEditIncident] = useState<JobHazmatIncidentRow | null>(null)
  const [confirmRemoval, setConfirmRemoval] = useState<{ kind: 'void' | 'delete'; row: JobHazmatIncidentRow } | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<JobHazmatIncidentRow | null>(null)
  const [removalBusy, setRemovalBusy] = useState(false)
  const removalCapability = hazmatFeeRemovalCapability(role)

  const runRemoval = async () => {
    if (!confirmRemoval || removalBusy) return
    setRemovalBusy(true)
    try {
      const res =
        confirmRemoval.kind === 'delete'
          ? await deleteHazmatFeeIncident(confirmRemoval.row.id)
          : await voidHazmatFeeIncident(confirmRemoval.row.id)
      if (!res.ok) {
        showToast(res.error ?? 'Could not update the fee', 'error')
        return
      }
      showToast(confirmRemoval.kind === 'delete' ? 'Hazmat fee deleted.' : 'Hazmat fee voided.', 'success')
      setConfirmRemoval(null)
      onChanged?.()
    } finally {
      setRemovalBusy(false)
    }
  }

  if (incidents.length === 0) return null

  const invoiceById = new Map((job.invoices ?? []).map((inv) => [inv.id, inv]))
  const jobInfo = hazmatNoticeJobInfoFromJob(job)

  const openNotice = (row: JobHazmatIncidentRow) => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(buildHazmatFeeNoticeHtml(jobInfo, hazmatIncidentRowToDraft(row)))
    w.document.close()
  }

  const downloadPdf = async (row: JobHazmatIncidentRow) => {
    setPdfBusyId(row.id)
    try {
      const blob = await buildHazmatFeeNoticePdfBlob(jobInfo, hazmatIncidentRowToDraft(row))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = hazmatNoticePdfFilename(jobInfo)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch {
      showToast('Could not build the notice PDF. Try again.', 'error')
    } finally {
      setPdfBusyId(null)
    }
  }

  const customerEmail = (job.customer_email ?? '').trim()

  const emailNotice = async (row: JobHazmatIncidentRow) => {
    setConfirmEmail(null)
    setEmailBusyId(row.id)
    try {
      const res = await sendHazmatNoticeEmailToCustomer({
        jobId: job.id,
        incident: row,
        jobInfo,
        customerEmail,
      })
      if (res.ok) {
        showToast(`Notice emailed to ${customerEmail}.`, 'success')
        onChanged?.()
      } else {
        showToast(res.error ?? 'Notice email failed', 'error')
      }
    } finally {
      setEmailBusyId(null)
    }
  }

  const smallBtn = {
    flex: '1 1 0',
    textAlign: 'center',
    padding: '0.3rem 0.45rem',
    fontSize: '0.75rem',
    border: '1px solid var(--border-strong)',
    borderRadius: 4,
    background: 'var(--surface)',
    color: 'var(--text-700)',
    cursor: 'pointer',
    fontWeight: 500,
  } as const

  return (
    <>
      <tr>
        <td
          colSpan={3}
          style={{ padding: '0.6rem 0.75rem 0.2rem', fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-muted)' }}
        >
          RIDERS
        </td>
      </tr>
      {incidents.map((row) => {
          const inv = row.invoice_id ? invoiceById.get(row.invoice_id) : undefined
          // v2.1031: an unlinked incident is a job-total fee — it rides in the
          // Job Total and links itself to the next bill that goes out.
          const invoiceState = row.voided_at
            ? 'Voided'
            : !row.invoice_id
            ? 'In job total'
            : inv
              ? inv.status === 'ready_to_bill'
                ? 'Draft'
                : inv.status === 'billed'
                  ? 'Billed'
                  : inv.status === 'paid'
                    ? 'Paid'
                    : inv.status
              : 'Invoice removed'
          const incidentDay = formatWorkDateYmdMonthDayShort(String(row.incident_at).slice(0, 10))
          return (
            <tr key={row.id} style={{ background: row.voided_at ? 'var(--bg-subtle)' : 'var(--bg-red-tint)', opacity: row.voided_at ? 0.75 : 1 }}>
              {/* One full-width cell (v2.1032): the title owns the whole line so it
                  never wraps on desktop, the fee right-aligns beside it, and the
                  notice actions stretch across the section below. */}
              <td colSpan={3} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
              {/* Icon lives INSIDE the title span so the pair never wraps apart. */}
              <span style={{ fontWeight: 600, color: 'var(--text-800)' }}>
                <span aria-hidden style={{ color: 'var(--text-red-600)', fontWeight: 700, fontSize: '1.15em', lineHeight: 1, marginRight: '0.4rem', verticalAlign: '-0.05em' }}>☣</span>
                Biohazard remediation fee — incident {incidentDay}
              </span>
              <span
                style={{
                  padding: '0.05rem 0.4rem',
                  borderRadius: 999,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  background: invoiceState === 'Voided' ? 'var(--bg-subtle)' : invoiceState === 'Draft' || invoiceState === 'In job total' ? 'var(--bg-amber-tint)' : 'var(--bg-blue-tint)',
                  color: invoiceState === 'Voided' ? 'var(--text-muted)' : invoiceState === 'Draft' || invoiceState === 'In job total' ? 'var(--text-amber-800)' : 'var(--text-blue-800)',
                }}
              >
                {invoiceState}
              </span>
              {!row.voided_at ? (
                <span
                  style={{
                    padding: '0.05rem 0.4rem',
                    borderRadius: 999,
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    background: row.notice_emailed_at ? 'var(--bg-green-tint)' : 'var(--bg-amber-tint)',
                    color: row.notice_emailed_at ? 'var(--text-green-800)' : 'var(--text-amber-800)',
                  }}
                  title={
                    row.notice_emailed_at
                      ? `Notice emailed to ${row.notice_emailed_to ?? 'the customer'}`
                      : 'The Biohazard Fee Notice email has not been sent for this fee yet'
                  }
                >
                  {row.notice_emailed_at
                    ? `Notice emailed ${formatWorkDateYmdMonthDayShort(String(row.notice_emailed_at).slice(0, 10))}`
                    : 'Notice not emailed'}
                </span>
              ) : null}
              <span style={{ flex: 1 }} />
              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                ${formatCurrency(Number(row.fee_amount))}
              </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
              {(() => {
                const gateInvoice = inv
                  ? {
                      status: inv.status ?? null,
                      stripe_invoice_id: (inv as { stripe_invoice_id?: string | null }).stripe_invoice_id ?? null,
                      sent_to_customer_at: (inv as { sent_to_customer_at?: string | null }).sent_to_customer_at ?? null,
                      external_send_channel: (inv as { external_send_channel?: string | null }).external_send_channel ?? null,
                    }
                  : null
                const blocker = hazmatFeeMutationBlocker(row, gateInvoice)
                return (
                  <>
                    <button
                      type="button"
                      disabled={!!blocker}
                      onClick={() => setEditIncident(row)}
                      style={{ ...smallBtn, cursor: blocker ? 'not-allowed' : 'pointer', opacity: blocker ? 0.55 : 1 }}
                      title={blocker ?? 'Edit the fee amount, description, photos, or testimonials'}
                    >
                      Edit…
                    </button>
                    {!row.voided_at && removalCapability ? (
                      <button
                        type="button"
                        disabled={!!blocker}
                        onClick={() => setConfirmRemoval({ kind: 'void', row })}
                        style={{ ...smallBtn, cursor: blocker ? 'not-allowed' : 'pointer', opacity: blocker ? 0.55 : 1 }}
                        title={blocker ?? 'Void the fee: keep the record, remove the charge'}
                      >
                        Void…
                      </button>
                    ) : null}
                    {removalCapability === 'delete' ? (
                      <button
                        type="button"
                        disabled={!row.voided_at && !!blocker}
                        onClick={() => setConfirmRemoval({ kind: 'delete', row })}
                        style={{ ...smallBtn, color: 'var(--text-red-700)', cursor: !row.voided_at && blocker ? 'not-allowed' : 'pointer', opacity: !row.voided_at && blocker ? 0.55 : 1 }}
                        title={(!row.voided_at && blocker) || 'Delete the incident entirely (restorable from Recently deleted)'}
                      >
                        Delete…
                      </button>
                    ) : null}
                  </>
                )
              })()}
              <button type="button" onClick={() => openNotice(row)} style={smallBtn} title="Open the printable Biohazard Remediation Fee Notice">
                Open notice
              </button>
              <button
                type="button"
                disabled={pdfBusyId === row.id}
                onClick={() => void downloadPdf(row)}
                style={{ ...smallBtn, cursor: pdfBusyId === row.id ? 'wait' : 'pointer' }}
                title="Download the notice as a PDF"
              >
                {pdfBusyId === row.id ? 'Building…' : 'Download PDF'}
              </button>
              <button
                type="button"
                disabled={emailBusyId === row.id}
                onClick={() => {
                  if (!customerEmail) {
                    showToast('Job has no customer email; add it on Edit Job first.', 'error')
                    return
                  }
                  setConfirmEmail(row)
                }}
                style={{ ...smallBtn, cursor: emailBusyId === row.id ? 'wait' : 'pointer' }}
                title={
                  customerEmail
                    ? row.notice_emailed_at
                      ? `Send the notice PDF to ${customerEmail} again`
                      : `Email the notice PDF to ${customerEmail}`
                    : 'Job has no customer email'
                }
              >
                {emailBusyId === row.id ? 'Sending…' : row.notice_emailed_at ? 'Re-email notice…' : 'Email notice…'}
              </button>
              {row.public_token ? (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(hazmatNoticePublicUrl(row.public_token))
                      .then(() => showToast('Public notice link copied.', 'success'))
                      .catch(() => showToast('Could not copy the link.', 'error'))
                  }}
                  style={smallBtn}
                  title="Copy the public notice link (what the Stripe invoice footer carries)"
                >
                  Copy link
                </button>
              ) : null}
                </div>
              </td>
            </tr>
          )
        })}
      {editIncident
        ? createPortal(
            <HazmatFeeEditDialog
              incident={editIncident}
              onClose={() => setEditIncident(null)}
              onSaved={() => onChanged?.()}
            />,
            document.body,
          )
        : null}
      {confirmRemoval
        ? createPortal(
            <ConfirmDialog
              title={confirmRemoval.kind === 'delete' ? 'Delete this hazmat fee?' : 'Void this hazmat fee?'}
              body={
                confirmRemoval.kind === 'delete'
                  ? `The incident and its $${formatCurrency(Number(confirmRemoval.row.fee_amount))} fee are removed from the job entirely (restorable by a dev from Recently deleted). The Job Total and any open bill shrink by the fee.`
                  : `The $${formatCurrency(Number(confirmRemoval.row.fee_amount))} charge is removed from the Job Total and any open bill, but the incident record and notice stay for your files.`
              }
              confirmLabel={removalBusy ? 'Working…' : confirmRemoval.kind === 'delete' ? 'Delete fee' : 'Void fee'}
              cancelLabel="Cancel"
              onCancel={() => (removalBusy ? null : setConfirmRemoval(null))}
              onConfirm={() => void runRemoval()}
            />,
            document.body,
          )
        : null}
      {confirmEmail
        ? createPortal(
            <ConfirmDialog
              title="Email the fee notice?"
              body={`The Biohazard Remediation Fee Notice PDF goes to ${customerEmail}.${confirmEmail.notice_emailed_at ? ' It was already emailed once — this sends it again.' : ''}`}
              confirmLabel="Send email"
              cancelLabel="Cancel"
              onCancel={() => setConfirmEmail(null)}
              onConfirm={() => void emailNotice(confirmEmail)}
            />,
            document.body,
          )
        : null}
    </>
  )
}
