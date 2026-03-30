import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { Database } from '../../types/database'
import type { Json } from '../../types/database'

type JobsLedgerInvoice = Database['public']['Tables']['jobs_ledger_invoices']['Row']
type CustomerRow = Database['public']['Tables']['customers']['Row']

export type JobBillingContext = {
  id: string
  master_user_id: string
  hcp_number: string | null
  job_name: string | null
  customer_id: string | null
  customer_name: string | null
  customer_email: string | null
}

export type SendRecordInvoicePayload =
  | { kind: 'job'; job: JobBillingContext }
  | { kind: 'invoice'; job: JobBillingContext; invoice: Pick<JobsLedgerInvoice, 'id' | 'amount' | 'status'> }

type ExternalChannel = 'housecallpro' | 'physical'

function channelButtonStyle(selected: boolean): CSSProperties {
  return {
    flex: 1,
    padding: '0.5rem 0.75rem',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: selected ? 600 : 400,
    border: selected ? '2px solid #2563eb' : '1px solid #d1d5db',
    background: selected ? '#eff6ff' : 'white',
    color: '#111827',
  }
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function contactInfoFromCustomer(c: CustomerRow): { email: string; phone: string } {
  const ci = c.contact_info
  if (ci == null || typeof ci !== 'object') return { email: '', phone: '' }
  const o = ci as Record<string, unknown>
  return {
    email: typeof o.email === 'string' ? o.email : '',
    phone: typeof o.phone === 'string' ? o.phone : '',
  }
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
}

function jobLedgerHasCustomerForBilling(customerId: string | null | undefined): boolean {
  return customerId != null && String(customerId).trim().length > 0
}

export default function SendRecordInvoiceModal({
  payload,
  onClose,
  onSuccess,
  onAfterEnsureSuccess,
  jobUpdating,
  invoiceUpdating,
}: {
  payload: SendRecordInvoicePayload | null
  onClose: () => void
  onSuccess: () => Promise<void>
  /** Refetch jobs/invoices after ensure RPC creates or syncs the RTB line (so UI e.g. green button updates without full page reload). */
  onAfterEnsureSuccess?: () => void | Promise<void>
  jobUpdating: boolean
  invoiceUpdating: boolean
}) {
  const onAfterEnsureSuccessRef = useRef(onAfterEnsureSuccess)
  onAfterEnsureSuccessRef.current = onAfterEnsureSuccess
  const [tab, setTab] = useState<'record' | 'stripe'>('record')
  const [channel, setChannel] = useState<ExternalChannel>('housecallpro')
  const [recordAck, setRecordAck] = useState(false)
  const [sentDate, setSentDate] = useState(todayIsoDate)
  const [externalNote, setExternalNote] = useState('')
  const [recordError, setRecordError] = useState<string | null>(null)

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customersLoading, setCustomersLoading] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [createMode, setCreateMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')

  const [totalStr, setTotalStr] = useState('')
  const [billingName, setBillingName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [dueDate, setDueDate] = useState(todayIsoDate)
  const [memo, setMemo] = useState('')
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [stripeSubmitting, setStripeSubmitting] = useState(false)
  const [stripeSuccess, setStripeSuccess] = useState<{ url: string; id: string } | null>(null)

  const [ensuredInvoice, setEnsuredInvoice] = useState<{ jobId: string; id: string; amount: number } | null>(null)
  const [ensureError, setEnsureError] = useState<string | null>(null)
  const [ensureLoading, setEnsureLoading] = useState(false)

  const open = payload !== null
  const kind = payload?.kind ?? 'job'
  const job = payload?.job ?? null
  const invoice = payload?.kind === 'invoice' ? payload.invoice : null
  const canStripe = job !== null && (kind === 'invoice' ? invoice !== null : true)

  useEffect(() => {
    if (!open || !job) return
    setTab('record')
    setRecordAck(false)
    setChannel('housecallpro')
    setSentDate(todayIsoDate())
    setExternalNote('')
    setRecordError(null)
    setStripeError(null)
    setStripeSuccess(null)
    setStripeSubmitting(false)
    setEnsuredInvoice(null)
    setEnsureError(null)
    setEnsureLoading(false)
    setCreateMode(false)
    setNewName('')
    setNewEmail('')
    setNewPhone('')
    setDueDate(todayIsoDate())
    setMemo('')
    setSelectedCustomerId(job.customer_id ?? '')
    setBillingName((job.customer_name ?? '').trim())
    setBillingEmail((job.customer_email ?? '').trim())
    if (invoice) {
      setTotalStr(String(Number(invoice.amount)))
    } else {
      setTotalStr('')
    }
  }, [open, job?.id, invoice?.id])

  useEffect(() => {
    if (!open || !job) return
    setCustomersLoading(true)
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.from('customers').select('*').eq('master_user_id', job.master_user_id).order('name'),
          'load customers for send invoice'
        )
        setCustomers((data ?? []) as CustomerRow[])
      } catch {
        setCustomers([])
      } finally {
        setCustomersLoading(false)
      }
    })()
  }, [open, job?.id, job?.master_user_id])

  useEffect(() => {
    if (!open || !job?.id || tab !== 'stripe' || kind !== 'job') return
    // After Stripe finalize the row is `billed`; re-running ensure is wasted and can surface PostgREST errors.
    if (stripeSuccess) return
    if (ensuredInvoice?.jobId === job.id) return

    let cancelled = false
    setEnsureLoading(true)
    setEnsureError(null)

    void (async () => {
      try {
        const raw = await withSupabaseRetry(
          async () =>
            await supabase.rpc('ensure_single_ready_to_bill_invoice_for_job', {
              p_job_id: job.id,
            }),
          'ensure RTB invoice'
        )
        if (cancelled) return
        const obj = raw as Record<string, unknown> | null
        if (obj && typeof obj.error === 'string' && obj.error.length > 0) {
          setEnsuredInvoice(null)
          setEnsureError(obj.error)
          return
        }
        if (obj?.ok === true && typeof obj.invoice_id === 'string') {
          const rawAmt = obj.amount
          const amt =
            typeof rawAmt === 'number'
              ? rawAmt
              : typeof rawAmt === 'string'
                ? Number(rawAmt)
                : NaN
          if (!Number.isFinite(amt)) {
            setEnsuredInvoice(null)
            setEnsureError('Unexpected response from server')
            return
          }
          setEnsuredInvoice({ jobId: job.id, id: obj.invoice_id, amount: amt })
          setTotalStr(String(amt))
          setEnsureError(null)
          try {
            await onAfterEnsureSuccessRef.current?.()
          } catch {
            /* Refetch failed; ensured invoice state is still valid. */
          }
        } else {
          setEnsuredInvoice(null)
          setEnsureError('Unexpected response from server')
        }
      } catch (e) {
        if (cancelled) return
        setEnsuredInvoice(null)
        setEnsureError(e instanceof Error ? e.message : 'Failed to ensure invoice')
      } finally {
        if (!cancelled) setEnsureLoading(false)
      }
    })()

    return () => {
      cancelled = true
      setEnsureLoading(false)
    }
    // ensuredInvoice is read when tab/open/job changes; omit from deps to avoid an extra run right after a successful ensure.
  }, [open, job?.id, tab, kind, stripeSuccess])

  useEffect(() => {
    if (!open || createMode || !selectedCustomerId) return
    const c = customers.find((x) => x.id === selectedCustomerId)
    if (!c) return
    const { email } = contactInfoFromCustomer(c)
    setBillingName((c.name ?? '').trim())
    setBillingEmail(email.trim())
  }, [open, createMode, selectedCustomerId, customers])

  async function confirmRecordExternal() {
    if (!job || !recordAck) return
    setRecordError(null)
    const sentAt = sentDate.trim() ? new Date(sentDate + 'T12:00:00').toISOString() : new Date().toISOString()
    try {
      if (kind === 'invoice' && invoice) {
        await withSupabaseRetry(
          async () =>
            supabase
              .from('jobs_ledger_invoices')
              .update({
                status: 'billed',
                external_send_channel: channel,
                external_send_note: externalNote.trim() || null,
                sent_to_customer_at: sentAt,
              })
              .eq('id', invoice.id),
          'record external invoice send'
        )
      } else {
        const data = await withSupabaseRetry(
          async () => supabase.rpc('update_job_status', { p_job_id: job.id, p_to_status: 'billed' }),
          'record external job billed'
        )
        const res = data as { error?: string } | null
        if (res?.error) throw new Error(res.error)
      }
      await onSuccess()
      onClose()
    } catch (e) {
      setRecordError(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  async function resolveCustomerIdForStripe(): Promise<string | null> {
    if (!job) return null
    if (createMode) {
      const name = newName.trim()
      const email = newEmail.trim()
      if (!name || !isValidEmail(email)) return null
      const contact_info: Json = { email, phone: newPhone.trim() || '' }
      const row = await withSupabaseRetry(
        async () =>
          supabase
            .from('customers')
            .insert({
              name,
              master_user_id: job.master_user_id,
              contact_info,
            })
            .select('id')
            .single(),
        'create customer for Stripe invoice'
      )
      const id = row && typeof row === 'object' && 'id' in row ? (row as { id: string }).id : null
      if (!id) throw new Error('Customer create failed')
      if (!job.customer_id) {
        await withSupabaseRetry(
          async () => supabase.from('jobs_ledger').update({ customer_id: id }).eq('id', job.id),
          'link customer to job for Stripe'
        )
      }
      return id
    }
    if (!selectedCustomerId) return null
    return selectedCustomerId
  }

  async function submitStripe() {
    if (!job || !canStripe) return
    const effectiveInvoiceId = invoice?.id ?? ensuredInvoice?.id
    if (!effectiveInvoiceId) return
    setStripeError(null)
    const amt = Number(totalStr)
    if (!Number.isFinite(amt) || amt <= 0) {
      setStripeError('Enter a valid total')
      return
    }
    if (!isValidEmail(billingEmail)) {
      setStripeError('Valid customer email required')
      return
    }
    setStripeSubmitting(true)
    try {
      const cid = await resolveCustomerIdForStripe()
      if (!cid) {
        setStripeError('Choose a customer or complete create-customer fields')
        setStripeSubmitting(false)
        return
      }

      const {
        data: { session: refreshedSession },
        error: refreshErr,
      } = await supabase.auth.refreshSession()
      if (refreshErr || !refreshedSession?.access_token) {
        throw new Error('Session expired. Sign in again.')
      }

      const { data, error: fnErr } = await supabase.functions.invoke('create-stripe-invoice', {
        headers: { Authorization: `Bearer ${refreshedSession.access_token}` },
        body: {
          jobs_ledger_invoice_id: effectiveInvoiceId,
          customer_id: cid,
          amount_dollars: amt,
          customer_email: billingEmail.trim(),
          customer_name: billingName.trim() || billingEmail.trim(),
          due_date: dueDate.trim(),
          memo: memo.trim() || undefined,
        },
      })

      if (fnErr) {
        let msg = fnErr.message
        if (fnErr instanceof FunctionsHttpError && fnErr.context?.json) {
          try {
            const b = (await fnErr.context.json()) as { error?: string } | null
            if (b?.error) msg = b.error
          } catch {
            /* ignore */
          }
        }
        throw new Error(msg)
      }

      const res = data as {
        success?: boolean
        error?: string
        hosted_invoice_url?: string
        stripe_invoice_id?: string
      } | null
      if (res?.error) throw new Error(res.error)
      const url = res?.hosted_invoice_url
      const sid = res?.stripe_invoice_id
      if (!url || !sid) throw new Error('Invalid response from server')

      setStripeSuccess({ url, id: sid })
      await onSuccess()
    } catch (e) {
      setStripeError(e instanceof Error ? e.message : 'Stripe request failed')
    } finally {
      setStripeSubmitting(false)
    }
  }

  if (!open || !job) return null

  const busy = jobUpdating || invoiceUpdating || stripeSubmitting

  if (!jobLedgerHasCustomerForBilling(job.customer_id)) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 60,
        }}
      >
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 420, maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Invoice / Update</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
            {job.hcp_number ?? '—'} · {job.job_name ?? '—'}
          </p>
          <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#b91c1c' }}>
            Link this job to a customer on the Jobs page before billing.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
    >
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 420, maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem' }}>Invoice / Update</h2>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
          {job.hcp_number ?? '—'} · {job.job_name ?? '—'}
          {invoice ? ` · $${Number(invoice.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''}
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb' }}>
          <button
            type="button"
            onClick={() => setTab('record')}
            style={{
              padding: '0.5rem 0.75rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontWeight: tab === 'record' ? 600 : 400,
              borderBottom: tab === 'record' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            Record external send
          </button>
          <button
            type="button"
            onClick={() => canStripe && setTab('stripe')}
            disabled={!canStripe}
            style={{
              padding: '0.5rem 0.75rem',
              border: 'none',
              background: 'none',
              cursor: canStripe ? 'pointer' : 'not-allowed',
              fontWeight: tab === 'stripe' ? 600 : 400,
              borderBottom: tab === 'stripe' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: -1,
              color: canStripe ? 'inherit' : '#9ca3af',
            }}
          >
            Stripe invoice
          </button>
        </div>

        {tab === 'record' && (
          <>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
              <input type="checkbox" checked={recordAck} onChange={(e) => setRecordAck(e.target.checked)} style={{ marginTop: 4 }} />
              <span>Invoice has been sent to the customer through</span>
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <button type="button" onClick={() => setChannel('housecallpro')} style={channelButtonStyle(channel === 'housecallpro')}>
                HouseCallPro
              </button>
              <button type="button" onClick={() => setChannel('physical')} style={channelButtonStyle(channel === 'physical')}>
                Physical Invoice
              </button>
            </div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Date</label>
            <input type="date" value={sentDate} onChange={(e) => setSentDate(e.target.value)} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem' }} />
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Note (optional)</label>
            <textarea value={externalNote} onChange={(e) => setExternalNote(e.target.value)} rows={3} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem' }} />
            {recordError && <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{recordError}</p>}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={!recordAck || busy}
                onClick={() => void confirmRecordExternal()}
                style={{
                  padding: '0.5rem 1rem',
                  background: recordAck && !busy ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: recordAck && !busy ? 'pointer' : 'not-allowed',
                }}
              >
                {busy ? '…' : 'Confirm'}
              </button>
            </div>
          </>
        )}

        {tab === 'stripe' && canStripe && (
          <>
            {kind === 'job' && ensureLoading && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.75rem' }}>Preparing invoice line…</p>
            )}
            {kind === 'job' && !ensureLoading && ensureError && (
              <p style={{ color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{ensureError}</p>
            )}
            {!stripeSuccess &&
            (kind === 'invoice' ? invoice : kind === 'job' && ensuredInvoice && !ensureLoading && !ensureError) ? (
              <>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Total (USD)</label>
                <input type="text" inputMode="decimal" value={totalStr} onChange={(e) => setTotalStr(e.target.value)} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem' }} />
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Customer name</label>
                <input type="text" value={billingName} onChange={(e) => setBillingName(e.target.value)} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem' }} />
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Customer email</label>
                <input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem' }} />

                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Due date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem' }} />
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.25rem' }}>Memo (optional)</label>
                <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} style={{ width: '100%', padding: '0.35rem', marginBottom: '0.75rem' }} />

                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input type="checkbox" checked={createMode} onChange={(e) => setCreateMode(e.target.checked)} />
                    Create new customer
                  </label>
                  {!createMode ? (
                    <>
                      <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Bill to customer</label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        disabled={customersLoading}
                        style={{ width: '100%', padding: '0.35rem', marginTop: '0.25rem' }}
                      >
                        <option value="">Select customer…</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input type="text" placeholder="Customer name" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ padding: '0.35rem' }} />
                      <input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ padding: '0.35rem' }} />
                      <input type="text" placeholder="Phone (optional)" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={{ padding: '0.35rem' }} />
                    </div>
                  )}
                </div>

                {stripeError && <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{stripeError}</p>}
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={onClose} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', background: 'white', borderRadius: 4, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void submitStripe()}
                    style={{
                      padding: '0.5rem 1rem',
                      background: !busy ? '#3b82f6' : '#9ca3af',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: busy ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {stripeSubmitting ? '…' : 'Generate invoice'}
                  </button>
                </div>
              </>
            ) : stripeSuccess ? (
              <>
                <p style={{ fontSize: '0.875rem', color: '#059669', marginBottom: '0.75rem' }}>Stripe invoice created.</p>
                <p style={{ fontSize: '0.8125rem', wordBreak: 'break-all', marginBottom: '0.5rem' }}>{stripeSuccess.url}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(stripeSuccess.url)}
                    style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Copy payment link
                  </button>
                  <a href={stripeSuccess.url} target="_blank" rel="noreferrer" style={{ padding: '0.35rem 0.75rem', border: '1px solid #3b82f6', borderRadius: 4, color: '#3b82f6' }}>
                    Open link
                  </a>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#9ca3af', marginBottom: '1rem' }}>
                  <input type="checkbox" disabled checked={false} readOnly />
                  Email customer automatically (coming soon)
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose()
                    }}
                    style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
