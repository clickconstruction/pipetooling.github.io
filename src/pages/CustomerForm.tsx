import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'
import type { Json } from '../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

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
        setFetching(false)
      })()
    }
  }, [isNew, id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const payload = {
      name: name.trim(),
      address: address.trim() || null,
      contact_info: contactInfoToJson(phone, email),
      date_met: dateMet.trim() || null,
    }
    if (isNew) {
      if (!user) {
        setError('You must be signed in to create a customer.')
        setLoading(false)
        return
      }
      const { error: err } = await supabase.from('customers').insert({ ...payload, master_user_id: user.id })
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
