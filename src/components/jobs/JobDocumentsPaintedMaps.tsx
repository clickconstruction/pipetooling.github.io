import { useCallback, useEffect, useMemo, useState } from 'react'
import { onPaintedMapsChanged, openPaintedMap, startPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import { PAINTED_MAP_DOCUMENT_WORDS, paintedMapDocumentRows } from '../../lib/paintedMap/paintedMapDocuments'
import { loadPaintedMapsFor, loadPainterNames, type Landed, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState'
import { PAINT_SWATCH } from '../paintedMap/paintedMapLook'
import { documentsChip, documentsHeading, documentsLinkButton, documentsQuietButton, documentsTd } from './jobDocumentsStyles'

type Props = {
  job: { id: string; job_name?: string | null; job_address?: string | null; development_id?: string | null; development?: { id: string; name: string | null } | null }
  /** May this person see the copies that went out? Then the section says where a map's fixed copy is. */
  sentCopiesShown?: boolean
  /** The job's painted maps and its development's. For a smoke. */
  loadMaps?: (home: { jobId: string; developmentId: string | null }) => Promise<Landed<PaintedMapWhole[]>>
  /** The painters' names. For a smoke. */
  loadNames?: (ids: ReadonlyArray<string | null>) => Promise<Map<string, string>>
}

type Read = { kind: 'loading' } | { kind: 'read'; wholes: PaintedMapWhole[]; names: Map<string, string> } | { kind: 'failed'; words: string }

const dayOf = (iso: string): string | null => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDenverCalendarDayShort(ms) : null
}

/**
 * The Documents tab's **Painted maps** (punch list #345, Taunya's ask of 2026-11-15): the job's
 * maps and its development's, listed where the office looks for everything else about a job.
 *
 * A row is a door, not a file. A press opens the map as it is now, in the painted map's own
 * window, and **Paint a map** starts one for the job. Nothing is stored here: a map keeps changing,
 * and the copy that went out is already under *Sent from this job*. The line under the job's
 * address stays, since that is where the crew meets a map.
 */
export function JobDocumentsPaintedMaps({ job, sentCopiesShown = false, loadMaps = loadPaintedMapsFor, loadNames = loadPainterNames }: Props) {
  const [read, setRead] = useState<Read>({ kind: 'loading' })
  const developmentId = job.development_id ?? job.development?.id ?? null
  const developmentLabel = job.development?.name ?? null

  const load = useCallback(async () => {
    const res = await loadMaps({ jobId: job.id, developmentId })
    if (!res.ok) {
      setRead({ kind: 'failed', words: res.error })
      return
    }
    // The names are words beside each map. A read of them that fails costs the words and never the list.
    const names = await loadNames(res.value.map((w) => w.map.createdBy)).catch(() => new Map<string, string>())
    setRead({ kind: 'read', wholes: res.value, names })
  }, [job.id, developmentId, loadMaps, loadNames])

  useEffect(() => {
    void load()
    // A map made, renamed, added to or thrown away anywhere in the app is read again here.
    return onPaintedMapsChanged(() => void load())
  }, [load])

  const rows = useMemo(
    () => (read.kind === 'read' ? paintedMapDocumentRows(read.wholes, job.id, developmentId, developmentLabel, (id) => (id ? (read.names.get(id) ?? null) : null), dayOf) : []),
    [read, job.id, developmentId, developmentLabel],
  )
  const address = job.job_address ?? null
  const paint = () => startPaintedMap({ jobId: job.id, developmentId, label: job.job_name ?? null, developmentLabel, address })

  return (
    <section data-job-documents-painted-maps aria-labelledby="job-documents-painted-maps" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h3 id="job-documents-painted-maps" style={{ ...documentsHeading, flex: 1 }}>
          {PAINTED_MAP_DOCUMENT_WORDS.heading}
        </h3>
        <button type="button" style={documentsQuietButton} onClick={paint}>
          {PAINTED_MAP_DOCUMENT_WORDS.paint}
        </button>
      </div>
      {read.kind === 'loading' ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{PAINTED_MAP_DOCUMENT_WORDS.loading}</p>
      ) : read.kind === 'failed' ? (
        <p role="status" data-job-documents-painted-maps-failed style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {PAINTED_MAP_DOCUMENT_WORDS.failedLead} {read.words}{' '}
          <button type="button" onClick={() => void load()} style={{ ...documentsLinkButton, fontWeight: 400 }}>
            {PAINTED_MAP_DOCUMENT_WORDS.retry}
          </button>
        </p>
      ) : rows.length === 0 ? (
        <EmptyState compact main={PAINTED_MAP_DOCUMENT_WORDS.none} next={{ label: PAINTED_MAP_DOCUMENT_WORDS.paint, onPress: paint }} tail={PAINTED_MAP_DOCUMENT_WORDS.noneTail} />
      ) : (
        <>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-testid="job-documents-painted-map">
                  <td style={documentsTd}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span aria-hidden style={PAINT_SWATCH} />
                      <button type="button" onClick={() => openPaintedMap(row.id, address)} style={documentsLinkButton}>
                        {row.name}
                      </button>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{row.detail}</span>
                      {row.from ? <span style={{ ...documentsChip, marginLeft: 0, background: 'var(--bg-muted)', color: 'var(--text-700)' }}>{row.from}</span> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{sentCopiesShown ? PAINTED_MAP_DOCUMENT_WORDS.copies : PAINTED_MAP_DOCUMENT_WORDS.live}</p>
        </>
      )}
    </section>
  )
}

export default JobDocumentsPaintedMaps
