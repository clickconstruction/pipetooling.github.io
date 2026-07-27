import { useState } from 'react'
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
}: {
  job: JobWithDetails
  incidents: JobHazmatIncidentRow[]
}) {
  const { showToast } = useToastContext()
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null)
  const [emailBusyId, setEmailBusyId] = useState<string | null>(null)

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
    if (!customerEmail) {
      showToast('Job has no customer email; add it on Edit Job first.', 'error')
      return
    }
    if (!window.confirm(`Email the Biohazard Remediation Fee Notice to ${customerEmail}?`)) return
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
      } else {
        showToast(res.error ?? 'Notice email failed', 'error')
      }
    } finally {
      setEmailBusyId(null)
    }
  }

  const smallBtn = {
    padding: '0.15rem 0.45rem',
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
          const invoiceState = inv
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
            <tr key={row.id} style={{ background: 'var(--bg-red-tint)' }}>
              <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem' }}>
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
                  background: invoiceState === 'Draft' ? 'var(--bg-amber-tint)' : 'var(--bg-blue-tint)',
                  color: invoiceState === 'Draft' ? 'var(--text-amber-800)' : 'var(--text-blue-800)',
                }}
              >
                {invoiceState}
              </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
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
                onClick={() => void emailNotice(row)}
                style={{ ...smallBtn, cursor: emailBusyId === row.id ? 'wait' : 'pointer' }}
                title={
                  customerEmail
                    ? `Email the notice PDF to ${customerEmail}`
                    : 'Job has no customer email'
                }
              >
                {emailBusyId === row.id ? 'Sending…' : 'Email notice…'}
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
              <td style={{ textAlign: 'center', borderBottom: '1px solid var(--border)', color: 'var(--text-faint)' }}>—</td>
              <td
                style={{
                  padding: '0.5rem 0.375rem 0.5rem 0.625rem',
                  textAlign: 'right',
                  verticalAlign: 'top',
                  borderBottom: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '0.875rem',
                  color: 'var(--text-700)',
                }}
              >
                ${formatCurrency(Number(row.fee_amount))}
              </td>
            </tr>
          )
        })}
    </>
  )
}
