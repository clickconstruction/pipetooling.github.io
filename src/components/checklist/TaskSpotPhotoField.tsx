import { useEffect, useRef } from 'react'
import { useTaskShot } from '../../hooks/useTaskShot'

/** A device held in the hand: its press on the field opens the camera. A desk opens the file picker. */
function handHeld(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

/** The photo as the giver has it now: a picture just taken and not yet sent, or the one the task already has. */
export type TaskSpotPhotoDraft = { kind: 'new'; id: string; blob: Blob; previewUrl: string } | { kind: 'saved'; path: string; previewUrl: string | null }

type Props = {
  value: TaskSpotPhotoDraft | null
  onChange: (next: TaskSpotPhotoDraft | null) => void
  /** True while the owner is sending a picture: the presses wait. */
  busy?: boolean
}

/**
 * Photo of the spot (punch list #328, PR 6): the giver's one optional picture of where the work is,
 * beside the Place row. On a phone the press opens the camera. The picture is shrunk on the device
 * to the office's own photo size before it goes anywhere, and the shrink drops the camera's data, so
 * no position travels with it. The place is set by the giver's own press, never read off a picture.
 *
 * The field only holds the picture. The window that owns it sends it when the task is saved, since a
 * new task has no id to file a picture under until then.
 */
export function TaskSpotPhotoField({ value, onChange, busy = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { shot, shrinking, error, pick } = useTaskShot()
  const handed = useRef<string | null>(null)

  // A pick that finished shrinking becomes the field's value, once.
  useEffect(() => {
    if (!shot || handed.current === shot.id) return
    handed.current = shot.id
    onChange({ kind: 'new', id: shot.id, blob: shot.blob, previewUrl: shot.previewUrl })
  }, [shot, onChange])

  const open = () => inputRef.current?.click()
  const waiting = busy || shrinking

  return (
    <div data-task-spot-photo-field style={{ marginTop: '0.6rem' }}>
      <span id="task-spot-photo-label" style={{ display: 'block', fontWeight: 500, marginBottom: '0.35rem' }}>
        Photo of the spot
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={handHeld() ? 'environment' : undefined}
        aria-labelledby="task-spot-photo-label"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void pick(file)
        }}
      />
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          {value.previewUrl ? (
            <img src={value.previewUrl} alt="The photo of the spot" style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
          ) : (
            <span style={{ width: 96, height: 72, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>Photo saved</span>
          )}
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem', fontSize: '0.8125rem' }}>
            <button type="button" onClick={open} disabled={waiting} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}>
              {shrinking ? 'Reading the photo…' : 'Take another'}
            </button>
            <button type="button" onClick={() => onChange(null)} disabled={waiting} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit' }}>
              Remove the photo
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={waiting}
          style={{ display: 'grid', placeItems: 'center', width: '100%', minHeight: 64, borderRadius: 8, border: '1.5px dashed var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.875rem', fontWeight: 600, cursor: waiting ? 'default' : 'pointer', fontFamily: 'inherit' }}
        >
          {shrinking ? 'Reading the photo…' : '＋ Add a photo'}
        </button>
      )}
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
        {value ? 'The person sees this photo on the task, beside the place.' : 'What the spot looks like. Leave it out for a task that needs none.'}
      </div>
      {error ? (
        <p role="alert" style={{ margin: '0.3rem 0 0', fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
