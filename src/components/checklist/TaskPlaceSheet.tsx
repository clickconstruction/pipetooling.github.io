import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { requestMyLocation, type MyFix } from '../../lib/materials/myLocation'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { ADD_TASK_PICKER_Z } from '../../lib/windowLayers'
import {
  TASK_PLACE_NAME_MAX,
  TASK_PLACE_START_WAIT_MS,
  TASK_PLACE_WIDE_START,
  TASK_PLACE_WIDE_ZOOM,
  cleanTaskPlaceName,
  isTaskPlaceWideStart,
  taskPlaceFixWords,
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
}

/**
 * Where is it? (punch list #328, PR 2): the sheet that sets a new place on a task. A view from
 * above with a ring in the middle. The giver drags the map under the ring, or presses Use where I
 * am while standing on the spot, names the place and uses it. The map and its ring are the box
 * map's (`OnSiteMap`), so a place is set the way a box's spot is.
 *
 * The phone is asked where it is on that one press and at no other time. What comes back is shown
 * on the map before anything is kept, with how sure the phone is, and a reading too wide to trust
 * asks for the ring instead of being taken (`taskPlaceFixWords`).
 */
export function TaskPlaceSheet({ start, initial, onUse, onClose }: Props) {
  const [ring, setRing] = useState<TaskPlacePoint | null>(null)
  const [fly, setFly] = useState<TaskPlacePoint | null>(null)
  const [fix, setFix] = useState<MyFix | null>(null)
  const [finding, setFinding] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [name, setName] = useState(initial?.name ?? '')
  // Nowhere to open, and no reading coming: the map opens wide so the giver can still drag to the spot.
  const [openWide, setOpenWide] = useState(false)
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
        setFix(p)
        setFly({ lat: p.lat, lng: p.lng })
      },
      (words) => {
        setFinding(false)
        setRefusal(words)
        setOpenWide(true)
      },
    )
  }, [])

  // The margin belongs to the reading. Once the ring is dragged off it, the place is the giver's own call.
  const accuracyM = ring ? taskPlaceSheetAccuracy(fix, ring) : null
  const fixWords = fix && ring && accuracyM != null ? taskPlaceFixWords(accuracyM) : null
  const dragged = fix != null && ring != null && fix.accuracyM != null && accuracyM == null
  const wide = !start && !fly && openWide
  const mapStart = start ?? (fly ? { lat: fly.lat, lng: fly.lng } : wide ? TASK_PLACE_WIDE_START : null)

  // The wide view's own centre is nobody's place: the press waits for a drag.
  const ready = ring != null && !(wide && isTaskPlaceWideStart(ring))

  const use = () => {
    if (!ring || !ready) return
    onUse({ lat: ring.lat, lng: ring.lng, name: cleanTaskPlaceName(name), accuracyM })
  }

  return createPortal(
    <div
      data-task-place-sheet
      style={{ position: 'fixed', inset: 0, zIndex: ADD_TASK_PICKER_Z, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 'env(safe-area-inset-top, 0px) 0 0' }}
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
        <div style={{ flex: '1 1 auto', minHeight: 220 }}>
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
          ) : fixWords ? (
            <p
              role="status"
              data-task-place-fix={fixWords.poor ? 'poor' : 'ok'}
              style={
                fixWords.poor
                  ? { margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.45rem 0.6rem' }
                  : { margin: 0, fontSize: '0.875rem', color: 'var(--text-green-700)' }
              }
            >
              {fixWords.words}
            </p>
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
    document.body,
  )
}
