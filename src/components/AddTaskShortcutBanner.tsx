import { useState } from 'react'
import type { UserRole } from '../hooks/useAuth'
import { showHeaderTaskChecklistButton } from '../lib/headerTaskDispatchEstimatorEligible'
import { shouldShowAddTaskBanner, markAddTaskBannerDismissed } from '../lib/iosPwa'
import { AppTopBanner } from './layout/AppTopBanner'

const INSTALL_PAGE_HREF = '/task-install.html'

/**
 * Slim, dismissible offer shown only to task-capable users browsing in iOS Safari (not in the
 * installed standalone app — that's where "Add to Home Screen" is unavailable). Tapping "Add"
 * routes to the /task install helper. Dismissal is remembered in localStorage.
 *
 * It is the first line above the header, so it draws in `AppTopBanner` like the others. Safari keeps
 * its own bar over the status bar, so the inset it would pay is 0px wherever the offer can show.
 *
 * `quiet` (the new phone layout, `lib/phoneLayout`): the same offer as one quiet row inside the
 * Dashboard's own content, where it scrolls away with the page and takes no room from the bars. The
 * same Add, the same Dismiss and the same remembered dismissal; Layout mounts it on the Dashboard alone.
 */
export default function AddTaskShortcutBanner({ role, quiet = false }: { role: UserRole | null; quiet?: boolean }) {
  const [visible, setVisible] = useState(
    () => showHeaderTaskChecklistButton(role) && shouldShowAddTaskBanner()
  )

  if (!visible) return null

  const add = () => {
    window.location.href = INSTALL_PAGE_HREF
  }
  const dismiss = () => {
    markAddTaskBannerDismissed()
    setVisible(false)
  }

  if (quiet) {
    return (
      <div
        role="region"
        aria-label="Add Task home screen shortcut"
        data-add-task-offer="quiet"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          margin: '0 0 0.5rem',
          padding: '0 0.25rem 0 0.75rem',
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--surface)',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3, padding: '0.4rem 0' }}>
          Add a one-tap <strong style={{ color: 'var(--text-strong)' }}>Add Task</strong> icon to your Home Screen.
        </span>
        <button
          type="button"
          onClick={add}
          style={{
            flexShrink: 0,
            minHeight: 44,
            padding: '0 0.6rem',
            background: 'none',
            color: 'var(--text-link)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          Add
        </button>
        <button
          type="button"
          onClick={dismiss}
          style={{
            flexShrink: 0,
            minHeight: 44,
            padding: '0 0.6rem',
            background: 'none',
            color: 'var(--text-muted)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Dismiss
        </button>
      </div>
    )
  }

  return (
    <AppTopBanner
      role="region"
      aria-label="Add Task home screen shortcut"
      padY="0.5rem"
      padX="0.85rem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
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
        onClick={add}
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
        onClick={dismiss}
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
    </AppTopBanner>
  )
}
