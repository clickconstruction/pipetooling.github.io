import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTaskShot } from '../../hooks/useTaskShot'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { finishRule } from '../../lib/taskProgress'
import { sheetOutcome, type SheetPressOutcome } from '../../lib/taskSheetPress'
import { TaskPhotoTile } from './TaskPhotoTile'
import type { TaskShot } from '../../hooks/useTaskShot'

/**
 * Task cards (#273, PR 4b): the finishing sheet, on a card that asks for a photo. It opens when the last Done when…
 * line is ticked or when Done is pressed on the % sheet: *Every line is ticked* or *Finishing*, the photo tile
 * (required), one *No photo, here is why* line, and **Done · 100%**, which reads **Photo first** and holds until a photo
 * is in or a reason is typed (`finishRule`). The press sends the photo, posts the reason when there is one, then
 * finishes the card the way the tick did. A shot the press could not send for want of signal comes back `shotKept`
 * (v2.6628): the tile reads *Kept on the phone* and a second press sends it no more.
 */

export function TaskFinishSheet({
  open,
  title,
  lines,
  onDone,
  onClose,
  error = null,
}: {
  open: boolean
  title: string
  /** *3 of 3* when the last line brought the sheet, null when Done did. */
  lines: { ticked: number; total: number } | null
  /** Resolves `ok` once the card is finished; the sheet closes then. `shotKept` marks the tile. */
  onDone: (shot: TaskShot | null, reason: string) => Promise<boolean | SheetPressOutcome>
  onClose: () => void
  /** A send that failed, with its reason; the sheet stays open. */
  error?: string | null
}) {
  const isMobile = useIsMobile()
  const shotHost = useTaskShot()
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason('')
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

  const rule = finishRule({ asksForPhoto: true }, Boolean(shotHost.shot), reason)
  const canGo = rule.ok && !saving && !shotHost.shrinking
  const press = async () => {
    if (!canGo) return
    setSaving(true)
    try {
      // A shot already kept on the phone rides its own press; the finish goes without it.
      const out = sheetOutcome(await onDone(shotHost.kept ? null : shotHost.shot, reason.trim()))
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
      <div role="dialog" aria-modal="true" aria-labelledby="task-finish-sheet-title" onClick={(e) => e.stopPropagation()} style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)', boxSizing: 'border-box' }} data-testid="task-finish-sheet">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h2 id="task-finish-sheet-title" style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
            {lines ? 'Every line is ticked' : 'Finishing'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>
            ×
          </button>
        </div>
        <p style={{ margin: '4px 0 12px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
          <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>{title}</span>
          {lines ? <> · {lines.ticked} of {lines.total}</> : null} · this card asks for a photo
        </p>
        <TaskPhotoTile host={shotHost} words="The finishing photo" required disabled={saving} />
        {!shotHost.shot ? (
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 140))}
            placeholder="No photo, here is why…"
            aria-label="No photo, here is why"
            maxLength={140}
            style={{ width: '100%', boxSizing: 'border-box', height: 46, padding: '0 0.75rem', fontSize: '1rem', border: '2px solid var(--text-600)', borderRadius: 10, marginBottom: 10 }}
          />
        ) : null}
        {error ? <div style={{ fontSize: '0.85rem', color: 'var(--text-red-700)', margin: '0 0 10px' }}>{error}</div> : null}
        <button
          type="button"
          onClick={() => void press()}
          disabled={!canGo}
          style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', fontSize: '1rem', fontWeight: 700, cursor: canGo ? 'pointer' : 'not-allowed', background: canGo ? '#16a34a' : DEAD_PRESS_FILL, color: canGo ? 'white' : DEAD_PRESS_TEXT }}
        >
          {saving ? '…' : rule.pressWords}
        </button>
      </div>
    </div>,
    document.body,
  )
}
