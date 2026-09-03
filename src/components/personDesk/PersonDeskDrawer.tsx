import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { usePersonDeskContext } from '../../contexts/PersonDeskContext'
import { canOpenPersonDesk } from '../../lib/people/personDeskGates'
import { PersonDeskBody } from './PersonDeskBody'
import { DESK_Z } from './personDeskShared'

/**
 * The Person Desk drawer (v2.2701): one person, every control, opened from
 * their name anywhere in the app. Right-hand panel on desktop, full-screen
 * sheet under 640px. The body (header + sections) is shared with the
 * People → Person tab (PR 3) — the drawer is only the shell.
 */
export function PersonDeskDrawer() {
  const desk = usePersonDeskContext()
  const { role } = useAuth()
  const payload = desk.payload
  const [narrow, setNarrow] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth <= 640 : false))

  useEffect(() => {
    if (!payload) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') desk.close()
    }
    const onResize = () => setNarrow(window.innerWidth <= 640)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [payload, desk])

  if (!payload) return null
  if (!canOpenPersonDesk(role)) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Person Desk: ${payload.displayName ?? 'person'}`}
      style={{ position: 'fixed', inset: 0, zIndex: DESK_Z, background: 'rgba(17,24,39,0.32)', display: 'flex', justifyContent: 'flex-end' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) desk.close()
      }}
    >
      <div
        style={{
          width: narrow ? '100vw' : 'min(600px, 96vw)',
          height: '100%',
          background: 'var(--bg-page)',
          borderLeft: narrow ? 'none' : '1px solid var(--border)',
          boxShadow: '-12px 0 32px rgba(0,0,0,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <PersonDeskBody payload={payload} changeKey={desk.changeKey} onChanged={desk.markChanged} onClose={desk.close} variant="drawer" />
      </div>
    </div>
  )
}
