import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'

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

type Props = {
  showQuickFill?: boolean
  onCreated?: (customer: CustomerRow) => void
  onCancel?: () => void
  mode: 'page' | 'modal'
}

export default function NewCustomerForm({ showQuickFill = false, onCreated, onCancel, mode }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dateMet, setDateMet] = useState('')
  const [quickFill, setQuickFill] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [masterUserId, setMasterUserId] = useState('')
  const [availableMasters, setAvailableMasters] = useState<{ id: string; name: string; email: string }[]>([])
  const [mastersLoading, setMastersLoading] = useState(false)
  const [quickFillExpanded, setQuickFillExpanded] = useState(false)
  const [customerMasterExpanded, setCustomerMasterExpanded] = useState(false)

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
    if (!user?.id || (myRole !== 'assistant' && myRole !== 'dev' && myRole !== 'master_technician' && myRole !== 'estimator')) return
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
          .in('role', ['master_technician', 'dev'])
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
          .in('role', ['master_technician', 'dev'])
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if ((myRole === 'assistant' || myRole === 'dev' || myRole === 'estimator') && !masterUserId) {
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
    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      contact_info: contactInfoToJson(phone, email),
      date_met: dateMet.trim() || null,
      master_user_id: customerMasterId,
    }
    const { data, error: err } = await supabase.from('customers').insert(payload).select().single()
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    if (onCreated) {
      onCreated(data as CustomerRow)
    } else {
      navigate('/customers', { replace: true })
    }
  }

  const title = mode === 'modal' ? 'Add customer' : 'New customer'

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
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                color: '#374151',
              }}
            >
              Quick Fill {quickFillExpanded ? '\u25BC' : '\u25B6'}
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
      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
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
          <label htmlFor="ncf-dateMet" style={{ display: 'block', marginBottom: 4 }}>Date Met</label>
          <input
            id="ncf-dateMet"
            type="date"
            value={dateMet}
            onChange={(e) => setDateMet(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {(myRole === 'assistant' || myRole === 'dev' || myRole === 'master_technician' || myRole === 'estimator') && (
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
                  color: '#374151',
                }}
                aria-expanded={customerMasterExpanded}
              >
                {customerMasterExpanded ? '\u25BC' : '\u25B6'}
              </button>
              <label htmlFor="ncf-master" style={{ marginBottom: 0, cursor: 'pointer' }} onClick={() => setCustomerMasterExpanded((e) => !e)}>
                Customer Master {(myRole === 'assistant' || myRole === 'dev' || myRole === 'estimator') ? '*' : ''}
              </label>
              {masterUserId && !customerMasterExpanded && (
                <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  ({availableMasters.find((m) => m.id === masterUserId)?.name || availableMasters.find((m) => m.id === masterUserId)?.email || 'Selected'})
                </span>
              )}
            </div>
            {customerMasterExpanded && (
              <>
                {mastersLoading ? (
                  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading masters...</p>
                ) : (myRole === 'assistant' || myRole === 'dev' || myRole === 'estimator') && availableMasters.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: '#b91c1c' }}>
                    {myRole === 'assistant'
                      ? 'No masters have adopted you yet. Ask a master to adopt you in Settings.'
                      : 'No masters found.'}
                  </p>
                ) : (
                  <>
                    <select
                      id="ncf-master"
                      value={masterUserId}
                      onChange={(e) => setMasterUserId(e.target.value)}
                      required={myRole === 'assistant' || myRole === 'dev' || myRole === 'estimator'}
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
              </>
            )}
          </div>
        )}
        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Saving…' : 'Save'}
          </button>
          {mode === 'page' && <Link to="/customers" style={{ padding: '0.5rem 1rem' }}>Cancel</Link>}
          {mode === 'modal' && onCancel && (
            <button type="button" onClick={onCancel} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
