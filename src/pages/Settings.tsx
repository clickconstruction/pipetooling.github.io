import { useEffect, useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type UserRole = 'owner' | 'master' | 'assistant' | 'subcontractor'

type UserRow = {
  id: string
  email: string
  name: string
  role: UserRole
  last_sign_in_at: string | null
}

const ROLES: UserRole[] = ['owner', 'master', 'assistant', 'subcontractor']

function timeSinceAgo(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.floor((now - d) / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`
  const mo = Math.floor(day / 30)
  return `${mo} mo ago`
}

export default function Settings() {
  const { user: authUser } = useAuth()
  const [myRole, setMyRole] = useState<UserRole | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)
  const [codeSubmitting, setCodeSubmitting] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('master')
  const [inviteName, setInviteName] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSubmitting, setInviteSubmitting] = useState(false)
  const [manualAddOpen, setManualAddOpen] = useState(false)
  const [manualAddEmail, setManualAddEmail] = useState('')
  const [manualAddName, setManualAddName] = useState('')
  const [manualAddRole, setManualAddRole] = useState<UserRole>('master')
  const [manualAddPassword, setManualAddPassword] = useState('')
  const [manualAddError, setManualAddError] = useState<string | null>(null)
  const [manualAddSubmitting, setManualAddSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteEmail, setDeleteEmail] = useState('')
  const [deleteName, setDeleteName] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [sendingSignInEmailId, setSendingSignInEmailId] = useState<string | null>(null)
  const [loggingInAsId, setLoggingInAsId] = useState<string | null>(null)

  async function loadData() {
    if (!authUser?.id) {
      setLoading(false)
      return
    }
    const { data: me, error: eMe } = await supabase
      .from('users')
      .select('role')
      .eq('id', authUser.id)
      .single()
    if (eMe) {
      setError(eMe.message)
      setLoading(false)
      return
    }
    const role = (me as { role: UserRole } | null)?.role ?? null
    setMyRole(role)
    if (role !== 'owner') {
      setLoading(false)
      return
    }
    const { data: list, error: eList } = await supabase
      .from('users')
      .select('id, email, name, role, last_sign_in_at')
      .order('name')
    if (eList) setError(eList.message)
    else setUsers((list as UserRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [authUser?.id])

  async function handleClaimCode(e: React.FormEvent) {
    e.preventDefault()
    setCodeError(null)
    setCodeSubmitting(true)
    const { data, error: eRpc } = await supabase.rpc('claim_owner_with_code', { code_input: code.trim() })
    setCodeSubmitting(false)
    if (eRpc) {
      setCodeError(eRpc.message)
      return
    }
    if (data) {
      setCode('')
      setCodeError(null)
      await loadData()
    } else {
      setCodeError('Invalid code')
    }
  }

  async function updateRole(id: string, role: UserRole) {
    setUpdatingId(id)
    setError(null)
    const { error: e } = await supabase.from('users').update({ role }).eq('id', id)
    if (e) {
      setError(e.message)
    } else {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)))
    }
    setUpdatingId(null)
  }

  async function sendSignInEmail(u: UserRow) {
    setSendingSignInEmailId(u.id)
    setError(null)
    const redirectTo = new URL('dashboard', window.location.href).href
    const { error: e } = await supabase.auth.signInWithOtp({
      email: u.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
      },
    })
    if (e) setError(e.message)
    setSendingSignInEmailId(null)
  }

  async function loginAsUser(u: UserRow) {
    setLoggingInAsId(u.id)
    setError(null)
    const redirectTo = new URL('dashboard', window.location.href).href
    const { data, error: eFn } = await supabase.functions.invoke('login-as-user', {
      body: { email: u.email, redirectTo },
    })
    setLoggingInAsId(null)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setError(msg)
      return
    }
    const link = (data as { action_link?: string } | null)?.action_link
    if (!link) {
      setError('Could not get login link')
      return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token && session?.refresh_token) {
      sessionStorage.setItem('impersonation_original', JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      }))
    }
    window.location.href = link
  }

  function openInvite() {
    setInviteOpen(true)
    setInviteEmail('')
    setInviteRole('master')
    setInviteName('')
    setInviteError(null)
  }

  function closeInvite() {
    setInviteOpen(false)
  }

  function openManualAdd() {
    setManualAddOpen(true)
    setManualAddEmail('')
    setManualAddName('')
    setManualAddRole('master')
    setManualAddPassword('')
    setManualAddError(null)
  }

  function closeManualAdd() {
    setManualAddOpen(false)
  }

  function openDelete() {
    setDeleteOpen(true)
    setDeleteEmail('')
    setDeleteName('')
    setDeleteError(null)
  }

  function closeDelete() {
    setDeleteOpen(false)
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    setDeleteError(null)
    setDeleteSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('delete-user', {
      body: { email: deleteEmail.trim(), name: deleteName.trim() },
    })
    setDeleteSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setDeleteError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setDeleteError(err)
      return
    }
    closeDelete()
    await loadData()
  }

  async function handleManualAdd(e: React.FormEvent) {
    e.preventDefault()
    setManualAddError(null)
    setManualAddSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('create-user', {
      body: {
        email: manualAddEmail.trim(),
        password: manualAddPassword,
        role: manualAddRole,
        name: manualAddName.trim() || undefined,
      },
    })
    setManualAddSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setManualAddError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setManualAddError(err)
      return
    }
    closeManualAdd()
    await loadData()
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSubmitting(true)
    const { data, error: eFn } = await supabase.functions.invoke('invite-user', {
      body: { email: inviteEmail.trim(), role: inviteRole, name: inviteName.trim() || undefined },
    })
    setInviteSubmitting(false)
    if (eFn) {
      let msg = eFn.message
      if (eFn instanceof FunctionsHttpError && eFn.context?.json) {
        try {
          const b = (await eFn.context.json()) as { error?: string } | null
          if (b?.error) msg = b.error
        } catch { /* ignore */ }
      }
      setInviteError(msg)
      return
    }
    const err = (data as { error?: string } | null)?.error
    if (err) {
      setInviteError(err)
      return
    }
    closeInvite()
  }

  if (loading) return <p>Loading…</p>
  if (error && !myRole) return <p style={{ color: '#b91c1c' }}>{error}</p>

  return (
    <div>
      <h1 style={{ marginBottom: '1rem' }}>Settings</h1>

      <form onSubmit={handleClaimCode} style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="code" style={{ display: 'block', marginBottom: 4 }}>Enter code</label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value); setCodeError(null) }}
            disabled={codeSubmitting}
            placeholder="Admin code"
            style={{ padding: '0.5rem', minWidth: 160 }}
            autoComplete="one-time-code"
          />
          <button type="submit" disabled={codeSubmitting || !code.trim()}>
            {codeSubmitting ? 'Checking…' : 'Submit'}
          </button>
        </div>
        {codeError && <p style={{ color: '#b91c1c', marginTop: 4, marginBottom: 0 }}>{codeError}</p>}
      </form>

      {myRole !== 'owner' && <p style={{ marginBottom: '1.5rem' }}>Only owners can manage user roles.</p>}

      {myRole === 'owner' && (
        <>
          <p style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Set user class for everyone who has signed up. Only owners can change these.
          </p>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={openInvite} style={{ padding: '0.5rem 1rem' }}>
              Invite via email
            </button>
            <button type="button" onClick={openManualAdd} style={{ padding: '0.5rem 1rem' }}>
              Manually add user
            </button>
            <button type="button" onClick={openDelete} style={{ padding: '0.5rem 1rem' }}>
              Delete user
            </button>
          </div>
          {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', maxWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Email</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Name</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Role</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Last login</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{u.email}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{u.name}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                        disabled={updatingId === u.id}
                        style={{ padding: '0.25rem 0.5rem' }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r.charAt(0).toUpperCase() + r.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>{timeSinceAgo(u.last_sign_in_at)}</td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => sendSignInEmail(u)}
                          disabled={sendingSignInEmailId === u.id}
                          style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                        >
                          {sendingSignInEmailId === u.id ? 'Sending…' : 'Send email to sign in'}
                        </button>
                        <button
                          type="button"
                          onClick={() => loginAsUser(u)}
                          disabled={loggingInAsId === u.id}
                          style={{ padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                        >
                          {loggingInAsId === u.id ? 'Redirecting…' : 'Login as user'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {users.length === 0 && <p style={{ marginTop: '1rem' }}>No users yet.</p>}
        </>
      )}

      {inviteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Invite via email</h2>
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invite-email" style={{ display: 'block', marginBottom: 4 }}>Email *</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null) }}
                  required
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invite-role" style={{ display: 'block', marginBottom: 4 }}>Role</label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as UserRole)}
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="invite-name" style={{ display: 'block', marginBottom: 4 }}>Name (optional)</label>
                <input
                  id="invite-name"
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  disabled={inviteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {inviteError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{inviteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={inviteSubmitting}>
                  {inviteSubmitting ? 'Sending…' : 'Send invite'}
                </button>
                <button type="button" onClick={closeInvite} disabled={inviteSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manualAddOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Manually add user</h2>
            <form onSubmit={handleManualAdd}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-email" style={{ display: 'block', marginBottom: 4 }}>Email *</label>
                <input
                  id="manual-email"
                  type="email"
                  value={manualAddEmail}
                  onChange={(e) => { setManualAddEmail(e.target.value); setManualAddError(null) }}
                  required
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-password" style={{ display: 'block', marginBottom: 4 }}>Initial password *</label>
                <input
                  id="manual-password"
                  type="password"
                  value={manualAddPassword}
                  onChange={(e) => { setManualAddPassword(e.target.value); setManualAddError(null) }}
                  required
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                  autoComplete="new-password"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-role" style={{ display: 'block', marginBottom: 4 }}>Role</label>
                <select
                  id="manual-role"
                  value={manualAddRole}
                  onChange={(e) => setManualAddRole(e.target.value as UserRole)}
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="manual-name" style={{ display: 'block', marginBottom: 4 }}>Name (optional)</label>
                <input
                  id="manual-name"
                  type="text"
                  value={manualAddName}
                  onChange={(e) => setManualAddName(e.target.value)}
                  disabled={manualAddSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {manualAddError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{manualAddError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={manualAddSubmitting}>
                  {manualAddSubmitting ? 'Creating…' : 'Create user'}
                </button>
                <button type="button" onClick={closeManualAdd} disabled={manualAddSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: 'white', padding: '1.5rem', borderRadius: 8, minWidth: 320 }}>
            <h2 style={{ marginTop: 0 }}>Delete user</h2>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.875rem' }}>
              Type the user&apos;s email and name exactly. Both must match to delete.
            </p>
            <form onSubmit={handleDelete}>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-email" style={{ display: 'block', marginBottom: 4 }}>Email *</label>
                <input
                  id="delete-email"
                  type="email"
                  value={deleteEmail}
                  onChange={(e) => { setDeleteEmail(e.target.value); setDeleteError(null) }}
                  required
                  disabled={deleteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="delete-name" style={{ display: 'block', marginBottom: 4 }}>Name *</label>
                <input
                  id="delete-name"
                  type="text"
                  value={deleteName}
                  onChange={(e) => { setDeleteName(e.target.value); setDeleteError(null) }}
                  required
                  disabled={deleteSubmitting}
                  style={{ width: '100%', padding: '0.5rem' }}
                />
              </div>
              {deleteError && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{deleteError}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={deleteSubmitting} style={{ color: '#b91c1c' }}>
                  {deleteSubmitting ? 'Deleting…' : 'Delete user'}
                </button>
                <button type="button" onClick={closeDelete} disabled={deleteSubmitting}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
