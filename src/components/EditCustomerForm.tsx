import { useEffect, useState } from 'react'
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

type Props = {
  customerId: string
  onSaved: () => void
  onCancel: () => void
}

export default function EditCustomerForm({ customerId, onSaved, onCancel }: Props) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dateMet, setDateMet] = useState('')
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
      setMasterUserId(row.master_user_id ?? '')
      setFetching(false)
    })()
  }, [customerId])

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
    onSaved()
  }

  if (fetching) return <p>Loading…</p>

  return (
    <div>
      <h2 style={{ margin: 0, marginBottom: '1rem' }}>Edit customer</h2>
      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
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
          <label htmlFor="edit-address" style={{ display: 'block', marginBottom: 4 }}>Address</label>
          <input
            id="edit-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-phone" style={{ display: 'block', marginBottom: 4 }}>Phone Number</label>
          <input
            id="edit-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-email" style={{ display: 'block', marginBottom: 4 }}>Email</label>
          <input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="edit-dateMet" style={{ display: 'block', marginBottom: 4 }}>Date Met</label>
          <input
            id="edit-dateMet"
            type="date"
            value={dateMet}
            onChange={(e) => setDateMet(e.target.value)}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {(myRole === 'assistant' || myRole === 'dev' || myRole === 'master_technician') && (
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="edit-master" style={{ display: 'block', marginBottom: 4 }}>Customer Master</label>
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
              onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setError(null) }}
              title="Delete customer"
              style={{ padding: '0.5rem', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M232.7 69.9C237.1 56.8 249.3 48 263.1 48L377 48C390.8 48 403 56.8 407.4 69.9L416 96L512 96C529.7 96 544 110.3 544 128C544 145.7 529.7 160 512 160L128 160C110.3 160 96 145.7 96 128C96 110.3 110.3 96 128 96L224 96L232.7 69.9zM128 208L512 208L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 208zM216 272C202.7 272 192 282.7 192 296L192 488C192 501.3 202.7 512 216 512C229.3 512 240 501.3 240 488L240 296C240 282.7 229.3 272 216 272zM320 272C306.7 272 296 282.7 296 296L296 488C296 501.3 306.7 512 320 512C333.3 512 344 501.3 344 488L344 296C344 282.7 333.3 272 320 272zM424 272C410.7 272 400 282.7 400 296L400 488C400 501.3 410.7 512 424 512C437.3 512 448 501.3 448 488L448 296C448 282.7 437.3 272 424 272z" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
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
                  if (deleteConfirm.trim() !== name.trim()) return
                  setDeleting(true)
                  setError(null)
                  const { error: delErr } = await supabase
                    .from('customers')
                    .delete()
                    .eq('id', customerId)
                  setDeleting(false)
                  if (delErr) {
                    setError(delErr.message)
                    return
                  }
                  setDeleteOpen(false)
                  onSaved()
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
