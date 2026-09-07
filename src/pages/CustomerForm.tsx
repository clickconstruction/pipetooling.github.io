import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import NewCustomerForm from '../components/NewCustomerForm'
import type { Database } from '../types/database'
import type { Json } from '../types/database'

type CustomerRow = Database['public']['Tables']['customers']['Row']
type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'helpers'

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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(!isNew)
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Load user role (gates the danger zone below)
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
    if (!id) return
    ;(async () => {
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
  }, [id])

  if (isNew) {
    return <NewCustomerForm showQuickFill mode="page" />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const payload: any = {
      name: name.trim(),
      address: address.trim() || null,
      contact_info: contactInfoToJson(phone, email),
      date_met: dateMet.trim() || null,
      date_met_source: dateMet.trim() ? 'manual' : null,
    }
    const { error: err } = await supabase.from('customers').update(payload).eq('id', id!)
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/customers', { replace: true })
  }

  if (fetching) return <p>Loading…</p>

  return (
    <div>
      <h1 style={{ margin: 0, marginBottom: '1rem' }}>Edit customer</h1>
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
        {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Saving…' : 'Save'}
          </button>
          <Link to="/customers" style={{ padding: '0.5rem 1rem' }}>Cancel</Link>
        </div>
      </form>

      {(myRole === 'dev' || myRole === 'master_technician') && (
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)', maxWidth: 400 }}>
          <button type="button" onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setError(null) }} style={{ padding: '0.5rem 1rem', color: 'var(--text-red-700)' }}>
            Delete customer
          </button>
        </div>
      )}

      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div role="dialog" aria-modal="true" style={{ background: 'var(--surface)', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Delete customer</h2>
            <p style={{ marginBottom: '1rem' }}>Type the customer name <strong>{name}</strong> to confirm.</p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => { setDeleteConfirm(e.target.value); setError(null) }}
              placeholder="Customer name"
              disabled={deleting}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem' }}
              autoComplete="off"
            />
            {error && <p style={{ color: 'var(--text-red-700)', marginBottom: '1rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={async () => {
                  if (!id || deleteConfirm.trim() !== name.trim()) return
                  setDeleting(true)
                  setError(null)
                  const { error: delErr } = await supabase
                    .from('customers')
                    .delete()
                    .eq('id', id)
                  setDeleting(false)
                  if (delErr) {
                    setError(delErr.message)
                    return
                  }
                  setDeleteOpen(false)
                  navigate('/customers', { replace: true })
                }}
                disabled={deleting || deleteConfirm.trim() !== name.trim()}
                style={{ padding: '0.5rem 1rem', color: 'var(--text-red-700)', background: 'var(--surface)', border: '1px solid #b91c1c', borderRadius: 4, cursor: deleting ? 'not-allowed' : 'pointer' }}
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
                style={{ padding: '0.5rem 1rem', background: 'var(--bg-muted)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: deleting ? 'not-allowed' : 'pointer' }}
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
