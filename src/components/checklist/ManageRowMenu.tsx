import { useEffect, useState } from 'react'
import { ROW_MENU_LINE_PX, rowMenuPlacement } from '../../lib/checklistManageRow'

/** Manage's ⋮ menu: over the page and the phone's bottom bar, under every window (Job Detail is 1004). */
export const MANAGE_ROW_MENU_Z = 1000

export type ManageRowMenuLine = {
  key: string
  label: string
  onPress: () => void
  /** Delete reads red. */
  danger?: boolean
}

type Anchor = { top: number; bottom: number; right: number }

/**
 * The ⋮ press of a task on Checklist → Manage, and the menu it opens (punch list #348).
 *
 * The menu is drawn over the page, `position: fixed`, from where its press sits. It used to hang inside the
 * list, whose rounded edge cut it: on the last task a phone showed the top of *Edit* and no *Delete*. It opens
 * under its press when it fits and above it when it does not (`rowMenuPlacement`). Pinned to the screen, it
 * would be left behind by a scroll or a turn of the phone, so either closes it.
 */
export function ManageRowMenu({ title, lines, open, onOpenChange }: { title: string; lines: readonly ManageRowMenuLine[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  useEffect(() => {
    if (!open) return
    const close = () => onOpenChange(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, onOpenChange])

  const { opensUp, ...spot } = anchor
    ? rowMenuPlacement({
        anchorTop: anchor.top,
        anchorBottom: anchor.bottom,
        anchorRight: anchor.right,
        menuHeight: lines.length * ROW_MENU_LINE_PX + 2,
        viewportWidth: window.innerWidth,
        viewportHeight: window.visualViewport?.height ?? window.innerHeight,
      })
    : { right: 8, top: 8, opensUp: false }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          const at = e.currentTarget.getBoundingClientRect()
          setAnchor({ top: at.top, bottom: at.bottom, right: at.right })
          onOpenChange(!open)
        }}
        aria-label={`Actions for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{ width: 36, height: 36, flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.1rem', borderRadius: 8 }}
      >
        ⋮
      </button>
      {open ? (
        <>
          <div data-testid="manage-row-menu-backdrop" style={{ position: 'fixed', inset: 0, zIndex: MANAGE_ROW_MENU_Z - 1 }} onClick={() => onOpenChange(false)} />
          <div
            role="menu"
            data-opens={opensUp ? 'up' : 'down'}
            style={{ position: 'fixed', ...spot, zIndex: MANAGE_ROW_MENU_Z, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)', minWidth: 170, overflow: 'hidden' }}
          >
            {lines.map((line, i) => (
              <button
                key={line.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  onOpenChange(false)
                  line.onPress()
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.6rem 0.9rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: line.danger ? 'var(--text-red-700)' : 'var(--text-strong)', borderTop: i > 0 ? '1px solid var(--border)' : undefined }}
              >
                {line.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  )
}
