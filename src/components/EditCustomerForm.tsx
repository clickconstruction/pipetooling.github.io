import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth, type UserRole } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import type { Database } from '../types/database'
import type { Json } from '../types/database'
import CustomerSearchCombobox from './customers/CustomerSearchCombobox'
import {
  extractContactFromCustomer,
  getCustomerDisplay,
  type CustomerRow as CustomerPickRow,
} from '../lib/customerContactDisplay'
import { formatErrorMessage, withSupabaseRetry } from '../utils/errorHandling'
import { openInExternalBrowser } from '../lib/openInExternalBrowser'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import { isCustomerArchived } from '../lib/customerArchive'
import { DISCOUNT_REASON_PRESETS, standingDiscountFromCustomer } from '../lib/jobs/discountLine'
import { CUSTOMER_PAYMENT_TERMS, isCustomerPaymentTerms, parseCustomerTerms, type CustomerPaymentTerms } from '../lib/customerPaymentTerms'
import CustomerContactsSection from './customers/CustomerContactsSection'
import CustomerPropertiesSection from './customers/CustomerPropertiesSection'

type CustomerRow = Database['public']['Tables']['customers']['Row']

const JOB_FOLDERS_DRIVE_URL =
  'https://drive.google.com/drive/folders/1cOTvZrJFTUlxTiUMoESdMtTRvQgxft60?usp=drive_link'

type MergeField =
  | 'name'
  | 'address'
  | 'contact_info'
  | 'customer_type'
  | 'date_met'
  | 'master_user_id'
  | 'google_drive_link'
  | 'job_pictures_link'

const MERGE_FIELD_KEYS: MergeField[] = [
  'name',
  'address',
  'contact_info',
  'customer_type',
  'date_met',
  'master_user_id',
  'google_drive_link',
  'job_pictures_link',
]

