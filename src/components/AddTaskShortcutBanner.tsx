import { useState } from 'react'
import type { UserRole } from '../hooks/useAuth'
import { showHeaderTaskChecklistButton } from '../lib/headerTaskDispatchEstimatorEligible'
import { shouldShowAddTaskBanner, markAddTaskBannerDismissed } from '../lib/iosPwa'

const INSTALL_PAGE_HREF = '/task-install.html'

/**
 * Slim, dismissible offer shown only to task-capable users browsing in iOS Safari (not in the
 * installed standalone app — that's where "Add to Home Screen" is unavailable). Tapping "Add"
 * routes to the /task install helper. Dismissal is remembered in localStorage.
 */
export default function AddTaskShortcutBanner({ role }: { role: UserRole | null }) {
  const [visible, setVisible] = useState(
    () => showHeaderTaskChecklistButton(role) && shouldShowAddTaskBanner()
  )

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Add Task home screen shortcut"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.5rem 0.85rem',
        background: 'var(--bg-orange-tint)',
        borderBottom: '1px solid var(--border-orange)',
        color: '#7c2d12',
        fontSize: '0.875rem',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="1.1em"
        height="1.1em"
        fill="none"
        stroke="#ea580c"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span style={{ flex: 1, lineHeight: 1.35 }}>
        Add a one-tap <strong>Add Task</strong> icon to your Home Screen.
      </span>
      <button
        type="button"
        onClick={() => {
          window.location.href = INSTALL_PAGE_HREF
        }}
        style={{
          padding: '0.3rem 0.75rem',
          background: '#f97316',
          color: 'white',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => {
          markAddTaskBannerDismissed()
          setVisible(false)
        }}
        style={{
          padding: '0.3rem 0.5rem',
          background: 'transparent',
          color: 'var(--text-orange-800)',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        Dismiss
      </button>
    </div>
  )
}
