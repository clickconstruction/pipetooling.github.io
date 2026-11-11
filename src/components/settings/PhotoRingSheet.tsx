/**
 * Cards and footers (punch list #313) — the photo sheet: a person's headshot placed in its ring.
 *
 * It opens from *Change the photo* on the card *Your card and footer*. The photo is kept whole;
 * dragging the picture and sliding the zoom only move three numbers, which the footer and the
 * business card both read (`cropMath.ts`). A new photo is shrunk on the device before it is
 * sent. On a phone it rises as a sheet; at a desk it is a centred box (`PhoneSheet`).
 */
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { PhoneSheet } from '../PhoneSheet'
import { BRAND } from '../../lib/brandKit/layouts'
import { clampCrop, dragCrop, stagePlacement, zoomCrop, ZOOM_MAX, ZOOM_MIN } from '../../lib/brandKit/cropMath'
import { readPicture, type CardPhoto } from '../../lib/brandKit/cardIo'
import { DEFAULT_CROP, type KitCrop } from '../../lib/brandKit/person'
import type { CardWords } from '../../lib/brandKit/cardWords'
import { shrinkPhoto } from '../../lib/materials/photoShrink'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { formatErrorMessage } from '../../utils/errorHandling'

const STAGE = 260

const quiet: CSSProperties = { padding: '0.55rem 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-base)', cursor: 'pointer', font: 'inherit', fontWeight: 500, flex: 1 }
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.8125rem', margin: 0 }

/** The ring over the stage: the part of the picture outside it is dimmed, never hidden, so a person sees what they are dragging. */
const ringMask: CSSProperties = { position: 'absolute', inset: 0, borderRadius: '50%', border: `5px solid ${BRAND.orange}`, boxShadow: '0 0 0 200px rgba(0, 0, 0, 0.58)', pointerEvents: 'none' }

export function PhotoRingSheet({
  words,
  photo,
  crop,
  zIndex,
  onClose,
  onSave,
}: {
  words: CardWords
  /** The photo on file, or null when there is none yet. */
  photo: CardPhoto | null
  crop: KitCrop
  zIndex?: number
  onClose: () => void
  /** `blob` is a new photo to send, or null when only its place in the ring changed. Resolves when saved; rejects with the reason. */
  onSave: (blob: Blob | null, crop: KitCrop) => Promise<void>
}) {
  const [picture, setPicture] = useState<CardPhoto | null>(photo)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [draft, setDraft] = useState<KitCrop>(photo ? clampCrop(crop, photo) : DEFAULT_CROP)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const live = useRef(true)
  // set on every mount: the dev server mounts an effect twice, and a flag only ever cleared would drop a chosen photo
  useEffect(() => {
    live.current = true
    return () => void (live.current = false)
  }, [])

  const choose = async (file: File | undefined) => {
    if (!file) return
    setProblem(null)
    try {
      const shot = await shrinkPhoto(file, 1600, 0.85)
      const next = await readPicture(shot.blob)
      if (!live.current) return
      setPicture(next)
      setBlob(shot.blob)
      setDraft(clampCrop(DEFAULT_CROP, next))
    } catch {
      if (live.current) setProblem(words.photoNotRead)
    }
  }

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!picture) return
    drag.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const from = drag.current
    if (!from || !picture) return
    drag.current = { x: e.clientX, y: e.clientY }
    setDraft((c) => dragCrop(c, e.clientX - from.x, e.clientY - from.y, picture, STAGE))
  }
  const onUp = () => {
    drag.current = null
  }

  const changed = Boolean(blob) || (photo != null && (draft.fx !== crop.fx || draft.fy !== crop.fy || draft.zoom !== crop.zoom))
  const canSave = Boolean(picture) && changed && !busy

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    setProblem(null)
    try {
      await onSave(blob, draft)
    } catch (e) {
      if (live.current) setProblem(formatErrorMessage(e, words.photoNotSaved))
    } finally {
      if (live.current) setBusy(false)
    }
  }

  const at = picture ? stagePlacement(draft, picture, STAGE) : null

  return (
    <PhoneSheet label={words.sheetTitle} title={words.sheetTitle} width={420} zIndex={zIndex} onClose={onClose} dataAttrs={{ 'data-photo-ring-sheet': '' }}>
      <div style={{ padding: '0.25rem 1rem 1rem', overflowY: 'auto' }}>
        <p style={{ ...muted, marginBottom: '0.75rem' }}>{words.sheetLead}</p>
        <div
          data-photo-ring-stage
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{ position: 'relative', width: STAGE, height: STAGE, margin: '0 auto 0.6rem', borderRadius: 10, overflow: 'hidden', background: '#0b0f17', touchAction: 'none', cursor: picture ? 'grab' : 'default', display: 'grid', placeItems: 'center' }}
        >
          {picture && at ? (
            <img alt="" src={picture.href} draggable={false} style={{ position: 'absolute', left: at.x, top: at.y, width: at.w, height: at.h, maxWidth: 'none', userSelect: 'none' }} />
          ) : (
            <span style={{ color: 'white', fontSize: '0.875rem', textAlign: 'center', padding: '0 2.5rem', position: 'relative', zIndex: 1 }}>{words.ringEmpty}</span>
          )}
          <div style={ringMask} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
          {words.zoom}
          <input
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={0.01}
            value={draft.zoom}
            disabled={!picture}
            onChange={(e) => picture && setDraft((c) => zoomCrop(c, Number(e.target.value), picture))}
            style={{ width: 180 }}
          />
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem' }}>
          <label style={{ ...quiet, textAlign: 'center' }}>
            {words.takePhoto}
            <input type="file" accept="image/*" capture="user" hidden onChange={(e) => void choose(e.target.files?.[0])} />
          </label>
          <label style={{ ...quiet, textAlign: 'center' }}>
            {words.choosePhoto}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(e) => void choose(e.target.files?.[0])} />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          style={{ width: '100%', padding: '0.65rem 1rem', border: 'none', borderRadius: 6, font: 'inherit', fontWeight: 600, background: canSave ? '#2563eb' : DEAD_PRESS_FILL, color: canSave ? 'white' : DEAD_PRESS_TEXT, cursor: canSave ? 'pointer' : 'default' }}
        >
          {busy ? words.saving : words.savePhoto}
        </button>
        {problem ? (
          <div role="alert" style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {problem}
          </div>
        ) : null}
        <p style={{ ...muted, marginTop: '0.6rem' }}>{words.sheetFoot}</p>
      </div>
    </PhoneSheet>
  )
}
