/**
 * The painted maps of a job, as lines under its address (punch list #345). A painted map is the
 * address, continued: the part a street address cannot say. So it sits where the address is, in
 * the job window's top band, and shows on every tab.
 *
 * A job with no painted map looks as it did, plus one quiet press for whoever wants to paint one.
 * A map painted for the job's development shows here too, since it is every lot's way in.
 *
 * The job's own list of places sits here too (punch list #393, `paintedJobList.ts`): one line when
 * it holds a place, and a press that sets one with no map to paint first.
 *
 * **Photo of a spot** (punch list #413) is that press with the camera first: it opens the camera
 * and reads the phone once in the same press, and the place sheet then opens with the photo in it
 * and the dot where the person stood.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { handHeld } from '../../lib/paintedMap/handHeld'
import { mapSummaryWords, mapsForDevelopment, mapsForJob } from '../../lib/paintedMap/paintedMap'
import { JOB_LIST_WORDS, jobListCountWords, jobListPlaces, jobListsOf } from '../../lib/paintedMap/paintedJobList'
import { onPaintedMapsChanged, openPaintedMap, paintPaintedMap, startPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { loadPaintedMapsFor, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import { SPOT_WORDS, type PaintedSpot, type SpotReading } from '../../lib/paintedMap/paintedSpot'
import { readSpotNow } from '../../lib/paintedMap/paintedSpotIo'
import { useTakenDown } from '../../hooks/useTakenDown'
import { PaintedPlaceMark } from './PaintedPlaceMark'
import { PAINT_SWATCH } from './paintedMapLook'

/** An id for a list not yet saved, as the start sheet makes one for a map. */
const newId = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

type Props = {
  jobId: string
  developmentId?: string | null
  /** The job in words, for the start sheet. */
  jobLabel?: string | null
  developmentLabel?: string | null
  /** The job's address: where a new map opens. The window looks it up, and only when a map needs somewhere to open. */
  address?: string | null
  /**
   * `maps` shows the maps alone: no press to paint one, and nothing at all for
   * a job with none. For a sheet that is about something else, such as On my way.
   */
  /** The phone's Paint a map: centred blue words, no box. */
  addCentred?: boolean
  only?: 'maps'
}

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minHeight: 40, padding: '0.35rem 0.6rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }
/** The desk's Paint a map (v2.7326): an ordinary press at the strip's left, not a dashed box the width of the window. */
const add: CSSProperties = { ...row, width: 'auto', justifySelf: 'start', minHeight: 34, padding: '0.3rem 0.75rem', fontSize: '0.8125rem', borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'transparent', color: 'var(--text-link)' }
/** The phone's press (punch list #355, the owner's call): centred blue words with no box, the row still 40 px for a thumb. */
const addWords: CSSProperties = { ...add, width: '100%', justifySelf: 'stretch', minHeight: 40, fontSize: '0.875rem', borderStyle: 'none', justifyContent: 'center', textAlign: 'center', padding: '0.2rem 0.6rem', fontWeight: 700 }
/** The phone's Photo of a spot (#413): the full width and 56 px tall, since it is pressed standing in a yard. */
const spotPress: CSSProperties = { ...row, minHeight: 56, justifyContent: 'center', gap: '0.55rem', fontSize: '1rem', fontWeight: 700, borderWidth: 1.5, borderColor: 'var(--border-strong)', background: 'var(--surface)' }

/** A camera, drawn in the colour of the words beside it. */
function CameraGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'block', flex: 'none' }}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13.5" r="3" />
    </svg>
  )
}

