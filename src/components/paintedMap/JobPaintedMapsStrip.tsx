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
 *
 * Places an earlier job kept at the same customer address show here too (#413, step 4,
 * `paintedAddressPlaces.ts`): a line for each such list, since the next tech at a house is on a
 * different job. With `rows`, each place of the job's list and of those lists is drawn as a row
 * with its photo (step 5), so the crew's window shows what is where without opening a map.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { handHeld } from '../../lib/paintedMap/handHeld'
import { mapSummaryWords, mapsForDevelopment, mapsForJob } from '../../lib/paintedMap/paintedMap'
import { JOB_LIST_WORDS, jobListCountWords, jobListPlaces, jobListsOf, type JobPlace } from '../../lib/paintedMap/paintedJobList'
import { onPaintedMapsChanged, openPaintedMap, paintPaintedMap, startPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { ADDRESS_PLACES_WORDS, addressListLineWords, placeRowsMoreWords, placeRowsShown, type AddressList } from '../../lib/paintedMap/paintedAddressPlaces'
import { loadAddressPlaceLists, notePaintedPlaceOpened } from '../../lib/paintedMap/paintedAddressPlacesIo'
import { loadPaintedMapsFor, paintedPlacePhotoUrls, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import { shortPlaceWords } from '../../lib/paintedMap/paintedPlaceWords'
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
  /** Draw each place as a row with its photo, under its list's line (#413, step 5): the job's own window. */
  rows?: boolean
  /**
   * The Job Mode card under the new phone layout (`lib/phoneLayout/jobCard.ts`): the same three presses at a thumb's
   * size. Photo of a spot is the full width, and Paint a map and Place on this job share one row of 44 px presses
   * with `end`, the card's own press (My spend). Each does what it did.
   */
  card?: { end?: ReactNode }
}

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minHeight: 40, padding: '0.35rem 0.6rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }
/** The desk's Paint a map (v2.7326): an ordinary press at the strip's left, not a dashed box the width of the window. */
const add: CSSProperties = { ...row, width: 'auto', justifySelf: 'start', minHeight: 34, padding: '0.3rem 0.75rem', fontSize: '0.8125rem', borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'transparent', color: 'var(--text-link)' }
/** The phone's press (punch list #355, the owner's call): centred blue words with no box, the row still 40 px for a thumb. */
const addWords: CSSProperties = { ...add, width: '100%', justifySelf: 'stretch', minHeight: 40, fontSize: '0.875rem', borderStyle: 'none', justifyContent: 'center', textAlign: 'center', padding: '0.2rem 0.6rem', fontWeight: 700 }
/** The phone's Photo of a spot (#413): the full width and 56 px tall, since it is pressed standing in a yard. */
const spotPress: CSSProperties = { ...row, minHeight: 56, justifyContent: 'center', gap: '0.55rem', fontSize: '1rem', fontWeight: 700, borderWidth: 1.5, borderColor: 'var(--border-strong)', background: 'var(--surface)' }
/** The Job Mode card's presses under the new phone layout: 44 px, their words whole on one or two lines. */
const cardPress: CSSProperties = { ...row, width: 'auto', minWidth: 0, minHeight: 44, justifyContent: 'center', textAlign: 'center', padding: '0 0.4rem', borderRadius: 10, borderColor: 'var(--border-strong)', background: 'var(--surface)', fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.15 }
const cardSpotPress: CSSProperties = { ...cardPress, width: '100%', gap: '0.5rem', fontSize: '0.9375rem' }

/** A place as a row (#413, step 5): its photo, its mark and name, and the start of its words. 64 px for a thumb. */
const placeRow: CSSProperties = { display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) auto', gap: '0.6rem', alignItems: 'center', width: '100%', minHeight: 64, padding: '0.3rem 0.6rem 0.3rem 0.3rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.875rem', textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }
const placeThumb: CSSProperties = { width: 72, height: 54, borderRadius: 6, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-muted)', objectFit: 'cover', display: 'block' }

function PlaceRow({ place, url, dashed, onOpen }: { place: JobPlace; url: string | null; dashed: boolean; onOpen: () => void }) {
  const words = shortPlaceWords(place.words, 90)
  return (
    <button type="button" data-job-place-row={place.id} style={placeRow} aria-label={`${place.name}: open this place`} onClick={(e) => { e.stopPropagation(); onOpen() }}>
      {url ? <img src={url} alt="" style={placeThumb} /> : <span aria-hidden style={{ ...placeThumb, display: 'grid', placeItems: 'center' }}><PaintedPlaceMark number={place.letter} kind={place.kind} size={26} dashed={dashed} /></span>}
      <span style={{ display: 'grid', gap: '0.1rem', minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
          {url ? <PaintedPlaceMark number={place.letter} kind={place.kind} size={20} dashed={dashed} /> : null}
          <b style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name}</b>
        </span>
        {words ? <span style={{ color: 'var(--text-700)', fontSize: '0.8125rem', overflowWrap: 'anywhere' }}>{words}</span> : null}
      </span>
      <span aria-hidden style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>›</span>
    </button>
  )
}

/** A camera, drawn in the colour of the words beside it. */
function CameraGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ display: 'block', flex: 'none' }}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="13.5" r="3" />
    </svg>
  )
}

