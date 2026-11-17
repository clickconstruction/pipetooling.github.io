import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTaskShot, type TaskShot } from '../../hooks/useTaskShot'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { sheetOutcome, type SheetPressOutcome } from '../../lib/taskSheetPress'
import { ADD_PHOTO_PRESS, ADD_PHOTO_SHEET_TITLE, ADD_PHOTO_TILE_WORDS } from '../../lib/tasks/todayPage'
import { TaskPhotoTile } from './TaskPhotoTile'

/**
 * A photo for a task, at any time (punch list #369, step B2). A card could take a photo only at a percent, on a Done
 * when… line, or at the finish of a card that asks for one, so a person had no way to show proof on an everyday task.
 * The card's **📷 Photo** press opens this: the photo tile and one press. The shot goes to the card's strip, as a
 * `progress` photo on an open card and a `finish` photo on a done one. It finishes nothing and changes no percent.
 *
 * Built on the finishing sheet's frame (`TaskFinishSheet`), so it docks to the bottom of a phone the same way.
 */
export function TaskPhotoSheet({
  open,
  title,
  onAdd,
  onClose,
  error = null,
}: {
  open: boolean
  title: string
  /** Resolves `ok` once the photo is sent or kept on the phone; the sheet closes then. */
  onAdd: (shot: TaskShot) => Promise<boolean | SheetPressOutcome>
  onClose: () => void
  error?: string | null
}) {
  const isMobile = useIsMobile()
  const shotHost = useTaskShot()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setSaving(false)
    shotHost.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const canGo = Boolean(shotHost.shot) && !shotHost.kept && !saving && !shotHost.shrinking
  const press = async () => {
    if (!canGo || !shotHost.shot) return
    setSaving(true)
    try {
      const out = sheetOutcome(await onAdd(shotHost.shot))
      if (out.shotKept) shotHost.markKept()
      if (out.ok) onClose()
    } finally {
      setSaving(false)
    }
  }

  const panel: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: '18px 18px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxHeight: '88vh', overflowY: 'auto' }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(440px, calc(100vw - 32px))', borderRadius: 16, padding: '16px 18px' }

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 1210, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="task-photo-sheet-title" onClick={(e) => e.stopPropagation()} style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h2 id="task-photo-sheet-title" style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
            {ADD_PHOTO_SHEET_TITLE}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>
            ×
          </button>
        </div>
        <p style={{ margin: '4px 0 12px', fontSize: '0.9rem', color: 'var(--text-strong)', fontWeight: 600, lineHeight: 1.4 }}>{title}</p>
        <TaskPhotoTile host={shotHost} words={ADD_PHOTO_TILE_WORDS} required disabled={saving} />
        {error ? <div style={{ fontSize: '0.85rem', color: 'var(--text-red-700)', margin: '0 0 10px' }}>{error}</div> : null}
        <button
          type="button"
          onClick={() => void press()}
          disabled={!canGo}
          style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', fontSize: '1rem', fontWeight: 700, cursor: canGo ? 'pointer' : 'not-allowed', background: canGo ? '#2563eb' : DEAD_PRESS_FILL, color: canGo ? '#fff' : DEAD_PRESS_TEXT }}
        >
          {saving ? '…' : ADD_PHOTO_PRESS}
        </button>
      </div>
    </div>,
    document.body,
  )
}