export function JobPaintedMapsStrip({ jobId, developmentId = null, jobLabel = null, developmentLabel = null, address = null, only, addCentred = false }: Props) {
  const [wholes, setWholes] = useState<PaintedMapWhole[]>([])
  const [failed, setFailed] = useState<string | null>(null)
  // A read that lands after the strip is taken down sets nothing: there is no screen left to draw on.
  const takenDown = useTakenDown()

  const load = useCallback(async () => {
    const res = await loadPaintedMapsFor({ jobId, developmentId })
    if (takenDown()) return
    if (res.ok) {
      setWholes(res.value)
      setFailed(null)
    } else {
      setFailed(res.error)
    }
  }, [jobId, developmentId, takenDown])

  useEffect(() => {
    void load()
    return onPaintedMapsChanged(() => void load())
  }, [load])

  const maps = useMemo(() => {
    const byId = new Map(wholes.map((w) => [w.map.id, w]))
    // The job's own list of places is not a map somebody painted: it has a line of its own, below.
    return mapsForJob(wholes.map((w) => w.map).filter((m) => m.jobList !== true), jobId, developmentId).map((m) => ({ ...m, whole: byId.get(m.id)! }))
  }, [wholes, jobId, developmentId])
  // The job's lists, the oldest first, and every place on them as one list.
  const lists = useMemo(() => jobListsOf(wholes.map((w) => w.map), jobId), [wholes, jobId])
  const listPlaces = useMemo(() => jobListPlaces(lists.map((l) => wholes.find((w) => w.map.id === l.id)!)), [lists, wholes])
  const firstList = lists[0] ?? null

  /** ＋ Place on this job: onto the list the job has, or onto a new one that is saved with this first place. */
  const addJobPlace = () => {
    if (firstList) openPaintedMap(firstList.id, address, 'place')
    else paintPaintedMap({ id: newId(), name: JOB_LIST_WORDS.name, words: '', home: { jobId, developmentId: null, label: jobLabel, address }, first: 'place', jobList: true })
  }

  // Photo of a spot (#413): the camera opens on the press, and the phone is read once in that same press, so the
  // reading is of the moment the photo was taken. The place sheet opens when the photo comes back.
  const spotInput = useRef<HTMLInputElement>(null)
  const spotReading = useRef<Promise<SpotReading> | null>(null)
  const pressSpot = () => {
    spotInput.current?.click()
    spotReading.current = readSpotNow()
  }
  const takeSpot = (file: File) => {
    const spot: PaintedSpot = { file, reading: spotReading.current ?? readSpotNow(), takenMs: file.lastModified > 0 ? file.lastModified : null }
    spotReading.current = null
    if (firstList) openPaintedMap(firstList.id, address, 'place', spot)
    else paintPaintedMap({ id: newId(), name: JOB_LIST_WORDS.name, words: '', home: { jobId, developmentId: null, label: jobLabel, address }, first: 'place', jobList: true, spot })
  }

  if (only === 'maps' && maps.length === 0 && listPlaces.length === 0) return null

  return (
    <div data-job-painted-maps style={{ display: 'grid', gap: '0.35rem' }}>
      {only === 'maps' ? <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-700)' }}>Painted for this job</span> : null}
      {maps.map((m) => {
        const summary = mapSummaryWords(m.whole.lines, m.whole.places.length)
        return (
          <button key={m.id} type="button" data-painted-map-line style={row} onClick={(e) => { e.stopPropagation(); openPaintedMap(m.id, address) }}>
            <span aria-hidden style={PAINT_SWATCH} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            <span style={{ marginLeft: 'auto', flex: 'none', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }}>
              {m.fromDevelopment ? `from ${developmentLabel || 'the development'} · ` : ''}
              {summary ? `${summary} ›` : 'open ›'}
            </span>
          </button>
        )
      })}
      {firstList && listPlaces.length > 0 ? (
        <button type="button" data-job-places-line style={row} onClick={(e) => { e.stopPropagation(); openPaintedMap(firstList.id, address) }}>
          <PaintedPlaceMark number={listPlaces[0]!.letter} kind={listPlaces[0]!.kind} size={22} />
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{JOB_LIST_WORDS.name}</span>
          <span style={{ marginLeft: 'auto', flex: 'none', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }}>{jobListCountWords(listPlaces.length)} ›</span>
        </button>
      ) : null}
      {failed && only !== 'maps' ? (
        <p role="status" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          The painted maps did not load: {failed}{' '}
          <button type="button" onClick={(e) => { e.stopPropagation(); void load() }} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
            Try again
          </button>
        </p>
      ) : null}
      {only === 'maps' ? null : (
        <input
          ref={spotInput}
          type="file"
          accept="image/*"
          capture={handHeld() ? 'environment' : undefined}
          aria-label="Photo of a spot on this job"
          data-job-spot-input
          style={{ display: 'none' }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) takeSpot(file)
          }}
        />
      )}
      {only === 'maps' || !addCentred ? null : (
        <button type="button" data-job-spot style={spotPress} onClick={(e) => { e.stopPropagation(); pressSpot() }}>
          <CameraGlyph size={22} />
          {SPOT_WORDS.press}
        </button>
      )}
      {only === 'maps' ? null : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.5rem' }}>
          {addCentred ? null : (
            <button type="button" data-job-spot style={{ ...add, gap: '0.4rem' }} onClick={(e) => { e.stopPropagation(); pressSpot() }}>
              <CameraGlyph size={16} />
              {SPOT_WORDS.press}
            </button>
          )}
          <button type="button" data-paint-a-map style={addCentred ? { ...addWords, width: 'auto', flex: '1 1 0' } : add} onClick={(e) => { e.stopPropagation(); startPaintedMap({ jobId, developmentId, label: jobLabel, developmentLabel, address }) }}>
            ＋ Paint a map
          </button>
          <button type="button" data-job-place-add style={addCentred ? { ...addWords, width: 'auto', flex: '1 1 0' } : add} onClick={(e) => { e.stopPropagation(); addJobPlace() }}>
            {JOB_LIST_WORDS.add}
          </button>
        </div>
      )}
    </div>
  )
}

