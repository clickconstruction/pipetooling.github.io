/**
 * A place on a painted map, being added or changed (punch list #345): what it is, a word for
 * whoever comes next, and a photo. The dot itself is on the map above this panel, dragged under
 * the magnifying glass or set by one reading of where the painter stands.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTaskShot } from '../../hooks/useTaskShot'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { PAINTED_PLACE_CHIPS, PAINTED_PLACE_NAME_MAX, PAINTED_PLACE_WORDS_MAX, type PaintedPlace } from '../../lib/paintedMap/paintedMap'
import { PAINTED_PLACE_NO_CODES_WORDS } from '../../lib/paintedMap/paintedPlacePhoto'
import { isPoorFix } from '../../lib/paintedMap/paintedTrack'
import { taskPlaceAccuracyWords } from '../../lib/tasks/taskPlace'

/** The photo as the panel hands it over: a new picture, the one the place already has, or none. */
export type PaintedPlacePhotoChoice = { kind: 'new'; id: string; blob: Blob } | { kind: 'keep' } | { kind: 'none' }

type Props = {
  /** The place being changed, or null for a new one. */
  place: PaintedPlace | null
  /** The saved photo, to look at. */
  photoUrl: string | null
  /** The phone's margin, while the dot still sits on its reading. Null once the dot was moved by hand. */
  accuracyM: number | null
  /** A reading was taken and the dot was then moved off it. */
  movedOffReading: boolean
  finding: boolean
  busy: boolean
  /** The place is the caller's to remove. */
  canRemove: boolean
  onUseWhereIAm: () => void
  onSave: (input: { name: string; words: string; photo: PaintedPlacePhotoChoice }) => void
  onRemove: () => void
  onCancel: () => void
}

const press: CSSProperties = { minHeight: 44, padding: '0 0.9rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer' }
const deadPress: CSSProperties = { ...press, background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const chip: CSSProperties = { minHeight: 36, padding: '0 0.8rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }
const chipOn: CSSProperties = { ...chip, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }
const field: CSSProperties = { minHeight: 44, padding: '0.5rem 0.6rem', fontSize: '1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box', width: '100%' }
const label: CSSProperties = { display: 'grid', gap: '0.3rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }
const quiet: CSSProperties = { background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: '0.875rem', textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer', minHeight: 32 }

/** A device held in the hand: its press on the photo opens the camera. A desk opens the file picker. */
function handHeld(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

export function PaintedPlacePanel({ place, photoUrl, accuracyM, movedOffReading, finding, busy, canRemove, onUseWhereIAm, onSave, onRemove, onCancel }: Props) {
  const [name, setName] = useState(place?.name ?? '')
  const [words, setWords] = useState(place?.words ?? '')
  // The saved photo stays until the painter takes it off or takes another.
  const [keepSaved, setKeepSaved] = useState(Boolean(place?.photoPath))
  const inputRef = useRef<HTMLInputElement>(null)
  const { shot, shrinking, error: shotError, pick, clear } = useTaskShot()

  useEffect(() => {
    if (shot) setKeepSaved(false)
  }, [shot])

  const sure = taskPlaceAccuracyWords(accuracyM)
  const poor = isPoorFix(accuracyM)
  const preview = shot?.previewUrl ?? (keepSaved ? photoUrl : null)
  const hasPhoto = Boolean(shot) || keepSaved
  const waiting = busy || shrinking

  const save = () => {
    if (waiting) return
    onSave({ name, words, photo: shot ? { kind: 'new', id: shot.id, blob: shot.blob } : keepSaved ? { kind: 'keep' } : { kind: 'none' } })
  }

  return (
    <div data-painted-place-panel style={{ display: 'grid', gap: '0.7rem' }}>
      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>What is here?</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {PAINTED_PLACE_CHIPS.map((c) => (
            <button key={c} type="button" aria-pressed={name === c} style={name === c ? chipOn : chip} onClick={() => setName(c)}>
              {c}
            </button>
          ))}
        </div>
        <label style={label}>
          Name
          <input type="text" value={name} maxLength={PAINTED_PLACE_NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Truck gate" style={field} />
        </label>
      </div>
      <div style={{ display: 'grid', gap: '0.3rem' }}>
        <label style={label}>
          A word for whoever comes next
          <input type="text" value={words} maxLength={PAINTED_PLACE_WORDS_MAX} onChange={(e) => setWords(e.target.value)} placeholder="Close it behind you." style={field} />
        </label>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{PAINTED_PLACE_NO_CODES_WORDS}</span>
      </div>

      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Photo</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture={handHeld() ? 'environment' : undefined}
          aria-label="Photo of the place"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void pick(file)
          }}
        />
        {hasPhoto ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {preview ? (
              <img src={preview} alt="The photo of the place" style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
            ) : (
              <span style={{ width: 96, height: 72, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'grid', placeItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>A photo is saved</span>
            )}
            <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem' }}>
              <button type="button" style={quiet} disabled={waiting} onClick={() => inputRef.current?.click()}>
                {shrinking ? 'Reading the photo…' : 'Take another'}
              </button>
              <button
                type="button"
                style={quiet}
                disabled={waiting}
                onClick={() => {
                  clear()
                  setKeepSaved(false)
                }}
              >
                Remove the photo
              </button>
            </span>
          </div>
        ) : (
          <button type="button" disabled={waiting} onClick={() => inputRef.current?.click()} style={{ display: 'grid', placeItems: 'center', width: '100%', minHeight: 64, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontSize: '0.875rem', fontFamily: 'inherit', cursor: 'pointer' }}>
            {shrinking ? 'Reading the photo…' : '＋ Add a photo'}
          </button>
        )}
        {shotError ? (
          <p role="alert" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-red-700)' }}>
            {shotError}
          </p>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <button type="button" style={finding ? deadPress : press} disabled={finding} onClick={onUseWhereIAm}>
          {finding ? 'Finding you…' : 'Put the dot where I am'}
        </button>
        {sure && poor ? (
          <p role="status" data-painted-place-fix="poor" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }}>
            Your phone is only sure {sure}. Drag the dot onto the spot.
          </p>
        ) : sure ? (
          <p role="status" data-painted-place-fix="ok" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-green-700)' }}>
            Found you. Your phone is sure {sure}.
          </p>
        ) : movedOffReading ? (
          <p role="status" data-painted-place-fix="moved" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            You moved the dot. The place is where the dot is now.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Drag the blue dot onto the spot, or press the map to bring it there. Your phone is read once, on that press, and not followed.</p>
        )}
      </div>

      <button type="button" data-painted-place-save style={waiting ? { ...deadPress, minHeight: 52 } : { ...press, minHeight: 52, background: '#2563eb', borderColor: '#2563eb', color: '#fff' }} disabled={waiting} onClick={save}>
        {busy ? 'Saving…' : place ? 'Save the place' : 'Add this place'}
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" style={press} onClick={onCancel}>
          Cancel
        </button>
        {place && canRemove ? (
          <button type="button" style={quiet} onClick={onRemove}>
            Remove this place
          </button>
        ) : null}
      </div>
    </div>
  )
}
