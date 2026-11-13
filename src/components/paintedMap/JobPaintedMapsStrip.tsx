/**
 * The painted maps of a job, as lines under its address (punch list #345). A painted map is the
 * address, continued: the part a street address cannot say. So it sits where the address is, in
 * the job window's top band, and shows on every tab.
 *
 * A job with no painted map looks as it did, plus one quiet press for whoever wants to paint one.
 * A map painted for the job's development shows here too, since it is every lot's way in.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAddressGeocodeCoords } from '../../hooks/useAddressGeocodeCoords'
import { normalizeAddressForGeocodeKey } from '../../lib/map/normalizeAddressForGeocode'
import { mapSummaryWords, mapsForJob } from '../../lib/paintedMap/paintedMap'
import { onPaintedMapsChanged, openPaintedMap, startPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { loadPaintedMapsFor, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import { PAINT_SWATCH } from './paintedMapLook'

type Props = {
  jobId: string
  developmentId?: string | null
  /** The job in words, for the start sheet. */
  jobLabel?: string | null
  developmentLabel?: string | null
  /** The job's address: where a new map opens. */
  address?: string | null
}

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minHeight: 40, padding: '0.35rem 0.6rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }
const add: CSSProperties = { ...row, borderStyle: 'dashed', borderColor: 'var(--border-strong)', background: 'transparent', color: 'var(--text-link)' }

export function JobPaintedMapsStrip({ jobId, developmentId = null, jobLabel = null, developmentLabel = null, address = null }: Props) {
  const [wholes, setWholes] = useState<PaintedMapWhole[]>([])
  const [failed, setFailed] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await loadPaintedMapsFor({ jobId, developmentId })
    if (res.ok) {
      setWholes(res.value)
      setFailed(null)
    } else {
      setFailed(res.error)
    }
  }, [jobId, developmentId])

  useEffect(() => {
    void load()
    return onPaintedMapsChanged(() => void load())
  }, [load])

  // Where a new map opens, and where an empty one does: the job's address as the app already placed it.
  const addresses = useMemo(() => {
    const display = (address ?? '').trim()
    return display ? [{ key: normalizeAddressForGeocodeKey(display), display }] : []
  }, [address])
  const { coords } = useAddressGeocodeCoords(addresses, addresses.length > 0, 'painted map start')
  const center = addresses[0] ? (coords.get(addresses[0].key) ?? null) : null

  const maps = useMemo(() => {
    const byId = new Map(wholes.map((w) => [w.map.id, w]))
    return mapsForJob(wholes.map((w) => w.map), jobId, developmentId).map((m) => ({ ...m, whole: byId.get(m.id)! }))
  }, [wholes, jobId, developmentId])

  return (
    <div data-job-painted-maps style={{ display: 'grid', gap: '0.35rem' }}>
      {maps.map((m) => {
        const summary = mapSummaryWords(m.whole.lines, m.whole.places.length)
        return (
          <button key={m.id} type="button" data-painted-map-line style={row} onClick={(e) => { e.stopPropagation(); openPaintedMap(m.id, center) }}>
            <span aria-hidden style={PAINT_SWATCH} />
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
            <span style={{ marginLeft: 'auto', flex: 'none', color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.8125rem' }}>
              {m.fromDevelopment && developmentLabel ? `from ${developmentLabel} · ` : ''}
              {summary ? `${summary} ›` : 'open ›'}
            </span>
          </button>
        )
      })}
      {failed ? (
        <p role="status" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          The painted maps did not load: {failed}{' '}
          <button type="button" onClick={(e) => { e.stopPropagation(); void load() }} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
            Try again
          </button>
        </p>
      ) : null}
      <button type="button" data-paint-a-map style={add} onClick={(e) => { e.stopPropagation(); startPaintedMap({ jobId, developmentId, label: jobLabel, developmentLabel, center }) }}>
        ＋ Paint a map
      </button>
    </div>
  )
}
