import { useCallback, useEffect, useMemo, useState } from 'react'
import { onPaintedMapsChanged, openPaintedMap, startPaintedMap } from '../../lib/paintedMap/paintedMapDoor'
import {
  PAINTED_MAP_LIBRARY_WORDS as WORDS,
  findPaintedMapLibrary,
  paintedMapLibraryCountWords,
  paintedMapLibraryNoMatchWords,
  paintedMapLibraryRows,
} from '../../lib/paintedMap/paintedMapDocuments'
import { PAINTED_MAP_LAYER_MAX, loadPaintedMapsEvery, loadPaintedMapsForSearch, loadPainterNames, type Landed, type PaintedMapWhole } from '../../lib/paintedMap/paintedMapIo'
import type { PaintedMapSearchRow } from '../../lib/paintedMap/paintedMapSearch'
import { useTakenDown } from '../../hooks/useTakenDown'
import { formatDenverCalendarDayShort } from '../../utils/dateUtils'
import { EmptyState } from '../EmptyState'
import { PAINT_SWATCH } from '../paintedMap/paintedMapLook'
import { PaintedMapShareSheet } from '../paintedMap/PaintedMapShareSheet'
import { documentsHeading, documentsLinkButton, documentsQuietButton, documentsTd, documentsTh } from '../jobs/jobDocumentsStyles'

type Props = {
  /** Every painted map the reader can open, newest first. For a smoke. */
  loadMaps?: () => Promise<Landed<PaintedMapWhole[]>>
  /** Each map's home in words, where the reader can see the home. For a smoke. */
  loadHomes?: () => Promise<PaintedMapSearchRow[]>
  /** The painters' names. For a smoke. */
  loadNames?: (ids: ReadonlyArray<string | null>) => Promise<Map<string, string>>
}

type Read = { kind: 'loading' } | { kind: 'read'; wholes: PaintedMapWhole[]; homes: PaintedMapSearchRow[]; names: Map<string, string> } | { kind: 'failed'; words: string }

const dayOf = (iso: string): string | null => {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? formatDenverCalendarDayShort(ms) : null
}

/** A box to find a map once the list is longer than a glance. */
const FIND_FROM = 7

/**
 * The Documents page's **Painted maps** tab (punch list #345, Taunya's ask of 2026-11-15): every
 * painted map the reader can open, whatever it is on. A job's own Documents tab lists that job's
 * maps; this is the one place that lists them all, a map on no job among them.
 *
 * A row is a door, as on a job: the name opens the map as it is now. Nothing is stored here. Row
 * security decides the list, so a tech sees the maps a tech may open.
 */
export function DocumentsPaintedMapsTab({ loadMaps = loadPaintedMapsEvery, loadHomes = loadPaintedMapsForSearch, loadNames = loadPainterNames }: Props) {
  const [read, setRead] = useState<Read>({ kind: 'loading' })
  const [find, setFind] = useState('')
  /** Share on a row (v2.7415): the map's Share sheet, without opening the map. */
  const [sharing, setSharing] = useState<{ id: string; name: string } | null>(null)

  // A read that lands after the tab is taken down sets nothing: there is no screen left to draw on.
  const takenDown = useTakenDown()

  const load = useCallback(async () => {
    const res = await loadMaps()
    if (takenDown()) return
    if (!res.ok) {
      setRead({ kind: 'failed', words: res.error })
      return
    }
    // The homes and the names are words beside each map. Either failing costs the words and never the list.
    const [homes, names] = await Promise.all([
      loadHomes().catch(() => [] as PaintedMapSearchRow[]),
      loadNames(res.value.map((w) => w.map.createdBy)).catch(() => new Map<string, string>()),
    ])
    if (takenDown()) return
    setRead({ kind: 'read', wholes: res.value, homes, names })
  }, [loadMaps, loadHomes, loadNames, takenDown])

  useEffect(() => {
    void load()
    // A map made, renamed, moved, added to or thrown away anywhere in the app is read again here.
    return onPaintedMapsChanged(() => void load())
  }, [load])

  const rows = useMemo(() => (read.kind === 'read' ? paintedMapLibraryRows(read.wholes, read.homes, (id) => (id ? (read.names.get(id) ?? null) : null), dayOf) : []), [read])
  const shown = useMemo(() => findPaintedMapLibrary(rows, find), [rows, find])
  const paint = () => startPaintedMap({})

  return (
    <section data-documents-painted-maps aria-labelledby="documents-painted-maps" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
          <h2 id="documents-painted-maps" style={{ ...documentsHeading, fontSize: '1.05rem' }}>
            {WORDS.heading}
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{WORDS.lead}</p>
        </div>
        <button type="button" style={documentsQuietButton} onClick={paint}>
          {WORDS.paint}
        </button>
      </div>

      {read.kind === 'loading' ? (
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>{WORDS.loading}</p>
      ) : read.kind === 'failed' ? (
        <p role="status" data-documents-painted-maps-failed style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {WORDS.failedLead} {read.words}{' '}
          <button type="button" onClick={() => void load()} style={{ ...documentsLinkButton, fontWeight: 400 }}>
            {WORDS.retry}
          </button>
        </p>
      ) : rows.length === 0 ? (
        <EmptyState main={WORDS.none} next={{ label: WORDS.paint, onPress: paint }} tail={WORDS.noneTail} />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {rows.length >= FIND_FROM ? (
              <input
                type="search"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder={WORDS.find}
                aria-label={WORDS.find}
                style={{ flex: '1 1 16rem', minWidth: 0, maxWidth: '26rem', padding: '0.4rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontSize: '0.875rem' }}
              />
            ) : null}
            <span data-documents-painted-maps-count style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {paintedMapLibraryCountWords(shown.length, rows.length, PAINTED_MAP_LAYER_MAX)}
            </span>
          </div>
          {shown.length === 0 ? (
            <EmptyState compact main={paintedMapLibraryNoMatchWords(find)} next={{ label: WORDS.clear, onPress: () => setFind('') }} />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th style={documentsTh}>{WORDS.columns.map}</th>
                    <th style={documentsTh}>{WORDS.columns.where}</th>
                    <th style={documentsTh}>{WORDS.columns.holds}</th>
                    <th style={documentsTh}>{WORDS.columns.painted}</th>
                    <th style={documentsTh} aria-label={WORDS.share} />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={row.id} data-testid="documents-painted-map">
                      <td style={documentsTd}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                          <span aria-hidden style={PAINT_SWATCH} />
                          <button type="button" onClick={() => openPaintedMap(row.id)} style={documentsLinkButton}>
                            {row.name}
                          </button>
                        </span>
                        {row.words ? <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{row.words}</div> : null}
                      </td>
                      <td style={documentsTd}>{row.where}</td>
                      <td style={{ ...documentsTd, whiteSpace: 'nowrap' }}>{row.holds}</td>
                      <td style={{ ...documentsTd, color: 'var(--text-muted)' }}>{row.painted ?? ''}</td>
                      <td style={{ ...documentsTd, textAlign: 'right', whiteSpace: 'nowrap', width: '1%' }}>
                        <button type="button" style={documentsQuietButton} aria-label={`${WORDS.share} ${row.name}`} onClick={() => setSharing({ id: row.id, name: row.name })}>
                          {WORDS.share}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {sharing ? <PaintedMapShareSheet mapId={sharing.id} mapName={sharing.name} onClose={() => setSharing(null)} /> : null}
    </section>
  )
}

export default DocumentsPaintedMapsTab
