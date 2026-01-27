import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const navStyle = ({ isActive }: { isActive: boolean }) => ({ fontWeight: isActive ? 600 : undefined })

const IMPERSONATION_KEY = 'impersonation_original'

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor'

const SUBCONTRACTOR_PATHS = ['/', '/dashboard', '/calendar']

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: authUser } = useAuth()
  const [role, setRole] = useState<UserRole | null>(null)
  const [impersonating, setImpersonating] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem(IMPERSONATION_KEY)
  )

  useEffect(() => {
    if (!authUser?.id) {
      setRole(null)
      return
    }
    supabase.from('users').select('role').eq('id', authUser.id).single().then(({ data }) => {
      setRole((data as { role: UserRole } | null)?.role ?? null)
    })
  }, [authUser?.id])

  useEffect(() => {
    if (role === 'subcontractor' && !SUBCONTRACTOR_PATHS.includes(location.pathname)) {
      navigate('/dashboard', { replace: true })
    }
  }, [role, location.pathname, navigate])

  async function handleBackToMyAccount() {
    const raw = sessionStorage.getItem(IMPERSONATION_KEY)
    sessionStorage.removeItem(IMPERSONATION_KEY)
    setImpersonating(false)
    if (!raw) return
    try {
      const { access_token, refresh_token } = JSON.parse(raw) as { access_token?: string; refresh_token?: string }
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token })
      }
    } catch {
      navigate('/sign-in', { replace: true })
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/sign-in', { replace: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <nav
        style={{
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <NavLink to="/dashboard" style={navStyle} end>Dashboard</NavLink>
        {role !== 'subcontractor' && (
          <>
            <NavLink to="/customers" style={navStyle}>Customers</NavLink>
            <NavLink to="/projects" style={navStyle}>Projects</NavLink>
            <NavLink to="/people" style={navStyle}>People</NavLink>
            {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (
              <NavLink to="/materials" style={navStyle}>Materials</NavLink>
            )}
          </>
        )}
        <NavLink to="/calendar" style={navStyle}>Calendar</NavLink>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {role !== 'subcontractor' && <NavLink to="/settings" style={navStyle}>Settings</NavLink>}
          {impersonating && (
            <button
              type="button"
              onClick={handleBackToMyAccount}
              style={{
                padding: '0.35rem 0.75rem',
                background: '#fef3c7',
                color: '#92400e',
                border: '1px solid #f59e0b',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              Back to my account
            </button>
          )}
          <button type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </span>
      </nav>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
