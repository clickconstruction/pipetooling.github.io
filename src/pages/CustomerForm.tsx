import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import NewCustomerForm from '../components/NewCustomerForm'
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
  const [masterUserId, setMasterUserId] = useState('')
  const [availableMasters, setAvailableMasters] = useState<{ id: string; name: string; email: string }[]>([])
  const [mastersLoading, setMastersLoading] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Load user role (edit form uses for master dropdown)
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setMyRole((data as { role: UserRole } | null)?.role ?? null))
  }, [user?.id])

  // Load masters for edit form dropdown
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
      setMasterUserId(row.master_user_id ?? '')
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
    let customerMasterId = masterUserId
    if (!customerMasterId && myRole === 'master_technician' && user?.id) customerMasterId = user.id
    const payload: any = {
      name: name.trim(),
      address: address.trim() || null,
      contact_info: contactInfoToJson(phone, email),
      date_met: dateMet.trim() || null,
    }
    if (customerMasterId) {
      payload.master_user_id = customerMasterId
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
        {(myRole === 'assistant' || myRole === 'dev' || myRole === 'master_technician') && (
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="master" style={{ display: 'block', marginBottom: 4 }}>Customer Master</label>
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
                  id="master"
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
        {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Saving…' : 'Save'}
          </button>
          <Link to="/customers" style={{ padding: '0.5rem 1rem' }}>Cancel</Link>
        </div>
      </form>

      {(myRole === 'dev' || myRole === 'master_technician') && (
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb', maxWidth: 400 }}>
          <button type="button" onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setError(null) }} style={{ padding: '0.5rem 1rem', color: '#b91c1c' }}>
            Delete customer
          </button>
        </div>
      )}

      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
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
            {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
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
                style={{ padding: '0.5rem 1rem', color: '#b91c1c', background: 'white', border: '1px solid #b91c1c', borderRadius: 4, cursor: deleting ? 'not-allowed' : 'pointer' }}
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
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: deleting ? 'not-allowed' : 'pointer' }}
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
