import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  ChecklistAddModalProvider,
  useChecklistAddModal,
} from '../contexts/ChecklistAddModalContext'
import ChecklistAddModal from '../components/ChecklistAddModal'
import { isStandalonePwa, markTaskShortcutInstalled, POST_LOGIN_REDIRECT_KEY } from '../lib/iosPwa'

const ADD_TASK_ICON_HREF = '/icons/add-task-180.png'
const INSTALL_PAGE_HREF = '/task-install.html'
// Same photo backdrop as the sign-in page (see authPublicLanding.css).
const AUTH_BG_HREF = '/auth/pipetexas-bg.jpg'

function CheckGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="28"
      height="28"
      fill="none"
      stroke="#16a34a"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

/**
 * Dedicated, task-only surface shown when the Add Task icon is launched (standalone + signed in).
 * Reuses ChecklistAddModal (driven entirely by ChecklistAddModalContext) on a minimal branded
 * background — no app nav, no dashboard. Closing the form lands on a launcher that only offers
 * creating another task.
 */
function StandaloneCreateInner() {
  const modal = useChecklistAddModal()
  const [justSaved, setJustSaved] = useState(false)

  const openForm = () => {
    setJustSaved(false)
    modal?.openAddModal({ onSaved: () => setJustSaved(true) })
  }

  // Open the create form immediately on first mount.
  useEffect(() => {
    modal?.openAddModal({ onSaved: () => setJustSaved(true) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isOpen = modal?.isOpen ?? false

  return (
    <>
      {/* Sign-in photo backdrop (matches the sign-in page), behind both the launcher and modal. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: `url('${AUTH_BG_HREF}') center center / cover no-repeat`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      </div>
      {!isOpen && (
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.25rem',
            textAlign: 'center',
          }}
        >
          <img
            src={ADD_TASK_ICON_HREF}
            alt=""
            width={72}
            height={72}
            style={{ borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}
          />
          {justSaved ? (
            <>
              <div style={{ marginTop: '1rem' }}>
                <CheckGlyph />
              </div>
              <h1
                style={{
                  fontSize: '1.3rem',
                  margin: '0.5rem 0 0.25rem',
                  color: '#fff',
                  textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                }}
              >
                Task added
              </h1>
              <p
                style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '0.95rem',
                  margin: '0 0 1.25rem',
                  textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                }}
              >
                Your task was created.
              </p>
            </>
          ) : (
            <h1
              style={{
                fontSize: '1.3rem',
                margin: '1rem 0 1.25rem',
                color: '#fff',
                textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              }}
            >
              Add a Task
            </h1>
          )}
          <button
            type="button"
            onClick={openForm}
            style={{
              padding: '0.7rem 1.4rem',
              background: '#f97316',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '1rem',
            }}
          >
            {justSaved ? 'Add another task' : 'New task'}
          </button>
        </div>
      )}
      <ChecklistAddModal overlayBackground="transparent" />
    </>
  )
}

function StandaloneCreateTask() {
  return (
    <ChecklistAddModalProvider>
      <StandaloneCreateInner />
    </ChecklistAddModalProvider>
  )
}

/**
 * The Add Task icon's start_url (`/task`).
 * - Launched from the icon (standalone) + signed in: render the dedicated task-only create page.
 * - Launched standalone but signed out (the webclip has its own session): send to sign-in, then
 *   return here (POST_LOGIN_REDIRECT_KEY) so they land on the dedicated page, not the dashboard.
 * - Opened in a browser instead of the icon: this URL is the launch target, not the installer —
 *   redirect to the static install page (/task-install.html) which carries the Add Task manifest.
 */
export default function TaskShortcut() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [surface, setSurface] = useState<'pending' | 'standalone'>('pending')

  useEffect(() => {
    if (isStandalonePwa()) {
      markTaskShortcutInstalled()
      setSurface('standalone')
      return
    }
    // Visited in a browser tab: this is the launch target, not the installer.
    window.location.replace(INSTALL_PAGE_HREF)
  }, [])

  // Standalone launch with no session in this webclip: sign in, then come back to /task.
  useEffect(() => {
    if (surface !== 'standalone' || loading || user) return
    try {
      localStorage.setItem(POST_LOGIN_REDIRECT_KEY, '/task')
    } catch {
      /* ignore */
    }
    navigate('/sign-in', { replace: true })
  }, [surface, user, loading, navigate])

  if (surface === 'standalone' && user && !loading) {
    return <StandaloneCreateTask />
  }
  return <div style={{ padding: '2rem', textAlign: 'center' }}>Opening…</div>
}