type DevelopmentProps = {
  developmentId: string
  developmentLabel?: string | null
  /** The development's lots, with the words each is known by. Their own maps show here too. */
  jobs: ReadonlyArray<{ id: string; label: string }>
  /** The site's address: where a new map opens. */
  address?: string | null
}

/**
 * The painted maps of a development, under its address (punch list #345): the site's own first,
 * since a way in serves every lot, then each lot's own with the lot's name. A map painted here is
 * for the whole development and shows on each of its jobs.
 */
export function DevelopmentPaintedMapsStrip({ developmentId, developmentLabel = null, jobs, address = null }: DevelopmentProps) {
  const [wholes, setWholes] = useState<PaintedMapWhole[]>([])
  const [failed, setFailed] = useState<string | null>(null)
  const jobKey = jobs.map((j) => j.id).join(',')
  // As on a job's strip: a read that lands after the strip is taken down sets nothing.
  const takenDown = useTakenDown()

  const load = useCallback(async () => {
    const res = await loadPaintedMapsFor({ developmentId, jobIds: jobKey ? jobKey.split(',') : [] })
    if (takenDown()) return
    if (res.ok) {
      setWholes(res.value)
      setFailed(null)
    } else {
      setFailed(res.error)
    }
  }, [developmentId, jobKey, takenDown])

  useEffect(() => {
    void load()
    return onPaintedMapsChanged(() => void load())
  }, [load])

  const maps = useMemo(() => {
    const byId = new Map(wholes.map((w) => [w.map.id, w]))
    const labels = new Map(jobs.map((j) => [j.id, j.label]))
    return mapsForDevelopment(wholes.map((w) => w.map), developmentId, labels).map((m) => ({ ...m, whole: byId.get(m.id)! }))
    // The lots are keyed by their ids: a new list with the same lots is the same list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wholes, developmentId, jobKey])

  return (
    <div data-development-painted-maps style={{ display: 'grid', gap: '0.35rem', maxWidth: 560 }}>
      {maps.map((m) => {
        const summary = mapSummaryWords(m.whole.lines, m.whole.places.length)
        return (
          <button key={m.id} type="button" data-painted-map-line style={row} onClick={() => openPaintedMap(m.id, address)}>
            <span aria-hidden style={PAINT_SWATCH} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            <span style={{ marginLeft: 'auto', flex: 'none', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }}>
              {m.jobLabel ? `${m.jobLabel} · ` : ''}
              {summary ? `${summary} ›` : 'open ›'}
            </span>
          </button>
        )
      })}
      {failed ? (
        <p role="status" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          The painted maps did not load: {failed}{' '}
          <button type="button" onClick={() => void load()} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
            Try again
          </button>
        </p>
      ) : null}
      <button type="button" data-paint-a-map style={add} onClick={() => startPaintedMap({ developmentId, developmentLabel, address })}>
        ＋ Paint a map
      </button>
    </div>
  )
}
