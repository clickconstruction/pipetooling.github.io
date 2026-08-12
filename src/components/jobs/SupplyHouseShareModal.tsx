import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToastContext } from '../../contexts/ToastContext'
import { formatErrorMessage } from '../../utils/errorHandling'
import { extractContactFromCustomer } from '../../lib/customerContactDisplay'
import { effectiveJobLedgerNumber } from '../../lib/ledgerDisplayPrefixes'
import {
  composeJobAccountEmail,
  jobAccountGaps,
  prefillJobAccountInfo,
  type JobAccountInfo,
  type OwnerMode,
} from '../../lib/supplyHouseJobAccount'
import {
  shareContactDisplay,
  summarizeJobShares,
  type JobAccountShareRow,
} from '../../lib/supplyHouseJobAccountsLedger'
import type { JobWithDetails } from '../../types/jobWithDetails'

type ContactRow = { id: string; label: string; email: string }

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.4rem 0',
  borderBottom: '1px solid var(--border)',
  fontSize: '0.875rem',
}

const labelStyle: CSSProperties = { color: 'var(--text-muted)', flexShrink: 0 }

const inputStyle: CSSProperties = {
  padding: '0.3rem 0.5rem',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: '0.8125rem',
  minWidth: 0,
  flex: 1,
  maxWidth: 240,
  textAlign: 'right',
}

