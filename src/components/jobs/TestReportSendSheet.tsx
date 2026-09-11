import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { extractContactInfo } from '../../lib/bids/bidContactInfo'
import { parseEmailList, testReportSendBlockers, testReportShortLabel, type TestReportData, type TestReportJobInfo, type TestReportSettings } from '../../lib/jobs/testReport'
import { buildTestReportEmail } from '../../lib/jobs/testReportEmail'
import { sendTestReport } from '../../lib/jobs/sendTestReport'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { Json } from '../../types/database'

/**
 * The Send sheet (v2.3301) — what Taunya writes by hand today, prefilled: To
 * the GC on the job (else the customer), the settings' standing cc, the
 * subject, the body with the Stripe pay link, the PDF as the attachment.
 * "Bill first" when the job has no Stripe bill; sending without the link is a
 * deliberate second button.
 */
const label: CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', fontSize: '0.9rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit' }
const btn: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: 13, fontWeight: 600, cursor: 'pointer' }

export default function TestReportSendSheet({
  reportId,
  data,
  jobInfo,
  job,
  settings,
  payLink,
  previouslySentTo,
  onClose,
  onSent,
}: {
  reportId: string
  data: TestReportData
  jobInfo: TestReportJobInfo
  job: JobWithDetails
  settings: TestReportSettings
  payLink: { url: string; amount: number } | null
  previouslySentTo: string[]
  onClose: () => void
  onSent: () => void
}) {
  const { showToast } = useToastContext()
  const [gcEmail, setGcEmail] = useState<string | null>(null)
  const [gcLoading, setGcLoading] = useState(Boolean(job.gc_customer_id))
  const [to, setTo] = useState('')
  const [cc, setCc] = useState(settings.emailCc)
  const [includeLink, setIncludeLink] = useState(Boolean(payLink))
  const [bodyText, setBodyText] = useState('')
  const [bodyTouched, setBodyTouched] = useState(false)
  const [sending, setSending] = useState(false)

  // The GC's email lives on the customers row, not the job.
  useEffect(() => {
    let cancelled = false
    if (!job.gc_customer_id) {
      setGcLoading(false)
      return
    }
    void (async () => {
      try {
        const row = (await withSupabaseRetry(
          async () => supabase.from('customers').select('contact_info').eq('id', job.gc_customer_id!).maybeSingle(),
          'load gc email for test report',
        )) as { contact_info: Json | null } | null
        if (cancelled) return
        setGcEmail(extractContactInfo(row?.contact_info ?? null).email.trim() || null)
      } finally {
        if (!cancelled) setGcLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job.gc_customer_id])

  // Prefill To once the GC lookup settles: previous recipients → the GC → the customer.
  useEffect(() => {
    if (gcLoading) return
    setTo((cur) => cur || previouslySentTo.join(', ') || gcEmail || jobInfo.customerEmail || '')
  }, [gcLoading, gcEmail, jobInfo.customerEmail, previouslySentTo])

  const reportLabel = testReportShortLabel(data.testType, data.system)
  const amountLabel = payLink ? `$${payLink.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null
  const email = useMemo(
    () =>
      buildTestReportEmail({
        reportLabel,
        address: jobInfo.jobAddress,
        payUrl: includeLink && payLink ? payLink.url : null,
        amountLabel: includeLink ? amountLabel : null,
        companyName: settings.companyName,
        officePhone: settings.officePhone,
        bodyTemplate: settings.emailBodyTemplate,
      }),
    [reportLabel, jobInfo.jobAddress, includeLink, payLink, amountLabel, settings.companyName, settings.officePhone, settings.emailBodyTemplate],
  )
  useEffect(() => {
    if (!bodyTouched) setBodyText(email.text)
  }, [email.text, bodyTouched])

  const toList = parseEmailList(to)
  const ccList = parseEmailList(cc)
  const blockers = testReportSendBlockers(data, { toEmail: toList[0] ?? to.trim(), hasPayLink: Boolean(payLink && includeLink), requirePayLink: false })
  const recipientLabel = gcEmail && toList.includes(gcEmail.toLowerCase()) ? (job.gcCustomer?.name ?? null) : toList.includes((jobInfo.customerEmail ?? '').toLowerCase()) ? jobInfo.customerName : null

  const send = async () => {
    if (blockers.length) return
    setSending(true)
    try {
      const res = await sendTestReport({
        reportId,
        data,
        job: jobInfo,
        settings,
        to: toList,
        cc: ccList,
        subject: email.subject,
        bodyText,
        payUrl: includeLink && payLink ? payLink.url : null,
        amountLabel: includeLink ? amountLabel : null,
        recipientLabel,
      })
      if (!res.ok) {
        showToast(res.message, 'error')
        return
      }
      showToast(`Sent to ${res.sentTo.join(', ')}${res.pdfVersion > 1 ? ` (v${res.pdfVersion})` : ''}.`, 'success')
      onSent()
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '1rem', background: 'var(--surface)', marginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Send {reportLabel} report</div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={label}>To</div>
          <input type="text" value={to} onChange={(e) => setTo(e.target.value)} placeholder={gcLoading ? 'Looking up the GC…' : 'gc@example.com, second@example.com'} style={input} />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>
            {gcEmail ? `${job.gcCustomer?.name ?? 'GC'} · ${gcEmail}` : job.gc_customer_id ? `${job.gcCustomer?.name ?? 'The GC'} has no email on file — type one, and add it on their customer card.` : jobInfo.customerEmail ? `No GC on this job — the customer, ${jobInfo.customerName}.` : 'No GC on this job and no customer email — type the address.'}
          </div>
        </div>
        <div>
          <div style={label}>cc</div>
          <input type="text" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="malachi@example.com" style={input} />
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }}>The standing copy comes from Settings → Test reports → Always copy.</div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={label}>Subject</div>
        <div style={{ ...input, background: 'transparent' }}>{email.subject}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={label}>Message</div>
        <textarea
          rows={7}
          value={bodyText}
          onChange={(e) => {
            setBodyTouched(true)
            setBodyText(e.target.value)
          }}
          style={{ ...input, fontFamily: 'inherit' }}
        />
        {bodyTouched ? (
          <button type="button" onClick={() => { setBodyTouched(false); setBodyText(email.text) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, padding: '4px 0' }}>
            Reset to the template
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
          <span style={{ width: 26, height: 32, background: '#e53935', color: '#fff', fontSize: 9, fontWeight: 700, display: 'grid', placeItems: 'center', borderRadius: 3 }}>PDF</span>
          <span style={{ fontSize: 13 }}>
            <strong>{reportLabel} report</strong>
            <br />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>attached · built from this report as it is now</span>
          </span>
        </div>
        {payLink ? (
          <label style={{ fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={includeLink} onChange={(e) => setIncludeLink(e.target.checked)} />
            Include the Stripe pay link ({amountLabel})
          </label>
        ) : (
          <div style={{ borderLeft: '4px solid #b7791f', background: '#fff6e0', color: '#5a4a15', padding: '8px 12px', borderRadius: '0 8px 8px 0', fontSize: 13 }}>
            <strong>Bill first.</strong> No Stripe invoice on this job yet — the email goes out without a pay link. Open <strong>Bill Customer</strong> on the row, then send from here.
          </div>
        )}
      </div>

      {blockers.length ? (
        <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, color: '#b42318' }}>
          {blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}

      <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" style={btn} onClick={onClose} disabled={sending}>Back</button>
        <button type="button" style={{ ...btn, background: '#b0662f', border: '1px solid #b0662f', color: '#fff' }} onClick={() => void send()} disabled={sending || blockers.length > 0 || gcLoading}>
          {sending ? 'Sending…' : previouslySentTo.length ? 'Send again' : payLink && !includeLink ? 'Send without the link' : 'Send'}
        </button>
      </div>
    </div>
  )
}
