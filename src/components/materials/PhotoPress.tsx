/**
 * Materials on site (punch list #209): the Photo press on a box, three taps and nothing to decide. It
 * opens the camera, shrinks the shot on the phone, names it the way the photo sweep names one in the
 * job's Drive folder (*2026-10-28 Jordan · A1 after Put in.jpg*) and sends it; the sweep files it and
 * the note reads "in the job's folder". With no signal the shot stays on the phone and the box screen
 * offers Send now, or Share instead through the share sheet. `BoxPhotos` draws the thumbnails, on every phone and
 * at the office since v2.7819: a filed shot from the job's Drive folder, a shot that waits from this phone's own
 * store as a small copy, else from the bucket (`boxPhotoBytesIo.ts`), and a press on one opens the whole picture.
 * A square reads its picture only once it is near the screen, so a page of ninety boxes reads the few in view.
 */
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { updatePhoto } from '../../lib/materials/onSiteStore'
import { shootBoxPhoto } from '../../lib/materials/boxPhotoShoot'
import { photoStatusWords, photoWords, type PhotoNote } from '../../lib/materials/photo'
import { readBoxPhotoBytes } from '../../lib/materials/boxPhotoBytesIo'
import { boxPhotoMissingWords, boxPhotoOpenLabel, boxPhotoReasonWords } from '../../lib/materials/boxPhotoSource'
import { bytesWords } from '../../lib/materials/photoShrink'
import { boxPhotoDayWords } from '../../lib/materials/boxScreen'
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

/** How far past the screen's top and bottom a square starts reading its picture: about a screen ahead on a phone. */
const BOX_PHOTO_NEAR_MARGIN = '600px 0px'

export function PhotoPress({ jobId, containerId, containerLabel, after, byUserId, byName, onToast, onTaken, style, fact, factStyle }: {
  jobId: string
  containerId: string
  containerLabel: string
  /** What just happened to the box, when it was minutes ago: "Put in", "Add a part", "Count". Null otherwise. Names the file and turns the chip blue; the chip itself reads Photo. */
  after: string | null
  byUserId: string | null
  byName: string
  onToast: Toast
  /** A shot was kept, on its way or on this phone: the person stands at the box (the pin ask, punch list #372). */
  onTaken?: () => void
  style?: CSSProperties
  /** On a box's own screen the press is a tile (punch list #398): what it has, or what a photo now would be of, under its name. */
  fact?: string
  factStyle?: CSSProperties
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // One word on the chip so three fit one line at 375 (v2.6229); what the shot follows is said by the blue outline, the aria-label and the file's name.
  const label = busy ?? 'Photo'
  const ofWhat = after ? `Photo after ${after}` : `Photo of ${containerLabel}`
  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const shot = await shootBoxPhoto(f, { jobId, containerId, containerLabel, after, byUserId, byName, onStage: (s) => setBusy(s === 'shrinking' ? 'Shrinking…' : 'Sending…') })
      if (shot.kind === 'lost') {
        // Nothing holds the shot, and the words do not say it is kept.
        onToast(`${shot.why} This phone could not keep the photo either. Take it again when there is signal.`, 'error')
      } else if (shot.kind === 'kept') {
        onTaken?.()
        onToast(`${shot.why} The photo is kept on this phone. It sends by itself when there is signal.`, 'info')
      } else {
        onTaken?.()
        onToast(`Photo of ${containerLabel} is on its way to the job's folder, ${bytesWords(shot.note.bytes)}.`, 'success')
      }
    } catch (err) {
      onToast(`The photo could not be taken: ${formatErrorMessage(err)}`, 'error')
    } finally {
      setBusy(null)
    }
  }
  return (
    <>
      <button type="button" style={style} disabled={busy != null} aria-label={`${busy ?? ofWhat}: open the camera; the picture goes to the job's Drive folder by itself`} title="Opens the camera. The picture is shrunk on the phone and filed in the job's Drive folder, named for this box." onClick={() => input.current?.click()}>
        {fact == null ? <><CameraGlyph />{label}</> : <><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, fontSize: '0.95rem' }}><CameraGlyph size={16} />{label}</span><span style={factStyle}>{fact}</span></>}
      </button>
      <input ref={input} type="file" accept="image/*" capture="environment" onChange={onFile} tabIndex={-1} aria-hidden style={{ display: 'none' }} />
    </>
  )
}

