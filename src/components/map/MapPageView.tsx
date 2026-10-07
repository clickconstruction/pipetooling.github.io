import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
// Leaflet / react-leaflet / Geoman: import only from this file (and the lazy pins canvas) so they stay in the lazy Map route chunk.
import { useMap } from 'react-leaflet'
import { booleanPointInPolygon, point } from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import '@geoman-io/leaflet-geoman-free'
import { useMapPageData, type GeocodeAddressRow, type MapPageEntity } from '../../hooks/useMapPageData'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { MapGeocodeReviewModal } from './MapGeocodeReviewModal'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import { mapEntityMatchesSearch } from '../../lib/map/mapEntitySearch'
import { DEFAULT_MAP_BID_STAGES, mapEntityPassesLayerFilter } from '../../lib/map/mapLayerFilter'
import {
  BUILDER_FOCUS_BID_STAGES,
  builderBidOutcomeCounts,
} from '../../lib/map/builderBidMapFocus'
import { supabase } from '../../lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useAuth } from '../../hooks/useAuth'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'
import { CourtAreasLayer } from './CourtAreasLayer'
import { CourtAreasPanel, type CourtAreaListed } from './CourtAreasPanel'
import { courtCoverage, type CourtAreaDraft } from '../../lib/legal/courtAreasDraft'
import type { CourtAreaPolygon } from '../../lib/legal/courtAreas'
import { insertCourtArea, listCourtAreas, retireCourtArea, updateCourtArea } from '../../lib/legal/courtAreasIo'
import { formatErrorMessage } from '../../utils/errorHandling'
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext'
import type { SubmissionSectionKey } from '../../lib/bids/submissionSections'
import { useOfficeAnchor } from '../../hooks/useOfficeAnchor'
import { BID_BOARD_MAP_RING_MILES } from '../../lib/bids/bidBoardMap'
import type { MapCanvasAnchor } from '../../lib/map/mapCanvasTypes'
import { mapPageDirectionsUrl } from '../../lib/map/mapPagePins'
import { mapPageBands, mapPageNearest, mapPagePlacePins, mapPagePlaces, mapPageTotalsLine, placesInBands, type DistanceBucketKey, type DistanceBucketVisibility } from '../../lib/map/mapPagePlaces'
import { DEFAULT_DISTANCE_BUCKETS } from '../../lib/bids/bidBoardMapRail'
import { MapPageRail, PlaceCard, type MapPagePlaceOfEntity } from './MapPageRail'
import {
  BID_BOARD_MAP_DUE_RING_COLOR,
  BID_STAGE_META,
  JOBS_MAP_COLLECTIONS_RING_COLOR,
  JOBS_MAP_SECTIONS,
  JOBS_MAP_SECTION_COLOR,
  JOBS_MAP_SECTION_LABEL,
  MAP_PAGE_CLUSTER_RING_PRIORITY,
  MAP_PAGE_DEFAULT_JOB_SECTIONS,
  MAP_PAGE_ESTIMATE_COLOR,
  mapPageLegendCounts,
  readMapPageClustered,
  writeMapPageClustered,
  type JobsMapSection,
} from '../../lib/map/mapPageSections'
import { BID_STAGE_MARKER_COLOR } from '../../lib/map/builderBidMapFocus'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'

// The shared pins canvas (v2.4796): the Dashboard, Bid Board, Pipeline and clocked-in maps draw on it too.
const PinsMapCanvas = lazy(() => import('./PinsMapCanvas'))
import { farFromOfficeLine, farFromOfficePlaces, farMilesWords, farPlaceCountWords, mapPageFitAllPoints, mapPageHomeFitPoints, splitFarFromOffice } from '../../lib/map/mapPageFirstView'

const openLinkLikeStyle: CSSProperties = {
  color: 'var(--text-link)',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
  font: 'inherit',
}


/**
 * One chip over the map (v2.4802): the key and the switch for a job section, a bid stage or the
 * estimates. The dot is the pin's color; `ring` draws the ring the section's pins can wear
 * (Collections red on Billed, the due ring on Unsent). The count is the placed records it stands for.
 */
function SectionChip({
  label,
  color,
  count,
  active,
  title,
  ring,
  onToggle,
}: {
  label: string
  color: string
  count: number
  active: boolean
  title: string
  ring?: string | null
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.25rem 0.7rem',
        borderRadius: 999,
        border: `1px solid ${active ? color : 'var(--border)'}`,
        background: active ? 'var(--surface)' : 'transparent',
        color: active ? 'var(--text-700)' : 'var(--text-muted)',
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.2,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'border-color 120ms ease, color 120ms ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: active ? color : 'var(--text-faint-300)',
          boxShadow: active && ring ? `0 0 0 2px ${ring}` : undefined,
          transition: 'background 120ms ease',
        }}
      />
      {label}
      <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{count}</span>
    </button>
  )
}

const chipRowStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }
const chipSepStyle: CSSProperties = { width: 1, height: 18, background: 'var(--border-strong)', margin: '0 0.15rem' }

const headerToolbarButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.3rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  fontSize: '0.8125rem',
  fontWeight: 500,
  lineHeight: 1.2,
  cursor: 'pointer',
}

/** One-shot fly-to from the table, the geocode list, the far list and the court areas panel. Mounted inside the canvas. */
function MapFlyTo({
  target,
  onConsumed,
}: {
  target: { lat: number; lng: number } | null
  onConsumed: () => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const z = map.getZoom()
    map.flyTo([target.lat, target.lng], Math.max(z, 14), { duration: 0.45 })
    const id = window.setTimeout(() => {
      onConsumed()
    }, 0)
    return () => {
      clearTimeout(id)
    }
  }, [map, target, onConsumed])
  return null
}

function GeomanDraw({
  onFilterPolygon,
  clearSignal,
  paused = false,
}: {
  onFilterPolygon: (poly: Feature<Polygon> | null) => void
  clearSignal: number
  /** While the Court areas mode is on (v2.4769), a drawn shape is an area, not a filter. */
  paused?: boolean
}) {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    const m = map as L.Map & {
      pm: { addControls: (o: Record<string, unknown>) => void; removeControls: () => void }
    }
    // Only the polygon tool: the area filter and the Court areas mode both draw polygons (v2.4791).
    m.pm.addControls({
      position: 'topleft',
      oneBlock: true,
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      removalMode: false,
      rotateMode: false,
    })

    const onCreate = (ev: { layer: L.Layer }) => {
      if (pausedRef.current) return
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
      const lr = (ev as { layer: L.Polygon }).layer
      layerRef.current = lr
      const gj = lr.toGeoJSON() as Feature<Polygon>
      onFilterPolygon(gj)
    }

    // Geoman custom events; not in Leaflet typings
    type MapWithPm = L.Map & { on: (t: string, h: (e: { layer: L.Layer }) => void) => L.Map; off: (t: string, h: (e: { layer: L.Layer }) => void) => L.Map }
    ;(map as unknown as MapWithPm).on('pm:create', onCreate)

    return () => {
      ;(map as unknown as MapWithPm).off('pm:create', onCreate)
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
      m.pm.removeControls()
    }
  }, [map, onFilterPolygon])

  useEffect(() => {
    if (clearSignal === 0) return
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }
    onFilterPolygon(null)
  }, [clearSignal, map, onFilterPolygon])

  return null
}

function filterEntitiesByPolygon(entities: MapPageEntity[], poly: Feature<Polygon> | null): MapPageEntity[] {
  if (!poly) return entities
  return entities.filter((e) => {
    if (e.lat == null || e.lng == null) return false
    return booleanPointInPolygon(point([e.lng, e.lat]), poly)
  })
}

/** Shown when geocoding runs; `open` follows progress until all rows are terminal. */
function GeocodeProgressList({
  rows,
  entities,
  onAddressOpen,
}: {
  rows: GeocodeAddressRow[]
  entities: MapPageEntity[]
  onAddressOpen: (addressNormalized: string) => void
}) {
  if (rows.length === 0) return null
  const done = rows.filter((r) => r.status === 'ok' || r.status === 'error').length
  const anyActive = rows.some((r) => r.status === 'pending' || r.status === 'in_progress')
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        margin: 0,
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <details
        open={anyActive}
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-700)',
          margin: 0,
          minWidth: 'min(18rem, 100%)',
        }}
      >
        <summary style={{ cursor: 'pointer', userSelect: 'none' }}>{`Geocoding (${done}/${rows.length})`}</summary>
        <ul
          aria-live="polite"
          style={{
            margin: '0.5rem 0 0 0',
            padding: '0 0 0 1.1rem',
            listStyle: 'none',
            maxHeight: 'min(40vh, 240px)',
            overflowY: 'auto',
          }}
        >
        {rows.map((r) => {
          const icon = r.status === 'ok' ? '✓' : r.status === 'error' ? '✗' : r.status === 'in_progress' ? '…' : '·'
          const matched = entities.filter((e) => e.addressKey === r.address_normalized)
          const hasEntity = matched.length > 0
          // Job/bid/estimate numbers for this address; several entities can share one address.
          const ids = [...new Set(matched.map((e) => e.sublabel.trim()).filter((s) => s.length > 0))]
          const idPrefix = ids.slice(0, 3).join(', ') + (ids.length > 3 ? ` +${ids.length - 3} more` : '')
          return (
            <li
              key={r.address_normalized}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.25rem' }}
            >
              <span aria-hidden="true" style={{ width: '0.9rem' }}>
                {icon}
              </span>
              {idPrefix.length > 0 ? (
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{idPrefix}</span>
              ) : null}
              <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{r.addressLabel}</span>
              {hasEntity ? (
                <button
                  type="button"
                  onClick={() => onAddressOpen(r.address_normalized)}
                  style={openLinkLikeStyle}
                  aria-label={`Open job, bid, or estimate for this address: ${r.addressLabel}`}
                >
                  Open
                </button>
              ) : null}
              {r.errorMessage ? <span style={{ color: 'var(--text-red-700)' }}>{r.errorMessage}</span> : null}
            </li>
          )
        })}
        </ul>
      </details>
    </div>
  )
}

