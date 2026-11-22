/**
 * The job window's Map tab (punch list #413, step 8): everything painted or kept for the job, on
 * one map. The lines of its painted maps, the places of its own list and the places an earlier job
 * kept at the same address. A press on a dot opens its place.
 *
 * Taunya's first picture of the idea, 2026-11-21: "a job in the modal for jobs should have an
 * additional map tab". It is drawn on the old map, so opening the tab costs no Google map load,
 * and it is read only: a place is set from **Photo of a spot** and **＋ Place on this job** under
 * the address, which sit over every tab. What is drawn is `paintedJobMap.ts`'s.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { useAddressGeocodeCoords } from '../../hooks/useAddressGeocodeCoords'
import { useTakenDown } from '../../hooks/useTakenDown'
import { normalizeAddressForGeocodeKey } from '../../lib/map/normalizeAddressForGeocode'
import type { AddressList } from '../../lib/paintedMap/paintedAddressPlaces'
import { loadAddressPlaceLists, notePaintedPlaceOpened } from '../../lib/paintedMap/paintedAddressPlacesIo'
import { JOB_MAP_WORDS, jobMapIsEmpty, jobMapParts, jobMapSummaryWords } from '../../lib/paintedMap/paintedJobMap'
import { onPaintedMapsChanged, openPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { loadPaintedMapsFor, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'

const PaintedMapCanvasLazy = lazy(() => import('../paintedMap/PaintedMapCanvas'))

type Props = {
  jobId: string
  developmentId?: string | null
  /** The job's address: where the map opens when nothing is on it yet. */
  address?: string | null
  /** A phone draws a shorter map, so the line under it is in view. */
  phone?: boolean
}

export default function JobWindowMapTab({ jobId, developmentId = null, address = null, phone = false }: Props) {
  const [wholes, setWholes] = useState<PaintedMapWhole[] | null>(null)
  const [addressLists, setAddressLists] = useState<AddressList[]>([])
  const [failed, setFailed] = useState<string | null>(null)
  const takenDown = useTakenDown()

  const load = useCallback(async () => {
    const [maps, kept] = await Promise.all([loadPaintedMapsFor({ jobId, developmentId }), loadAddressPlaceLists(jobId)])
    if (takenDown()) return
    if (maps.ok) {
      setWholes(maps.value)
      setFailed(null)
    } else {
      setFailed(maps.error)
    }
    // A read of the address that fails draws none of its places: the job's own map still stands.
    setAddressLists(kept.ok ? kept.value : [])
  }, [jobId, developmentId, takenDown])

  useEffect(() => {
    void load()
    return onPaintedMapsChanged(() => void load())
  }, [load])

  const parts = useMemo(() => jobMapParts(wholes ?? [], jobId, addressLists), [wholes, jobId, addressLists])
  const empty = jobMapIsEmpty(parts)

  // Only a map with nothing on it needs the address looked up: lines and places frame themselves.
  const addresses = useMemo(() => {
    const display = (address ?? '').trim()
    return display ? [{ key: normalizeAddressForGeocodeKey(display), display }] : []
  }, [address])
  const { coords } = useAddressGeocodeCoords(addresses, wholes !== null && empty && addresses.length > 0, 'job map tab')
  const start = addresses[0] ? (coords.get(addresses[0].key) ?? null) : null

  const canvasLines = useMemo(() => parts.lines.map((l) => ({ id: l.id, points: l.points, poorParts: l.poorParts, how: l.how, ...(l.color ? { color: l.color } : null) })), [parts.lines])
  const canvasPlaces = useMemo(() => parts.places.map((p) => ({ ...p, fromJob: p.fromEarlier })), [parts.places])
  const openPlace = useCallback(
    (placeId: string) => {
      const place = parts.places.find((p) => p.id === placeId)
      if (!place) return
      notePaintedPlaceOpened(place.id)
      openPaintedMap(place.mapId, address, undefined, undefined, place.id)
    },
    [parts.places, address],
  )

  const summary = jobMapSummaryWords(parts)
  return (
    <div data-job-map-tab={wholes === null ? 'loading' : empty ? 'empty' : 'drawn'} style={{ display: 'grid', gap: '0.6rem' }}>
      {failed ? (
        <p role="alert" style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }}>
          {JOB_MAP_WORDS.failed} {failed}{' '}
          <button type="button" onClick={() => void load()} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline', cursor: 'pointer', minHeight: 44 }}>
            Try again
          </button>
        </p>
      ) : null}
      {wholes !== null && empty ? (
        <p role="status" data-job-map-none style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-700)' }}>
          {JOB_MAP_WORDS.none}
        </p>
      ) : null}
      <div style={{ height: phone ? '52vh' : 440, minHeight: 280, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-muted)' }}>
        <Suspense fallback={<p style={{ margin: 0, padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Opening the map…</p>}>
          <PaintedMapCanvasLazy lines={canvasLines} places={canvasPlaces} height="100%" start={start} onPlaceTap={openPlace} />
        </Suspense>
      </div>
      {summary ? (
        <p data-job-map-summary style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-700)' }}>
          <b style={{ color: 'var(--text-strong)' }}>{summary}</b>
          {parts.places.length > 0 ? ` · ${JOB_MAP_WORDS.hint}` : ''}
        </p>
      ) : null}
    </div>
  )
}
