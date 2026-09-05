import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'
import { isAssistantLike } from '../lib/subcontractorLikeRole'
import {
  CONVERTIBLE_PROSPECT_COLUMNS,
  canAccessProspectPipeline,
  customerDraftFromProspect,
  markProspectConverted,
  prospectChipLabel,
  recordProspectConverted,
  searchProspectsForCustomerForm,
  type ConvertibleProspect,
  type ProspectConversionLane,
} from '../lib/prospects/prospectConversion'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers' | 'estimator'

function contactInfoToJson(phone: string, email: string): { phone: string | null; email: string | null } | null {
  const phoneTrimmed = phone.trim()
  const emailTrimmed = email.trim()
  if (!phoneTrimmed && !emailTrimmed) return null
  return {
    phone: phoneTrimmed || null,
    email: emailTrimmed || null,
  }
}

function convertDateToISO(dateStr: string): string {
  const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
    const month = dateMatch[1]
    const day = dateMatch[2]
    const year = dateMatch[3]
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr
  return ''
}

function parseQuickFill(input: string): { name: string; address: string; email: string; phone: string; date: string } {
  const parts = input.split(/\t|\s{2,}/).map((p) => p.trim()).filter((p) => p.length > 0)
  let name = ''
  let address = ''
  let email = ''
  let phone = ''
  let date = ''

  const emailIndex = parts.findIndex((p) => p.includes('@'))
  if (emailIndex !== -1 && parts[emailIndex]) {
    email = parts[emailIndex]
    parts.splice(emailIndex, 1)
  }

  const phonePattern = /[\d\-\(\)\s]+/
  const phoneIndex = parts.findIndex((p) => phonePattern.test(p) && p.replace(/[\d\-\(\)\s]/g, '').length === 0)
  if (phoneIndex !== -1 && parts[phoneIndex]) {
    phone = parts[phoneIndex]
    parts.splice(phoneIndex, 1)
  }

  const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$/
  const dateIndex = parts.findIndex((p) => datePattern.test(p))
  if (dateIndex !== -1 && parts[dateIndex]) {
    date = convertDateToISO(parts[dateIndex])
    parts.splice(dateIndex, 1)
  }

  if (parts.length > 0 && parts[0]) name = parts[0]
  if (parts.length > 1) address = parts.slice(1).filter(Boolean).join(' ')

  return { name, address, email, phone, date }
}

export type NewCustomerInitialValues = {
  name?: string
  address?: string
  phone?: string
  email?: string
  dateMet?: string
}

export type NewCustomerFormPayload = {
  name: string
  address: string | null
  contact_info: { phone: string | null; email: string | null } | null
  customer_type: 'commercial' | 'residential' | null
  date_met: string | null
  master_user_id: string
}

/** Reported with the new row: which prospect (if any) Save just marked converted. */
export type NewCustomerCreatedMeta = {
  convertedProspectId: string | null
}

type Props = {
  showQuickFill?: boolean
  onCreated?: (customer: CustomerRow, meta?: NewCustomerCreatedMeta) => void
  onCancel?: () => void
  mode: 'page' | 'modal'
  initialValues?: NewCustomerInitialValues
  /** When provided, form submit calls this instead of creating customer (for Convert flow) */
  onSubmitForConvert?: (payload: NewCustomerFormPayload) => Promise<void>
  /**
   * A prospect already linked when the form opens (Follow Up's "Converted ✓").
   * Save marks it converted with the new customer id; the user can unlink it.
   */
  sourceProspect?: ConvertibleProspect | null
  /** Telemetry lane for `prospect_converted{lane}`; defaults to `add-customer`. */
  conversionLane?: ProspectConversionLane
}

