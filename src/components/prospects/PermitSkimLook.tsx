import { useEffect, useState, type CSSProperties } from 'react'
import { fetchStreetViewImageBlob, fetchStreetViewMetaWithMonth, googleStreetViewPanoUrl } from '../../lib/fetchStreetViewPreview'
import { mapsDoor, type ResearchPermitRow } from '../../lib/research/permitResearch'
import { NO_STREET_VIEW_WORDS, TILE_PX, satelliteTileUrl, streetTileUrl, streetViewLocation, streetViewWords, tilesAround } from '../../lib/research/permitLook'

/**
 * Permits, the look (punch list #302, PR 3): the two pictures across the top of a skim card. A
 * street view of the address with the month it was taken, and a map with the permit in its
 * middle and the miles from the office. Where the car never drove, the first tile is satellite
 * and says so. A press on either opens it in Google in a new tab. Drawn for the top card only,
 * so one street view is asked for per card that is actually read.
 */
const STILL_W = 420
const STILL_H = 180

const tile: CSSProperties = { position: 'relative', overflow: 'hidden', display: 'block', background: 'var(--bg-200)', minWidth: 0 }
const tag: CSSProperties = { position: 'absolute', bottom: 6, borderRadius: 6, padding: '1px 7px', fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap', lineHeight: 1.5 }
const darkTag: CSSProperties = { ...tag, left: 6, background: 'rgba(17,24,39,0.72)', color: '#ffffff' }
const lightTag: CSSProperties = { ...tag, right: 6, background: 'rgba(255,255,255,0.92)', color: 'var(--text-strong)' }

type Street = { state: 'loading' } | { state: 'image'; url: string; month: string | null; lat: number; lng: number } | { state: 'none' }

/** A still of map tiles with the point in its middle: a block bigger than any tile it sits in, centred. */
function TileStill({ lat, lng, zoom, kind }: { lat: number; lng: number; zoom: number; kind: 'street' | 'satellite' }) {
  const tiles = tilesAround(lat, lng, zoom, STILL_W, STILL_H)
  return (
    <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: STILL_W, height: STILL_H, transform: 'translate(-50%, -50%)' }}>
      {tiles.map((t) => (
        <img key={t.key} src={kind === 'street' ? streetTileUrl(t) : satelliteTileUrl(t)} alt="" draggable={false} loading="lazy" style={{ position: 'absolute', left: t.left, top: t.top, width: TILE_PX, height: TILE_PX, maxWidth: 'none' }} />
      ))}
    </span>
  )
}

const pin: CSSProperties = { position: 'absolute', left: '50%', top: '50%', width: 14, height: 14, margin: '-7px 0 0 -7px', borderRadius: '50%', background: '#2563eb', border: '2px solid #ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }

export function PermitSkimLook({ row, milesWords, compact = false }: { row: ResearchPermitRow; milesWords: string | null; /** A phone: a shorter strip, so more of the card is above the answers. */ compact?: boolean }) {
  const [street, setStreet] = useState<Street>({ state: 'loading' })
  const location = streetViewLocation(row)

  useEffect(() => {
    if (!location) {
      setStreet({ state: 'none' })
      return
    }
    let live = true
    let made: string | null = null
    setStreet({ state: 'loading' })
    fetchStreetViewMetaWithMonth(location)
      .then(async (meta) => {
        if (!live) return
        if (!meta) {
          setStreet({ state: 'none' })
          return
        }
        const blob = await fetchStreetViewImageBlob(location)
        if (!live || typeof URL.createObjectURL !== 'function') return
        made = URL.createObjectURL(blob)
        setStreet({ state: 'image', url: made, month: meta.month, lat: meta.lat, lng: meta.lng })
      })
      // A street view that cannot be read is no reason to hold the card: the tile falls back to satellite.
      .catch(() => live && setStreet({ state: 'none' }))
    return () => {
      live = false
      if (made && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(made)
    }
  }, [location])

  const maps = mapsDoor(row)
  const hasPoint = row.lat != null && row.lng != null
  const streetHref = street.state === 'image' ? googleStreetViewPanoUrl(street.lat, street.lng) : maps

  return (
    // The pictures are light in either theme, so the words on them read the light theme's values.
    <div data-theme="light" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, height: compact ? 104 : 124, background: 'var(--border)', borderRadius: '13px 13px 0 0', overflow: 'hidden' }}>
      <a href={streetHref ?? undefined} target="_blank" rel="noreferrer" aria-label={street.state === 'image' ? 'Open Street View in Google, in a new tab' : 'Open the site in Google Maps, in a new tab'} style={tile}>
        {street.state === 'image' && <img src={street.url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        {street.state === 'none' && hasPoint && <TileStill lat={row.lat as number} lng={row.lng as number} zoom={17} kind="satellite" />}
        <span style={darkTag}>{street.state === 'loading' ? 'Asking for a street view…' : street.state === 'image' ? streetViewWords(street.month) : NO_STREET_VIEW_WORDS}</span>
      </a>
      <a href={maps ?? undefined} target="_blank" rel="noreferrer" aria-label="Open the site in Google Maps, in a new tab" style={tile}>
        {hasPoint && (
          <>
            <TileStill lat={row.lat as number} lng={row.lng as number} zoom={11} kind="street" />
            <span aria-hidden="true" style={pin} />
          </>
        )}
        <span style={lightTag}>{milesWords ?? (hasPoint ? 'Map' : 'No point on this permit')}</span>
      </a>
    </div>
  )
}
