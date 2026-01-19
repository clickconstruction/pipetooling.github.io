import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'
import type { Json } from '../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor'

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

function convertDateToISO(dateStr: string): string {
  // Try to parse M/D/YYYY or MM/DD/YYYY format
  const dateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dateMatch && dateMatch[1] && dateMatch[2] && dateMatch[3]) {
    const month = dateMatch[1]
    const day = dateMatch[2]
    const year = dateMatch[3]
    // Format as YYYY-MM-DD for HTML date input
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  return ''
}

function parseQuickFill(input: string): { name: string; address: string; email: string; phone: string; date: string } {
  // Split by tabs or multiple spaces
  const parts = input.split(/\t|\s{2,}/).map((p) => p.trim()).filter((p) => p.length > 0)
  
  let name = ''
  let address = ''
  let email = ''
  let phone = ''
  let date = ''

  // Identify email (contains @)
  const emailIndex = parts.findIndex((p) => p.includes('@'))
  if (emailIndex !== -1 && parts[emailIndex]) {
    email = parts[emailIndex]
    parts.splice(emailIndex, 1)
  }

  // Identify phone (matches phone pattern: numbers, dashes, parentheses, spaces)
  const phonePattern = /[\d\-\(\)\s]+/
  const phoneIndex = parts.findIndex((p) => phonePattern.test(p) && p.replace(/[\d\-\(\)\s]/g, '').length === 0)
  if (phoneIndex !== -1 && parts[phoneIndex]) {
    phone = parts[phoneIndex]
    parts.splice(phoneIndex, 1)
  }

  // Identify date (matches M/D/YYYY or MM/DD/YYYY or YYYY-MM-DD format)
  const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$/
  const dateIndex = parts.findIndex((p) => datePattern.test(p))
  if (dateIndex !== -1 && parts[dateIndex]) {
    date = convertDateToISO(parts[dateIndex])
    parts.splice(dateIndex, 1)
  }

  // First remaining part is name
  if (parts.length > 0 && parts[0]) {
    name = parts[0]
  }

  // Second remaining part is address
  if (parts.length > 1) {
    address = parts.slice(1).filter(Boolean).join(' ')
  }

  return { name, address, email, phone, date }
}