function defaultMergeFieldSource(): Record<MergeField, 'survivor' | 'victim'> {
  return {
    name: 'survivor',
    address: 'survivor',
    contact_info: 'survivor',
    customer_type: 'survivor',
    date_met: 'survivor',
    master_user_id: 'survivor',
    google_drive_link: 'survivor',
    job_pictures_link: 'survivor',
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

type VictimCounts = {
  bids: number
  jobs_ledger: number
  estimates: number
  projects: number
  customer_contacts: number
  customer_contact_persons: number
}

type PreviewMerge = {
  victim_counts: VictimCounts
  victim_has_stripe: boolean
  survivor_has_stripe: boolean
  stripe_blocked: boolean
}

function parsePreviewMerge(data: unknown): PreviewMerge | null {
  if (!isRecord(data)) return null
  const vc = data.victim_counts
  if (!isRecord(vc)) return null
  const num = (k: string) => (typeof vc[k] === 'number' ? vc[k] : Number(vc[k]))
  return {
    victim_counts: {
      bids: num('bids'),
      jobs_ledger: num('jobs_ledger'),
      estimates: num('estimates'),
      projects: num('projects'),
      customer_contacts: num('customer_contacts'),
      customer_contact_persons: num('customer_contact_persons'),
    },
    victim_has_stripe: Boolean(data.victim_has_stripe),
    survivor_has_stripe: Boolean(data.survivor_has_stripe),
    stripe_blocked: Boolean(data.stripe_blocked),
  }
}

function extractContactInfo(ci: Json | null): { phone: string; email: string } {
  if (ci == null) return { phone: '', email: '' }
  if (typeof ci === 'object' && ci !== null) {
    const obj = ci as Record<string, unknown>
    return {
      phone: typeof obj.phone === 'string' ? obj.phone : '',
      email: typeof obj.email === 'string' ? obj.email : '',
    }
  }
  return { phone: '', email: '' }
}

function contactInfoToJson(phone: string, email: string): { phone: string | null; email: string | null } | null {
  const phoneTrimmed = phone.trim()
  const emailTrimmed = email.trim()
  if (!phoneTrimmed && !emailTrimmed) return null
  return {
    phone: phoneTrimmed || null,
    email: emailTrimmed || null,
  }
}

type Props = {
  customerId: string
  onSaved: () => void | Promise<void>
  onCancel: () => void
  onDeleted?: (customerId: string) => void
  onMerged?: (args: { survivorId: string; removedId: string }) => void
}

export default function EditCustomerForm({ customerId, onSaved, onCancel, onDeleted, onMerged }: Props) {
  const { user } = useAuth()
  const { showToast } = useToastContext()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dateMet, setDateMet] = useState('')
  const [googleDriveLink, setGoogleDriveLink] = useState('')
  const [jobPicturesLink, setJobPicturesLink] = useState('')
  // Standing discount (v2.3272; on the real Edit customer form since v2.3281 — it first
  // shipped into an unrouted page): offered on every new job and bill, never inserted by itself.
  const [standingPct, setStandingPct] = useState('')
  const [standingReason, setStandingReason] = useState<string | null>(null)
  // Payment terms (Their Word PR 4): the office's standing decision about this customer.
  const [paymentTerms, setPaymentTerms] = useState<CustomerPaymentTerms>('standard')
  const [paymentTermsNote, setPaymentTermsNote] = useState('')
  const [loadedTerms, setLoadedTerms] = useState('standard|')
  const [customerType, setCustomerType] = useState<'commercial' | 'residential' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  // Payment terms are an office decision (Their Word PR 4): dev / master / assistant-like.
  const canSetTerms = myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)
  const myUserId = user?.id ?? null
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [archivedAt, setArchivedAt] = useState<string | null>(null)
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false)
  const [archiving, setArchiving] = useState(false)
  // Two columns on a desk, one on a phone (the modal itself is 94vw).
  const [narrow, setNarrow] = useState<boolean>(() => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : false))
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 720px)')
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const [mergeExpanded, setMergeExpanded] = useState(false)
  const [mergeCustomers, setMergeCustomers] = useState<CustomerPickRow[]>([])
  const [mergeCustomersLoading, setMergeCustomersLoading] = useState(false)
  const [mergeVictimId, setMergeVictimId] = useState<string | null>(null)
  const [mergeSearchText, setMergeSearchText] = useState('')
  const [mergePreview, setMergePreview] = useState<PreviewMerge | null>(null)
  const [mergePreviewLoading, setMergePreviewLoading] = useState(false)
  const [mergePreviewError, setMergePreviewError] = useState<string | null>(null)
  const [mergeFieldSource, setMergeFieldSource] = useState(defaultMergeFieldSource)
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false)
  const [mergeConfirmText, setMergeConfirmText] = useState('')
  const [merging, setMerging] = useState(false)

  useEffect(() => {
    setMergeExpanded(false)
    setMergeVictimId(null)
    setMergeSearchText('')
    setMergePreview(null)
    setMergePreviewError(null)
    setMergeFieldSource(defaultMergeFieldSource())
    setMergeConfirmOpen(false)
    setMergeConfirmText('')
  }, [customerId])

  useEffect(() => {
    if (!user?.id) {
      return
    }
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setMyRole((data as { role: UserRole } | null)?.role ?? null)
      })
  }, [user?.id])

  useEffect(() => {
    if (
      !mergeExpanded ||
      (myRole !== 'dev' && myRole !== 'master_technician' && !isAssistantLike(myRole))
    )
      return
    setMergeCustomersLoading(true)
    ;(async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase
              .from('customers')
              .select(
                'id, name, address, contact_info, date_met, master_user_id, customer_type, google_drive_link, job_pictures_link',
              )
              .order('name'),
          'customers for merge picker',
        )
        setMergeCustomers((rows ?? []) as CustomerPickRow[])
      } catch (e) {
        showToast(formatErrorMessage(e, 'Could not load customers'), 'error')
        setMergeCustomers([])
      } finally {
        setMergeCustomersLoading(false)
      }
    })()
  }, [mergeExpanded, myRole, showToast])

  useEffect(() => {
    if (!mergeVictimId || mergeVictimId === customerId) {
      setMergePreview(null)
      setMergePreviewError(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setMergePreviewLoading(true)
      setMergePreviewError(null)
      try {
        const raw = await withSupabaseRetry(
          async () =>
            await supabase.rpc('preview_merge_customers', {
              p_survivor: customerId,
              p_victim: mergeVictimId,
            }),
          'preview merge customers',
        )
        if (cancelled) return
        const parsed = parsePreviewMerge(raw)
        if (!parsed) {
          setMergePreviewError('Invalid preview response')
          setMergePreview(null)
        } else {
          setMergePreview(parsed)
        }
      } catch (e) {
        if (!cancelled) {
          const msg = formatErrorMessage(e, 'Preview failed')
          showToast(msg, 'error')
          setMergePreviewError(msg)
          setMergePreview(null)
        }
      } finally {
        if (!cancelled) setMergePreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, mergeVictimId, showToast])

  useEffect(() => {
    if (mergeVictimId) {
      setMergeFieldSource(defaultMergeFieldSource())
    }
  }, [mergeVictimId])

  useEffect(() => {
    if (!customerId) return
    ;(async () => {
      const { data, error: err } = await supabase.from('customers').select('*').eq('id', customerId).single()
      if (err) {
        setError(err.message)
        setFetching(false)
        return
      }
      const row = data as CustomerRow
      setName(row.name)
      setAddress(row.address ?? '')
      const contactInfo = extractContactInfo(row.contact_info)
      setPhone(contactInfo.phone || '')
      setEmail(contactInfo.email || '')
      setDateMet(row.date_met ? (row.date_met.split('T')[0] || '') : '')
      setGoogleDriveLink(row.google_drive_link ?? '')
      setJobPicturesLink(row.job_pictures_link ?? '')
      const standing = standingDiscountFromCustomer(row as { standing_discount_pct?: number | string | null; standing_discount_reason?: string | null })
      setStandingPct(standing ? String(standing.pct) : '')
      setStandingReason(standing?.reason ?? null)
      const termsRow = parseCustomerTerms(row as unknown as Record<string, unknown>)
      setPaymentTerms(termsRow.terms)
      setPaymentTermsNote(termsRow.note ?? '')
      setLoadedTerms(`${termsRow.terms}|${termsRow.note ?? ''}`)
      setCustomerType(
        row.customer_type === 'commercial' || row.customer_type === 'residential'
          ? row.customer_type
          : null
      )
      // Tolerate the column not existing yet (client can deploy before db push).
      setArchivedAt(isCustomerArchived(row) ? row.archived_at : null)
      setFetching(false)
    })()
  }, [customerId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const payload: Record<string, unknown> = {
      name: name.trim(),
      // customers.address mirrors the ★ property row by trigger (v2.3008); the Properties section owns it.
      contact_info: contactInfoToJson(phone, email),
      customer_type: customerType,
      date_met: dateMet.trim() || null,
      // Typed = manual (never auto-overwritten); cleared = null so the
      // clock-session fill (v2.1696) may repopulate it.
      date_met_source: dateMet.trim() ? 'manual' : null,
      google_drive_link: googleDriveLink.trim() || null,
      job_pictures_link: jobPicturesLink.trim() || null,
    }
    const standingNum = parseFloat(standingPct.replace(/[%\s]/g, ''))
    payload.standing_discount_pct = Number.isFinite(standingNum) && standingNum > 0 ? Math.min(100, Math.round(standingNum * 100) / 100) : null
    payload.standing_discount_reason = payload.standing_discount_pct != null ? standingReason : null
    // Payment terms (Their Word PR 4): written only when changed, stamped with who and when.
    if (canSetTerms && `${paymentTerms}|${paymentTermsNote.trim()}` !== loadedTerms) {
      payload.payment_terms = paymentTerms
      payload.payment_terms_note = paymentTermsNote.trim() || null
      payload.payment_terms_set_by = myUserId
      payload.payment_terms_set_at = new Date().toISOString()
    }
    // One company (v2.2972): master_user_id is provenance now — never rewritten on edit.
    const { error: err, data } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', customerId)
      .select('id')
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    // PostgREST returns no error when RLS allows the command but updates 0 rows — treat as failure.
    if (!Array.isArray(data) || data.length === 0) {
      setError(
        'Could not save changes. You may not have permission to update this customer, or the record was not found.',
      )
      return
    }
    await onSaved()
  }

  const mergeList = mergeCustomers.filter((c) => c.id !== customerId)
  const victimRow = mergeVictimId ? mergeList.find((c) => c.id === mergeVictimId) : undefined

  const survivorContactLine = `${email.trim() || '—'} · ${phone.trim() || '—'}`
  const victimContactLine = victimRow
    ? (() => {
        const { email: em, phone: ph } = extractContactFromCustomer(victimRow)
        return `${em || '—'} · ${ph || '—'}`
      })()
    : '—'

  function setFieldSource(field: MergeField, src: 'survivor' | 'victim') {
    setMergeFieldSource((prev) => ({ ...prev, [field]: src }))
  }

  async function runMerge() {
    if (!mergeVictimId || mergeConfirmText.trim().toUpperCase() !== 'MERGE') return
    setMerging(true)
    setError(null)
    try {
      const p_field_choices: Record<string, string> = {}
      for (const k of MERGE_FIELD_KEYS) {
        p_field_choices[k] = mergeFieldSource[k]
      }
      await withSupabaseRetry(
        async () =>
          await supabase.rpc('merge_customers', {
            p_survivor: customerId,
            p_victim: mergeVictimId,
            p_field_choices,
          }),
        'merge customers',
      )
      showToast('Customers merged', 'success')
      setMergeConfirmOpen(false)
      setMergeConfirmText('')
      const removedId = mergeVictimId
      queueMicrotask(() => {
        onMerged?.({ survivorId: customerId, removedId })
      })
      await onSaved()
    } catch (e) {
      showToast(formatErrorMessage(e, 'Merge failed'), 'error')
    } finally {
      setMerging(false)
    }
  }

  const canMerge =
    mergeVictimId &&
    mergePreview &&
    !mergePreview.stripe_blocked &&
    !mergePreviewLoading &&
    !mergePreviewError

  async function setArchived(archive: boolean) {
    setArchiving(true)
    setError(null)
    const nextArchivedAt = archive ? new Date().toISOString() : null
    const { error: err, data } = await supabase
      .from('customers')
      .update({ archived_at: nextArchivedAt, archived_by: archive ? (user?.id ?? null) : null })
      .eq('id', customerId)
      .select('id')
    setArchiving(false)
    if (err) {
      showToast(formatErrorMessage(err, archive ? 'Archive failed' : 'Unarchive failed'), 'error')
      return
    }
    if (!Array.isArray(data) || data.length === 0) {
      showToast('Could not update this customer. You may not have permission.', 'error')
      return
    }
    setArchivedAt(nextArchivedAt)
    setArchiveConfirmOpen(false)
    showToast(archive ? `${name || 'Customer'} archived.` : `${name || 'Customer'} unarchived.`, 'success')
    await onSaved()
  }

  if (fetching) return <p>Loading…</p>

  const showMergeUi = myRole === 'dev' || myRole === 'master_technician' || isAssistantLike(myRole)
  const showArchiveUi = showMergeUi
  const isArchived = archivedAt != null

  return (
    <div>
      <h2 style={{ margin: 0, marginBottom: isArchived ? '0.5rem' : '1rem' }}>Edit customer</h2>
      {isArchived && (
        <p
          style={{
            margin: '0 0 1rem',
            padding: '0.4rem 0.75rem',
            borderRadius: 6,
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-700)',
            fontSize: '0.875rem',
            maxWidth: 720,
            boxSizing: 'border-box',
          }}
        >
          <strong>Archived</strong> {new Date(archivedAt!).toLocaleDateString()} — hidden from the customer list and
          new-link pickers. Existing jobs, bids, and estimates are unaffected.
        </p>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 260px) minmax(0, 1fr)', gap: narrow ? '1.25rem' : '0 1.75rem', alignItems: 'start' }}>
          <div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-name" style={{ display: 'block', marginBottom: 4 }}>
            Name *
          </label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Customer Type</label>
          <div style={{ display: 'flex', gap: 0 }}>
            <button
              type="button"
              onClick={() => setCustomerType('residential')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border-strong)',
                borderRadius: '4px 0 0 4px',
                background: customerType === 'residential' ? '#3b82f6' : 'var(--surface)',
                color: customerType === 'residential' ? 'white' : 'var(--text-700)',
                cursor: 'pointer',
              }}
            >
              Residential
            </button>
            <button
              type="button"
              onClick={() => setCustomerType('commercial')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid var(--border-strong)',
                borderRadius: '0 4px 4px 0',
                background: customerType === 'commercial' ? '#3b82f6' : 'var(--surface)',
                color: customerType === 'commercial' ? 'white' : 'var(--text-700)',
                cursor: 'pointer',
              }}
            >
              Commercial
            </button>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-phone" style={{ display: 'block', marginBottom: 4 }}>
            Phone Number
          </label>
          <input
            id="edit-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-email" style={{ display: 'block', marginBottom: 4 }}>
            Email
          </label>
          <input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-standingPct" style={{ display: 'block', marginBottom: 4 }}>Standing discount</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'stretch', border: '1px solid var(--border-strong)', borderRadius: 6, overflow: 'hidden' }}>
              <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', padding: '0 0.45rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f7a52', background: 'var(--bg-green-100)', borderRight: '1px solid var(--border)' }}>%</span>
              <input
                id="edit-standingPct"
                type="text"
                inputMode="decimal"
                value={standingPct}
                placeholder="none"
                aria-label="Standing discount percent"
                onChange={(e) => setStandingPct(e.target.value.replace(/[^0-9.]/g, ''))}
                style={{ width: '5rem', padding: '0.5rem', border: 'none', textAlign: 'right' }}
              />
            </span>
            <span style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap' }}>
              {DISCOUNT_REASON_PRESETS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setStandingReason((cur) => (cur === r ? null : r))}
                  aria-pressed={standingReason === r}
                  style={{ border: `1px solid ${standingReason === r ? '#0f7a52' : '#a7dcc2'}`, background: standingReason === r ? '#0f7a52' : 'var(--surface)', color: standingReason === r ? '#ffffff' : '#0f7a52', borderRadius: 999, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {r}
                </button>
              ))}
            </span>
          </div>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Offered on every new job and every bill for this customer until it is applied or waved off there — never added by itself. Existing jobs are untouched.
          </p>
        </div>
        {canSetTerms && (
          <div style={{ marginBottom: '1rem' }} data-testid="edit-customer-terms">
            <label htmlFor="edit-paymentTerms" style={{ display: 'block', marginBottom: 4 }}>Payment terms</label>
            <select
              id="edit-paymentTerms"
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(isCustomerPaymentTerms(e.target.value) ? e.target.value : 'standard')}
              style={{ width: '100%', padding: '0.5rem' }}
            >
              {CUSTOMER_PAYMENT_TERMS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={paymentTermsNote}
              onChange={(e) => setPaymentTermsNote(e.target.value.slice(0, 200))}
              placeholder="Note shown with the terms (e.g. ask Malachi before bidding Ph. 2)"
              aria-label="Payment terms note"
              style={{ width: '100%', padding: '0.5rem', marginTop: 6 }}
            />
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {CUSTOMER_PAYMENT_TERMS.find((t) => t.key === paymentTerms)?.hint} Shows on New Bid and New Job for this customer.
            </p>
          </div>
        )}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-dateMet" style={{ display: 'block', marginBottom: 4 }}>
            Date Met
          </label>
          <input
            id="edit-dateMet"
            type="date"
            value={dateMet}
            onChange={(e) => setDateMet(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-customer-folder" style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}>
            Customer Files
          </label>
          <input
            id="edit-customer-folder"
            type="url"
            value={googleDriveLink}
            onChange={(e) => setGoogleDriveLink(e.target.value)}
            placeholder="https://drive.google.com/..."
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
          />
          <a
            href={JOB_FOLDERS_DRIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault()
              openInExternalBrowser(JOB_FOLDERS_DRIVE_URL)
            }}
            style={{ fontSize: '0.8125rem', color: 'var(--text-link)', marginTop: 4, display: 'inline-block' }}
          >
            customer and job folders
          </a>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="edit-customer-job-pictures"
            style={{ display: 'block', marginBottom: 4, fontWeight: 500, fontSize: '0.875rem' }}
          >
            Customer Pictures
          </label>
          <input
            id="edit-customer-job-pictures"
            type="url"
            value={jobPicturesLink}
            onChange={(e) => setJobPicturesLink(e.target.value)}
            placeholder="https://drive.google.com/..."
            style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, fontSize: '0.875rem' }}
          />
          <a
            href={JOB_FOLDERS_DRIVE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.preventDefault()
              openInExternalBrowser(JOB_FOLDERS_DRIVE_URL)
            }}
            style={{ fontSize: '0.8125rem', color: 'var(--text-link)', marginTop: 4, display: 'inline-block' }}
          >
            customer and job folders
          </a>
        </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 }}>
            <CustomerContactsSection customerId={customerId} />
            <CustomerPropertiesSection customerId={customerId} onPrimaryAddressChange={setAddress} />
          </div>
        </div>
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: 'pointer',
                color: 'var(--text-700)',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', alignSelf: 'center' }}>Contacts and properties save as you go.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {showArchiveUi && (
            <button
              type="button"
              disabled={archiving}
              onClick={() => {
                if (isArchived) {
                  void setArchived(false)
                } else {
                  setArchiveConfirmOpen(true)
                }
              }}
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: archiving ? 'not-allowed' : 'pointer',
                color: 'var(--text-700)',
                fontWeight: 500,
                opacity: archiving ? 0.7 : 1,
              }}
            >
              {archiving ? 'Working…' : isArchived ? 'Unarchive' : 'Archive customer'}
            </button>
          )}
          {(myRole === 'dev' || myRole === 'master_technician') && (
            <button
              type="button"
              onClick={() => {
                setDeleteOpen(true)
                setDeleteConfirm('')
                setError(null)
              }}
              title="Delete customer"
              style={{
                padding: '0.5rem',
                color: 'var(--text-red-700)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
              </svg>
            </button>
          )}
          </div>
        </div>
      </form>

      {showMergeUi && (
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: mergeExpanded ? 8 : 0 }}>
            <button
              type="button"
              onClick={() => setMergeExpanded((prev) => !prev)}
              style={{
                padding: 0,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1rem',
                lineHeight: 1,
                color: 'var(--text-700)',
              }}
              aria-expanded={mergeExpanded}
            >
              {mergeExpanded ? '\u25BC' : '\u25B6'}
            </button>
            <span style={{ cursor: 'pointer', fontWeight: 500 }} onClick={() => setMergeExpanded((prev) => !prev)}>
              Merge with another customer
            </span>
          </div>
          {mergeExpanded && (
            <div style={{ fontSize: '0.875rem', maxWidth: 520 }}>
              <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: '0.75rem' }}>
                All bids, jobs, estimates, and projects linked to the other customer move to this one. Then the other
                customer is removed. Choose which values to keep for each field.
              </p>
              <label style={{ display: 'block', marginBottom: 4 }}>Other customer</label>
              <CustomerSearchCombobox
                customers={mergeList}
                loading={mergeCustomersLoading}
                valueId={mergeVictimId}
                searchText={mergeSearchText}
                onSearchTextChange={setMergeSearchText}
                onSelect={(c) => {
                  setMergeVictimId(c.id)
                  setMergeSearchText(getCustomerDisplay(c))
                }}
                onClear={() => {
                  setMergeVictimId(null)
                  setMergeSearchText('')
                  setMergePreview(null)
                }}
                placeholder="Search to merge into this customer…"
                aria-label="Search customer to merge"
              />
              {mergePreviewLoading && <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Loading preview…</p>}
              {mergePreviewError && <p style={{ color: 'var(--text-red-700)', marginTop: 8 }}>{mergePreviewError}</p>}
              {mergePreview && (
                <div style={{ marginTop: '0.75rem' }}>
                  {mergePreview.stripe_blocked && (
                    <p style={{ color: 'var(--text-red-700)', marginBottom: 8 }}>
                      Both customers have different Stripe IDs. Resolve in Stripe before merging.
                    </p>
                  )}
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 6,
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Will re-link from other customer</div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      <li>Bids: {mergePreview.victim_counts.bids}</li>
                      <li>Jobs: {mergePreview.victim_counts.jobs_ledger}</li>
                      <li>Estimates: {mergePreview.victim_counts.estimates}</li>
                      <li>Projects: {mergePreview.victim_counts.projects}</li>
                      <li>CRM contacts: {mergePreview.victim_counts.customer_contacts}</li>
                      <li>Contact persons: {mergePreview.victim_counts.customer_contact_persons}</li>
                    </ul>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Keep values from</div>
                  {victimRow && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <MergeFieldRow
                        fieldId="merge-name"
                        label="Name"
                        survivorValue={`${name.trim() || '—'}`}
                        victimValue={victimRow.name || '—'}
                        selected={mergeFieldSource.name}
                        onChange={(s) => setFieldSource('name', s)}
                      />
                      <MergeFieldRow
                        fieldId="merge-address"
                        label="Address"
                        survivorValue={address.trim() || '—'}
                        victimValue={victimRow.address?.trim() || '—'}
                        selected={mergeFieldSource.address}
                        onChange={(s) => setFieldSource('address', s)}
                      />
                      <MergeFieldRow
                        fieldId="merge-contact"
                        label="Contact (email · phone)"
                        survivorValue={survivorContactLine}
                        victimValue={victimContactLine}
                        selected={mergeFieldSource.contact_info}
                        onChange={(s) => setFieldSource('contact_info', s)}
                      />
                      <MergeFieldRow
                        fieldId="merge-type"
                        label="Customer type"
                        survivorValue={customerType ?? '—'}
                        victimValue={victimRow.customer_type ?? '—'}
                        selected={mergeFieldSource.customer_type}
                        onChange={(s) => setFieldSource('customer_type', s)}
                      />
                      <MergeFieldRow
                        fieldId="merge-date"
                        label="Date met"
                        survivorValue={dateMet.trim() || '—'}
                        victimValue={
                          victimRow.date_met ? (String(victimRow.date_met).split('T')[0] ?? '—') : '—'
                        }
                        selected={mergeFieldSource.date_met}
                        onChange={(s) => setFieldSource('date_met', s)}
                      />
                      <MergeFieldRow
                        fieldId="merge-google-drive"
                        label="Customer Files"
                        survivorValue={googleDriveLink.trim() || '—'}
                        victimValue={victimRow.google_drive_link?.trim() || '—'}
                        selected={mergeFieldSource.google_drive_link}
                        onChange={(s) => setFieldSource('google_drive_link', s)}
                      />
                      <MergeFieldRow
                        fieldId="merge-job-pictures"
                        label="Customer Pictures"
                        survivorValue={jobPicturesLink.trim() || '—'}
                        victimValue={victimRow.job_pictures_link?.trim() || '—'}
                        selected={mergeFieldSource.job_pictures_link}
                        onChange={(s) => setFieldSource('job_pictures_link', s)}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={!canMerge || merging}
                    onClick={() => {
                      setMergeConfirmOpen(true)
                      setMergeConfirmText('')
                    }}
                    style={{
                      marginTop: '1rem',
                      padding: '0.5rem 1rem',
                      background: canMerge ? '#7c3aed' : '#d1d5db',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: canMerge && !merging ? 'pointer' : 'not-allowed',
                      fontWeight: 500,
                    }}
                  >
                    Merge into this customer…
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {archiveConfirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 420 }}>
            <h2 style={{ marginTop: 0 }}>Archive customer</h2>
            <p style={{ marginBottom: '0.5rem' }}>
              Archive <strong>{name}</strong>? Nothing is deleted:
            </p>
            <ul style={{ margin: '0 0 1rem', paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
              <li>Hidden from the Customers list (a "Show archived" toggle reveals them)</li>
              <li>Removed from pickers that link new jobs, bids, estimates, and projects</li>
              <li>Existing jobs, bids, estimates, and projects stay linked and display unchanged</li>
              <li>You can unarchive anytime from this screen</li>
            </ul>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  void setArchived(true)
                }}
                disabled={archiving}
                style={{
                  padding: '0.5rem 1rem',
                  color: 'white',
                  background: '#b45309',
                  border: 'none',
                  borderRadius: 4,
                  cursor: archiving ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={() => setArchiveConfirmOpen(false)}
                disabled={archiving}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: archiving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Delete customer</h2>
            <p style={{ marginBottom: '1rem' }}>
              Type the customer name <strong>{name}</strong> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => {
                setDeleteConfirm(e.target.value)
                setError(null)
              }}
              placeholder="Customer name"
              disabled={deleting}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              autoComplete="off"
            />
            {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (deleteConfirm.trim() !== name.trim()) return
                  setDeleting(true)
                  setError(null)
                  onDeleted?.(customerId)
                  onCancel()
                  setDeleteOpen(false)
                  setDeleting(false)
                  supabase
                    .from('customers')
                    .delete()
                    .eq('id', customerId)
                    .then(({ error: delErr }) => {
                      if (delErr) {
                        showToast(delErr.message, 'error')
                        onSaved()
                      }
                    })
                }}
                disabled={deleting || deleteConfirm.trim() !== name.trim()}
                style={{
                  padding: '0.5rem 1rem',
                  color: 'var(--text-red-700)',
                  background: 'var(--surface)',
                  border: '1px solid #b91c1c',
                  borderRadius: 4,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete customer'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteOpen(false)
                  setDeleteConfirm('')
                  setError(null)
                }}
                disabled={deleting}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {mergeConfirmOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1110 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 420 }}>
            <h2 style={{ marginTop: 0 }}>Confirm merge</h2>
            <p style={{ marginBottom: '1rem' }}>
              This cannot be undone. The customer <strong>{victimRow?.name ?? '—'}</strong> will be removed and all its
              links moved to <strong>{name.trim() || 'this customer'}</strong>. Type <strong>MERGE</strong> to confirm.
            </p>
            <input
              type="text"
              value={mergeConfirmText}
              onChange={(e) => setMergeConfirmText(e.target.value)}
              placeholder="MERGE"
              disabled={merging}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              autoComplete="off"
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  void runMerge()
                }}
                disabled={merging || mergeConfirmText.trim().toUpperCase() !== 'MERGE'}
                style={{
                  padding: '0.5rem 1rem',
                  color: 'white',
                  background: '#7c3aed',
                  border: 'none',
                  borderRadius: 4,
                  cursor: merging ? 'not-allowed' : 'pointer',
                }}
              >
                {merging ? 'Merging…' : 'Merge'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMergeConfirmOpen(false)
                  setMergeConfirmText('')
                }}
                disabled={merging}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-muted)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  cursor: merging ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MergeFieldRow({
  fieldId,
  label,
  survivorValue,
  victimValue,
  selected,
  onChange,
}: {
  fieldId: string
  label: string
  survivorValue: string
  victimValue: string
  selected: 'survivor' | 'victim'
  onChange: (s: 'survivor' | 'victim') => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '88px 1fr',
        gap: '8px 12px',
        alignItems: 'start',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 8,
      }}
    >
      <span style={{ fontWeight: 500, color: 'var(--text-700)' }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}>
          <input type="radio" name={fieldId} checked={selected === 'survivor'} onChange={() => onChange('survivor')} />
          <span style={{ color: 'var(--text-600)', wordBreak: 'break-word' }}>{survivorValue}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}>
          <input type="radio" name={fieldId} checked={selected === 'victim'} onChange={() => onChange('victim')} />
          <span style={{ color: 'var(--text-600)', wordBreak: 'break-word' }}>{victimValue}</span>
        </label>
      </div>
    </div>
  )
}
