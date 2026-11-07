import { useRef } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { TaskShotHost } from '../../hooks/useTaskShot'

/**
 * Task cards (#273, PR 4b): the photo tile on a sheet. Dashed and empty it reads its ask (*A photo of where it stands*,
 * *The finishing photo*); a tap opens the camera on a phone (the file picker at a desk); picked, it shows the shot with
 * *Take another* and *Remove*. The one hidden file input lives inside.
 */
export function TaskPhotoTile({ host, words, required = false, disabled = false }: { host: TaskShotHost; words: string; required?: boolean; disabled?: boolean }) {
  const isMobile = useIsMobile()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const open = () => {
    if (disabled || host.shrinking) return
    inputRef.current?.click()
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={isMobile ? 'environment' : undefined}
        tabIndex={-1}
        aria-hidden
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        data-testid="task-photo-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void host.pick(f)
        }}
      />
      {host.shot ? (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <img src={host.shot.previewUrl} alt="The photo you took" style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #16a34a' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-green-700)' }}>📷 Photo taken</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={open} disabled={disabled} style={{ fontSize: '0.8rem', padding: '4px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
                Take another
              </button>
              <button type="button" onClick={host.clear} disabled={disabled} style={{ fontSize: '0.8rem', padding: '4px 9px', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={disabled || host.shrinking}
          aria-label={words}
          style={{
            width: '100%',
            minHeight: 66,
            borderRadius: 10,
            border: `1.5px dashed ${required ? '#d97706' : 'var(--border-strong)'}`,
            background: 'var(--surface)',
            color: 'var(--text-700)',
            fontWeight: 700,
            fontSize: '0.9rem',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: 8,
          }}
        >
          {host.shrinking ? 'Shrinking the photo…' : `📷 ${words}`}
          {!host.shrinking ? <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginTop: 2 }}>{required ? 'asked on this card' : 'offered, never held'}</span> : null}
        </button>
      )}
      {host.error ? <div style={{ fontSize: '0.8rem', color: 'var(--text-red-700)', marginTop: 4 }}>{host.error}</div> : null}
    </div>
  )
}
