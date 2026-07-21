import { useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import type { JobWithDetails } from '../../types/jobWithDetails'
import {
  hazmatIncidentRowToDraft,
  hazmatNoticeJobInfoFromJob,
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
 * "Riders" strip in the Edit Job billing section: one line per hazmat incident
 * (the fee's line-item representation — the invoice row alone reads as an
 * anonymous draft). Re-opens the printable notice from the persisted incident
 * and downloads its PDF twin — the wizard used to be the only place the notice
 * existed, and only until it closed.
 */
export function JobFormHazmatRidersStrip({
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
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)', marginBottom: '0.35rem' }}>
        Riders
      </div>
      <div style={{ display: 'grid', gap: '0.35rem' }}>
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
            <div
              key={row.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.6rem',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-subtle)',
                fontSize: '0.8125rem',
              }}
            >
              <span aria-hidden style={{ color: 'var(--text-red-600)', fontWeight: 700 }}>☣</span>
              <span style={{ fontWeight: 600, color: 'var(--text-800)' }}>
                Biohazard remediation fee — incident {incidentDay}
              </span>
              <span style={{ color: 'var(--text-700)' }}>${formatCurrency(Number(row.fee_amount))}</span>
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
              <span style={{ flex: 1 }} />
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
