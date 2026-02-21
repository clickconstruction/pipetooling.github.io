import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency } from '../../lib/format'
import type { Database } from '../../types/database'

type JobsReceivableRow = Database['public']['Tables']['jobs_receivables']['Row']
type Person = { id: string; master_user_id: string; kind: string; name: string; email: string | null; phone: string | null; notes: string | null }
type UserRow = { id: string; name: string; email: string | null; role: string }
type PersonKind = 'assistant' | 'master_technician' | 'sub' | 'estimator'
const KIND_TO_USER_ROLE: Record<PersonKind, string> = { assistant: 'assistant', master_technician: 'master_technician', sub: 'subcontractor', estimator: 'estimator' }

export function ReceivablesSection() {
  const { user: authUser } = useAuth()
  const [receivables, setReceivables] = useState<JobsReceivableRow[]>([])
  const [receivablesLoading, setReceivablesLoading] = useState(false)
  const [receivablesFormOpen, setReceivablesFormOpen] = useState(false)
  const [editingReceivable, setEditingReceivable] = useState<JobsReceivableRow | null>(null)
  const [receivablesPayer, setReceivablesPayer] = useState('')
  const [receivablesPointOfContact, setReceivablesPointOfContact] = useState('')
  const [receivablesAccountRepName, setReceivablesAccountRepName] = useState('')
  const [receivablesAmount, setReceivablesAmount] = useState('')
  const [receivablesSaving, setReceivablesSaving] = useState(false)
  const [receivablesDeletingId, setReceivablesDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

  async function loadUsers() {
    if (!authUser?.id) return
    const [usersRes, meRes] = await Promise.all([
      supabase.from('users').select('id, name, email, role').in('role', ['assistant', 'master_technician', 'subcontractor', 'estimator']).order('name'),
      supabase.from('users').select('role').eq('id', authUser.id).single(),
    ])
    let usersList = (usersRes.data as UserRow[]) ?? []
    const myRole = (meRes.data as { role?: string } | null)?.role
    if (myRole === 'dev') {
      const { data: devUsers } = await supabase.from('users').select('id, name, email, role').eq('role', 'dev')
      if (devUsers?.length) {
        const existingIds = new Set(usersList.map((u) => u.id))
        const newDevs = (devUsers as UserRow[]).filter((u) => !existingIds.has(u.id))
        usersList = [...usersList, ...newDevs]
      }
    }
    setUsers(usersList)
  }

  async function loadRoster() {
    if (!authUser?.id) return
    const { data: peopleData } = await supabase.from('people').select('id, master_user_id, kind, name, email, phone, notes').order('kind').order('name')
    setPeople((peopleData as Person[]) ?? [])
    await loadUsers()
  }

  async function loadReceivables() {
    if (!authUser?.id) return
    setReceivablesLoading(true)
    setError(null)
    const { data, error: err } = await supabase.from('jobs_receivables').select('*').order('created_at', { ascending: false })
    if (err) {
      setError(`Failed to load receivables: ${err.message}`)
    } else {
      setReceivables((data as JobsReceivableRow[]) ?? [])
    }
    setReceivablesLoading(false)
  }

  async function getEffectiveMasterId(): Promise<string | null> {
    if (!authUser?.id) return null
    const { data: me } = await supabase.from('users').select('role').eq('id', authUser.id).single()
    const role = (me as { role?: string } | null)?.role
    if (role === 'dev' || role === 'master_technician') return authUser.id
    if (role === 'assistant') {
      const { data: adoptions } = await supabase.from('master_assistants').select('master_id').eq('assistant_id', authUser.id)
      const masterId = (adoptions as { master_id: string }[] | null)?.[0]?.master_id
      return masterId ?? authUser.id
    }
    return authUser.id
  }

  function isAlreadyUser(email: string | null): boolean {
    if (!email?.trim()) return false
    const e = email.trim().toLowerCase()
    return users.some((u) => u.email && u.email.toLowerCase() === e)
  }

  function byKind(k: PersonKind): ({ source: 'user'; id: string; name: string; email: string | null } | ({ source: 'people' } & Person))[] {
    const userRole = KIND_TO_USER_ROLE[k]
    const fromUsers = users.filter((u) => u.role === userRole).map((u) => ({ source: 'user' as const, id: u.id, name: u.name, email: u.email }))
    const fromPeople = people.filter((p) => p.kind === k && !isAlreadyUser(p.email)).map((p) => ({ source: 'people' as const, ...p }))
    return [...fromUsers, ...fromPeople].sort((a, b) => a.name.localeCompare(b.name))
  }

  function accountRepOptions(): string[] {
    const masters = byKind('master_technician').map((item) => item.name?.trim()).filter((n): n is string => !!n)
    const subs = byKind('sub').map((item) => item.name?.trim()).filter((n): n is string => !!n)
    const seen = new Set<string>()
    const result: string[] = []
    for (const n of [...masters, ...subs].sort((a, b) => a.localeCompare(b))) {
      if (!seen.has(n)) {
        seen.add(n)
        result.push(n)
      }
    }
    return result
  }

  function openAddReceivable() {
    setEditingReceivable(null)
    setReceivablesPayer('')
    setReceivablesPointOfContact('')
    setReceivablesAccountRepName('')
    setReceivablesAmount('')
    setReceivablesFormOpen(true)
  }

  function openEditReceivable(r: JobsReceivableRow) {
    setEditingReceivable(r)
    setReceivablesPayer(r.payer ?? '')
    setReceivablesPointOfContact(r.point_of_contact ?? '')
    setReceivablesAccountRepName(r.account_rep_name ?? '')
    setReceivablesAmount(r.amount != null ? String(r.amount) : '')
    setReceivablesFormOpen(true)
  }

  function closeReceivablesForm() {
    setReceivablesFormOpen(false)
    setEditingReceivable(null)
  }

  async function saveReceivable(e: React.FormEvent) {
    e.preventDefault()
    if (!authUser?.id) return
    const masterId = await getEffectiveMasterId()
    if (!masterId) {
      setError('Could not determine master for this receivable.')
      return
    }
    setReceivablesSaving(true)
    setError(null)
    const amountNum = parseFloat(receivablesAmount) || 0
    if (editingReceivable) {
      const { error: err } = await supabase
        .from('jobs_receivables')
        .update({
          payer: receivablesPayer.trim(),
          point_of_contact: receivablesPointOfContact.trim(),
          account_rep_name: receivablesAccountRepName.trim() || null,
          amount: amountNum,
        })
        .eq('id', editingReceivable.id)
      if (err) setError(err.message)
      else {
        await loadReceivables()
        closeReceivablesForm()
      }
    } else {
      const { error: err } = await supabase.from('jobs_receivables').insert({
        master_user_id: masterId,
        payer: receivablesPayer.trim(),
        point_of_contact: receivablesPointOfContact.trim(),
        account_rep_name: receivablesAccountRepName.trim() || null,
        amount: amountNum,
      })
      if (err) setError(err.message)
      else {
        await loadReceivables()
        closeReceivablesForm()
      }
    }
    setReceivablesSaving(false)
  }

  async function deleteReceivable(id: string) {
    if (!confirm('Delete this receivable?')) return
    setReceivablesDeletingId(id)
    const { error: err } = await supabase.from('jobs_receivables').delete().eq('id', id)
    if (err) setError(err.message)
    else await loadReceivables()
    setReceivablesDeletingId(null)
  }

  useEffect(() => {
    loadRoster()
  }, [authUser?.id])

  useEffect(() => {
    loadReceivables()
  }, [authUser?.id])

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Jobs Receivables</h2>
      {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
      <div style={{ marginBottom: '0.75rem', fontSize: '1rem', fontWeight: 600, textAlign: 'center' }}>
        AR: ${formatCurrency(receivables.reduce((sum, r) => sum + Number(r.amount || 0), 0))}
      </div>
      {receivablesLoading ? (
        <p style={{ color: '#6b7280' }}>Loading…</p>
      ) : (
        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Payer</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Point Of Contact</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Account Rep</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Amount</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {receivables.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>No receivables yet. Click Add Payer to add one.</td></tr>
              ) : (
                receivables.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{r.payer || '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{r.point_of_contact || '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>{r.account_rep_name || '—'}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 500 }}>${formatCurrency(Number(r.amount || 0))}</td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center', justifyContent: 'center' }}>
                        <button type="button" onClick={() => openEditReceivable(r)} title="Edit" aria-label="Edit" style={{ padding: '0.25rem', cursor: 'pointer', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={16} height={16} fill="currentColor" aria-hidden="true">
                            <path d="M362.7 19.3L314.3 67.7 444.3 197.7 492.7 149.3c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18.3 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
                          </svg>
                        </button>
                        <button type="button" onClick={() => deleteReceivable(r.id)} disabled={receivablesDeletingId === r.id} title="Delete" aria-label="Delete" style={{ padding: '0.25rem', cursor: receivablesDeletingId === r.id ? 'not-allowed' : 'pointer', background: 'none', border: 'none', color: '#dc2626', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={16} height={16} fill="currentColor" aria-hidden="true">
                            <path d="M232.7 69.9L224 96L128 96C110.3 96 96 110.3 96 128C96 145.7 110.3 160 128 160L512 160C529.7 160 544 145.7 544 128C544 110.3 529.7 96 512 96L416 96L407.3 69.9C402.9 56.8 390.7 48 376.9 48L263.1 48C249.3 48 237.1 56.8 232.7 69.9zM512 208L128 208L149.1 531.1C150.7 556.4 171.7 576 197 576L443 576C468.3 576 489.3 556.4 490.9 531.1L512 208z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button
          type="button"
          onClick={openAddReceivable}
          style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Add Payer
        </button>
      </div>

      {receivablesFormOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>{editingReceivable ? 'Edit Receivable' : 'Add Payer'}</h3>
            <form onSubmit={saveReceivable}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Payer *</label>
                <input type="text" value={receivablesPayer} onChange={(e) => setReceivablesPayer(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Point Of Contact</label>
                <input type="text" value={receivablesPointOfContact} onChange={(e) => setReceivablesPointOfContact(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Account Rep</label>
                <select value={receivablesAccountRepName} onChange={(e) => setReceivablesAccountRepName(e.target.value)} style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}>
                  <option value="">—</option>
                  {accountRepOptions().map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>Amount to Collect *</label>
                <input type="number" step="0.01" min={0} value={receivablesAmount} onChange={(e) => setReceivablesAmount(e.target.value)} required style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeReceivablesForm} style={{ padding: '0.5rem 1rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={receivablesSaving} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: receivablesSaving ? 'not-allowed' : 'pointer' }}>{receivablesSaving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
