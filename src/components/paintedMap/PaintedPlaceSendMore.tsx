/**
 * Send more: the sheet behind the press beside **Text this place…** (v2.7844,
 * `lib/paintedMap/paintedPlaceSendMore.ts`). Up to three ways, each a name and one short line: this
 * place with its photo, every place of the row's set in one text, and the whole map.
 *
 * The photo is read when the sheet opens, since a phone opens its share sheet only inside the press
 * that asked for it. Until it is in hand the photo's press is dead and says so.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { placeSaysWords } from '../../lib/paintedMap/paintedPlaceKind'
import { SEND_MORE_WORDS as W, allPlacesName, allPlacesSub, placePhotoFileName, placesShareWords, placesTextHref, wholeMapWords, type SendMoreSet, type SendMoreWay } from '../../lib/paintedMap/paintedPlaceSendMore'
import { placeSendMoreIo, type PlaceSendMoreIo } from '../../lib/paintedMap/paintedPlaceSendMoreIo'
import { placeShareWords } from '../../lib/paintedMap/paintedPlaceShare'
import { PAINTED_MAP_SHEET_Z } from '../../lib/windowLayers'

export type SendMorePlace = { name: string; words?: string | null; kind?: string | null; lat: number; lng: number }

type Props = {
  place: SendMorePlace
  /** The place's photo in the bucket, for the photo's way. */
  photoPath?: string | null
  /** The ways to draw, in order (`sendMoreWays`). */
  ways: ReadonlyArray<SendMoreWay>
  /** The places of the row's set that have a spot to send. */
  set: ReadonlyArray<SendMorePlace>
  setKind: SendMoreSet
  /** A phone, where Messages can be opened. A desk copies. */
  phone: boolean
  /** The map is a job's own list of places. */
  list?: boolean
  /** Opens the map's own Share sheet. */
  onShareMap?: () => void
  onClose: () => void
  io?: PlaceSendMoreIo
}

type Photo = { kind: 'getting' } | { kind: 'ready'; file: File } | { kind: 'gone' }

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.7rem', width: '100%', minHeight: 56, padding: '0.4rem 0.8rem', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', textAlign: 'left', textDecoration: 'none', cursor: 'pointer', boxSizing: 'border-box' }
const dead: CSSProperties = { background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, borderColor: 'var(--border)', cursor: 'default' }
const sub: CSSProperties = { fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }
const note: CSSProperties = { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }

/** The small picture on each way: a photo, a few dots on a map, a painted line. */
function WayIcon({ way, color }: { way: SendMoreWay; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      {way === 'photo' ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="m21 15-4.5-4.5L8 19" />
        </>
      ) : way === 'all' ? (
        <>
          <path d="M7 3a3 3 0 0 1 3 3c0 2.2-3 5-3 5S4 8.2 4 6a3 3 0 0 1 3-3z" />
          <path d="M17 11a3 3 0 0 1 3 3c0 2.2-3 5-3 5s-3-2.8-3-5a3 3 0 0 1 3-3z" />
          <path d="M4 21h16" />
        </>
      ) : (
        <>
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="5" r="2" />
          <path d="M7 19h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6" />
        </>
      )}
    </svg>
  )
}

export function PaintedPlaceSendMore({ place, photoPath = null, ways, set, setKind, phone, list = false, onShareMap, onClose, io = placeSendMoreIo }: Props) {
  const isTopmost = useModalStackEntry()
  const offersPhoto = ways.includes('photo') && !!photoPath
  const [photo, setPhoto] = useState<Photo>({ kind: 'getting' })
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null)
  const says = placeSaysWords({ name: place.name, kind: place.kind })

  useEffect(() => {
    if (!offersPhoto || !photoPath) return
    let live = true
    void io.loadPhoto(photoPath, placePhotoFileName(says)).then((file) => {
      if (live) setPhoto(file ? { kind: 'ready', file } : { kind: 'gone' })
    })
    return () => {
      live = false
    }
  }, [io, offersPhoto, photoPath, says])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopmost()) {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [isTopmost, onClose])

  const sharePhoto = () => {
    if (photo.kind !== 'ready') return
    setSaid(null)
    // Nothing is awaited before the share sheet is asked for: the phone opens it only inside this press.
    io.share(photo.file, placeShareWords(place) ?? says).then(
      (shared) => {
        if (shared) onClose()
      },
      () => setSaid({ ok: false, words: W.photoRefused }),
    )
  }

  const copyAll = async () => {
    const words = placesShareWords(set)
    if (!words) return
    try {
      await io.copy(words)
      setSaid({ ok: true, words: W.copied })
    } catch {
      setSaid({ ok: false, words: W.wouldNotCopy })
    }
  }

  const allName = allPlacesName(set.length, setKind)
  const allSub = allPlacesSub(set.length, { phone })
  const whole = wholeMapWords(list)

  return createPortal(
    <div
      data-place-send-more-sheet
      style={{ position: 'fixed', inset: 0, zIndex: PAINTED_MAP_SHEET_Z, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'env(safe-area-inset-top, 0px) 0 0' }}
      onClick={(e) => {
        // The map's window sits behind: this press closes the sheet alone.
        e.stopPropagation()
        onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={`${W.title}: ${says}`} onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 520, maxHeight: '100%', overflowY: 'auto', borderTopLeftRadius: 14, borderTopRightRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{W.title}</h2>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{says}</span>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'inherit', fontSize: '0.9375rem', minHeight: 44, padding: '0 0.25rem' }}>
            {W.close}
          </button>
        </div>
        <div style={{ display: 'grid', gap: '0.6rem', padding: '0.85rem 1rem calc(0.8rem + env(safe-area-inset-bottom, 0px))' }}>
          {ways.map((way) => {
            if (way === 'photo') {
              if (!offersPhoto) return null
              const ready = photo.kind === 'ready'
              return (
                <button key={way} type="button" data-send-more="photo" data-photo={photo.kind} style={ready ? row : { ...row, ...dead }} disabled={!ready} onClick={sharePhoto}>
                  <WayIcon way={way} color={ready ? 'var(--text-link)' : 'currentColor'} />
                  <span style={{ display: 'grid', gap: 1 }}>
                    {W.photo}
                    <span style={ready ? sub : { ...sub, color: 'inherit' }}>{photo.kind === 'getting' ? W.photoGetting : W.photoSub}</span>
                  </span>
                </button>
              )
            }
            if (way === 'all') {
              const inner = (
                <>
                  <WayIcon way={way} color="var(--text-link)" />
                  <span style={{ display: 'grid', gap: 1 }}>
                    {allName}
                    <span style={sub}>{allSub}</span>
                  </span>
                </>
              )
              return phone ? (
                <a key={way} data-send-more="all" href={placesTextHref(set) ?? undefined} style={row}>
                  {inner}
                </a>
              ) : (
                <button key={way} type="button" data-send-more="all" style={row} onClick={() => void copyAll()}>
                  {inner}
                </button>
              )
            }
            if (!onShareMap) return null
            return (
              <button
                key={way}
                type="button"
                data-send-more="map"
                style={row}
                onClick={() => {
                  onClose()
                  onShareMap()
                }}
              >
                <WayIcon way={way} color="var(--text-link)" />
                <span style={{ display: 'grid', gap: 1 }}>
                  {whole.name}
                  <span style={sub}>{whole.sub}</span>
                </span>
              </button>
            )
          })}
          {offersPhoto && photo.kind === 'gone' ? <p role="status" data-send-more-said style={note}>{W.photoGone}</p> : null}
          {said ? (
            <p role="status" data-send-more-said style={said.ok ? { margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-green-700)' } : note}>
              {said.words}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}
