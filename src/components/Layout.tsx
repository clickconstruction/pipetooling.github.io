import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useForceReload } from '../contexts/ForceReloadContext'
import { useChecklistAddModal } from '../contexts/ChecklistAddModalContext'
import ChecklistAddModal from './ChecklistAddModal'
import {
  PINNABLE_PATHS,
  pathToLabel,
  getTabFromPath,
  isPinned,
  togglePinned,
  addPinForUser,
} from '../lib/pinnedTabs'

const navStyle = ({ isActive }: { isActive: boolean }) => ({
  fontWeight: isActive ? 600 : undefined,
  textDecoration: isActive ? 'underline' : undefined,
})

const dropdownLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  display: 'block' as const,
  padding: '0.5rem 1rem',
  textDecoration: isActive ? 'underline' : 'none',
  color: 'inherit',
  fontWeight: isActive ? 600 : undefined,
  borderBottom: '1px solid #e5e7eb',
})

const IMPERSONATION_KEY = 'impersonation_original'

type UserRole = 'dev' | 'master_technician' | 'assistant' | 'subcontractor' | 'estimator'

const SUBCONTRACTOR_PATHS = ['/', '/dashboard', '/calendar', '/checklist', '/settings']
const ESTIMATOR_PATHS = ['/dashboard', '/materials', '/bids', '/calendar', '/checklist', '/settings']

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user: authUser } = useAuth()
  const [role, setRole] = useState<UserRole | null>(null)
  const [impersonating, setImpersonating] = useState(
    () => typeof window !== 'undefined' && !!localStorage.getItem(IMPERSONATION_KEY)
  )
  const [gearOpen, setGearOpen] = useState(false)
  const gearRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [, setPinsVersion] = useState(0)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  )
  const [pinForUsers, setPinForUsers] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [pinForUserId, setPinForUserId] = useState('')
  const [pinForMessage, setPinForMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pinForSaving, setPinForSaving] = useState(false)
  const [pinForOpen, setPinForOpen] = useState(false)
  const pinForRef = useRef<HTMLDivElement>(null)
  const forceReload = useForceReload()
  const checklistAddModal = useChecklistAddModal()

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)')
    const handler = () => setIsMobile(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setGearOpen(false)
      }
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
      if (pinForRef.current && !pinForRef.current.contains(e.target as Node)) {
        setPinForOpen(false)
      }
    }
    if (gearOpen || menuOpen || pinForOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [gearOpen, menuOpen, pinForOpen])

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
    if (role === 'estimator' && (location.pathname === '/' || !ESTIMATOR_PATHS.includes(location.pathname))) {
      navigate('/bids', { replace: true })
    }
  }, [role, location.pathname, navigate])

  useEffect(() => {
    const handler = () => setPinsVersion((v) => v + 1)
    window.addEventListener('pipetooling-pins-changed', handler)
    return () => window.removeEventListener('pipetooling-pins-changed', handler)
  }, [])

  useEffect(() => {
    if (role === 'dev') {
      supabase.from('users').select('id, name, email').order('name').then(({ data }) => {
        const users = (data ?? []) as Array<{ id: string; name: string; email: string }>
        setPinForUsers(users)
        if (users.length > 0 && !pinForUserId) setPinForUserId(users[0]?.id ?? '')
      })
    }
  }, [role])

  async function handleBackToMyAccount() {
    const raw = localStorage.getItem(IMPERSONATION_KEY)
    localStorage.removeItem(IMPERSONATION_KEY)
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

  function renderNavLinks(onNavClick?: () => void) {
    const linkStyle = onNavClick ? dropdownLinkStyle : navStyle
    if (role === 'estimator') {
      return (
        <>
          <NavLink to="/dashboard" style={linkStyle} end onClick={onNavClick}>Dashboard</NavLink>
          <NavLink to="/materials" style={linkStyle} onClick={onNavClick}>Materials</NavLink>
          <NavLink to="/bids" style={linkStyle} onClick={onNavClick}>Bids</NavLink>
          <NavLink to="/calendar" style={linkStyle} onClick={onNavClick}>Calendar</NavLink>
          <NavLink to="/checklist" style={linkStyle} onClick={onNavClick}>Checklist</NavLink>
        </>
      )
    }
    return (
      <>
        <NavLink to="/dashboard" style={linkStyle} end onClick={onNavClick}>Dashboard</NavLink>
        {role !== 'subcontractor' && (
          <>
            <NavLink to="/customers" style={linkStyle} onClick={onNavClick}>Customers</NavLink>
            <NavLink to="/projects" style={linkStyle} onClick={onNavClick}>Projects</NavLink>
            {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (
              <NavLink to="/jobs" style={linkStyle} onClick={onNavClick}>Jobs</NavLink>
            )}
            <NavLink to="/people" style={linkStyle} onClick={onNavClick}>People</NavLink>
            {(role === 'dev' || role === 'master_technician' || role === 'assistant') && (
              <>
                <NavLink to="/materials" style={linkStyle} onClick={onNavClick}>Materials</NavLink>
                <NavLink to="/bids" style={linkStyle} onClick={onNavClick}>Bids</NavLink>
              </>
            )}
          </>
        )}
        <NavLink to="/calendar" style={linkStyle} onClick={onNavClick}>Calendar</NavLink>
        <NavLink to="/checklist" style={linkStyle} onClick={onNavClick}>Checklist</NavLink>
      </>
    )
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
        {isMobile ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              title="Menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="24" height="24" fill="currentColor" aria-hidden="true">
                <path d="M96 160C96 142.3 110.3 128 128 128L512 128C529.7 128 544 142.3 544 160C544 177.7 529.7 192 512 192L128 192C110.3 192 96 177.7 96 160zM96 320C96 302.3 110.3 288 128 288L512 288C529.7 288 544 302.3 544 320C544 337.7 529.7 352 512 352L128 352C110.3 352 96 337.7 96 320zM544 480C544 497.7 529.7 512 512 512L128 512C110.3 512 96 497.7 96 480C96 462.3 110.3 448 128 448L512 448C529.7 448 544 462.3 544 480z" />
              </svg>
            </button>
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: '100%',
                  marginTop: 4,
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
                  minWidth: 160,
                  zIndex: 50,
                }}
              >
                {renderNavLinks(() => setMenuOpen(false))}
              </div>
            )}
          </div>
        ) : (
          renderNavLinks()
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
                Project
              </button>
              <button
                type="button"
                onClick={() => checklistAddModal?.openAddModal()}
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
                ToDo
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
              Bid
            </button>
          )}
          <div ref={gearRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setGearOpen((o) => !o)}
              title="Settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M259.1 73.5C262.1 58.7 275.2 48 290.4 48L350.2 48C365.4 48 378.5 58.7 381.5 73.5L396 143.5C410.1 149.5 423.3 157.2 435.3 166.3L503.1 143.8C517.5 139 533.3 145 540.9 158.2L570.8 210C578.4 223.2 575.7 239.8 564.3 249.9L511 297.3C511.9 304.7 512.3 312.3 512.3 320C512.3 327.7 511.8 335.3 511 342.7L564.4 390.2C575.8 400.3 578.4 417 570.9 430.1L541 481.9C533.4 495 517.6 501.1 503.2 496.3L435.4 473.8C423.3 482.9 410.1 490.5 396.1 496.6L381.7 566.5C378.6 581.4 365.5 592 350.4 592L290.6 592C275.4 592 262.3 581.3 259.3 566.5L244.9 496.6C230.8 490.6 217.7 482.9 205.6 473.8L137.5 496.3C123.1 501.1 107.3 495.1 99.7 481.9L69.8 430.1C62.2 416.9 64.9 400.3 76.3 390.2L129.7 342.7C128.8 335.3 128.4 327.7 128.4 320C128.4 312.3 128.9 304.7 129.7 297.3L76.3 249.8C64.9 239.7 62.3 223 69.8 209.9L99.7 158.1C107.3 144.9 123.1 138.9 137.5 143.7L205.3 166.2C217.4 157.1 230.6 149.5 244.6 143.4L259.1 73.5zM320.3 400C364.5 399.8 400.2 363.9 400 319.7C399.8 275.5 363.9 239.8 319.7 240C275.5 240.2 239.8 276.1 240 320.3C240.2 364.5 276.1 400.2 320.3 400z" />
              </svg>
            </button>
            {gearOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 4,
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
                  minWidth: 140,
                  zIndex: 50,
                }}
              >
                <NavLink
                  to="/settings"
                  onClick={() => setGearOpen(false)}
                  style={{
                    display: 'block',
                    padding: '0.5rem 1rem',
                    textDecoration: 'none',
                    color: 'inherit',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  Settings
                </NavLink>
                <button
                  type="button"
                  onClick={() => {
                    setGearOpen(false)
                    const base = window.location.origin + window.location.pathname
                    const hash = window.location.hash || ''
                    window.location.href = base + '?nocache=' + Date.now() + hash
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem 1rem',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'inherit',
                    color: '#dc2626',
                    borderBottom: role === 'dev' ? '1px solid #e5e7eb' : undefined,
                  }}
                >
                  Hard Reload
                </button>
                {role === 'dev' && (
                  <button
                    type="button"
                    onClick={() => {
                      setGearOpen(false)
                      forceReload?.forceEveryoneToReload()
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.5rem 1rem',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 'inherit',
                      color: '#ea580c',
                    }}
                  >
                    Global Reload
                  </button>
                )}
              </div>
            )}
          </div>
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
        </span>
      </nav>
      <main className="appMain" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div style={{ flex: 1 }}>
          <Outlet />
        </div>
        {authUser?.id && PINNABLE_PATHS.includes(location.pathname as typeof PINNABLE_PATHS[number]) && (
          <div
            style={{
              padding: '0.5rem 1rem',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
              background: '#f9fafb',
            }}
          >
            <button
              type="button"
              onClick={() => {
                const path = location.pathname
                const label = pathToLabel(path)
                const tab = getTabFromPath(path, location.search)
                togglePinned(authUser.id, path, label, tab ?? undefined)
              }}
              title={isPinned(authUser.id, location.pathname, getTabFromPath(location.pathname, location.search)) ? 'Unpin from dashboard' : 'Pin to dashboard'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.875rem',
                background: isPinned(authUser.id, location.pathname, getTabFromPath(location.pathname, location.search))
                  ? '#e0e7ff'
                  : 'transparent',
                color: isPinned(authUser.id, location.pathname, getTabFromPath(location.pathname, location.search))
                  ? '#3730a3'
                  : '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              {isPinned(authUser.id, location.pathname, getTabFromPath(location.pathname, location.search)) ? (
                <>
                  <PinIcon filled />
                  Unpin
                </>
              ) : (
                <>
                  <PinIcon filled={false} />
                  Pin
                </>
              )}
            </button>
            {role === 'dev' && pinForUsers.length > 0 && (
              <div ref={pinForRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setPinForOpen((o) => !o)}
                  title="Pin for someone"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.35rem 0.5rem',
                    background: pinForOpen ? '#e0e7ff' : 'transparent',
                    color: pinForOpen ? '#3730a3' : '#6b7280',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="16" height="16" fill="currentColor" aria-hidden="true">
                    <path d="M128 96C110.3 96 96 110.3 96 128L96 224C96 241.7 110.3 256 128 256C145.7 256 160 241.7 160 224L160 160L224 160C241.7 160 256 145.7 256 128C256 110.3 241.7 96 224 96L128 96zM160 416C160 398.3 145.7 384 128 384C110.3 384 96 398.3 96 416L96 512C96 529.7 110.3 544 128 544L224 544C241.7 544 256 529.7 256 512C256 494.3 241.7 480 224 480L160 480L160 416zM416 96C398.3 96 384 110.3 384 128C384 145.7 398.3 160 416 160L480 160L480 224C480 241.7 494.3 256 512 256C529.7 256 544 241.7 544 224L544 128C544 110.3 529.7 96 512 96L416 96zM544 416C544 398.3 529.7 384 512 384C494.3 384 480 398.3 480 416L480 480L416 480C398.3 480 384 494.3 384 512C384 529.7 398.3 544 416 544L512 544C529.7 544 544 529.7 544 512L544 416z" />
                  </svg>
                </button>
                {pinForOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: 0,
                      marginBottom: 4,
                      padding: '0.5rem',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      zIndex: 50,
                    }}
                  >
                    <select
                      value={pinForUserId}
                      onChange={(e) => setPinForUserId(e.target.value)}
                      style={{
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.8125rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                        background: '#fff',
                        minWidth: 120,
                      }}
                      aria-label="Pin for user"
                    >
                      {pinForUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name?.trim() || u.email || u.id.slice(0, 8)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={pinForSaving}
                      onClick={async () => {
                        if (!pinForUserId) return
                        const path = location.pathname
                        const label = pathToLabel(path)
                        const tab = getTabFromPath(path, location.search)
                        const item = { path, label, ...(tab ? { tab } : {}) }
                        setPinForSaving(true)
                        setPinForMessage(null)
                        const { error } = await addPinForUser(pinForUserId, item)
                        setPinForSaving(false)
                        if (error) {
                          setPinForMessage({ type: 'error', text: error.message })
                          setTimeout(() => setPinForMessage(null), 4000)
                        } else {
                          const name = pinForUsers.find((u) => u.id === pinForUserId)?.name?.trim() || pinForUsers.find((u) => u.id === pinForUserId)?.email || 'User'
                          setPinForMessage({ type: 'success', text: `Pinned for ${name}.` })
                          setTimeout(() => setPinForMessage(null), 3000)
                          setPinForOpen(false)
                          if (pinForUserId === authUser.id) {
                            togglePinned(authUser.id, path, label, tab ?? undefined)
                          }
                        }
                      }}
                      style={{
                        padding: '0.35rem 0.6rem',
                        fontSize: '0.8125rem',
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe',
                        borderRadius: 6,
                        cursor: pinForSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 500,
                      }}
                    >
                      Pin for
                    </button>
                  </div>
                )}
              </div>
            )}
            {pinForMessage && (
              <span
                style={{
                  fontSize: '0.875rem',
                  color: pinForMessage.type === 'success' ? '#059669' : '#b91c1c',
                  fontWeight: 500,
                }}
              >
                {pinForMessage.text}
              </span>
            )}
          </div>
        )}
      </main>
      <ChecklistAddModal />
    </div>
  )
}

function PinIcon({ filled: _filled }: { filled: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="14" height="14" fill="currentColor" aria-hidden="true">
      <path d="M352 348.4C416.1 333.9 464 276.5 464 208C464 128.5 399.5 64 320 64C240.5 64 176 128.5 176 208C176 276.5 223.9 333.9 288 348.4L288 544C288 561.7 302.3 576 320 576C337.7 576 352 561.7 352 544L352 348.4zM328 160C297.1 160 272 185.1 272 216C272 229.3 261.3 240 248 240C234.7 240 224 229.3 224 216C224 158.6 270.6 112 328 112C341.3 112 352 122.7 352 136C352 149.3 341.3 160 328 160z" />
    </svg>
  )
}