export function MapPageView() {
  const navigate = useNavigate()
  const { loading, error, entities, geocodeAddressRows, geocodeInProgress, reload } = useMapPageData(true)
  const jobFormModal = useJobFormModal()
  const openJobOnMap = useCallback(
    (jobId: string) => {
      jobFormModal?.openEditJob(jobId, {
        onSaved: () => void reload(),
      })
    },
    [jobFormModal, reload]
  )
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lng: number } | null>(null)
  const clearMapFlyTo = useCallback(() => setMapFlyTo(null), [])
  const [geocodeChooserMatches, setGeocodeChooserMatches] = useState<MapPageEntity[] | null>(null)
  // The place the office clicked (v2.4796; places v2.4804): its popup on a desktop, the card in the rail.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [bandsOn, setBandsOn] = useState<DistanceBucketVisibility>(DEFAULT_DISTANCE_BUCKETS)
  const toggleBand = useCallback((key: DistanceBucketKey) => setBandsOn((prev) => ({ ...prev, [key]: !prev[key] })), [])
  const openEntity = useCallback(
    (e: MapPageEntity) => {
      if (e.kind === 'job' && jobFormModal) {
        openJobOnMap(e.id)
      } else {
        navigate(e.linkTo)
      }
      if (e.lat != null && e.lng != null) {
        setMapFlyTo({ lat: e.lat, lng: e.lng })
        setSelectedId(e.addressKey)
      }
    },
    [jobFormModal, navigate, openJobOnMap]
  )
  const directionsTo = useCallback((place: { addressLabel: string }) => openInExternalBrowser(mapPageDirectionsUrl(place.addressLabel)), [])
  const pickPlace = useCallback((place: MapPagePlaceOfEntity) => {
    setSelectedId(place.key)
    setMapFlyTo({ lat: place.lat, lng: place.lng })
  }, [])
  const onGeocodeAddressOpen = useCallback(
    (addressNormalized: string) => {
      const matches = entities.filter((en) => en.addressKey === addressNormalized)
      if (matches.length === 0) return
      if (matches.length === 1) {
        openEntity(matches[0]!)
        return
      }
      setGeocodeChooserMatches(matches)
    },
    [entities, openEntity]
  )
  const [reviewOpen, setReviewOpen] = useState(false)
  const narrow = useNarrowViewport640()
  // The chips (v2.4802): job sections, bid stages and estimates; Paid, Lost and Estimates start off.
  const [jobSections, setJobSections] = useState<Record<JobsMapSection, boolean>>(MAP_PAGE_DEFAULT_JOB_SECTIONS)
  const [showEst, setShowEst] = useState(false)
  const [bidStages, setBidStages] = useState<Record<SubmissionSectionKey, boolean>>(DEFAULT_MAP_BID_STAGES)
  const [clustered, setClustered] = useState(() => readMapPageClustered())
  const toggleClustered = useCallback(() => {
    setClustered((c) => {
      writeMapPageClustered(!c)
      return !c
    })
  }, [])
  const legendCounts = useMemo(() => mapPageLegendCounts(entities.filter((e) => e.lat != null && e.lng != null)), [entities])
  // Builder-focus mode (v2.1162): /map?builder=<customerId> shows ONLY that
  // GC's bids, markers colored by outcome, with a scoreboard banner.
  const [searchParams, setSearchParams] = useSearchParams()
  const builderFocusId = searchParams.get('builder')
  const [builderFocusName, setBuilderFocusName] = useState<string | null>(null)
  useEffect(() => {
    if (!builderFocusId) {
      setBuilderFocusName(null)
      return
    }
    setBidStages(BUILDER_FOCUS_BID_STAGES)
    let cancelled = false
    void (async () => {
      const { data } = await supabase.from('customers').select('name').eq('id', builderFocusId).maybeSingle()
      if (!cancelled) setBuilderFocusName(data?.name ?? null)
    })()
    return () => { cancelled = true }
  }, [builderFocusId])
  const clearBuilderFocus = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('builder')
      return next
    })
    setBidStages(DEFAULT_MAP_BID_STAGES)
  }, [setSearchParams])
  // Bids by GC (v2.2164): a bid counts for the focused builder when it's the bid's GC or one of its packets
  // goes there; the section is that GC's packet outcome when the bid went to several GCs.
  const focusSectionOf = useCallback(
    (e: MapPageEntity): SubmissionSectionKey | undefined => (builderFocusId && e.bidGcSections?.[builderFocusId]) || e.bidSection,
    [builderFocusId],
  )
  const builderFocusEntities = useMemo(
    () => (builderFocusId ? entities.filter((e) => e.kind === 'bid' && (e.bidCustomerId === builderFocusId || !!e.bidGcSections?.[builderFocusId])) : []),
    [entities, builderFocusId],
  )
  const builderFocusCounts = useMemo(
    () => builderBidOutcomeCounts(builderFocusEntities.map((e) => focusSectionOf(e))),
    [builderFocusEntities, focusSectionOf],
  )
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [filterPoly, setFilterPoly] = useState<Feature<Polygon> | null>(null)
  const [clearDraw, setClearDraw] = useState(0)
  // Court areas mode (v2.4769): the office draws its justice precincts on this map.
  const { role: authRole, user: authUser } = useAuth()
  const canDrawCourtAreas = authRole === 'dev' || authRole === 'master_technician' || isAssistantLike(authRole)
  const [courtMode, setCourtMode] = useState(false)
  const [courtAreas, setCourtAreas] = useState<CourtAreaListed[]>([])
  const [courtPending, setCourtPending] = useState<CourtAreaPolygon | null>(null)
  const [courtClear, setCourtClear] = useState(0)
  const [courtBusy, setCourtBusy] = useState(false)
  const [courtError, setCourtError] = useState<string | null>(null)
  const courtDb = supabase as unknown as SupabaseClient
  const reloadCourtAreas = useCallback(async () => {
    try {
      setCourtAreas(await listCourtAreas(courtDb))
      setCourtError(null)
    } catch (e) {
      setCourtError(formatErrorMessage(e, 'Could not load the court areas.'))
    }
  }, [courtDb])
  useEffect(() => {
    if (courtMode) void reloadCourtAreas()
  }, [courtMode, reloadCourtAreas])
  const onCourtDrawn = useCallback((polygon: CourtAreaPolygon) => setCourtPending(polygon), [])
  const courtAct = useCallback(async (fallback: string, act: () => Promise<void>) => {
    setCourtBusy(true)
    try {
      await act()
      await reloadCourtAreas()
      setCourtError(null)
    } catch (e) {
      setCourtError(formatErrorMessage(e, fallback))
    } finally {
      setCourtBusy(false)
    }
  }, [reloadCourtAreas])
  const saveCourtArea = useCallback((draft: CourtAreaDraft) => {
    const polygon = courtPending
    if (!polygon) return
    void courtAct('Could not save the area.', async () => {
      await insertCourtArea(courtDb, draft, polygon, authUser?.id ?? null)
      setCourtPending(null)
      setCourtClear((c) => c + 1)
    })
  }, [courtAct, courtDb, courtPending, authUser?.id])
  const discardCourtShape = useCallback(() => {
    setCourtPending(null)
    setCourtClear((c) => c + 1)
  }, [])
  const renameCourtArea = useCallback((id: string, draft: CourtAreaDraft) => void courtAct('Could not change the area.', () => updateCourtArea(courtDb, id, draft)), [courtAct, courtDb])
  const confirmDialog = useConfirmDialog()
  const removeCourtArea = useCallback((a: CourtAreaListed) => {
    void (async () => {
      if (!(await confirmDialog({ title: 'Remove this area?', message: `${a.county} precinct ${a.precinct} comes off the map. Addresses inside it lose their precinct on the next classification.`, confirmLabel: 'Remove', danger: true }))) return
      await courtAct('Could not remove the area.', () => retireCourtArea(courtDb, a.id))
    })()
  }, [confirmDialog, courtAct, courtDb])
  // Classify now (v2.4770): the night's job by hand, under the office user's own session.
  const [classifyWords, setClassifyWords] = useState('')
  const classifyNow = useCallback(() => {
    void courtAct('The classification could not run.', async () => {
      const { data, error } = await supabase.functions.invoke('court-precinct-nightly', { body: {} })
      if (error) throw error
      const r = (data ?? {}) as { placed?: number; outside?: number; onLine?: number; noPoint?: number; written?: number; error?: string }
      if (r.error) throw new Error(r.error)
      setClassifyWords(`${r.placed ?? 0} placed · ${r.outside ?? 0} outside · ${r.onLine ?? 0} on a line · ${r.noPoint ?? 0} with no point · ${r.written ?? 0} ${r.written === 1 ? 'record' : 'records'} written`)
    })
  }, [courtAct])
  const focusCourtArea = useCallback((a: CourtAreaListed) => {
    const ring = (a.polygon.type === 'Polygon' ? a.polygon.coordinates[0] : a.polygon.coordinates[0]?.[0]) ?? []
    if (ring.length === 0) return
    const lat = ring.reduce((sum, c) => sum + (c[1] ?? 0), 0) / ring.length
    const lng = ring.reduce((sum, c) => sum + (c[0] ?? 0), 0) / ring.length
    setMapFlyTo({ lat, lng })
  }, [])
  const onFilterPolygon = useCallback((poly: Feature<Polygon> | null) => {
    setFilterPoly(poly)
  }, [])

  const visible = useMemo(() => {
    if (builderFocusId) {
      const f = { jobSections: { waiting: false, working: false, readyToBill: false, billed: false, paid: false }, showEst: false, bidStages }
      return builderFocusEntities.filter((e) => mapEntityPassesLayerFilter(e, f))
    }
    const f = { jobSections, showEst, bidStages }
    return entities.filter((e) => mapEntityPassesLayerFilter(e, f))
  }, [entities, jobSections, showEst, bidStages, builderFocusId, builderFocusEntities])

  const mapSearchTrim = useMemo(() => mapSearchQuery.trim(), [mapSearchQuery])

  const searchFiltered = useMemo(() => {
    if (mapSearchTrim.length === 0) return visible
    return visible.filter((e) => mapEntityMatchesSearch(mapSearchTrim, e))
  }, [visible, mapSearchTrim])

  // The drawn area (v2.4804) narrows the map and the rail, not a table.
  const inArea = useMemo(() => filterEntitiesByPolygon(searchFiltered, filterPoly), [searchFiltered, filterPoly])
  const withCoords = useMemo(
    () => inArea.filter((e) => e.lat != null && e.lng != null),
    [inArea]
  )
  // The first view (v2.4791): the office and its rings; pins far from the office are drawn but
  // never fitted, and listed under the map to have their addresses checked.
  const officeAnchor = useOfficeAnchor(true)
  const anchorPoint = useMemo(() => (officeAnchor ? { lat: officeAnchor.lat, lng: officeAnchor.lng } : null), [officeAnchor])
  const canvasAnchor = useMemo(
    (): MapCanvasAnchor | null => (anchorPoint ? { ...anchorPoint, label: 'Office', ringMiles: BID_BOARD_MAP_RING_MILES } : null),
    [anchorPoint],
  )
  const placed = useMemo(() => withCoords.map((e) => ({ ...e, lat: e.lat!, lng: e.lng! })), [withCoords])
  const nearAndFar = useMemo(() => splitFarFromOffice(placed, anchorPoint), [placed, anchorPoint])
  const farPlaces = useMemo(() => farFromOfficePlaces(nearAndFar.far), [nearAndFar.far])
  // Places (v2.4804): one pin per address; the bands from the office double as filters.
  const placesAll = useMemo(() => mapPagePlaces(placed), [placed])
  const bands = useMemo(() => mapPageBands(placesAll, anchorPoint), [placesAll, anchorPoint])
  const places = useMemo(() => placesInBands(placesAll, anchorPoint, bandsOn), [placesAll, anchorPoint, bandsOn])
  const nearPlaces = useMemo(() => splitFarFromOffice(places, anchorPoint).near, [places, anchorPoint])
  const homeFitPoints = useMemo(() => mapPageHomeFitPoints(nearPlaces, anchorPoint), [nearPlaces, anchorPoint])
  const fitAllPoints = useMemo(() => mapPageFitAllPoints(nearPlaces, anchorPoint), [nearPlaces, anchorPoint])
  // The map opens on the home fit; Fit all widens to every near pin and stays wide (the Bid Board map's rule).
  const [fitAll, setFitAll] = useState(false)
  const [fitSignal, setFitSignal] = useState(0)
  const fitPoints = fitAll ? fitAllPoints : homeFitPoints
  const pins = useMemo(
    () => mapPagePlacePins(places, { builderFocus: !!builderFocusId, focusSection: focusSectionOf }),
    [places, builderFocusId, focusSectionOf],
  )
  const byKey = useMemo(() => new Map(places.map((p) => [p.key, p])), [places])
  const selected = selectedId ? (byKey.get(selectedId) ?? null) : null
  useEffect(() => {
    if (selectedId && !byKey.has(selectedId)) setSelectedId(null)
  }, [byKey, selectedId])
  const renderPopup = useCallback(
    (id: string) => {
      const place = byKey.get(id)
      return place ? <PlaceCard place={place} anchor={anchorPoint} compact isMobile={false} focusSection={focusSectionOf} onOpen={openEntity} onDirections={directionsTo} /> : null
    },
    [byKey, anchorPoint, focusSectionOf, openEntity, directionsTo],
  )
  const nearest = useMemo(() => mapPageNearest(places, anchorPoint), [places, anchorPoint])
  const totalsLine = useMemo(() => mapPageTotalsLine(places), [places])
  const courtCover = useMemo(() => courtCoverage(withCoords.map((e) => ({ label: e.tableLabel, lat: e.lat, lng: e.lng })), courtAreas), [withCoords, courtAreas])
  const emptyHint = useMemo(() => {
    if (places.length > 0) return null
    if (mapSearchTrim.length > 0) return visible.length > 0 ? 'No matches for this search.' : 'Every chip is off — tap one above to show its pins.'
    if (filterPoly) return 'No pins in the drawn area. Clear the draw or draw another.'
    if (visible.length === 0 && entities.length > 0) return 'Every chip is off — tap one above to show its pins.'
    if (placesAll.length > 0) return 'Every band is off — tap a box below to show its places.'
    return loading ? 'Loading…' : 'Nothing has a map location yet. Add addresses to jobs, bids and estimates.'
  }, [places.length, mapSearchTrim, visible.length, filterPoly, entities.length, placesAll.length, loading])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', rowGap: '0.6rem' }}>
        <h1 style={{ margin: 0, marginRight: '0.25rem', fontSize: '1.25rem' }}>Map</h1>
        {builderFocusId ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              padding: '0.3rem 0.6rem',
              background: 'var(--bg-subtle)',
              fontSize: '0.8125rem',
            }}
          >
            <span style={{ fontWeight: 600 }}>Bids for {builderFocusName ?? '…'}</span>
            <span style={{ color: '#16a34a', whiteSpace: 'nowrap' }}>● {builderFocusCounts.won} won</span>
            <span style={{ color: 'var(--text-red-600)', whiteSpace: 'nowrap' }}>● {builderFocusCounts.lost} lost</span>
            <span style={{ color: '#ca8a04', whiteSpace: 'nowrap' }}>● {builderFocusCounts.pending} pending</span>
            {builderFocusCounts.hitRatePct != null && (
              <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>· {builderFocusCounts.hitRatePct}% hit rate</span>
            )}
            <button
              type="button"
              onClick={clearBuilderFocus}
              title="Show the full map again"
              aria-label="Exit builder focus"
              style={{
                border: '1px solid var(--border-strong)',
                borderRadius: 6,
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0 0.4rem',
                fontSize: '0.875rem',
                lineHeight: 1.4,
              }}
            >
              ×
            </button>
          </span>
        ) : (
          <div role="group" aria-label="Job sections" style={chipRowStyle}>
            {JOBS_MAP_SECTIONS.map((key) => (
              <SectionChip
                key={key}
                label={JOBS_MAP_SECTION_LABEL[key]}
                color={JOBS_MAP_SECTION_COLOR[key]}
                count={legendCounts.jobs[key]}
                active={jobSections[key]}
                title={key === 'billed' && legendCounts.collections > 0 ? `Billed — ${legendCounts.collections} in Collections wear the red ring` : `${jobSections[key] ? 'Hide' : 'Show'} ${JOBS_MAP_SECTION_LABEL[key].toLowerCase()} jobs`}
                ring={key === 'billed' && legendCounts.collections > 0 ? JOBS_MAP_COLLECTIONS_RING_COLOR : null}
                onToggle={() => setJobSections((prev) => ({ ...prev, [key]: !prev[key] }))}
              />
            ))}
            <span aria-hidden="true" style={chipSepStyle} />
          </div>
        )}
        <div role="group" aria-label="Bid stages" style={chipRowStyle}>
          {BID_STAGE_META.map((m) => (
            <SectionChip
              key={m.key}
              label={m.label}
              color={BID_STAGE_MARKER_COLOR[m.key]}
              count={legendCounts.bids[m.key]}
              active={bidStages[m.key]}
              title={m.key === 'unsent' ? 'Unsent — a due ring is amber when due soon, red when overdue' : m.title}
              ring={m.key === 'unsent' ? BID_BOARD_MAP_DUE_RING_COLOR.soon : null}
              onToggle={() => setBidStages((prev) => ({ ...prev, [m.key]: !prev[m.key] }))}
            />
          ))}
        </div>
        {!builderFocusId && (
          <div role="group" aria-label="Estimates" style={chipRowStyle}>
            <span aria-hidden="true" style={chipSepStyle} />
            <SectionChip label="Estimates" color={MAP_PAGE_ESTIMATE_COLOR} count={legendCounts.estimates} active={showEst} title={showEst ? 'Hide estimates' : 'Show estimates'} onToggle={() => setShowEst((v) => !v)} />
          </div>
        )}
        <GeocodeProgressList rows={geocodeAddressRows} entities={entities} onAddressOpen={onGeocodeAddressOpen} />
        <div style={{ display: 'inline-flex', gap: '0.5rem', marginLeft: 'auto' }}>
          {canDrawCourtAreas ? (
            <button
              type="button"
              data-court-areas-toggle
              aria-pressed={courtMode}
              onClick={() => { setCourtMode((m) => !m); setCourtPending(null); setCourtClear((c) => c + 1) }}
              title={courtMode ? 'Back to the map' : 'Draw the justice precincts the office files in'}
              style={{ ...headerToolbarButtonStyle, ...(courtMode ? { background: 'var(--bg-blue-tint)', borderColor: 'var(--border-blue)' } : null) }}
            >
              Court areas{courtAreas.length ? ` · ${courtAreas.length}` : ''}
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleClustered}
            aria-pressed={clustered}
            title={clustered ? 'Draw every pin on its own' : 'Group pins that overlap at this zoom into count discs'}
            style={{ ...headerToolbarButtonStyle, fontWeight: clustered ? 700 : 500 }}
          >
            {clustered ? 'Clustered ✓' : 'Cluster'}
          </button>
          <button
            type="button"
            onClick={() => { setFitAll(true); setFitSignal((c) => c + 1) }}
            disabled={fitAllPoints.length === 0}
            title="Frame every pin and the office"
            style={{
              ...headerToolbarButtonStyle,
              opacity: fitAllPoints.length === 0 ? 0.45 : 1,
              cursor: fitAllPoints.length === 0 ? 'default' : 'pointer',
            }}
          >
            Fit all
          </button>
          <button
            type="button"
            onClick={() => setClearDraw((c) => c + 1)}
            disabled={!filterPoly}
            title={filterPoly ? 'Remove the drawn area filter' : 'Draw an area on the map to filter first'}
            style={{
              ...headerToolbarButtonStyle,
              opacity: filterPoly ? 1 : 0.45,
              cursor: filterPoly ? 'pointer' : 'default',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Clear draw
          </button>
          <button
            type="button"
            onClick={() => void reload()}
            disabled={loading}
            style={{
              ...headerToolbarButtonStyle,
              opacity: loading ? 0.45 : 1,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v5h-5" />
            </svg>
            {loading ? 'Reloading…' : 'Reload data'}
          </button>
        </div>
      </div>

      <MapGeocodeReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        entitiesWithCoords={withCoords}
        onAfterRefresh={() => void reload()}
      />

      {geocodeChooserMatches && geocodeChooserMatches.length > 0 ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            paddingTop: 'var(--app-top-chrome, 0px)',
          }}
          role="dialog"
          aria-modal
          aria-labelledby="geocode-chooser-title"
        >
          <div
            style={{
              background: 'var(--surface)',
              padding: '1.25rem',
              borderRadius: 8,
              minWidth: 280,
              maxWidth: 'min(96vw, 420px)',
              maxHeight: 'min(80vh, 400px, 100%)',
              overflow: 'auto',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}
          >
            <h2 id="geocode-chooser-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>
              Multiple records at this address
            </h2>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-600)' }}>Choose which to open.</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {geocodeChooserMatches.map((e) => (
                <li key={`${e.kind}-${e.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setGeocodeChooserMatches(null)
                      openEntity(e)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.65rem 0.25rem',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, marginRight: '0.35rem' }}>{e.kind}</span>
                    <span>{e.tableLabel}</span>
                    {e.sublabel ? <span style={{ color: 'var(--text-muted)' }}>{` ${e.sublabel}`}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setGeocodeChooserMatches(null)}
              style={{ marginTop: '0.75rem', padding: '0.5rem 0.9rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!loading && geocodeInProgress ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Resolving addresses…</p>
      ) : null}

      {error ? <p style={{ color: 'var(--text-red-700)', margin: 0 }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p> : null}

      <div
        style={narrow
          ? { display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: 0 }
          : { display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '0.75rem', alignItems: 'start', minWidth: 0 }}
      >
        {/* isolation contains Leaflet's internal z-indexes (panes 200-700, controls 1000) so they can't paint over header dropdowns */}
        <div style={{ position: 'relative', flex: '0 0 auto', minHeight: 360, minWidth: 0, border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', isolation: 'isolate' }}>
          <Suspense fallback={<div style={{ height: narrow ? 360 : 520 }} />}>
            <PinsMapCanvas
              pins={pins}
              selectedId={selectedId}
              onSelect={setSelectedId}
              renderPopup={renderPopup}
              fitSignal={fitSignal}
              height={narrow ? 360 : 520}
              isMobile={narrow}
              anchor={canvasAnchor}
              fitPoints={fitPoints}
              cluster={clustered}
              clusterRingPriority={MAP_PAGE_CLUSTER_RING_PRIORITY}
              clusterNoun="places"
              pulseId={narrow ? null : hoverKey}
              // The map sits above the table: the wheel scrolls the page until the map is clicked once
              scrollZoomAfterClick
              // Leaflet ignores a height change after mount — remount when the form flips
              key={narrow ? 'phone' : 'desktop'}
            >
              <MapFlyTo target={mapFlyTo} onConsumed={clearMapFlyTo} />
              <GeomanDraw onFilterPolygon={onFilterPolygon} clearSignal={clearDraw} paused={courtMode} />
              {courtMode || courtAreas.length ? <CourtAreasLayer areas={courtAreas} drawing={courtMode} onDrawn={onCourtDrawn} clearSignal={courtClear} /> : null}
            </PinsMapCanvas>
          </Suspense>
        </div>
        <MapPageRail
          selected={selected}
          anchor={anchorPoint}
          bands={bands}
          bandsOn={bandsOn}
          onToggleBand={toggleBand}
          nearest={nearest}
          onPickPlace={pickPlace}
          onHoverPlace={setHoverKey}
          focusSection={focusSectionOf}
          onOpen={openEntity}
          onDirections={directionsTo}
          search={mapSearchQuery}
          onSearch={setMapSearchQuery}
          totalsLine={totalsLine}
          emptyHint={emptyHint}
          isMobile={narrow}
        />
      </div>
      <div style={{ minWidth: 0, width: '100%' }}>
          {farPlaces.length > 0 ? (
            <div data-far-from-office style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-700)' }}>
              <div style={{ fontWeight: 600 }}>{farFromOfficeLine(farPlaces.length)}</div>
              <ul style={{ margin: '0.25rem 0 0', padding: '0 0 0 1.1rem' }}>
                {farPlaces.map((p) => (
                  <li key={p.addressKey}>
                    {`${p.addressLabel} · ${farPlaceCountWords(p.items)} · ${farMilesWords(p.miles)} `}
                    <button type="button" onClick={() => setMapFlyTo({ lat: p.lat, lng: p.lng })} style={openLinkLikeStyle}>
                      Show
                    </button>
                    {p.items.length === 1 ? (
                      <>
                        {' · '}
                        <button type="button" onClick={() => openEntity(p.items[0]!)} style={openLinkLikeStyle}>
                          Open
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {courtMode ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <CourtAreasPanel areas={courtAreas} coverage={courtCover} pending={courtPending !== null} busy={courtBusy} error={courtError} onSave={saveCourtArea} onCancelPending={discardCourtShape} onRename={renameCourtArea} onRemove={removeCourtArea} onFocus={focusCourtArea} onClassify={classifyNow} classifyWords={classifyWords} />
            </div>
          ) : null}
      </div>

      <details
        style={{
          position: 'fixed',
          zIndex: 300,
          right: 'max(1rem, env(safe-area-inset-right, 0px))',
          bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
          maxWidth: 'min(100vw - 2rem, 240px)',
          margin: 0,
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontSize: '0.875rem',
            padding: '0.35rem 0.6rem',
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            listStyle: 'none',
            userSelect: 'none',
          }}
          aria-label="Debug tools"
        >
          Debug
        </summary>
        <div
          style={{
            marginTop: 6,
            padding: '0.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: 'pointer', width: '100%' }}
          >
            Review geocodes
          </button>
        </div>
      </details>
    </div>
  )
}
