/**
 * Materials on site (punch list #209): the Photo press on a box, three taps and nothing to decide. It
 * opens the camera, shrinks the shot on the phone, names it the way the photo sweep names one in the
 * job's Drive folder (*2026-10-28 Jordan · A1 after Put in.jpg*) and sends it; the sweep files it and
 * the note reads "in the job's folder". With no signal the shot stays on the phone and the box screen
 * offers Send now, or Share instead through the share sheet. `BoxPhotos` draws the thumbnails.
 */
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { addPhoto, newId, updatePhoto } from '../../lib/materials/onSiteStore'
import { photoFileName, photoStatusWords, photoWords, type PhotoNote } from '../../lib/materials/photo'
import { getPhotoBlob } from '../../lib/materials/photoBlobs'
import { bytesWords, shrinkPhoto } from '../../lib/materials/photoShrink'
import { canSharePhoto, downloadFile, sharePhoto } from '../../lib/materials/photoShare'
import { sendBoxPhoto } from '../../lib/materials/photoUpload'
import { formatErrorMessage } from '../../utils/errorHandling'

export function CameraGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ display: 'block', flex: '0 0 auto' }}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

type Toast = (m: string, t: 'success' | 'info' | 'error') => void

export function PhotoPress({ jobId, containerId, containerLabel, after, byUserId, byName, onToast, style }: {
  jobId: string
  containerId: string
  containerLabel: string
  /** What just happened to the box, when it was minutes ago: "Put in", "Add a part", "Count". Null otherwise. */
  after: string | null
  byUserId: string | null
  byName: string
  onToast: Toast
  style?: CSSProperties
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const label = busy ?? (after ? `Photo after ${after}` : `Photo of ${containerLabel}`)
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const at = new Date().toISOString()
    setBusy('Shrinking…')
    try {
      const shot = await shrinkPhoto(f)
      const type = shot.shrunk ? 'image/jpeg' : f.type || 'image/jpeg'
      const fileName = photoFileName({ at, byName, containerLabel, after, mime: type })
      const id = newId()
      const note: PhotoNote = { id, jobId, containerId, fileName, byUserId, byName, at, bytes: shot.blob.size, width: shot.width, height: shot.height, status: 'sending', driveFileId: null, storagePath: null, words: photoWords(containerLabel, after) }
      setBusy('Sending…')
      try {
        const sent = await sendBoxPhoto({ id, jobId, containerId, blob: shot.blob, fileName })
        addPhoto({ ...note, storagePath: sent.storagePath })
        onToast(`Photo of ${containerLabel} is on its way to the job's folder, ${bytesWords(shot.blob.size)}.`, 'success')
      } catch (err) {
        addPhoto({ ...note, status: 'on-phone' })
        onToast(`${formatErrorMessage(err)} The photo is kept on this phone: press Send now when there is one.`, 'info')
      }
    } catch (err) {
      onToast(`The photo could not be taken: ${formatErrorMessage(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <button type="button" style={style} disabled={busy != null} aria-label={`${label}: open the camera; the picture goes to the job's Drive folder by itself`} title="Opens the camera. The picture is shrunk on the phone and filed in the job's Drive folder, named for this box." onClick={() => input.current?.click()}>
        <CameraGlyph />
        {label}
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" onChange={onFile} tabIndex={-1} aria-hidden style={{ display: 'none' }} />
    </>
  )
}

/** The box's photos as thumbnails with their status; on the phone a kept shot offers Send now and Share instead. */
export function BoxPhotos({ photos, canAct, onToast, size = 56 }: { photos: PhotoNote[]; canAct: boolean; onToast?: Toast; size?: number }) {
  // The bytes come from the phone's own store; a blob is kept beside its url so Share instead can run inside the press.
  const [loaded, setLoaded] = useState<Record<string, { url: string; blob: Blob }>>({})
  const ids = photos.map((p) => p.id).join('|')
  useEffect(() => {
    let live = true
    const made: string[] = []
    Promise.all(photos.map(async (p) => [p.id, await getPhotoBlob(p.id).catch(() => null)] as const)).then((pairs) => {
      if (!live) return
      const next: Record<string, { url: string; blob: Blob }> = {}
      for (const [id, blob] of pairs) {
        if (!blob) continue
        const url = URL.createObjectURL(blob)
        made.push(url)
        next[id] = { url, blob }
      }
      setLoaded(next)
    })
    return () => { live = false; for (const u of made) URL.revokeObjectURL(u) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids])
  const [busyId, setBusyId] = useState<string | null>(null)
  const sendNow = async (p: PhotoNote) => {
    const got = loaded[p.id]
    if (!got) return
    setBusyId(p.id)
    try {
      const sent = await sendBoxPhoto({ id: p.id, jobId: p.jobId, containerId: p.containerId, blob: got.blob, fileName: p.fileName })
      updatePhoto(p.id, { status: 'sending', storagePath: sent.storagePath })
      onToast?.(`Photo on its way to the job's folder.`, 'success')
    } catch (err) {
      onToast?.(`${formatErrorMessage(err)} Still kept on this phone.`, 'info')
    } finally {
      setBusyId(null)
    }
  }
  const shareInstead = async (p: PhotoNote) => {
    const got = loaded[p.id]
    if (!got) return
    const file = new File([got.blob], p.fileName, { type: got.blob.type || 'image/jpeg' })
    try {
      if (canSharePhoto(file)) {
        const shared = await sharePhoto(file, photoWords(p.fileName, null))
        if (!shared) return
      } else downloadFile(file)
      updatePhoto(p.id, { status: 'shared' })
      onToast?.(`Photo shared as ${p.fileName}.`, 'success')
    } catch (err) {
      onToast?.(`The photo could not be shared: ${formatErrorMessage(err)}`, 'error')
    }
  }
  const small: CSSProperties = { minHeight: 32, padding: '0 0.6rem', borderRadius: 999, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }
  return (
    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      {photos.map((p) => {
        const got = loaded[p.id]
        const words = photoStatusWords(p.status)
        return (
          <div key={p.id} style={{ display: 'grid', gap: 4, justifyItems: 'start', maxWidth: 220 }} title={`${p.fileName} · ${bytesWords(p.bytes)}${p.width ? ` · ${p.width} × ${p.height}` : ''}`}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {got ? <img src={got.url} alt={p.fileName} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} /> : <span style={{ width: size, height: size, borderRadius: 8, border: '1px dashed var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}><CameraGlyph size={18} /></span>}
              <span style={{ fontSize: '0.8rem', color: p.status === 'on-phone' ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: p.status === 'on-phone' ? 600 : 500, lineHeight: 1.25 }}>
                {words}
                <br />
                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{bytesWords(p.bytes)} · {p.byName}</span>
              </span>
            </div>
            {canAct && p.status === 'on-phone' ? (
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button type="button" style={small} disabled={busyId === p.id || !got} onClick={() => sendNow(p)}>{busyId === p.id ? 'Sending…' : 'Send now'}</button>
                <button type="button" style={small} disabled={!got} onClick={() => shareInstead(p)}>Share instead</button>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
