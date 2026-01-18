import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Database } from '../types/database'
import type { Json } from '../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']

function contactInfoToText(ci: Json | null): string {
  if (ci == null) return ''
  if (typeof ci === 'string') return ci
  if (typeof ci === 'object' && ci !== null && 'notes' in ci && typeof (ci as { notes?: unknown }).notes === 'string')
    return (ci as { notes: string }).notes
  if (typeof ci === 'object' && ci !== null && 'raw' in ci && typeof (ci as { raw?: unknown }).raw === 'string')
    return (ci as { raw: string }).raw
  try {
    return JSON.stringify(ci)
  } catch {
    return ''
  }
}

function textToContactInfo(value: string): { notes: string } | null {
  const t = value.trim()
  if (!t) return null
  return { notes: t }
}

export default function CustomerForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isNew = !id

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [contactInfo, setContactInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(!isNew)

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
        setContactInfo(contactInfoToText(row.contact_info))
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
      contact_info: textToContactInfo(contactInfo),
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
      <h1 style={{ marginBottom: '1rem' }}>{isNew ? 'New customer' : 'Edit customer'}</h1>
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
          <label htmlFor="contact" style={{ display: 'block', marginBottom: 4 }}>Contact info (e.g. phone, email)</label>
          <textarea
            id="contact"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            rows={2}
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
