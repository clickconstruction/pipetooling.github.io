import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  isStandalonePwa,
  isIOSSafariBrowser,
  markTaskShortcutInstalled,
  setPendingOpenAddTask,
} from '../lib/iosPwa'

const ADD_TASK_ICON_HREF = '/icons/add-task-180.png'

/**
 * Inject the distinct icon + title that iOS captures at "Add to Home Screen" time, so the
 * new webclip gets the orange "Add Task" identity rather than the main app's. Returns a
 * restore function that puts the original <head> back on unmount (so a later add of the main
 * app icon is unaffected).
 */
function applyAddTaskInstallMeta(): () => void {
  const head = document.head
  const prevTitle = document.title

  // Temporarily remove existing apple-touch-icon links so iOS uses ours.
  const existingIcons = Array.from(
    head.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  )
  existingIcons.forEach((el) => el.remove())

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

/**
 * Public landing for the "Add Task" home-screen shortcut.
 * - Launched from the icon (standalone): record intent + install flags, hand off to the app
 *   (Layout opens the Add Checklist Item modal once it mounts).
 * - Viewed in iOS Safari: present the distinct icon/title for capture + Add-to-Home-Screen steps.
 * - Anywhere else: explain that the shortcut is for iPhone/iPad Safari.
 */
export default function TaskShortcut() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'redirecting' | 'ios-install' | 'other'>('redirecting')

  useEffect(() => {
    if (isStandalonePwa()) {
      markTaskShortcutInstalled()
      setPendingOpenAddTask()
      navigate('/dashboard', { replace: true })
      return
    }
    if (isIOSSafariBrowser()) {
      setMode('ios-install')
      return applyAddTaskInstallMeta()
    }
    setMode('other')
  }, [navigate])

  if (mode === 'redirecting') {
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

      {mode === 'ios-install' ? (
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
