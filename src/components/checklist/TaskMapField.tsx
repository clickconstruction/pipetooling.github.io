import { Suspense, lazy, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useModalStackEntry } from '../../hooks/useModalStackEntry'
import { useTaskMapWhole } from '../../hooks/useTaskMapWhole'
import { openPaintedMap, paintPaintedMap, type PaintedMapToPaint } from '../../lib/paintedMap/paintedMapDoor'
import { loadPaintedMap, loadPaintedMapsEvery, loadPaintedMapsForSearch, type Landed, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import { paintedLayerMaps } from '../../lib/paintedMap/paintedMapLayer'
import { paintedMapWhereWords, type PaintedMapSearchRow } from '../../lib/paintedMap/paintedMapSearch'
import { taskMapFrame, taskMapLineWords } from '../../lib/tasks/taskMap'
import { TASK_MAP_PICK_WORDS, mapsForTask, taskMapFromPainted, taskMapNewName, taskMapOfferWords, type TaskMapDraft } from '../../lib/tasks/taskMapPick'
import type { TaskPlacePoint } from '../../lib/tasks/taskPlace'
import { ADD_TASK_PICKER_Z } from '../../lib/windowLayers'
import { PAINT_COLOR, PAINT_SWATCH } from '../paintedMap/paintedMapLook'

const OnSiteMapLazy = lazy(() => import('../materials/OnSiteMap'))

type Reads = {
  /** Every painted map the giver can open, with its lines and places. Read on the press, never before. For a smoke. */
  loadMaps?: () => Promise<Landed<PaintedMapWhole[]>>
  /** Each map's home in words. For a smoke. */
  loadWheres?: () => Promise<PaintedMapSearchRow[]>
}

type PressProps = Reads & {
  /** The task's map as the giver has it now, or null for a task with no map. */
  value: TaskMapDraft | null
  onChange: (next: TaskMapDraft | null) => void
  /** The task's place, when it has one: the maps nearest it come first. */
  place: TaskPlacePoint | null
  /** The window is saving: the press waits. */
  busy?: boolean
  /** The layer of the sheet, for a window that sits above Add a task. */
  sheetZIndex?: number
  /** The task's words as typed: a map painted from the task starts with them as its name. */
  taskWords?: string
  /** Opens the painting window on a new map and says when it closes. For a smoke. */
  paint?: (start: PaintedMapToPaint, onClosed: () => void) => boolean
  /** Reads the map back once the painting window closes. For a smoke. */
  loadMap?: (mapId: string) => Promise<Landed<PaintedMapWhole | null>>
}

const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

/**
 * The **Map** press of a task window's Where row (punch list #345, "A map on a task", step 7). It
 * sits beside the place and the photo of the spot, since all three answer *where*. A press opens
 * *A map for this task*, the painted maps the giver can open, and one press there puts a map on the
 * task. Lit, the task has a map, and a press opens the same sheet to pick another.
 *
 * Nothing is read until the press, so a task with no map costs what it cost before.
 *
 * **Paint a new one** (step 8): the sheet's first half opens the painting window on a new map,
 * named from the task's words and hung on no job, since a task has none. The painter saves there
 * as on any map. When that window closes, the map is read back by the id made here, and if a line
 * or a place was saved it goes onto the task. Nothing saved is nothing changed.
 */
export function TaskMapPress({ value, onChange, place, busy = false, sheetZIndex, loadMaps, loadWheres, taskWords = '', paint = paintPaintedMap, loadMap = loadPaintedMap }: PressProps) {
  const [open, setOpen] = useState(false)
  const [paintRefused, setPaintRefused] = useState(false)
  const on = Boolean(value)
  // The painting window can stay open a long while. The map goes to whatever the window's form is by then.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const paintNew = (first: 'line' | 'walk') => {
    const id = newId()
    const opened = paint(
      { id, name: taskMapNewName(taskWords), words: '', first, home: { jobId: null, developmentId: null, label: '', developmentLabel: '', address: null, center: place ? { lat: place.lat, lng: place.lng } : null } },
      () => {
        void loadMap(id).then(
          (res) => {
            const painted = res.ok ? taskMapFromPainted(res.value) : null
            if (painted) onChangeRef.current(painted)
          },
          () => {},
        )
      },
    )
    if (opened) setOpen(false)
    else setPaintRefused(true)
  }
  return (
    <span data-task-map-field style={{ display: 'inline-flex' }}>
      <button
        type="button"
        data-task-map-press
        aria-pressed={on}
        aria-label={on ? TASK_MAP_PICK_WORDS.change : TASK_MAP_PICK_WORDS.pressAria}
        title={on ? `${TASK_MAP_PICK_WORDS.onTask}. Press to pick another.` : TASK_MAP_PICK_WORDS.pressTitle}
        disabled={busy}
        onClick={() => {
          setPaintRefused(false)
          setOpen(true)
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          font: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          minHeight: 40,
          padding: '0 10px',
          borderRadius: 10,
          border: on ? '1.5px solid #2563eb' : '1px dashed var(--border-strong)',
          background: on ? 'var(--bg-blue-tint)' : 'var(--surface)',
          color: on ? 'var(--text-blue-800)' : 'var(--text-700)',
          cursor: busy ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden style={{ width: 14, height: 4, borderRadius: 2, background: PAINT_COLOR, flex: 'none' }} />
        {TASK_MAP_PICK_WORDS.press}
      </button>
      {open ? (
        <TaskMapSheet
          value={value}
          place={place}
          {...(sheetZIndex != null ? { zIndex: sheetZIndex } : {})}
          {...(loadMaps ? { loadMaps } : {})}
          {...(loadWheres ? { loadWheres } : {})}
          onPaint={paintNew}
          paintRefused={paintRefused}
          onClose={() => setOpen(false)}
          onPick={(next) => {
            onChange(next)
            setOpen(false)
          }}
        />
      ) : null}
    </span>
  )
}

const stripChip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, font: 'inherit', fontSize: 12.5, fontWeight: 700, minHeight: 36, padding: '5px 11px', borderRadius: 999, border: '1px solid #2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', cursor: 'pointer', minWidth: 0, maxWidth: '100%' }
const stripOff: CSSProperties = { font: 'inherit', fontSize: 12.5, fontWeight: 600, minHeight: 36, padding: '5px 9px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-muted)', cursor: 'pointer', flex: 'none' }

/**
 * The task's map, set (punch list #345, step 7): under the Where row, the map lit with its name, a
 * small picture of its line, and what it holds. A press on the name opens the painted map. ✕ takes
 * it off the task and leaves the map where it is. Draws nothing for a task with no map.
 */
export function TaskMapSet({ value, onChange, loadMap = loadPaintedMap }: { value: TaskMapDraft | null; onChange: (next: TaskMapDraft | null) => void; /** The one map, for its name and picture. For a smoke. */ loadMap?: (mapId: string) => Promise<Landed<PaintedMapWhole | null>> }) {
  const read = useTaskMapWhole(value?.id ?? null, loadMap)
  const [pictureFailed, setPictureFailed] = useState(false)
  if (!value) return null
  const whole = read.kind === 'read' ? read.whole : null
  const name = whole?.map.name.trim() || value.name?.trim() || 'A painted map'
  const frame = whole ? taskMapFrame(whole.lines, whole.places, { width: 320, height: 110 }) : null
  return (
    <div data-task-map-set style={{ gridColumn: '1 / -1', display: 'grid', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <button type="button" data-task-map-set-open onClick={() => openPaintedMap(value.id)} title="Open this map" style={stripChip}>
          <span aria-hidden style={{ width: 14, height: 4, borderRadius: 2, background: PAINT_COLOR, flex: 'none' }} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </button>
        <button type="button" aria-label={TASK_MAP_PICK_WORDS.remove} title={TASK_MAP_PICK_WORDS.remove} onClick={() => onChange(null)} style={stripOff}>
          ✕
        </button>
      </div>
      {whole && frame && !pictureFailed ? (
        <div role="img" aria-label={`The map ${name}, seen from above`} data-task-map-set-picture style={{ height: 110, borderRadius: 10, overflow: 'hidden', background: 'var(--bg-muted)', position: 'relative' }}>
          <Suspense fallback={null}>
            <OnSiteMapLazy center={frame.center} pins={[]} height={110} startZoom={frame.zoom} still onTilesFailed={() => setPictureFailed(true)} painted={paintedLayerMaps([whole])} />
          </Suspense>
          <span aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 600 }} />
        </div>
      ) : null}
      <p data-task-map-set-words style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
        {whole ? `${taskMapLineWords(whole.map.name, whole.lines, whole.places.length)}. ` : ''}
        {TASK_MAP_PICK_WORDS.opens}
      </p>
    </div>
  )
}

type MapsRead = { kind: 'reading' } | { kind: 'read'; wholes: PaintedMapWhole[]; wheres: Map<string, string> } | { kind: 'failed'; words: string }

const offerRow: CSSProperties = { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', font: 'inherit', padding: '0.6rem 0.7rem', minHeight: 56, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer' }
const paintPress: CSSProperties = { minHeight: 48, padding: '0 0.75rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 700, fontSize: '0.9375rem', cursor: 'pointer', fontFamily: 'inherit' }
const head: CSSProperties = { margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }

/** How many maps before the sheet offers the box that finds one by name. */
const FIND_FROM = 7

/**
 * *A map for this task*: the painted maps the giver can open, each with its length, its places and
 * where it hangs. With a place on the task the nearest come first. With none, the newest. The
 * database lets a task point only at a map its giver can open, and this list holds only those.
 */
function TaskMapSheet({
  value,
  place,
  onPick,
  onClose,
  zIndex = ADD_TASK_PICKER_Z,
  loadMaps = loadPaintedMapsEvery,
  loadWheres = loadPaintedMapsForSearch,
  onPaint,
  paintRefused = false,
}: Reads & { value: TaskMapDraft | null; place: TaskPlacePoint | null; onPick: (next: TaskMapDraft | null) => void; onClose: () => void; zIndex?: number; /** Paint a new map for the task: by hand, or walked or driven. */ onPaint: (first: 'line' | 'walk') => void; /** The painting window could not open. */ paintRefused?: boolean }) {
  const isTopmost = useModalStackEntry()
  const [maps, setMaps] = useState<MapsRead>({ kind: 'reading' })
  const [find, setFind] = useState('')

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

  useEffect(() => {
    let cancelled = false
    // The homes are words beside each map. A read of them that fails costs the words and never the list.
    void Promise.all([loadMaps(), loadWheres().catch(() => [] as PaintedMapSearchRow[])]).then(
      ([res, rows]) => {
        if (cancelled) return
        if (!res.ok) return setMaps({ kind: 'failed', words: res.error || TASK_MAP_PICK_WORDS.failed })
        setMaps({ kind: 'read', wholes: res.value, wheres: new Map(rows.map((r) => [r.id, paintedMapWhereWords(r)] as const)) })
      },
      () => {
        if (!cancelled) setMaps({ kind: 'failed', words: TASK_MAP_PICK_WORDS.failed })
      },
    )
    return () => {
      cancelled = true
    }
  }, [loadMaps, loadWheres])

  const canWalk = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const all = maps.kind === 'read' ? mapsForTask(place, maps.wholes, (id) => maps.wheres.get(id) ?? null, '', Number.MAX_SAFE_INTEGER) : []
  const offers = maps.kind === 'read' ? mapsForTask(place, maps.wholes, (id) => maps.wheres.get(id) ?? null, find) : []

  return createPortal(
    <div
      data-task-map-sheet
      style={{ position: 'fixed', inset: 0, zIndex, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 'env(safe-area-inset-top, 0px) 0 0' }}
      onClick={(e) => {
        // The task window sits behind: this press closes the sheet alone.
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={TASK_MAP_PICK_WORDS.head}
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 520, maxHeight: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14, overflow: 'hidden' }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{TASK_MAP_PICK_WORDS.head}</h2>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9375rem', minHeight: 40, padding: '0 0.25rem', fontFamily: 'inherit' }}>
            Cancel
          </button>
        </div>
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'grid', gap: '0.6rem', alignContent: 'start', padding: '0.75rem 1rem calc(0.85rem + env(safe-area-inset-bottom, 0px))' }}>
          {value ? (
            <button type="button" data-task-map-sheet-remove onClick={() => onPick(null)} style={{ justifySelf: 'start', background: 'none', border: 'none', padding: 0, minHeight: 32, cursor: 'pointer', color: 'var(--text-link)', textDecoration: 'underline', fontSize: '0.9375rem', fontFamily: 'inherit' }}>
              {TASK_MAP_PICK_WORDS.remove}
            </button>
          ) : null}
          <p style={head}>{TASK_MAP_PICK_WORDS.paintHead}</p>
          <div data-task-map-sheet-paint style={{ display: 'grid', gridTemplateColumns: canWalk ? '1fr 1fr' : '1fr', gap: '0.5rem' }}>
            <button type="button" onClick={() => onPaint('line')} style={{ ...paintPress, border: '1px solid #2563eb', background: '#2563eb', color: '#fff' }}>
              {TASK_MAP_PICK_WORDS.draw}
            </button>
            {canWalk ? (
              <button type="button" onClick={() => onPaint('walk')} style={paintPress}>
                {TASK_MAP_PICK_WORDS.walk}
              </button>
            ) : null}
          </div>
          {paintRefused ? (
            <p role="alert" data-task-map-sheet-paint-refused style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
              {TASK_MAP_PICK_WORDS.paintNoHost}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {TASK_MAP_PICK_WORDS.paintHint} {TASK_MAP_PICK_WORDS.paintHome}
            </p>
          )}
          <p style={{ ...head, marginTop: '0.35rem' }}>{TASK_MAP_PICK_WORDS.pickHead}</p>
          {maps.kind === 'read' && all.length >= FIND_FROM ? (
            <input
              type="search"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              aria-label={TASK_MAP_PICK_WORDS.find}
              placeholder={TASK_MAP_PICK_WORDS.find}
              style={{ minHeight: 44, padding: '0.5rem 0.6rem', fontSize: '1rem', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-base)', boxSizing: 'border-box', width: '100%', fontFamily: 'inherit' }}
            />
          ) : null}
          {maps.kind === 'reading' ? (
            <p role="status" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {TASK_MAP_PICK_WORDS.reading}
            </p>
          ) : null}
          {maps.kind === 'failed' ? (
            <p role="alert" data-task-map-sheet-failed style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-amber-800)', background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>
              {maps.words}
            </p>
          ) : null}
          {maps.kind === 'read' && offers.length === 0 ? (
            <p role="status" data-task-map-sheet-none style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {all.length === 0 ? TASK_MAP_PICK_WORDS.none : TASK_MAP_PICK_WORDS.noneFound}
            </p>
          ) : null}
          {offers.length > 0 ? (
            <div data-task-map-sheet-offers style={{ display: 'grid', gap: '0.4rem' }}>
              {offers.map((o) => {
                const on = value?.id === o.id
                return (
                  <button key={o.id} type="button" aria-pressed={on} onClick={() => onPick({ id: o.id, name: o.name })} style={{ ...offerRow, ...(on ? { border: '1.5px solid #2563eb', background: 'var(--bg-blue-tint)' } : {}) }}>
                    <span aria-hidden style={PAINT_SWATCH} />
                    <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.name}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{taskMapOfferWords(o)}</span>
                    </span>
                    <span aria-hidden style={{ color: 'var(--text-muted)' }}>
                      ›
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
          {maps.kind === 'read' && all.length > 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{place ? 'The maps nearest the task’s place come first.' : 'The newest maps come first.'}</p>
          ) : null}
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-blue-800)', background: 'var(--bg-blue-tint)', borderRadius: 8, padding: '0.5rem 0.65rem' }}>Whoever gets this task can open its map, even on a job they are not on the crew of.</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
