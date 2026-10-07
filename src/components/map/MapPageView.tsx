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
import { useMapPageData, type MapPageEntity } from '../../hooks/useMapPageData'
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
import { classifyCourtPoint, courtClassificationWords, type CourtAreaPolygon } from '../../lib/legal/courtAreas'
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
import { farFromOfficePlaces, mapPageFitAllPoints, mapPageHomeFitPoints, splitFarFromOffice } from '../../lib/map/mapPageFirstView'
import { farShortLine, mapPageNotFound, unplacedLine } from '../../lib/map/mapPageUnplaced'
import { MapAddressSheet, type OpenableRecord } from './MapAddressSheet'

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
  /** The placed records the chip stands for; omitted while unknown. */
  count?: number
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
      {count != null ? <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{count}</span> : null}
    </button>
  )
}

/** The precincts layer's chip — the tint the layer uses for its first county. */
const MAP_PAGE_PRECINCT_COLOR = '#0ea5e9'

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

export function MapPageView() {
  const navigate = useNavigate()
  const { loading, error, entities, geocodeAddressRows, geocodeInProgress, unplaced, reload } = useMapPageData(true)
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
  // The place the office clicked (v2.4796; places v2.4804): its popup on a desktop, the card in the rail.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [bandsOn, setBandsOn] = useState<DistanceBucketVisibility>(DEFAULT_DISTANCE_BUCKETS)
  const toggleBand = useCallback((key: DistanceBucketKey) => setBandsOn((prev) => ({ ...prev, [key]: !prev[key] })), [])
  const openEntity = useCallback(
    (e: OpenableRecord) => {
      if (e.kind === 'job' && jobFormModal) {
        openJobOnMap(e.id)
      } else {
        navigate(e.linkTo)
      }
      if (e.lat != null && e.lng != null) {
        setMapFlyTo({ lat: e.lat, lng: e.lng })
        setSelectedId(e.addressKey ?? null)
      }
    },
    [jobFormModal, navigate, openJobOnMap]
  )
  const directionsTo = useCallback((place: { addressLabel: string }) => openInExternalBrowser(mapPageDirectionsUrl(place.addressLabel)), [])
  const pickPlace = useCallback((place: MapPagePlaceOfEntity) => {
    setSelectedId(place.key)
    setMapFlyTo({ lat: place.lat, lng: place.lng })
  }, [])
  const [reviewOpen, setReviewOpen] = useState(false)
  // The address sheet (v2.4805): the records the map cannot place and the far ones, in one window.
  const [sheetOpen, setSheetOpen] = useState(false)
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
  // Precincts as a layer (v2.4807): the court areas drawn for anyone on the page, without the mode.
  const [precinctsOn, setPrecinctsOn] = useState(false)
  const [courtAreas, setCourtAreas] = useState<CourtAreaListed[]>([])
  const [courtAreasLoaded, setCourtAreasLoaded] = useState(false)
  const [courtPending, setCourtPending] = useState<CourtAreaPolygon | null>(null)
  const [courtClear, setCourtClear] = useState(0)
  const [courtBusy, setCourtBusy] = useState(false)
  const [courtError, setCourtError] = useState<string | null>(null)
  const courtDb = supabase as unknown as SupabaseClient
  const reloadCourtAreas = useCallback(async () => {
    try {
      setCourtAreas(await listCourtAreas(courtDb))
      setCourtAreasLoaded(true)
      setCourtError(null)
    } catch (e) {
      setCourtError(formatErrorMessage(e, 'Could not load the court areas.'))
    }
  }, [courtDb])
  useEffect(() => {
    if (courtMode || precinctsOn) void reloadCourtAreas()
  }, [courtMode, precinctsOn, reloadCourtAreas])
  const precinctsShown = courtMode || precinctsOn
  // The place card's county and precinct, from the layer when it is on screen (v2.4807).
  const precinctWords = useCallback(
    (place: { lat: number; lng: number }) => (precinctsShown && courtAreasLoaded ? courtClassificationWords(classifyCourtPoint(place, courtAreas)) : null),
    [precinctsShown, courtAreasLoaded, courtAreas],
  )
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
  // The misses (v2.4805): over every entity, not the chips' selection — a record the map cannot place is a miss whatever is on.
  const notFoundInfo = useMemo(() => mapPageNotFound(entities, geocodeAddressRows), [entities, geocodeAddressRows])
  const missLine = useMemo(
    () => unplacedLine({ noAddress: unplaced.length, notFoundRecords: notFoundInfo.notFound.reduce((n, g) => n + g.items.length, 0), resolving: notFoundInfo.resolving }),
    [unplaced.length, notFoundInfo],
  )
  // The far addresses for the sheet and its line are over every placed record, whatever the chips show.
  const farAllPlaces = useMemo(() => {
    const all = entities.filter((e) => e.lat != null && e.lng != null).map((e) => ({ ...e, lat: e.lat!, lng: e.lng! }))
    return farFromOfficePlaces(splitFarFromOffice(all, anchorPoint).far)
  }, [entities, anchorPoint])
  const farLine = useMemo(() => farShortLine(farAllPlaces.length), [farAllPlaces.length])
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
      return place ? <PlaceCard place={place} anchor={anchorPoint} compact isMobile={false} focusSection={focusSectionOf} onOpen={openEntity} onDirections={directionsTo} precinctWords={precinctWords} /> : null
    },
    [byKey, anchorPoint, focusSectionOf, openEntity, directionsTo, precinctWords],
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
            <SectionChip
              label="Precincts"
              color={MAP_PAGE_PRECINCT_COLOR}
              count={courtAreasLoaded ? courtAreas.length : undefined}
              active={precinctsShown}
              title={precinctsShown ? 'Hide the justice precincts' : 'Draw the justice precincts the office filed — a place card then names its county and precinct'}
              onToggle={() => setPrecinctsOn((v) => !v)}
            />
          </div>
        )}
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

      <MapAddressSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        noAddress={unplaced}
        notFound={notFoundInfo.notFound}
        resolving={notFoundInfo.resolving}
        far={farAllPlaces}
        anchor={anchorPoint}
        canRecheck={canDrawCourtAreas}
        onOpen={(r) => { setSheetOpen(false); openEntity(r) }}
        onShow={(lat, lng) => { setSheetOpen(false); setMapFlyTo({ lat, lng }) }}
        onAfterRecheck={() => void reload()}
        onReviewAll={() => { setSheetOpen(false); setReviewOpen(true) }}
      />
      <MapGeocodeReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        entitiesWithCoords={withCoords}
        onAfterRefresh={() => void reload()}
      />

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
              {precinctsShown ? <CourtAreasLayer areas={courtAreas} drawing={courtMode} onDrawn={onCourtDrawn} clearSignal={courtClear} /> : null}
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
          precinctWords={precinctWords}
          search={mapSearchQuery}
          onSearch={setMapSearchQuery}
          totalsLine={totalsLine}
          emptyHint={emptyHint}
          isMobile={narrow}
        />
      </div>
      <div style={{ minWidth: 0, width: '100%' }}>
          {missLine || farLine ? (
            <div data-map-misses style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: 'var(--text-700)', display: 'flex', flexWrap: 'wrap', gap: '0.35rem 0.5rem', alignItems: 'baseline' }}>
              {missLine ? (
                geocodeInProgress ? (
                  <span style={{ color: 'var(--text-muted)' }}>{missLine}</span>
                ) : (
                  <button type="button" onClick={() => setSheetOpen(true)} style={openLinkLikeStyle}>
                    {`${missLine} · fix their addresses`}
                  </button>
                )
              ) : null}
              {missLine && farLine ? <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>·</span> : null}
              {farLine ? (
                <button type="button" onClick={() => setSheetOpen(true)} style={openLinkLikeStyle}>
                  {`${farLine} · check them`}
                </button>
              ) : null}
            </div>
          ) : null}
          {courtMode ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <CourtAreasPanel areas={courtAreas} coverage={courtCover} pending={courtPending !== null} busy={courtBusy} error={courtError} onSave={saveCourtArea} onCancelPending={discardCourtShape} onRename={renameCourtArea} onRemove={removeCourtArea} onFocus={focusCourtArea} onClassify={classifyNow} classifyWords={classifyWords} />
            </div>
          ) : null}
      </div>

    </div>
  )
}
