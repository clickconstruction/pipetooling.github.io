import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import CustomerSearchCombobox from '../customers/CustomerSearchCombobox'
import { extractContactInfo } from '../../lib/bids/bidContactInfo'
import { parseEmailList, testReportSendBlockers, testReportShortLabel, type TestReportData, type TestReportJobInfo, type TestReportSettings } from '../../lib/jobs/testReport'
import { buildTestReportEmail } from '../../lib/jobs/testReportEmail'
import { contactInfoWithEmail, gcPickWrites, prefillTestReportTo, testReportRecipientLabel } from '../../lib/jobs/testReportRecipients'
import { sendTestReport } from '../../lib/jobs/sendTestReport'
import type { JobWithDetails } from '../../types/jobWithDetails'
import type { Database, Json } from '../../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

/**
 * The Send sheet (v2.3301; GC picker v2.3309) — what Taunya writes by hand
 * today, prefilled: To the GC on the job (else the customer), the settings'
 * standing cc, the subject, the body with the Stripe pay link, the PDF as the
 * attachment. When the job has no GC, pick one here: their email fills To,
 * and the pick links them to the job so the next report — and the portal —
 * already know. "Bill first" when the job has no Stripe bill; sending
 * without the link is a deliberate second button.
 */
const label: CSSProperties = { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.6rem', fontSize: '0.9rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit' }
const btn: CSSProperties = { border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', borderRadius: 8, padding: '0.5rem 0.9rem', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const hint: CSSProperties = { fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3 }
const check: CSSProperties = { fontSize: 12.5, display: 'inline-flex', gap: 6, alignItems: 'center', marginTop: 6 }

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
  onSendStateChange,
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
  /**
   * The modal's sticky footer owns the Send button (v2.3326): the sheet reports
   * what the button should say and do, so the primary action never scrolls out
   * of sight below the message box.
   */
  onSendStateChange?: (state: { label: string; canSend: boolean; sending: boolean; send: () => void } | null) => void
}) {
  const { showToast } = useToastContext()
  const [jobGcEmail, setJobGcEmail] = useState<string | null>(null)
  const [gcLoading, setGcLoading] = useState(Boolean(job.gc_customer_id))
  // A GC picked here (v2.3309) — overrides the job's for this send and, when asked, becomes the job's.
  const [pickedGc, setPickedGc] = useState<CustomerRow | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customers, setCustomers] = useState<CustomerRow[] | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [setAsGc, setSetAsGc] = useState(true)
  const [saveEmailOnCard, setSaveEmailOnCard] = useState(true)
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
        setJobGcEmail(extractContactInfo(row?.contact_info ?? null).email.trim() || null)
      } finally {
        if (!cancelled) setGcLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job.gc_customer_id])

  // The customers list, only once the picker opens (the job form's own query).
  useEffect(() => {
    if (!pickerOpen || customers) return
    let cancelled = false
    void (async () => {
      try {
        const rows = (await withSupabaseRetry(
          async () => supabase.from('customers').select('id, name, address, contact_info, date_met, date_met_source, master_user_id, customer_type, archived_at').is('archived_at', null).order('name'),
          'load customers for gc pick',
        )) as CustomerRow[] | null
        if (!cancelled) setCustomers(rows ?? [])
      } catch (e) {
        if (!cancelled) {
          setCustomers([])
          showToast(formatErrorMessage(e, 'Could not load customers'), 'error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pickerOpen, customers, showToast])

  const effGcId = pickedGc?.id ?? job.gc_customer_id ?? null
  const effGcName = (pickedGc?.name ?? job.gcCustomer?.name ?? '').trim() || null
  const effGcEmail = pickedGc ? extractContactInfo(pickedGc.contact_info).email.trim() || null : jobGcEmail

  // Prefill To once the GC lookup settles: previous recipients → the GC → the customer.
  useEffect(() => {
    if (gcLoading) return
    setTo((cur) => cur || prefillTestReportTo({ previous: previouslySentTo, gcEmail: effGcEmail, customerEmail: jobInfo.customerEmail }).to)
  }, [gcLoading, effGcEmail, jobInfo.customerEmail, previouslySentTo])

  const pickGc = (c: CustomerRow) => {
    setPickedGc(c)
    setPickerOpen(false)
    setCustomerSearch(c.name)
    const email = extractContactInfo(c.contact_info).email.trim()
    if (email) setTo(email)
  }

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
  const recipientLabel = testReportRecipientLabel({ toList, gcEmail: effGcEmail, gcName: effGcName, customerEmail: jobInfo.customerEmail, customerName: jobInfo.customerName })
  const writes = gcPickWrites({ pickedGcId: pickedGc?.id ?? null, jobGcId: job.gc_customer_id ?? null, setAsGc, pickedGcEmail: effGcEmail, firstTo: toList[0] ?? null, saveEmailOnCard })

  const send = async () => {
    if (blockers.length) return
    setSending(true)
    try {
      // The GC pick's writes go first so the recipient label and the next report are right; each fails soft.
      if (writes.linkGcToJob) {
        try {
          await withSupabaseRetry(async () => supabase.from('jobs_ledger').update({ gc_customer_id: writes.linkGcToJob }).eq('id', job.id), 'link gc to job')
        } catch (e) {
          showToast(formatErrorMessage(e, 'Could not set the GC on the job — sending anyway'), 'error')
        }
      }
      if (writes.saveEmailOnGc) {
        try {
          const target = writes.saveEmailOnGc
          const current = pickedGc && pickedGc.id === target.customerId ? pickedGc.contact_info : null
          await withSupabaseRetry(async () => supabase.from('customers').update({ contact_info: contactInfoWithEmail(current, target.email) }).eq('id', target.customerId), 'save gc email')
        } catch (e) {
          showToast(formatErrorMessage(e, "Could not save the email on the GC's card — sending anyway"), 'error')
        }
      }
      const res = await sendTestReport({
        reportId,
        data,
        job: { ...jobInfo, customerCompany: effGcName ?? jobInfo.customerCompany },
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

  const sendLabel = sending ? 'Sending…' : previouslySentTo.length ? 'Send again' : payLink && !includeLink ? 'Send without the link' : 'Send'
  const canSend = !sending && blockers.length === 0 && !gcLoading
  // Lift the button to the modal footer; clear it on unmount.
  const sendRef = useRef(send)
  sendRef.current = send
  const onSendStateChangeRef = useRef(onSendStateChange)
  onSendStateChangeRef.current = onSendStateChange
  useEffect(() => {
    onSendStateChangeRef.current?.({ label: sendLabel, canSend, sending, send: () => void sendRef.current() })
  }, [sendLabel, canSend, sending])
  useEffect(() => () => onSendStateChangeRef.current?.(null), [])
  // Bring the sheet into view when it opens — it sits below the form.
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const gcHint = (() => {
    if (gcLoading) return 'Looking up the GC…'
    if (effGcId && effGcEmail) return `${effGcName ?? 'GC'} · ${effGcEmail}`
    if (effGcId) return `${effGcName ?? 'The GC'} has no email on file — type one below and it can be saved on their card.`
    if (jobInfo.customerEmail) return `No GC on this job — the customer, ${jobInfo.customerName}. Pick the GC if a contractor ordered this test.`
    return 'No GC on this job and no customer email — pick the GC or type the address.'
  })()

  return (
    <div ref={rootRef} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '1rem', background: 'var(--surface)', marginTop: 12, scrollMarginTop: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Send {reportLabel} report</div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
      </div>

      {/* The GC (v2.3309): the job's, or one picked here. */}
      <div style={{ marginBottom: 12 }}>
        <div style={label}>GC</div>
        {effGcId && !pickerOpen ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{effGcName ?? 'GC'}</span>
            {pickedGc && pickedGc.id !== job.gc_customer_id ? <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 8px', background: '#fff6e0', color: '#b7791f' }}>picked here</span> : null}
            <button type="button" onClick={() => setPickerOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12.5, padding: 0, textDecoration: 'underline' }}>
              change
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <CustomerSearchCombobox
              customers={customers ?? []}
              loading={pickerOpen && customers === null}
              valueId={pickedGc?.id ?? null}
              searchText={customerSearch}
              onSearchTextChange={(t) => {
                setCustomerSearch(t)
                if (!pickerOpen) setPickerOpen(true)
              }}
              onSelect={pickGc}
              onClear={() => {
                setPickedGc(null)
                setCustomerSearch('')
              }}
              placeholder="Search for the GC — the contractor who ordered this test"
              aria-label="Pick the GC for this report"
            />
            {pickerOpen && effGcId && job.gc_customer_id && !pickedGc ? (
              <button type="button" onClick={() => setPickerOpen(false)} style={{ justifySelf: 'start', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12.5, padding: 0 }}>
                keep {job.gcCustomer?.name ?? 'the job’s GC'}
              </button>
            ) : null}
          </div>
        )}
        <div style={hint}>{gcHint}</div>
        {pickedGc && pickedGc.id !== job.gc_customer_id ? (
          <label style={check}>
            <input type="checkbox" checked={setAsGc} onChange={(e) => setSetAsGc(e.target.checked)} />
            Set {pickedGc.name} as the GC on this job (the next report and the portal will know)
          </label>
        ) : null}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div style={label}>To</div>
          <input type="text" value={to} onChange={(e) => setTo(e.target.value)} placeholder={gcLoading ? 'Looking up the GC…' : 'gc@example.com, second@example.com'} style={input} />
          {effGcId && !effGcEmail && toList[0] ? (
            <label style={check}>
              <input type="checkbox" checked={saveEmailOnCard} onChange={(e) => setSaveEmailOnCard(e.target.checked)} />
              Save {toList[0]} on {effGcName ?? 'the GC'}’s customer card
            </label>
          ) : null}
        </div>
        <div>
          <div style={label}>cc</div>
          <input type="text" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="malachi@example.com" style={input} />
          <div style={hint}>The standing copy comes from Settings → Test reports → Always copy.</div>
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

      {onSendStateChange ? (
        <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text-muted)' }}>
          {canSend ? `The ${sendLabel} button is in the bar at the bottom of this window.` : blockers.length ? 'Fix the items above and the Send button in the bottom bar wakes up.' : ''}
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" style={btn} onClick={onClose} disabled={sending}>Back</button>
          <button type="button" style={{ ...btn, background: '#b0662f', border: '1px solid #b0662f', color: '#fff' }} onClick={() => void send()} disabled={!canSend}>
            {sendLabel}
          </button>
        </div>
      )}
    </div>
  )
}
