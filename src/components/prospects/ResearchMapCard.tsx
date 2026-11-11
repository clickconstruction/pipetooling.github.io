import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { MapCanvasAnchor, MapCanvasPin } from '../../lib/map/mapCanvasTypes'
import { googleMapsBrowserKey, resolveDashboardMapProvider } from '../../lib/dashboardJobsMap'
import { useOfficeAnchor } from '../../hooks/useOfficeAnchor'
import { LENS_PIN_COLOR, RESEARCH_SHOWING_WORDS, researchPins, rowLens, shortDay, workWords, type ResearchPermitRow } from '../../lib/research/permitResearch'

const PinsMapCanvas = lazy(() => import('../map/PinsMapCanvas'))
const PinsMapGoogleCanvas = lazy(() => import('../map/PinsMapGoogleCanvas'))

/**
 * Research (punch list #292, PR 2): the map lens on the ledger's rows. The same pins canvas the
 * Bid Board uses (Google when a key is set, OpenStreetMap otherwise), pins coloured by lens,
 * clustered at low zoom, the office ringed; a pin selects its row and the caller draws the
 * row's card beside the map with its Decide press.
 */
const LEGEND: Array<keyof typeof LENS_PIN_COLOR> = ['waiting', 'look', 'approach', 'taken']

export function ResearchMapCard({
  rows,
  selectedId,
  onSelect,
  isMobile,
  children,
  noPinsWords,
}: {
  rows: readonly ResearchPermitRow[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  isMobile: boolean
  /** The selected row's card, drawn beside the map (under it on a phone). */
  children?: React.ReactNode
  /** What the map says when no row has a point, for a caller that is not the ledger. */
  noPinsWords?: string
}) {
  const [fitSignal, setFitSignal] = useState(0)
  const [googleFailed, setGoogleFailed] = useState(false)
  const provider = resolveDashboardMapProvider({ key: googleMapsBrowserKey(), googleFailed })
  const googleUnavailable = useCallback((reason: string) => {
    console.warn(`[research map] Google Maps unavailable, using OpenStreetMap — ${reason}`)
    setGoogleFailed(true)
  }, [])
  const anchor = useOfficeAnchor(true)
  const canvasAnchor = useMemo<MapCanvasAnchor | null>(() => (anchor ? { lat: anchor.lat, lng: anchor.lng, label: 'Office', ringMiles: [25, 50] } : null), [anchor])
  const pins = useMemo<MapCanvasPin[]>(() => researchPins(rows), [rows])
  const unplaced = rows.length - pins.length
  const mapHeight = isMobile ? 360 : 520

  // Fit every pin when the set changes.
  useEffect(() => {
    setFitSignal((n) => n + 1)
  }, [pins.length])

  const renderPopup = useCallback(
    (id: string) => {
      const r = rows.find((x) => x.id === id)
      if (!r) return null
      const w = workWords(r)
      return (
        <div style={{ fontSize: '0.8125rem', lineHeight: 1.4, maxWidth: 240 }}>
          <strong>{r.address ?? r.permit_number}</strong>
          <br />
          {w.main} · {shortDay(r.filed_on)}
          <br />
          <span style={{ color: 'var(--text-muted)' }}>{r.contact ?? 'nobody named'} · {RESEARCH_SHOWING_WORDS[rowLens(r)]}</span>
        </div>
      )
    },
    [rows],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        {LEGEND.map((lens) => (
          <span key={lens} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i aria-hidden="true" style={{ width: 12, height: 12, borderRadius: '50%', background: LENS_PIN_COLOR[lens], border: '2px solid var(--surface)', boxShadow: '0 0 0 1px rgba(0,0,0,0.25)', display: 'inline-block' }} />
            {RESEARCH_SHOWING_WORDS[lens]}
          </span>
        ))}
        <span>· a number is a cluster, click it to open</span>
        {unplaced > 0 && <span>· {unplaced} with no point the city gave</span>}
        <span style={{ flex: '1 1 auto' }} />
        <button type="button" onClick={() => setFitSignal((n) => n + 1)} style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', fontSize: '0.78rem', cursor: 'pointer' }}>
          Fit all
        </button>
      </div>
      <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: '0.5rem' } : { display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '0.6rem', alignItems: 'stretch' }}>
        <div style={{ position: 'relative', height: mapHeight, borderRadius: 8, overflow: 'hidden', isolation: 'isolate', background: 'var(--bg-muted)', border: '1px solid var(--border)' }}>
          {pins.length > 0 ? (
            <Suspense fallback={<div style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading map…</div>}>
              {provider === 'google' ? (
                <PinsMapGoogleCanvas apiKey={googleMapsBrowserKey()} onUnavailable={googleUnavailable} pins={pins} selectedId={selectedId} onSelect={onSelect} renderPopup={renderPopup} fitSignal={fitSignal} height={mapHeight} isMobile={isMobile} anchor={canvasAnchor} cluster scrollZoomAfterClick key={isMobile ? 'phone' : 'desktop'} />
              ) : (
                <PinsMapCanvas pins={pins} selectedId={selectedId} onSelect={onSelect} renderPopup={renderPopup} fitSignal={fitSignal} height={mapHeight} isMobile={isMobile} anchor={canvasAnchor} cluster scrollZoomAfterClick key={isMobile ? 'phone' : 'desktop'} />
              )}
            </Suspense>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {noPinsWords ?? 'Nothing to place on this lens. Pick another under Showing, or widen the window.'}
            </div>
          )}
        </div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.9rem', background: 'var(--surface)', minHeight: isMobile ? undefined : mapHeight, boxSizing: 'border-box' }}>
          {children ?? <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Click a pin to read its permit here.</div>}
        </div>
      </div>
    </div>
  )
}