const missingChip = (
  <span style={{ background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)', borderRadius: 999, padding: '0.05rem 0.5rem', fontSize: '0.6875rem', fontWeight: 600, flexShrink: 0 }}>
    missing
  </span>
)

/**
 * Job Detail → "Share with supply house" (v2.1605, mockup-approved): the
 * job-account packet a supply house needs (property, phones, homeowner vs
 * building owner + company) with inline gap-filling, an org-wide contact
 * shortlist (supply_house_contacts), and a PipeTooling email send via the
 * send-supply-house-job-account edge function. Fills to the owner's phone /
 * email save back to the customer's contact_info when they were blank.
 */
export function SupplyHouseShareModal({ open, job, onClose }: { open: boolean; job: JobWithDetails; onClose: () => void }) {
  const { profileName } = useAuth()
  const { showToast } = useToastContext()
  const [info, setInfo] = useState<JobAccountInfo | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerContact, setCustomerContact] = useState<{ phone: string; email: string }>({ phone: '', email: '' })
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [sending, setSending] = useState(false)
  /** Prior shares of this job (v2.1606) — collapsed hint, click for when/who. */
  const [priorShares, setPriorShares] = useState<JobAccountShareRow[]>([])
  const [priorOpen, setPriorOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setSelectedIds(new Set())
    setAddOpen(false)
    setPriorShares([])
    setPriorOpen(false)
    void supabase
      .from('supply_house_job_accounts')
      .select('job_id, contact_label, contact_email, sent_by_name, sent_at')
      .eq('job_id', job.id)
      .order('sent_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled) setPriorShares((data ?? []) as JobAccountShareRow[])
      })
    void (async () => {
      let customer: { id: string; name: string | null; contact_info: unknown; customer_type: string | null } | null = null
      if (job.customer_id) {
        const { data } = await supabase
          .from('customers')
          .select('id, name, contact_info, customer_type')
          .eq('id', job.customer_id)
          .maybeSingle()
        customer = data ?? null
      }
      const { data: contactRows } = await supabase
        .from('supply_house_contacts')
        .select('id, label, email')
        .order('label')
      if (cancelled) return
      const contact = customer ? extractContactFromCustomer({ contact_info: customer.contact_info as never }) : { phone: '', email: '' }
      setCustomerId(customer?.id ?? null)
      setCustomerContact(contact)
      setInfo(
        prefillJobAccountInfo({
          jobName: job.job_name ?? job.customer_name,
          jobAddress: job.job_address,
          customerName: customer?.name ?? job.customer_name,
          customerPhone: contact.phone,
          customerEmail: contact.email,
          customerType: customer?.customer_type ?? null,
          gcName: job.gcCustomer?.name ?? null,
        })
      )
      setContacts((contactRows ?? []) as ContactRow[])
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill once per open
  }, [open])

  const gaps = useMemo(() => (info ? jobAccountGaps(info) : []), [info])
  const jobLabel = `${effectiveJobLedgerNumber(job.hcp_number, job.click_number) || '—'} · ${(job.job_name ?? job.customer_name ?? '').trim() || 'Job'}`

  if (!open) return null

  const patch = (p: Partial<JobAccountInfo>) => setInfo((prev) => (prev ? { ...prev, ...p } : prev))

  const addContact = async () => {
    const label = addLabel.trim()
    const email = addEmail.trim()
    if (!label || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('A label and a valid email are required', 'error')
      return
    }
    setAdding(true)
    const { data, error } = await supabase
      .from('supply_house_contacts')
      .insert({ label, email })
      .select('id, label, email')
      .single()
    setAdding(false)
    if (error || !data) {
      showToast(formatErrorMessage(error, 'Could not add the contact'), 'error')
      return
    }
    setContacts((prev) => [...prev, data as ContactRow].sort((a, b) => a.label.localeCompare(b.label)))
    setSelectedIds((prev) => new Set(prev).add((data as ContactRow).id))
    setAddLabel('')
    setAddEmail('')
    setAddOpen(false)
  }

  const send = async () => {
    if (!info || selectedIds.size === 0) {
      showToast('Pick at least one supply house contact', 'info')
      return
    }
    setSending(true)
    const { subject, text, html } = composeJobAccountEmail(info, jobLabel, profileName ?? '')
    const recipients = contacts.filter((c) => selectedIds.has(c.id)).map((c) => ({ label: c.label, email: c.email }))
    const toEmails = recipients.map((r) => r.email)
    const { data, error } = await supabase.functions.invoke('send-supply-house-job-account', {
      body: { job_id: job.id, recipients, to_emails: toEmails, subject, email_html: html, email_text: text },
    })
    const fnError = error ? formatErrorMessage(error) : (data as { error?: string } | null)?.error
    if (fnError) {
      setSending(false)
      showToast(`Could not send: ${fnError}`, 'error')
      return
    }
    // Save filled owner contact back to the customer when it was blank (best-effort).
    if (customerId) {
      const phoneFill = !customerContact.phone.trim() && info.ownerPhone.trim()
      const emailFill = !customerContact.email.trim() && info.ownerEmail.trim()
      if (phoneFill || emailFill) {
        const nextContact = {
          ...(phoneFill ? { phone: info.ownerPhone.trim() } : { phone: customerContact.phone }),
          ...(emailFill ? { email: info.ownerEmail.trim() } : { email: customerContact.email }),
        }
        await supabase.from('customers').update({ contact_info: nextContact }).eq('id', customerId)
      }
    }
    setSending(false)
    showToast(`Job account info sent to ${toEmails.length} ${toEmails.length === 1 ? 'contact' : 'contacts'}.`, 'success')
    onClose()
  }

  const fieldRow = (label: string, value: string, onChange: (v: string) => void, placeholder: string) => (
    <div style={rowStyle}>
      <span style={labelStyle}>{label}</span>
      {value.trim() ? (
        <input value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} aria-label={label} />
      ) : (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, justifyContent: 'flex-end' }}>
          {missingChip}
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} aria-label={label} />
        </span>
      )}
    </div>
  )

  const sectionHead = (text: string) => (
    <p style={{ margin: '0.8rem 0 0.25rem', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {text}
    </p>
  )

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1300 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${jobLabel} with a supply house`}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 12, width: '96%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: '1rem 1.15rem', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>Share with supply house</h3>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{jobLabel} — job account setup</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Close"
            style={{ padding: '0.3rem 0.6rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--surface)', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {priorShares.length > 0 ? (
          <div style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setPriorOpen((v) => !v)}
              aria-expanded={priorOpen}
              title="Show every previous send — when and to who"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.6rem',
                borderRadius: 999,
                border: '1px solid var(--border-strong)',
                background: 'var(--bg-blue-tint)',
                color: 'var(--text-blue-700)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {summarizeJobShares(priorShares, (iso) => {
                const d = new Date(iso)
                return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`
              })}
              <span aria-hidden style={{ fontSize: '0.625rem' }}>{priorOpen ? '▴' : '▾'}</span>
            </button>
            {priorOpen ? (
              <div style={{ margin: '0.4rem 0 0 0.5rem', borderLeft: '2px solid var(--border)', paddingLeft: '0.6rem' }}>
                {priorShares.map((s, idx) => {
                  const d = new Date(s.sent_at)
                  const when = Number.isNaN(d.getTime())
                    ? '—'
                    : `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)} ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                  return (
                    <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-700)', padding: '0.1rem 0' }}>
                      {when} · <span title={s.contact_email}>{shareContactDisplay(s)}</span>
                      {s.sent_by_name ? <span style={{ color: 'var(--text-muted)' }}> · by {s.sent_by_name}</span> : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        {!info ? (
          <p style={{ margin: '1rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
        ) : (
          <>
            {sectionHead('Job account info')}
            {fieldRow('Property', info.propertyName, (v) => patch({ propertyName: v }), 'Property name…')}
            {fieldRow('Address', info.address, (v) => patch({ address: v }), 'Street, city…')}
            {fieldRow('Site phone', info.sitePhone, (v) => patch({ sitePhone: v }), 'Add a phone…')}

            {sectionHead('Owner')}
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden', width: 'fit-content', marginBottom: '0.2rem' }}>
              {(['homeowner', 'building_owner'] as OwnerMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => patch({ ownerMode: mode })}
                  aria-pressed={info.ownerMode === mode}
                  style={{
                    padding: '0.25rem 0.7rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: info.ownerMode === mode ? 'var(--bg-blue-tint)' : 'var(--surface)',
                    color: info.ownerMode === mode ? 'var(--text-blue-700)' : 'var(--text-700)',
                  }}
                >
                  {mode === 'homeowner' ? 'Homeowner' : 'Building owner'}
                </button>
              ))}
            </div>
            {info.ownerMode === 'building_owner'
              ? fieldRow('Company', info.companyName, (v) => patch({ companyName: v }), 'Company name…')
              : null}
            {fieldRow(info.ownerMode === 'building_owner' ? 'Contact' : 'Homeowner', info.ownerName, (v) => patch({ ownerName: v }), 'Name…')}
            {fieldRow('Owner phone', info.ownerPhone, (v) => patch({ ownerPhone: v }), 'Add a phone…')}
            {fieldRow('Owner email', info.ownerEmail, (v) => patch({ ownerEmail: v }), 'Optional…')}

            {sectionHead('Send to')}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {contacts.map((c) => {
                const on = selectedIds.has(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    title={c.email}
                    onClick={() =>
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(c.id)) next.delete(c.id)
                        else next.add(c.id)
                        return next
                      })
                    }
                    style={{
                      padding: '0.25rem 0.7rem',
                      borderRadius: 999,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: on ? '1px solid #2563eb' : '1px solid var(--border-strong)',
                      background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
                      color: on ? 'var(--text-blue-700)' : 'var(--text-700)',
                    }}
                  >
                    {on ? '✓ ' : ''}
                    {c.label}
                  </button>
                )
              })}
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                style={{ padding: '0.25rem 0.7rem', borderRadius: 999, fontSize: '0.75rem', border: '1px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-link)', cursor: 'pointer' }}
              >
                + Add contact
              </button>
            </div>
            {contacts.length === 0 && !addOpen ? (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>No contacts yet — add your first supply house contact.</p>
            ) : null}
            {addOpen ? (
              <div style={{ display: 'flex', gap: 6, marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={addLabel} onChange={(e) => setAddLabel(e.target.value)} placeholder="Ferguson — Central desk" style={{ ...inputStyle, textAlign: 'left', maxWidth: 190 }} aria-label="Contact label" />
                <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="orders@ferguson.com" style={{ ...inputStyle, textAlign: 'left', maxWidth: 190 }} aria-label="Contact email" />
                <button
                  type="button"
                  onClick={() => void addContact()}
                  disabled={adding}
                  style={{ padding: '0.3rem 0.8rem', border: '1px solid #2563eb', borderRadius: 6, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  {adding ? 'Adding…' : 'Add'}
                </button>
              </div>
            ) : null}
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.6875rem', color: 'var(--text-faint)' }}>Contacts are remembered for next time.</p>

            <div style={{ marginTop: '0.8rem', background: 'var(--bg-subtle)', borderRadius: 8, padding: '0.5rem 0.7rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Sends “Job account setup — {jobLabel}” from PipeTooling with the info above. Replies go to your email.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: '0.8rem' }}>
              <span style={{ fontSize: '0.75rem', color: gaps.length ? 'var(--text-amber-800)' : 'var(--text-green-600)' }}>
                {gaps.length ? `Missing: ${gaps.join(', ')} — you can send anyway.` : 'All fields filled.'}
              </span>
              <span style={{ display: 'inline-flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  style={{ padding: '0.45rem 0.9rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', fontSize: '0.8125rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={sending || selectedIds.size === 0}
                  style={{
                    padding: '0.45rem 1rem',
                    border: 'none',
                    borderRadius: 6,
                    background: sending || selectedIds.size === 0 ? 'var(--bg-muted)' : '#2563eb',
                    color: sending || selectedIds.size === 0 ? 'var(--text-muted)' : '#fff',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    cursor: sending || selectedIds.size === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {sending ? 'Sending…' : 'Send email'}
                </button>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
