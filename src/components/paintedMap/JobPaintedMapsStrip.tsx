/**
 * The painted maps of a job, as lines under its address (punch list #345). A painted map is the
 * address, continued: the part a street address cannot say. So it sits where the address is, in
 * the job window's top band, and shows on every tab.
 *
 * A job with no painted map looks as it did, plus one quiet press for whoever wants to paint one.
 * A map painted for the job's development shows here too, since it is every lot's way in.
 */
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { mapSummaryWords, mapsForDevelopment, mapsForJob } from '../../lib/paintedMap/paintedMap'
import { onPaintedMapsChanged, openPaintedMap, startPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { loadPaintedMapsFor, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import { PAINT_SWATCH } from './paintedMapLook'

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
  only?: 'maps'
}

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minHeight: 40, padding: '0.35rem 0.6rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', background: 'var(--bg-subtle)', color: 'var(--text-strong)', fontFamily: 'inherit', fontSize: '0.875rem', fontWeight: 600, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }
const add: CSSProperties = { ...row, borderStyle: 'dashed', borderColor: 'var(--border-strong)', background: 'transparent', color: 'var(--text-link)' }

export function JobPaintedMapsStrip({ jobId, developmentId = null, jobLabel = null, developmentLabel = null, address = null, only }: Props) {
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

  const maps = useMemo(() => {
    const byId = new Map(wholes.map((w) => [w.map.id, w]))
    return mapsForJob(wholes.map((w) => w.map), jobId, developmentId).map((m) => ({ ...m, whole: byId.get(m.id)! }))
  }, [wholes, jobId, developmentId])

  if (only === 'maps' && maps.length === 0) return null

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
      {failed && only !== 'maps' ? (
        <p role="status" style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          The painted maps did not load: {failed}{' '}
          <button type="button" onClick={(e) => { e.stopPropagation(); void load() }} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-link)', fontFamily: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
            Try again
          </button>
        </p>
      ) : null}
      {only === 'maps' ? null : (
        <button type="button" data-paint-a-map style={add} onClick={(e) => { e.stopPropagation(); startPaintedMap({ jobId, developmentId, label: jobLabel, developmentLabel, address }) }}>
          ＋ Paint a map
        </button>
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

  const load = useCallback(async () => {
    const res = await loadPaintedMapsFor({ developmentId, jobIds: jobKey ? jobKey.split(',') : [] })
    if (res.ok) {
      setWholes(res.value)
      setFailed(null)
    } else {
      setFailed(res.error)
    }
  }, [developmentId, jobKey])

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
