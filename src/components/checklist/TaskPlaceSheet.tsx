import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { usePhoneKind } from '../../hooks/usePreciseLocation'
import { useVisualViewportBox } from '../../hooks/useVisualViewportBox'
import { visibleBand } from '../../lib/visibleBand'
import { requestMyLocation, type MyFix } from '../../lib/materials/myLocation'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { ADD_TASK_PICKER_Z } from '../../lib/windowLayers'
import { loadPaintedMapsEvery, type Landed, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import { isRoughFix } from '../../lib/paintedMap/paintedTrack'
import { PAINT_SWATCH } from '../paintedMap/paintedMapLook'
import { PreciseLocationLine } from '../paintedMap/PreciseLocationLine'
import { WHERE_I_AM_WEAK_NOTE_WORDS, whereIAmRoughNoteWords } from '../../lib/tasks/taskPlaceReading'
import { TASK_PLACE_WAY_WORDS, waysNearPlace } from '../../lib/tasks/taskPlaceWay'
import {
  TASK_PLACE_NAME_MAX,
  TASK_PLACE_START_WAIT_MS,
  TASK_PLACE_WIDE_START,
  TASK_PLACE_WIDE_ZOOM,
  cleanTaskPlaceName,
  isPoorTaskPlaceFix,
  isTaskPlaceWideStart,
  taskPlaceSheetAccuracy,
  type TaskPlaceDraft,
  type TaskPlacePoint,
} from '../../lib/tasks/taskPlace'

const OnSiteMapLazy = lazy(() => import('../materials/OnSiteMap'))

type Props = {
  /** Where the map opens: the place being moved, the last place anyone set, or the office. Null opens on the frame's words. */
  start: TaskPlacePoint | null
  /** The place being moved, with its name. */
  initial: TaskPlaceDraft | null
  onUse: (place: TaskPlaceDraft) => void
  onClose: () => void
  /** The sheet's layer. Over Add a task unless the window that opens it sits higher, as a roadmap task's does. */
  zIndex?: number
  /** The painted maps to pick the way in from (punch list #345). Read on the press, never before. For a smoke. */
  loadWays?: () => Promise<Landed<PaintedMapWhole[]>>
}

/**
 * Where is it? (punch list #328, PR 2): the sheet that sets a new place on a task. A view from
 * above with a ring in the middle. The giver drags the map under the ring, or presses Use where I
 * am while standing on the spot, names the place and uses it. The map and its ring are the box
 * map's (`OnSiteMap`), so a place is set the way a box's spot is.
 *
 * The phone is asked where it is on that one press and at no other time. What comes back is shown
 * on the map before anything is kept, with how sure the phone is, said by the Precise Location line
 * (punch list #402, call 8). A weak signal asks for the ring instead of being taken as it is. A
 * rough reading, which is only an area, does not move the map at all, and the line shows the way to
 * the switch.
 *
 * **Add the way in** (punch list #345, step 5): a place can carry the painted map that leads to it.
 * The press reads the painted maps the giver can open and offers the ones that come within a mile
 * of the ring, nearest first. Whoever gets the task can then open that map. Nothing is read until
 * the press, so a place with no way in costs what it cost before.
 */
export function TaskPlaceSheet({ start, initial, onUse, onClose, zIndex = ADD_TASK_PICKER_Z, loadWays = loadPaintedMapsEvery }: Props) {
  // The sheet fills the part of the page that shows (punch list #348): with the keyboard on the place's name an iPhone
  // slides the page, and a sheet pinned to the page lost its title and Cancel off the top of the screen.
  const shows = visibleBand(useVisualViewportBox())
  const [ring, setRing] = useState<TaskPlacePoint | null>(null)
  const [fly, setFly] = useState<TaskPlacePoint | null>(null)
  const [fix, setFix] = useState<MyFix | null>(null)
  // The last Use where I am got an area and not a spot (#402): its margin, for the words. The map was not moved.
  const [roughFix, setRoughFix] = useState<number | null>(null)
  const phoneKind = usePhoneKind()
  const [finding, setFinding] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [name, setName] = useState(initial?.name ?? '')
  // Nowhere to open, and no reading coming: the map opens wide so the giver can still drag to the spot.
  const [openWide, setOpenWide] = useState(false)
  // The way in: the painted map this place carries, and the list it is picked from.
  const [way, setWay] = useState<{ id: string; name: string | null } | null>(initial?.mapId ? { id: initial.mapId, name: initial.mapName ?? null } : null)
  const [picking, setPicking] = useState(false)
  const [maps, setMaps] = useState<{ kind: 'unread' } | { kind: 'reading' } | { kind: 'read'; wholes: PaintedMapWhole[] } | { kind: 'failed'; words: string }>({ kind: 'unread' })
  const isTopmost = useModalStackEntry()

  useEffect(() => {
    if (start || fly || openWide) return
    const t = window.setTimeout(() => setOpenWide(true), TASK_PLACE_START_WAIT_MS)
    return () => window.clearTimeout(t)
  }, [start, fly, openWide])

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

  const useWhereIAm = useCallback(() => {
    setFinding(true)
    setRefusal(null)
    requestMyLocation(
      (p) => {
        setFinding(false)
        // A rough reading is an area, and its middle can be miles off. The map stays where it is, or opens wide to
        // be dragged, and the line under the press shows the way to the switch.
        if (isRoughFix(p.accuracyM)) {
          setRoughFix(p.accuracyM)
          setOpenWide(true)
          return
        }
        setRoughFix(null)
        setFix(p)
        setFly({ lat: p.lat, lng: p.lng })
      },
      (words) => {
        setFinding(false)
        setRoughFix(null)
        setRefusal(words)
        setOpenWide(true)
      },
    )
  }, [])

  // The margin belongs to the reading. Once the ring is dragged off it, the place is the giver's own call.
  const accuracyM = ring ? taskPlaceSheetAccuracy(fix, ring) : null
  // The ring still sits on a reading taken by the press: the line may speak of the phone from it.
  const onReading = fix != null && ring != null && accuracyM != null
  const dragged = fix != null && ring != null && fix.accuracyM != null && accuracyM == null
  const wide = !start && !fly && openWide
  const mapStart = start ?? (fly ? { lat: fly.lat, lng: fly.lng } : wide ? TASK_PLACE_WIDE_START : null)

  // The wide view's own centre is nobody's place: the press waits for a drag.
  const ready = ring != null && !(wide && isTaskPlaceWideStart(ring))

  const use = () => {
    if (!ring || !ready) return
    onUse({ lat: ring.lat, lng: ring.lng, name: cleanTaskPlaceName(name), accuracyM, ...(way ? { mapId: way.id, mapName: way.name } : {}) })
  }

  const pickWay = () => {
    setPicking(true)
    if (maps.kind === 'read' || maps.kind === 'reading') return
    setMaps({ kind: 'reading' })
    void loadWays().then(
      (res) => setMaps(res.ok ? { kind: 'read', wholes: res.value } : { kind: 'failed', words: res.error || TASK_PLACE_WAY_WORDS.failed }),
      () => setMaps({ kind: 'failed', words: TASK_PLACE_WAY_WORDS.failed }),
    )
  }
  // Offered against the ring as it is now: drag the map and the list follows.
  const offered = maps.kind === 'read' && ring ? waysNearPlace(ring, maps.wholes) : []
  const wayName = way ? (way.name ?? (maps.kind === 'read' ? (maps.wholes.find((w) => w.map.id === way.id)?.map.name ?? null) : null)) : null

  return createPortal(
    <div
      data-task-place-sheet
      style={{ position: 'fixed', ...(shows ? { top: shows.top, left: 0, right: 0, height: shows.height } : { inset: 0 }), zIndex, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 'env(safe-area-inset-top, 0px) 0 0' }}
      onClick={(e) => {
        // The Add window sits behind: this press closes the sheet alone.
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Where is it?"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', minHeight: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Where is it?</h2>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem' }}>
            Cancel
          </button>
        </div>
        {/* The map asks for 220 px and gives way down to 60 when the keyboard leaves less, so the name and Use this place stay on screen. */}
        <div style={{ flex: '1 1 220px', minHeight: 60 }}>
          <Suspense fallback={<p style={{ margin: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading the map…</p>}>
            <OnSiteMapLazy
              center={mapStart}
              pins={[]}
              height="100%"
              flyTo={fly}
              placing={{ label: '', hint: 'Drag the map until the ring is on the spot' }}
              onCenterChange={setRing}
              emptyWords="Press Use where I am to start the map where you stand."
              startZoom={wide ? TASK_PLACE_WIDE_ZOOM : undefined}
            />
          </Suspense>
        </div>
        <div style={{ flex: 'none', display: 'grid', gap: '0.6rem', padding: '0.75rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <button
            type="button"
            onClick={useWhereIAm}
            disabled={finding}
            style={{ minHeight: 48, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '1rem', cursor: finding ? 'default' : 'pointer' }}
          >
            {finding ? 'Finding you…' : 'Use where I am'}
          </button>
          {refusal ? (
            <p role="status" data-task-place-refusal style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }}>
              {refusal}
            </p>
          ) : roughFix != null ? (
            // One reading, asked for by the press: there is no better one to wait for, so it is called rough at once.
            <div data-task-place-fix="rough">
              {/* The map above gives way to whatever is under the press, so the steps wait behind one press of their own. */}
              <PreciseLocationLine accuracyM={roughFix} kind={phoneKind} roughHeld roughNote={whereIAmRoughNoteWords(phoneKind)} foldSteps />
            </div>
          ) : onReading ? (
            <div data-task-place-fix={isPoorTaskPlaceFix(accuracyM) ? 'poor' : 'ok'}>
              <PreciseLocationLine accuracyM={accuracyM} kind={phoneKind} roughHeld weakNote={WHERE_I_AM_WEAK_NOTE_WORDS} />
            </div>
          ) : wide && !ready ? (
            <p role="status" data-task-place-fix="wide" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              The map opened wide. Zoom in and drag it until the ring is on the spot.
            </p>
          ) : dragged ? (
            <p role="status" data-task-place-fix="dragged" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              You moved the ring. The place is where the ring is now.
            </p>
          ) : null}
          <label style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>
            Name it, to pick it next time
            <input
              type="text"
              value={name}
              maxLength={TASK_PLACE_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pump house"
              style={{ minHeight: 44, padding: '0.5rem 0.6rem', fontSize: '1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box', width: '100%' }}
            />
          </label>
          {picking ? (
            <div data-task-place-ways style={{ display: 'grid', gap: '0.4rem', maxHeight: 190, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <b style={{ fontSize: '0.875rem' }}>{TASK_PLACE_WAY_WORDS.head}</b>
                <button type="button" onClick={() => setPicking(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-link)', fontSize: '0.875rem', fontFamily: 'inherit', padding: 0, minHeight: 32 }}>
                  Close the list
                </button>
              </div>
              {maps.kind === 'reading' ? <p role="status" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{TASK_PLACE_WAY_WORDS.reading}</p> : null}
              {maps.kind === 'failed' ? <p role="alert" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)' }}>{maps.words}</p> : null}
              {maps.kind === 'read' && offered.length === 0 ? <p role="status" data-task-place-ways-none style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{TASK_PLACE_WAY_WORDS.none}</p> : null}
              {offered.map((w) => {
                const on = way?.id === w.id
                return (
                  <button
                    key={w.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setWay({ id: w.id, name: w.name })
                      setPicking(false)
                    }}
                    style={{ display: 'grid', gap: '0.1rem', textAlign: 'left', padding: '0.45rem 0.6rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: on ? '#2563eb' : 'var(--border)', background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                      <span aria-hidden style={PAINT_SWATCH} />
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                    </span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-muted)' }}>{[w.summary, w.near].filter(Boolean).join(' · ')}</span>
                  </button>
                )
              })}
            </div>
          ) : way ? (
            <div data-task-place-way style={{ display: 'grid', gap: '0.15rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0, fontSize: '0.9375rem', fontWeight: 700 }}>
                <span aria-hidden style={PAINT_SWATCH} />
                <button type="button" onClick={pickWay} title="Press to pick another map" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', textAlign: 'left', minHeight: 32 }}>
                  {wayName ?? 'A painted map'}
                </button>
                <button type="button" onClick={() => setWay(null)} aria-label="Take the way in off this place" title="Take the way in off this place" style={{ marginLeft: 'auto', flex: 'none', minWidth: 36, minHeight: 32, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✕
                </button>
              </div>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{TASK_PLACE_WAY_WORDS.opens}</span>
            </div>
          ) : (
            <button type="button" data-task-place-way-add onClick={pickWay} disabled={!ready} style={{ justifySelf: 'start', background: 'none', border: 'none', padding: 0, minHeight: 32, cursor: ready ? 'pointer' : 'default', color: ready ? 'var(--text-link)' : 'var(--text-muted)', fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'inherit' }}>
              ＋ {TASK_PLACE_WAY_WORDS.add}
            </button>
          )}
          <button
            type="button"
            onClick={use}
            disabled={!ready}
            style={
              ready
                ? { minHeight: 52, borderRadius: 8, border: '1px solid #2563eb', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '1rem', cursor: 'pointer' }
                : { minHeight: 52, borderRadius: 8, border: '1px solid var(--border)', background: DEAD_PRESS_FILL, color: DEAD_PRESS_TEXT, fontWeight: 700, fontSize: '1rem', cursor: 'default' }
            }
          >
            Use this place
          </button>
        </div>
      </div>
    </div>,
    // The roadmap's canvas can fill the screen, and then only what is inside it shows.
    document.fullscreenElement ?? document.body,
  )
}
