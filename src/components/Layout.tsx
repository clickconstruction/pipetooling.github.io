import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const navStyle = ({ isActive }: { isActive: boolean }) => ({
  fontWeight: isActive ? 600 : undefined,
  textDecoration: isActive ? 'underline' : undefined,
})

const IMPERSONATION_KEY = 'impersonation_original'

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'

const SUBCONTRACTOR_PATHS = ['/', '/dashboard', '/calendar']
const ESTIMATOR_PATHS = ['/materials', '/bids']

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
    if (role === 'estimator' && (location.pathname === '/' || location.pathname === '/dashboard' || !ESTIMATOR_PATHS.includes(location.pathname))) {
      navigate('/bids', { replace: true })
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
        className="appNav"
        style={{
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        {role === 'estimator' ? (
          <>
            <NavLink to="/materials" style={navStyle}>Materials</NavLink>
            <NavLink to="/bids" style={navStyle}>Bids</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/dashboard" style={navStyle} end>Dashboard</NavLink>
            {role !== 'subcontractor' && (
              <>
                <NavLink to="/customers" style={navStyle}>Customers</NavLink>
                <NavLink to="/projects" style={navStyle}>Projects</NavLink>
                <NavLink to="/people" style={navStyle}>People</NavLink>
                {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (
                  <>
                    <NavLink to="/materials" style={navStyle}>Materials</NavLink>
                    <NavLink to="/bids" style={navStyle}>Bids</NavLink>
                  </>
                )}
              </>
            )}
            <NavLink to="/calendar" style={navStyle}>Calendar</NavLink>
          </>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (
            <>
              <button
                type="button"
                onClick={() => navigate('/projects/new')}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Add Project
              </button>
            </>
          )}
          {(role === 'dev' || role === 'master_technician' || role === 'assistant' || role === 'estimator') && (
            <button
              type="button"
              onClick={() => navigate('/bids?new=true')}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Add Bid
            </button>
          )}
          {role !== 'subcontractor' && role !== 'estimator' && (
            <NavLink 
              to="/settings" 
              title="Settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem',
                textDecoration: 'none',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
              </svg>
            </NavLink>
          )}
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
          {(role === 'subcontractor' || role === 'estimator') && (
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          )}
        </span>
      </nav>
      <main className="appMain" style={{ flex: 1 }}>
        <Outlet />
      </main>
    </div>
  )
}