export default function NewCustomerForm({ showQuickFill = false, onCreated, onCancel, mode, initialValues, onSubmitForConvert, sourceProspect, conversionLane = 'add-customer' }: Props) {
  const navigate = useNavigate()
  const { user, role: authRole, estimatorProspectsAccess } = useAuth()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [address, setAddress] = useState(initialValues?.address ?? '')
  const [phone, setPhone] = useState(initialValues?.phone ?? '')
  const [email, setEmail] = useState(initialValues?.email ?? '')
  const [dateMet, setDateMet] = useState(initialValues?.dateMet ?? '')
  const [quickFill, setQuickFill] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [masterUserId, setMasterUserId] = useState('')
  const [availableMasters, setAvailableMasters] = useState<{ id: string; name: string; email: string }[]>([])
  const [mastersLoading, setMastersLoading] = useState(false)
  const [quickFillExpanded, setQuickFillExpanded] = useState(false)
  const [customerMasterExpanded, setCustomerMasterExpanded] = useState(false)
  const [customerType, setCustomerType] = useState<'commercial' | 'residential'>('commercial')

  // "Started as a prospect?" (v2.2879, J34-F4): the pipeline's finish line lives
  // where customers are actually minted. Shown only to roles that can see the
  // customer pipeline (same gate as Prospects → Follow Up) and never inside the
  // Convert tab, which has its own picker. Prospects load once, on first use.
  const showProspectSearch = !onSubmitForConvert && canAccessProspectPipeline(authRole, estimatorProspectsAccess)
  const [linkedProspect, setLinkedProspect] = useState<ConvertibleProspect | null>(sourceProspect ?? null)
  const [prospectQuery, setProspectQuery] = useState('')
  const [prospectPool, setProspectPool] = useState<ConvertibleProspect[] | null>(null)
  const [prospectPoolLoading, setProspectPoolLoading] = useState(false)
  const prospectResults = prospectPool ? searchProspectsForCustomerForm(prospectPool, prospectQuery) : []

  useEffect(() => {
    setLinkedProspect(sourceProspect ?? null)
  }, [sourceProspect])

  // One-shot pool load on the first keystroke (~300 rows; the Prospects page
  // loads the same set). Keystrokes must not cancel it, so the only guard is
  // the loading flag plus an unmount check.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  useEffect(() => {
    if (!showProspectSearch || prospectPool !== null || prospectPoolLoading) return
    if (!prospectQuery.trim()) return
    setProspectPoolLoading(true)
    void (async () => {
      const { data, error: loadErr } = await supabase
        .from('prospects')
        .select(CONVERTIBLE_PROSPECT_COLUMNS)
        .order('company_name', { ascending: true })
      if (!mountedRef.current) return
      setProspectPool(loadErr ? [] : ((data ?? []) as ConvertibleProspect[]))
      setProspectPoolLoading(false)
    })()
  }, [showProspectSearch, prospectQuery, prospectPool, prospectPoolLoading])

  function linkProspect(p: ConvertibleProspect) {
    setLinkedProspect(p)
    setProspectQuery('')
    const draft = customerDraftFromProspect(p)
    if (draft.name) setName(draft.name)
    if (draft.address) setAddress(draft.address)
    if (draft.phone) setPhone(draft.phone)
    if (draft.email) setEmail(draft.email)
  }

  function handleQuickFill() {
    const parsed = parseQuickFill(quickFill)
    if (parsed.name) setName(parsed.name)
    if (parsed.address) setAddress(parsed.address)
    if (parsed.email) setEmail(parsed.email || '')
    if (parsed.phone) setPhone(parsed.phone || '')
    if (parsed.date) setDateMet(parsed.date || '')
    setQuickFill('')
  }

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setMyRole((data as { role: UserRole } | null)?.role ?? null))
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || (!isAssistantLike(myRole) && myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'estimator')) return
    setMastersLoading(true)
    ;(async () => {
      if (isAssistantLike(myRole)) {
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
          const typedMasters = (masters ?? []) as { id: string; name: string; email: string }[]
          setAvailableMasters(typedMasters)
          if (typedMasters.length === 1) {
            setMasterUserId(typedMasters[0]!.id)
          } else {
            const malachi = typedMasters.find((m) => (m.name || '').toLowerCase().includes('malachi'))
            if (malachi) setMasterUserId(malachi.id)
          }
        }
      } else if (myRole === 'dev' || myRole === 'master_technician' || myRole === 'estimator') {
        const { data: masters, error: mastersErr } = await supabase
          .from('users')
          .select('id, name, email')
          .in('role', ['master_technician'])
          .order('name')
        if (mastersErr) {
          setAvailableMasters([])
        } else {
          const typedMasters = (masters as { id: string; name: string; email: string }[]) ?? []
          setAvailableMasters(typedMasters)
          const malachi = typedMasters.find((m) => (m.name || '').toLowerCase().includes('malachi'))
          if (malachi) setMasterUserId(malachi.id)
        }
      }
      setMastersLoading(false)
    })()
  }, [user?.id, myRole])

  useEffect(() => {
    if (!user?.id) return
    if (myRole === 'master_technician') setMasterUserId(user.id)
  }, [user?.id, myRole])

  useEffect(() => {
    if (initialValues) {
      if (initialValues.name !== undefined) setName(initialValues.name)
      if (initialValues.address !== undefined) setAddress(initialValues.address)
      if (initialValues.phone !== undefined) setPhone(initialValues.phone)
      if (initialValues.email !== undefined) setEmail(initialValues.email)
      if (initialValues.dateMet !== undefined) setDateMet(initialValues.dateMet)
    }
  }, [initialValues?.name, initialValues?.address, initialValues?.phone, initialValues?.email, initialValues?.dateMet])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if ((isAssistantLike(myRole) || myRole === 'dev' || myRole === 'estimator') && !masterUserId) {
      setError('Please select a customer owner (master).')
      return
    }
    if (!user) {
      setError('You must be signed in to create a customer.')
      return
    }
    setLoading(true)
    let customerMasterId = masterUserId
    if (!customerMasterId && myRole === 'master_technician') customerMasterId = user.id
    if (!customerMasterId) customerMasterId = user.id
    const payload: NewCustomerFormPayload = {
      name: name.trim(),
      address: address.trim() || null,
      contact_info: contactInfoToJson(phone, email),
      customer_type: customerType,
      date_met: dateMet.trim() || null,
      master_user_id: customerMasterId,
    }
    if (onSubmitForConvert) {
      try {
        await onSubmitForConvert(payload)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to convert')
      } finally {
        setLoading(false)
      }
      return
    }
    const { data, error: err } = await supabase.from('customers').insert(payload).select().single()
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    if (!data) {
      setError('Customer was created but could not be loaded. Refresh the page and search again.')
      return
    }
    const created = data as CustomerRow
    // Close the loop on the prospect only now — Save is the confirm (decision
    // #17); Cancel above writes nothing. The customer already exists, so a
    // failure here is logged and never blocks the hand-off.
    let convertedProspectId: string | null = null
    if (linkedProspect && showProspectSearch) {
      const marked = await markProspectConverted(linkedProspect.id, created.id, payload.name, user.id)
      if (marked.ok) {
        convertedProspectId = linkedProspect.id
        recordProspectConverted(user.id, authRole, conversionLane)
      } else {
        console.error('[NewCustomerForm] failed to mark prospect converted:', marked.error)
      }
    }
    if (onCreated) {
      // Defer so React flushes state before closing modal and refreshing
      setTimeout(() => onCreated(created, { convertedProspectId }), 0)
    } else {
      navigate('/customers', { replace: true })
    }
  }

  const title = mode === 'modal' ? 'Add customer' : 'New customer'

  const missingFields: string[] = []
  if ((isAssistantLike(myRole) || myRole === 'dev' || myRole === 'estimator') && !masterUserId) missingFields.push('Master')
  const canSubmit = missingFields.length === 0

  return (
    <div>
      {showQuickFill && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>{title}</h1>
            <button
              type="button"
              onClick={() => setQuickFillExpanded((e) => !e)}
              style={{
                padding: '0.375rem 0.5rem',
                background: 'none',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: 'var(--text-700)',
              }}
            >
              Paste Fill {quickFillExpanded ? '\u25BC' : '\u25B6'}
            </button>
          </div>
          {quickFillExpanded && (
            <div style={{ marginTop: '0.75rem', width: 300 }}>
              <label htmlFor="quickFill" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Paste: Name	Address	Email	Phone	Date (M/D/YYYY)</label>
              <textarea
                id="quickFill"
                value={quickFill}
                onChange={(e) => setQuickFill(e.target.value)}
                placeholder="Name	Address	Email	Phone	Date (M/D/YYYY)"
                rows={3}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace', boxSizing: 'border-box' }}
              />
              <button
                type="button"
                onClick={handleQuickFill}
                disabled={!quickFill.trim()}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.375rem 0.75rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: quickFill.trim() ? 'pointer' : 'not-allowed',
                  opacity: quickFill.trim() ? 1 : 0.5,
                }}
              >
                Fill Fields
              </button>
            </div>
          )}
        </div>
      )}
      {!showQuickFill && <h2 style={{ margin: '0 0 1rem 0' }}>{title}</h2>}
      <form id={onSubmitForConvert ? 'convert-customer-form' : undefined} onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        {showProspectSearch && (
          <div style={{ marginBottom: '1rem' }} data-testid="ncf-prospect-search">
            <label htmlFor="ncf-prospect" style={{ display: 'block', marginBottom: 4 }}>Started as a prospect?</label>
            {linkedProspect ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.375rem 0.625rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 6,
                  background: 'var(--bg-muted)',
                  fontSize: '0.875rem',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: 'var(--text-muted)' }}>From prospect: </span>
                  <span style={{ fontWeight: 600 }}>{prospectChipLabel(linkedProspect)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setLinkedProspect(null)}
                  title="Not from this prospect — saving will leave it in the calling queue"
                  aria-label="Unlink prospect"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <input
                  id="ncf-prospect"
                  type="search"
                  value={prospectQuery}
                  onChange={(e) => setProspectQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const first = prospectResults[0]
                      if (first) linkProspect(first)
                    }
                  }}
                  placeholder="Search prospects by company, contact, phone, or address…"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
                />
                {prospectQuery.trim() !== '' && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', marginTop: '0.25rem', overflow: 'hidden' }}>
                    {prospectPool === null || prospectPoolLoading ? (
                      <p style={{ margin: 0, padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>Loading prospects…</p>
                    ) : prospectResults.length === 0 ? (
                      <p style={{ margin: 0, padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>No open prospects match — fine, just fill the form in.</p>
                    ) : (
                      prospectResults.map((p, i) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => linkProspect(p)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: '0.5rem 0.75rem',
                            border: 'none',
                            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                            background: 'none',
                            cursor: 'pointer',
                            color: 'inherit',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{p.company_name || p.contact_name || '—'}</span>
                          {p.company_name && p.contact_name && <span style={{ color: 'var(--text-muted)' }}> — {p.contact_name}</span>}
                          {(p.phone_number || p.address) && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {[p.phone_number, p.address].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Pick one to prefill the form; saving marks the prospect converted and takes it out of the calling queue.
                </div>
              </>
            )}
          </div>
        )}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="ncf-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
          <input
            id="ncf-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="ncf-address" style={{ display: 'block', marginBottom: 4 }}>Address</label>
          <input
            id="ncf-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="ncf-phone" style={{ display: 'block', marginBottom: 4 }}>Phone Number</label>
          <input
            id="ncf-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="ncf-email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
          <input
            id="ncf-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="ncf-customerType" style={{ display: 'block', marginBottom: 4 }}>Customer Type</label>
          <select
            id="ncf-customerType"
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value as 'commercial' | 'residential')}
            style={{ width: '100%', padding: '0.5rem' }}
          >
            <option value="commercial">Commercial</option>
            <option value="residential">Residential</option>
          </select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="ncf-dateMet" style={{ display: 'block', marginBottom: 4 }}>Date Met</label>
          <input
            id="ncf-dateMet"
            type="date"
            value={dateMet}
            onChange={(e) => setDateMet(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {(isAssistantLike(myRole) || myRole === 'dev' || myRole === 'master_technician' || myRole === 'estimator') && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => setCustomerMasterExpanded((e) => !e)}
                style={{
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  lineHeight: 1,
                  color: 'var(--text-700)',
                }}
                aria-expanded={customerMasterExpanded}
              >
                {customerMasterExpanded ? '\u25BC' : '\u25B6'}
              </button>
              <label htmlFor="ncf-master" style={{ marginBottom: 0, cursor: 'pointer' }} onClick={() => setCustomerMasterExpanded((e) => !e)}>
                Customer Master {(isAssistantLike(myRole) || myRole === 'dev' || myRole === 'estimator') ? '*' : ''}
              </label>
              {masterUserId && !customerMasterExpanded && (
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  ({availableMasters.find((m) => m.id === masterUserId)?.name || availableMasters.find((m) => m.id === masterUserId)?.email || 'Selected'})
                </span>
              )}
            </div>
            {customerMasterExpanded && (
              <>
                {mastersLoading ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading masters...</p>
                ) : (isAssistantLike(myRole) || myRole === 'dev' || myRole === 'estimator') && availableMasters.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-red-700)' }}>
                    {isAssistantLike(myRole)
                      ? 'No masters have adopted you yet. Ask a master to adopt you in Settings.'
                      : 'No masters found.'}
                  </p>
                ) : (
                  <>
                    <select
                      id="ncf-master"
                      value={masterUserId}
                      onChange={(e) => setMasterUserId(e.target.value)}
                      required={isAssistantLike(myRole) || myRole === 'dev' || myRole === 'estimator'}
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
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {myRole === 'master_technician'
                        ? 'You are automatically assigned as the customer owner.'
                        : 'Select which master this customer belongs to.'}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        {!onSubmitForConvert && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={!canSubmit || loading}
              title={!canSubmit ? `Required: ${missingFields.join(', ')}` : undefined}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
                fontWeight: 500,
                opacity: canSubmit && !loading ? 1 : 0.7,
              }}
            >
              {loading ? 'Saving…' : 'Save'}
            </button>
            {!canSubmit && !loading && missingFields.length > 0 && (
              <span style={{ fontSize: '0.8rem', color: '#FF6600', marginLeft: '0.5rem', display: 'inline-block' }}>
                <span style={{ display: 'block' }}>Required:</span>
                {missingFields.map((f) => (
                  <span key={f} style={{ display: 'block', marginLeft: '0.25em' }}>{f}</span>
                ))}
              </span>
            )}
            {mode === 'page' && <Link to="/customers" style={{ padding: '0.5rem 1rem' }}>Cancel</Link>}
            {mode === 'modal' && onCancel && (
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
            )}
          </div>
        )}
      </form>
    </div>
  )
}
