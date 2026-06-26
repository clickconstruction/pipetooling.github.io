import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  ChecklistAddModalProvider,
  useChecklistAddModal,
} from '../contexts/ChecklistAddModalContext'
import ChecklistAddModal from '../components/ChecklistAddModal'
import {
  isStandalonePwa,
  isIOSSafariBrowser,
  markTaskShortcutInstalled,
  setPendingOpenAddTask,
} from '../lib/iosPwa'

const ADD_TASK_ICON_HREF = '/icons/add-task-180.png'
const ADD_TASK_MANIFEST_HREF = '/add-task.webmanifest'

/**
 * Present the distinct icon / title / manifest that iOS captures at "Add to Home Screen" time,
 * so the new webclip launches at /task (its own start_url) with the orange "Add Task" identity
 * rather than the main app. Returns a restore function that puts the original <head> back on
 * unmount (so adding the main app icon later is unaffected).
 */
function applyAddTaskInstallMeta(): () => void {
  const head = document.head
  const prevTitle = document.title

  // Temporarily remove existing apple-touch-icon links so iOS uses ours.
  const existingIcons = Array.from(
    head.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  )
  existingIcons.forEach((el) => el.remove())

  // Point the manifest at the Add Task manifest (start_url:/task). On modern iOS the home-screen
  // app uses the manifest's start_url, so without this it would launch at "/" instead of /task.
  let manifestLink = head.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  let createdManifest = false
  let prevManifestHref: string | null = null
  if (!manifestLink) {
    manifestLink = document.createElement('link')
    manifestLink.setAttribute('rel', 'manifest')
    head.appendChild(manifestLink)
    createdManifest = true
  } else {
    prevManifestHref = manifestLink.getAttribute('href')
  }
  manifestLink.setAttribute('href', ADD_TASK_MANIFEST_HREF)

  const created: Element[] = []
  const addLink = (rel: string, href: string, sizes: string) => {
    const el = document.createElement('link')
    el.setAttribute('rel', rel)
    el.setAttribute('href', href)
    el.setAttribute('sizes', sizes)
    head.appendChild(el)
    created.push(el)
  }
  const addMeta = (name: string, content: string) => {
    const el = document.createElement('meta')
    el.setAttribute('name', name)
    el.setAttribute('content', content)
    head.appendChild(el)
    created.push(el)
  }

  addLink('apple-touch-icon', ADD_TASK_ICON_HREF, '180x180')
  addMeta('apple-mobile-web-app-title', 'Add Task')
  addMeta('apple-mobile-web-app-capable', 'yes')
  document.title = 'Add Task'

  return () => {
    document.title = prevTitle
    created.forEach((el) => el.remove())
    existingIcons.forEach((el) => head.appendChild(el))
    if (createdManifest) {
      manifestLink?.remove()
    } else if (manifestLink && prevManifestHref != null) {
      manifestLink.setAttribute('href', prevManifestHref)
    }
  }
}

function ShareGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ verticalAlign: '-0.15em' }}
    >
      <path d="M12 16V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}

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
      {!isOpen && (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.25rem',
            textAlign: 'center',
            background: '#fff7ed',
          }}
        >
          <img
            src={ADD_TASK_ICON_HREF}
            alt=""
            width={72}
            height={72}
            style={{ borderRadius: 16, boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
          />
          {justSaved ? (
            <>
              <div style={{ marginTop: '1rem' }}>
                <CheckGlyph />
              </div>
              <h1 style={{ fontSize: '1.3rem', margin: '0.5rem 0 0.25rem', color: '#7c2d12' }}>
                Task added
              </h1>
              <p style={{ color: '#9a3412', fontSize: '0.95rem', margin: '0 0 1.25rem' }}>
                Your task was created.
              </p>
            </>
          ) : (
            <h1 style={{ fontSize: '1.3rem', margin: '1rem 0 1.25rem', color: '#7c2d12' }}>
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
      <ChecklistAddModal />
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
 * Public landing for the "Add Task" home-screen shortcut.
 * - Launched from the icon (standalone) + signed in: render the dedicated task-only create page.
 * - Launched standalone but signed out: fall back to a one-time sign-in, then open the modal
 *   over the app (the persisted intent flag drives Layout).
 * - Viewed in iOS Safari: present the distinct icon/title/manifest + Add-to-Home-Screen steps.
 * - Anywhere else: explain that the shortcut is for iPhone/iPad Safari.
 */
export default function TaskShortcut() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [surface, setSurface] = useState<'pending' | 'standalone' | 'ios-install' | 'other'>(
    'pending'
  )

  // Decide the surface once (independent of auth so the install meta isn't re-applied on changes).
  useEffect(() => {
    if (isStandalonePwa()) {
      markTaskShortcutInstalled()
      setSurface('standalone')
      return
    }
    if (isIOSSafariBrowser()) {
      setSurface('ios-install')
      return applyAddTaskInstallMeta()
    }
    setSurface('other')
  }, [])

  // Standalone launch with no session in this webclip: fall back to sign-in + modal over the app.
  useEffect(() => {
    if (surface !== 'standalone' || loading) return
    if (!user) {
      setPendingOpenAddTask()
      navigate('/dashboard', { replace: true })
    }
  }, [surface, user, loading, navigate])

  if (surface === 'standalone') {
    if (loading || !user) {
      return <div style={{ padding: '2rem', textAlign: 'center' }}>Opening…</div>
    }
    return <StandaloneCreateTask />
  }

  if (surface === 'pending') {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Opening…</div>
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '2rem 1.25rem', textAlign: 'center' }}>
      <img
        src={ADD_TASK_ICON_HREF}
        alt="Add Task icon"
        width={88}
        height={88}
        style={{ borderRadius: 20, boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}
      />
      <h1 style={{ fontSize: '1.35rem', margin: '1rem 0 0.5rem' }}>Add Task to your Home Screen</h1>

      {surface === 'ios-install' ? (
        <>
          <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Get a one-tap icon that jumps straight to <strong>Add Checklist Item</strong>.
          </p>
          <ol
            style={{
              textAlign: 'left',
              color: '#374151',
              fontSize: '0.95rem',
              lineHeight: 1.7,
              margin: '1rem auto',
              maxWidth: 320,
            }}
          >
            <li>
              Tap the <strong>Share</strong> button <ShareGlyph /> in Safari.
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong> — the orange <strong>Add Task</strong> icon appears on your
              Home Screen.
            </li>
          </ol>
          <p style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
            Tip: the new icon may ask you to sign in once the first time you open it.
          </p>
        </>
      ) : (
        <>
          <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: 1.5 }}>
            This one-tap shortcut is for iPhone and iPad. On your device, open{' '}
            <strong>this page in Safari</strong> and use{' '}
            <strong>Share &rarr; Add to Home Screen</strong>.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Go to the app
          </button>
        </>
      )}
    </div>
  )
}
