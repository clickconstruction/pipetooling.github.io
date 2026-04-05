import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
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

type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor'

type MergeField = 'name' | 'address' | 'contact_info' | 'customer_type' | 'date_met' | 'master_user_id'

const MERGE_FIELD_KEYS: MergeField[] = [
  'name',
  'address',
  'contact_info',
  'customer_type',
  'date_met',
  'master_user_id',
]

function defaultMergeFieldSource(): Record<MergeField, 'survivor' | 'victim'> {
  return {
    name: 'survivor',
    address: 'survivor',
    contact_info: 'survivor',
    customer_type: 'survivor',
    date_met: 'survivor',
    master_user_id: 'survivor',
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

function masterShortLabel(masterId: string, masters: { id: string; name: string; email: string }[]): string {
  const m = masters.find((x) => x.id === masterId)
  if (m) return m.name || m.email || masterId
  return masterId ? `${masterId.slice(0, 8)}…` : '—'
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
  const [customerType, setCustomerType] = useState<'commercial' | 'residential' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [masterUserId, setMasterUserId] = useState('')
  const [availableMasters, setAvailableMasters] = useState<{ id: string; name: string; email: string }[]>([])
  const [mastersLoading, setMastersLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [advancedExpanded, setAdvancedExpanded] = useState(false)

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
    if (!user?.id || (myRole !== 'assistant' && myRole !== 'dev' && myRole !== 'master_technician')) return
    setMastersLoading(true)
    ;(async () => {
      if (myRole === 'assistant') {
        const { data: adoptions, error: adoptionsErr } = await supabase
          .from('master_assistants')
          .select('master_id')
          .eq('assistant_id', user.id)
        if (adoptionsErr) {
          setAvailableMasters([])
          setMastersLoading(false)
          return
        }
        if (!adoptions || adoptions.length === 0) {
          setAvailableMasters([])
          setMastersLoading(false)
          return
        }
        const masterIds = adoptions.map((a) => a.master_id)
        const { data: masters, error: mastersErr } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', masterIds)
          .in('role', ['master_technician'])
          .order('name')
        if (mastersErr) {
          setAvailableMasters([])
        } else {
          setAvailableMasters((masters ?? []) as { id: string; name: string; email: string }[])
        }
      } else if (myRole === 'dev' || myRole === 'master_technician') {
        const { data: masters, error: mastersErr } = await supabase
          .from('users')
          .select('id, name, email')
          .in('role', ['master_technician'])
          .order('name')
        if (mastersErr) {
          setAvailableMasters([])
        } else {
          setAvailableMasters((masters as { id: string; name: string; email: string }[]) ?? [])
        }
      }
      setMastersLoading(false)
    })()
  }, [user?.id, myRole])

  useEffect(() => {
    if (
      !mergeExpanded ||
      (myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'assistant')
    )
      return
    setMergeCustomersLoading(true)
    ;(async () => {
      try {
        const rows = await withSupabaseRetry(
          async () =>
            await supabase
              .from('customers')
              .select('id, name, address, contact_info, date_met, master_user_id, customer_type')
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
      setCustomerType(
        row.customer_type === 'commercial' || row.customer_type === 'residential'
          ? row.customer_type
          : null
      )
      setMasterUserId(row.master_user_id ?? '')
      setFetching(false)
    })()
  }, [customerId])

  useEffect(() => {
    if (mastersLoading || availableMasters.length !== 1) return
    if (masterUserId) return
    setMasterUserId(availableMasters[0]!.id)
  }, [mastersLoading, availableMasters, masterUserId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    let customerMasterId = masterUserId
    if (!customerMasterId && myRole === 'master_technician' && user?.id) customerMasterId = user.id
    const payload: Record<string, unknown> = {
      name: name.trim(),
      address: address.trim() || null,
      contact_info: contactInfoToJson(phone, email),
      customer_type: customerType,
      date_met: dateMet.trim() || null,
    }
    if (customerMasterId) {
      payload.master_user_id = customerMasterId
    }
    const { error: err } = await supabase.from('customers').update(payload).eq('id', customerId)
    setLoading(false)
    if (err) {
      setError(err.message)
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

  if (fetching) return <p>Loading…</p>

  const showMergeUi = myRole === 'dev' || myRole === 'master_technician' || myRole === 'assistant'

  return (
    <div>
      <h2 style={{ margin: 0, marginBottom: '1rem' }}>Edit customer</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
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
          <label htmlFor="edit-address" style={{ display: 'block', marginBottom: 4 }}>
            Address
          </label>
          <input
            id="edit-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
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
          <label style={{ display: 'block', marginBottom: 4 }}>Customer Type</label>
          <div style={{ display: 'flex', gap: 0 }}>
            <button
              type="button"
              onClick={() => setCustomerType('residential')}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                border: '1px solid #d1d5db',
                borderRadius: '4px 0 0 4px',
                background: customerType === 'residential' ? '#3b82f6' : 'white',
                color: customerType === 'residential' ? 'white' : '#374151',
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
                border: '1px solid #d1d5db',
                borderRadius: '0 4px 4px 0',
                background: customerType === 'commercial' ? '#3b82f6' : 'white',
                color: customerType === 'commercial' ? 'white' : '#374151',
                cursor: 'pointer',
              }}
            >
              Commercial
            </button>
          </div>
        </div>
        {(myRole === 'assistant' || myRole === 'dev' || myRole === 'master_technician') && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: advancedExpanded ? 4 : 0 }}>
              <button
                type="button"
                onClick={() => setAdvancedExpanded((prev) => !prev)}
                style={{
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  color: '#374151',
                }}
                aria-expanded={advancedExpanded}
              >
                {advancedExpanded ? '\u25BC' : '\u25B6'}
              </button>
              <span style={{ cursor: 'pointer' }} onClick={() => setAdvancedExpanded((prev) => !prev)}>
                Advanced
              </span>
              {!advancedExpanded && masterUserId && (
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  (Customer Master:{' '}
                  {availableMasters.find((m) => m.id === masterUserId)?.name ??
                    availableMasters.find((m) => m.id === masterUserId)?.email ??
                    'Selected'}
                  )
                </span>
              )}
            </div>
            {advancedExpanded && (
              <div style={{ paddingLeft: '1.25rem', borderLeft: '2px solid #e5e7eb' }}>
                <label htmlFor="edit-master" style={{ display: 'block', marginBottom: 4 }}>
                  Customer Master
                </label>
                {mastersLoading ? (
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading masters...</p>
                ) : (myRole === 'assistant' || myRole === 'dev') && availableMasters.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: '#b91c1c' }}>
                    {myRole === 'assistant'
                      ? 'No masters have adopted you yet. Ask a master to adopt you in Settings.'
                      : 'No masters found.'}
                  </p>
                ) : (
                  <>
                    <select
                      id="edit-master"
                      value={masterUserId}
                      onChange={(e) => setMasterUserId(e.target.value)}
                      disabled={myRole === 'master_technician'}
                      style={{ width: '100%', padding: '0.5rem' }}
                    >
                      <option value="">Select a master...</option>
                      {availableMasters.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.email}
                        </option>
                      ))}
                    </select>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>
                      {myRole === 'master_technician'
                        ? 'You are automatically assigned as the customer owner.'
                        : 'Select which master this customer belongs to.'}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
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
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#374151',
                fontWeight: 500,
              }}
            >
              Cancel
            </button>
          </div>
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
                color: '#b91c1c',
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
      </form>

      {showMergeUi && (
        <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
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
                color: '#374151',
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
              <p style={{ color: '#6b7280', marginTop: 0, marginBottom: '0.75rem' }}>
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
              {mergePreviewLoading && <p style={{ color: '#6b7280', marginTop: 8 }}>Loading preview…</p>}
              {mergePreviewError && <p style={{ color: '#b91c1c', marginTop: 8 }}>{mergePreviewError}</p>}
              {mergePreview && (
                <div style={{ marginTop: '0.75rem' }}>
                  {mergePreview.stripe_blocked && (
                    <p style={{ color: '#b91c1c', marginBottom: 8 }}>
                      Both customers have different Stripe IDs. Resolve in Stripe before merging.
                    </p>
                  )}
                  <div
                    style={{
                      background: '#f9fafb',
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
                        fieldId="merge-master"
                        label="Customer master"
                        survivorValue={masterShortLabel(masterUserId, availableMasters)}
                        victimValue={masterShortLabel(victimRow.master_user_id ?? '', availableMasters)}
                        selected={mergeFieldSource.master_user_id}
                        onChange={(s) => setFieldSource('master_user_id', s)}
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

      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
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
                  color: '#b91c1c',
                  background: 'white',
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
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
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
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320, maxWidth: 420 }}>
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
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
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
        borderBottom: '1px solid #f3f4f6',
        paddingBottom: 8,
      }}
    >
      <span style={{ fontWeight: 500, color: '#374151' }}>{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}>
          <input type="radio" name={fieldId} checked={selected === 'survivor'} onChange={() => onChange('survivor')} />
          <span style={{ color: '#4b5563', wordBreak: 'break-word' }}>{survivorValue}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 6, cursor: 'pointer' }}>
          <input type="radio" name={fieldId} checked={selected === 'victim'} onChange={() => onChange('victim')} />
          <span style={{ color: '#4b5563', wordBreak: 'break-word' }}>{victimValue}</span>
        </label>
      </div>
    </div>
  )
}