export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isNew = !id

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dateMet, setDateMet] = useState('')
  const [quickFill, setQuickFill] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(!isNew)
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [masterUserId, setMasterUserId] = useState('')
  const [availableMasters, setAvailableMasters] = useState<{ id: string; name: string; email: string }[]>([])
  const [mastersLoading, setMastersLoading] = useState(false)

  function handleQuickFill() {
    const parsed = parseQuickFill(quickFill)
    if (parsed.name) setName(parsed.name)
    if (parsed.address) setAddress(parsed.address)
    if (parsed.email) setEmail(parsed.email || '')
    if (parsed.phone) setPhone(parsed.phone || '')
    if (parsed.date) setDateMet(parsed.date || '')
    setQuickFill('')
  }

  // Load user role
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setMyRole((data as { role: UserRole } | null)?.role ?? null))
  }, [user?.id])

  // Load masters for assistants and devs (for assistants: only adopted masters; for devs/masters: all masters)
  useEffect(() => {
    if (!user?.id || (myRole !== 'assistant' && myRole !== 'dev' && myRole !== 'master_technician')) return
    
    setMastersLoading(true)
    ;(async () => {
      if (myRole === 'assistant') {
        // For assistants: Get masters who have adopted this assistant
        const { data: adoptions, error: adoptionsErr } = await supabase
          .from('master_assistants')
          .select('master_id')
          .eq('assistant_id', user.id)
        
        if (adoptionsErr) {
          console.error('Error loading adoptions:', adoptionsErr)
          setAvailableMasters([])
          setMastersLoading(false)
          return
        }
        
        if (!adoptions || adoptions.length === 0) {
          setAvailableMasters([])
          setMastersLoading(false)
          return
        }
        
        const masterIds = adoptions.map(a => a.master_id)
        const { data: masters, error: mastersErr } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', masterIds)
          .in('role', ['master_technician', 'dev'])
          .order('name')
        
        if (mastersErr) {
          console.error('Error loading masters:', mastersErr)
          setAvailableMasters([])
        } else {
          setAvailableMasters((masters as { id: string; name: string; email: string }[]) ?? [])
          // Auto-select first master if only one option (only for new customers)
          if (isNew && masters && masters.length === 1) {
            const onlyMaster = (masters as { id: string; name: string; email: string }[])[0]
            setMasterUserId(onlyMaster.id)
          }
        }
      } else if (myRole === 'dev' || myRole === 'master_technician') {
        // For devs and masters: Load all masters (master_technician and dev roles)
        const { data: masters, error: mastersErr } = await supabase
          .from('users')
          .select('id, name, email')
          .in('role', ['master_technician', 'dev'])
          .order('name')
        
        if (mastersErr) {
          console.error('Error loading masters:', mastersErr)
          setAvailableMasters([])
        } else {
          setAvailableMasters((masters as { id: string; name: string; email: string }[]) ?? [])
        }
      }
      setMastersLoading(false)
    })()
  }, [isNew, user?.id, myRole])

  // Auto-set master_user_id for masters only (devs and assistants must select)
  useEffect(() => {
    if (!isNew || !user?.id) return
    
    if (myRole === 'master_technician') {
      // Masters own their customers automatically
      setMasterUserId(user.id)
    }
    // Devs and assistants must manually select a master - no auto-set
  }, [isNew, user?.id, myRole])

  useEffect(() => {
    if (!isNew && id) {
      (async () => {
        const { data, error: err } = await supabase.from('customers').select('*').eq('id', id).single()
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
        setMasterUserId(row.master_user_id ?? '')
        setFetching(false)
      })()
    }
  }, [isNew, id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    
    if (isNew && (myRole === 'assistant' || myRole === 'dev') && !masterUserId) {
      setError('Please select a customer owner (master).')
      setLoading(false)
      return
    }
    
    setLoading(true)
    
    // Determine master_user_id
    let customerMasterId = masterUserId
    if (!customerMasterId) {
      // For masters, use their own ID
      if (myRole === 'master_technician' && user?.id) {
        customerMasterId = user.id
      }
    }
    
    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      contact_info: contactInfoToJson(phone, email),
      date_met: dateMet.trim() || null,
      master_user_id: customerMasterId || null,
    }
    if (isNew) {
      if (!user) {
        setError('You must be signed in to create a customer.')
        setLoading(false)
        return
      }
      const { error: err } = await supabase.from('customers').insert(payload)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      navigate('/customers', { replace: true })
    } else {
      const { error: err } = await supabase.from('customers').update(payload).eq('id', id!)
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      navigate('/customers', { replace: true })
    }
    setLoading(false)
  }

  if (!isNew && fetching) return <p>Loading…</p>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>{isNew ? 'New customer' : 'Edit customer'}</h1>
        <div style={{ width: 300, marginLeft: '2rem' }}>
          <label htmlFor="quickFill" style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>Quick Fill</label>
          <textarea
            id="quickFill"
            value={quickFill}
            onChange={(e) => setQuickFill(e.target.value)}
            placeholder="Paste: Name	Address	Email	Phone	Date (M/D/YYYY)"
            rows={3}
            style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }}
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
      </div>
      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="address" style={{ display: 'block', marginBottom: 4 }}>Address</label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="phone" style={{ display: 'block', marginBottom: 4 }}>Phone Number</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="dateMet" style={{ display: 'block', marginBottom: 4 }}>Date Met</label>
          <input
            id="dateMet"
            type="date"
            value={dateMet}
            onChange={(e) => setDateMet(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {(myRole === 'assistant' || myRole === 'dev' || myRole === 'master_technician') && (
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="master" style={{ display: 'block', marginBottom: 4 }}>
              Customer Owner (Master) {isNew && (myRole === 'assistant' || myRole === 'dev') ? '*' : ''}
            </label>
            {mastersLoading ? (
              <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading masters...</p>
            ) : isNew && (myRole === 'assistant' || myRole === 'dev') && availableMasters.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: '#b91c1c' }}>
                {myRole === 'assistant' 
                  ? 'No masters have adopted you yet. Ask a master to adopt you in Settings.'
                  : 'No masters found.'}
              </p>
            ) : (
              <>
                <select
                  id="master"
                  value={masterUserId}
                  onChange={(e) => setMasterUserId(e.target.value)}
                  required={isNew && (myRole === 'assistant' || myRole === 'dev')}
                  disabled={isNew && myRole === 'master_technician'}
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
                  {isNew && myRole === 'master_technician' 
                    ? 'You are automatically assigned as the customer owner.'
                    : 'Select which master this customer belongs to.'}
                </div>
              </>
            )}
          </div>
        )}
        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Saving…' : 'Save'}
          </button>
          <Link to="/customers" style={{ padding: '0.5rem 1rem' }}>Cancel</Link>
        </div>
      </form>
    </div>
  )
}