/** The box's photos as thumbnails with their status; on the phone a kept shot offers Send now and Share instead. */
export function BoxPhotos({ photos, canAct, onToast, size = 56, quiet = false }: { photos: PhotoNote[]; canAct: boolean; onToast?: Toast; size?: number; /** A filed photo says its day and who took it, never where it is or its size (punch list #398). */ quiet?: boolean }) {
  // The picture comes from the place that holds it (`boxPhotoBytesIo.ts`); the bytes are kept beside the url when this
  // phone has them, so Send now and Share instead can run inside the press. The url is null where this phone holds the
  // bytes and could not make a small copy: the square stays empty and the two presses still work.
  const [loaded, setLoaded] = useState<Record<string, { url: string | null; blob: Blob | null }>>({})
  /** The photos whose read came back with nothing: the square says why. */
  const [missing, setMissing] = useState<Record<string, true>>({})
  const [open, setOpen] = useState<PhotoNote | null>(null)
  // A square reads its picture once it is near the screen. With no observer (an old browser, the test DOM) every square reads at once.
  const [near, setNear] = useState<Record<string, true>>({})
  const squares = useRef(new Map<string, HTMLElement>())
  const photoIds = photos.map((p) => p.id).join('|')
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setNear(Object.fromEntries(photoIds.split('|').filter(Boolean).map((id) => [id, true as const])))
      return
    }
    const obs = new IntersectionObserver((entries) => {
      const seen: string[] = []
      for (const e of entries) {
        if (!e.isIntersecting) continue
        obs.unobserve(e.target)
        const id = (e.target as HTMLElement).dataset.photoId
        if (id) seen.push(id)
      }
      if (seen.length) setNear((m) => ({ ...m, ...Object.fromEntries(seen.map((id) => [id, true as const])) }))
    }, { rootMargin: BOX_PHOTO_NEAR_MARGIN })
    for (const el of squares.current.values()) obs.observe(el)
    return () => obs.disconnect()
  }, [photoIds])
  // One read a photo, kept by the row's own state: a shot the sweep filed since the last look is read again, from its
  // folder, and the picture it had stays up until the new one lands.
  const reads = useRef(new Map<string, { key: string; url: string | null; live: boolean }>())
  const ids = photos.map((p) => `${p.id}:${p.status}:${p.driveFileId ?? ''}`).join('|')
  useEffect(() => {
    const now = new Map(photos.map((p) => [p.id, p]))
    const gone: string[] = []
    for (const [id, r] of reads.current) {
      if (now.has(id)) continue
      r.live = false
      if (r.url) URL.revokeObjectURL(r.url)
      reads.current.delete(id)
      gone.push(id)
    }
    if (gone.length) {
      const without = <T,>(m: Record<string, T>): Record<string, T> => { const next = { ...m }; for (const id of gone) delete next[id]; return next }
      setLoaded(without)
      setMissing(without)
    }
    for (const p of photos) {
      if (!near[p.id]) continue
      const key = `${p.status}:${p.driveFileId ?? ''}`
      const before = reads.current.get(p.id)
      if (before?.key === key) continue
      if (before) before.live = false
      const r = { key, url: before?.url ?? null, live: true }
      reads.current.set(p.id, r)
      const landed = (got: { url: string | null; blob: Blob | null } | null) => {
        if (!r.live) { if (got?.url) URL.revokeObjectURL(got.url); return }
        if (r.url) URL.revokeObjectURL(r.url)
        r.url = got?.url ?? null
        setLoaded((m) => { const next = { ...m }; if (got) next[p.id] = { url: got.url, blob: got.blob }; else delete next[p.id]; return next })
        setMissing((m) => { const next = { ...m }; if (got) delete next[p.id]; else next[p.id] = true; return next })
      }
      void readBoxPhotoBytes(p, 'thumb', size).then(landed, () => landed(null))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, near])
  useEffect(() => {
    const all = reads.current
    return () => {
      for (const r of all.values()) { r.live = false; if (r.url) URL.revokeObjectURL(r.url) }
      all.clear()
    }
  }, [])
  const [busyId, setBusyId] = useState<string | null>(null)
  const sendNow = async (p: PhotoNote) => {
    const got = loaded[p.id]
    if (!got?.blob) return
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
    if (!got?.blob) return
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
        // Why it is not where it should be: a shot that waits, or a frame whose picture did not come, filed or not.
        const reason = boxPhotoReasonWords(p, Boolean(missing[p.id]))
        return (
          <div key={p.id} data-photo-id={p.id} ref={(el) => { if (el) squares.current.set(p.id, el); else squares.current.delete(p.id) }} style={{ display: 'grid', gap: 4, justifyItems: 'start', maxWidth: 220 }} title={`${p.fileName} · ${bytesWords(p.bytes)}${p.width ? ` · ${p.width} × ${p.height}` : ''}`}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {got?.url ? (
                <button type="button" aria-label={boxPhotoOpenLabel(p)} onClick={() => setOpen(p)} style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', lineHeight: 0, flex: 'none' }}>
                  <img src={got.url} alt={p.fileName} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', display: 'block' }} />
                </button>
              ) : (
                <span title={missing[p.id] ? boxPhotoMissingWords(p) : undefined} data-testid="box-photo-none" style={{ width: size, height: size, flex: 'none', borderRadius: 8, border: '1px dashed var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)' }}><CameraGlyph size={18} /></span>
              )}
              <span style={{ fontSize: '0.8rem', color: p.status === 'on-phone' ? 'var(--text-amber-700)' : 'var(--text-muted)', fontWeight: p.status === 'on-phone' ? 600 : 500, lineHeight: 1.25 }}>
                {quiet && p.status === 'filed' ? boxPhotoDayWords(p) : words}
                {reason ? <><br /><span data-testid="box-photo-reason" style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>{reason}</span></> : null}
                <br />
                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{quiet && p.status === 'filed' ? p.byName : `${bytesWords(p.bytes)} · ${p.byName}`}</span>
              </span>
            </div>
            {canAct && p.status === 'on-phone' ? (
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button type="button" style={small} disabled={busyId === p.id || !got?.blob} onClick={() => sendNow(p)}>{busyId === p.id ? 'Sending…' : 'Send now'}</button>
                <button type="button" style={small} disabled={!got?.blob} onClick={() => shareInstead(p)}>Share instead</button>
              </div>
            ) : null}
          </div>
        )
      })}
      {open ? <BoxPhotoViewer photo={open} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

/** The whole picture over the screen (v2.7819): a press on a thumbnail opens it, a press anywhere or Escape closes it. */
export function BoxPhotoViewer({ photo, onClose }: { photo: PhotoNote; onClose: () => void }) {
  const [state, setState] = useState<{ url: string } | 'loading' | 'none'>('loading')
  useEffect(() => {
    let live = true
    let made: string | null = null
    setState('loading')
    void readBoxPhotoBytes(photo, 'full').then(
      (got) => {
        const u = got?.url
        if (!u) { if (live) setState('none'); return }
        if (!live) { URL.revokeObjectURL(u); return }
        made = u
        setState({ url: u })
      },
      () => { if (live) setState('none') },
    )
    return () => { live = false; if (made) URL.revokeObjectURL(made) }
  }, [photo])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const what = photo.words?.trim() || photo.fileName
  const when = new Date(photo.at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <div role="dialog" aria-modal="true" aria-label={`Photo of ${what}`} onClick={(e) => { e.stopPropagation(); onClose() }} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: 'calc(var(--app-top-chrome, 0px) + 0.75rem) 0.75rem calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
      {state === 'loading' ? <p style={{ margin: 0, color: '#fff' }}>Opening the photo…</p> : null}
      {state === 'none' ? <p role="alert" style={{ margin: 0, color: '#fff', textAlign: 'center' }}>{boxPhotoMissingWords(photo)}</p> : null}
      {typeof state === 'object' ? <img src={state.url} alt={photo.fileName} style={{ maxWidth: '100%', maxHeight: 'min(78vh, 100%)', objectFit: 'contain', borderRadius: 8, display: 'block' }} /> : null}
      <p style={{ margin: 0, color: '#fff', fontSize: '0.9rem', textAlign: 'center', overflowWrap: 'anywhere' }}>{what} · {photo.byName} · {when}</p>
      <button type="button" onClick={(e) => { e.stopPropagation(); onClose() }} style={{ minHeight: 48, padding: '0 1.4rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, cursor: 'pointer' }}>Close the photo</button>
    </div>
  )
}