export function JobPaintedMapsStrip({ jobId, developmentId = null, jobLabel = null, developmentLabel = null, address = null, only, addCentred = false, rows = false, card }: Props) {
  const [wholes, setWholes] = useState<PaintedMapWhole[]>([])
  // The lists of places earlier jobs kept at this job's customer address (#413). A read that fails shows none: the job's own maps still stand.
  const [addressLists, setAddressLists] = useState<AddressList[]>([])
  const [photoUrls, setPhotoUrls] = useState<Map<string, string>>(() => new Map())
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
    const kept = await loadAddressPlaceLists(jobId)
    if (takenDown()) return
    setAddressLists(kept.ok ? kept.value : [])
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

  // The rows' photos, by signed address. Asked for only where rows are drawn.
  const photoKey = rows ? [...listPlaces, ...addressLists.flatMap((l) => l.places)].map((p) => p.photoPath ?? '').join('|') : ''
  useEffect(() => {
    if (!photoKey.replace(/\|/g, '')) return
    let gone = false
    void paintedPlacePhotoUrls(photoKey.split('|')).then((urls) => {
      if (!gone && !takenDown()) setPhotoUrls(urls)
    })
    return () => {
      gone = true
    }
  }, [photoKey, takenDown])

  /** A place's row was pressed: its list opens on it. Someone came looking, so the place counts an open. */
  const openPlace = (place: JobPlace) => {
    notePaintedPlaceOpened(place.id)
    openPaintedMap(place.mapId, address, undefined, undefined, place.id)
  }
  const placeRows = (places: ReadonlyArray<JobPlace>, listId: string, dashed: boolean) => {
    const { shown, more } = placeRowsShown(places)
    return (
      <div data-job-place-rows={listId} style={{ display: 'grid', gap: '0.3rem' }}>
        {shown.map((p) => (
          <PlaceRow key={p.id} place={p} url={p.photoPath ? (photoUrls.get(p.photoPath) ?? null) : null} dashed={dashed} onOpen={() => openPlace(p)} />
        ))}
        {more > 0 ? (
          <button type="button" data-job-place-rows-more style={{ ...addWords, minHeight: 44 }} onClick={(e) => { e.stopPropagation(); openPaintedMap(listId, address) }}>
            {placeRowsMoreWords(more)}
          </button>
        ) : null}
      </div>
    )
  }

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

  if (only === 'maps' && maps.length === 0 && listPlaces.length === 0 && addressLists.length === 0) return null

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
      {rows && firstList && listPlaces.length > 0 ? placeRows(listPlaces, firstList.id, false) : null}
      {addressLists.map((l) => (
        // Kept by an earlier job at this customer address (#413): read here, and owned by the job that made it.
        <div key={l.map.id} data-address-places={l.map.id} style={{ display: 'grid', gap: '0.3rem' }}>
          <button type="button" data-address-places-line style={{ ...row, borderStyle: 'dashed' }} onClick={(e) => { e.stopPropagation(); openPaintedMap(l.map.id, address) }}>
            <PaintedPlaceMark number={l.places[0]!.letter} kind={l.places[0]!.kind} size={22} dashed />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ADDRESS_PLACES_WORDS.name}</span>
            <span style={{ marginLeft: 'auto', flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }}>{addressListLineWords(l)} ›</span>
          </button>
          {rows ? placeRows(l.places, l.map.id, true) : null}
        </div>
      ))}
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
      {only === 'maps' || !card ? null : (
        <>
          <button type="button" data-job-spot style={cardSpotPress} onClick={(e) => { e.stopPropagation(); pressSpot() }}>
            <CameraGlyph size={20} />
            {SPOT_WORDS.press}
          </button>
          <div data-job-card-press-row style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 6 }}>
            {/* The row is three presses wide, so each says its name without the plus the wider presses carry. */}
            <button type="button" data-paint-a-map style={cardPress} onClick={(e) => { e.stopPropagation(); startPaintedMap({ jobId, developmentId, label: jobLabel, developmentLabel, address }) }}>
              Paint a map
            </button>
            <button type="button" data-job-place-add style={cardPress} onClick={(e) => { e.stopPropagation(); addJobPlace() }}>
              {JOB_LIST_WORDS.add.replace(/^＋\s*/, '')}
            </button>
            {card.end}
          </div>
        </>
      )}
      {only === 'maps' || card || !addCentred ? null : (
        <button type="button" data-job-spot style={spotPress} onClick={(e) => { e.stopPropagation(); pressSpot() }}>
          <CameraGlyph size={22} />
          {SPOT_WORDS.press}
        </button>
      )}
      {only === 'maps' || card ? null : (
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
