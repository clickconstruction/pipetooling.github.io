/**
 * Dashboard "Your jobs on a map" card (v2.3131) — every role.
 *
 * Plots the viewer's active jobs: team-assigned jobs (the Assigned Jobs rows)
 * plus, for a superintendent, the jobs on their assigned projects. Mounts
 * above the Assigned Jobs section; renders nothing when there is no job to
 * show. It draws in the shared `PinsMapFrame` (punch list #395), which loads its
 * canvases lazily so the Dashboard bundle stays map-free, and holds the Google /
 * OpenStreetMap rule, the Satellite and Streets switch and the Time press;
 * coordinates come from `useDashboardJobsMapPins`.
 *
 * Interactions: a pin opens the same read-only / tabbed job window the job
 * rows open (`openJobDetailFromDashboardJobRow`); Directions is the rows'
 * Google Maps link via `openInExternalBrowser`.
 *
 * The head folds the card (v2.8330), as Assigned Jobs and the other sections fold: a triangle and the title as
 * one press, the whole head on a phone, kept per device under the key Hide map wrote. The map opens on the
 * office view (`lib/map/officeView.ts`): centred on the office, about a hundred miles to the frame's nearer
 * edge, where it used to fit every pin and let one far job shrink the rest. A job the view leaves out is named
 * in a line under the map, **Fit all** shows every pin and **Office view** comes back. With no office on record
 * the map fits its pins as it did.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOfficeAnchorState } from '../../hooks/useOfficeAnchor'
import type { UserRole } from '../../hooks/useAuth'
import { useDashboardJobsMapPins } from '../../hooks/useDashboardJobsMapPins'
import {
  DASHBOARD_JOBS_MAP_STATUS_COLOR,
  dashboardJobsMapCanvasPins,
  dashboardJobsMapDetailLine,
  dashboardJobsMapDirectionsUrl,
  dashboardJobsMapLegend,
  dashboardJobsMapUnmappedLine,
  readDashboardJobsMapHidden,
  writeDashboardJobsMapHidden,
  type DashboardJobsMapJob,
  type DashboardJobsMapPin,
} from '../../lib/dashboardJobsMap'
import type { DashboardTeamAssignedJobRow } from '../../lib/dashboardTeamAssignedJobRow'
import { MAP_TIME_PINS_WORDS } from '../../lib/map/mapTime'
import { OFFICE_VIEW_BACK, OFFICE_VIEW_SHOW_ALL, countOutsideOfficeView, officeView, officeViewLine, type OfficeViewMode } from '../../lib/map/officeView'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { EmptyState } from '../EmptyState'
import { PinsMapFrame } from '../map/PinsMapFrame'
import { ValueSentence } from '../valuesInPlace/ValuesInPlace'
import { DashboardJobsMapPopupBody } from './DashboardJobsMapPopupBody'
import { DashboardListRowSkeleton } from './DashboardSkeletons'
import { DashboardCardHead, DashboardCardTitle } from './DashboardCardTitle'

const OUTLINE_BUTTON_STYLE: React.CSSProperties = {
  padding: '0.35rem 0.75rem',
  fontSize: '0.875rem',
  background: 'none',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const LINK_BUTTON_STYLE: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  fontSize: '0.875rem',
  color: 'var(--text-link)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const MOBILE_ACTION_STYLE: React.CSSProperties = {
  flex: 1,
  minHeight: 44,
  padding: '0.4rem 0.5rem',
  fontSize: '0.9375rem',
  fontWeight: 600,
  background: 'var(--surface)',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

function PinGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.25" />
    </svg>
  )
}

export function DashboardJobsMapCard({
  role,
  assignedJobs,
  superintendentJobs,
  loading,
  isMobile,
  openJobDetailFromDashboardJobRow,
}: {
  role: UserRole | null
  assignedJobs: DashboardTeamAssignedJobRow[]
  superintendentJobs: DashboardTeamAssignedJobRow[]
  loading: boolean
  isMobile: boolean
  openJobDetailFromDashboardJobRow: (j: DashboardTeamAssignedJobRow) => void
}) {
  const [hidden, setHidden] = useState<boolean>(() => readDashboardJobsMapHidden())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fitSignal, setFitSignal] = useState(0)
  // What the map shows: the office view each time the card opens, every pin once Fit all is pressed. A visit's state.
  const [viewMode, setViewMode] = useState<OfficeViewMode>('office')
  const { pins, unmapped, noAddress, resolving, total } = useDashboardJobsMapPins(assignedJobs, superintendentJobs, !hidden)
  const office = useOfficeAnchorState(!hidden)
  // The map's box arrives after the pins and the office do, so its width is read off the node itself when it mounts.
  const [mapBox, setMapBox] = useState<HTMLDivElement | null>(null)
  const [mapWidth, setMapWidth] = useState<number | null>(null)
  useEffect(() => {
    if (!mapBox) return
    const read = () => setMapWidth(mapBox.getBoundingClientRect().width || null)
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(mapBox)
    return () => ro.disconnect()
  }, [mapBox])
  const mapHeight = isMobile ? 260 : 360
  const officeLat = office.anchor?.lat ?? null
  const officeLng = office.anchor?.lng ?? null
  const view = useMemo(() => (officeLat == null || officeLng == null ? null : officeView({ lat: officeLat, lng: officeLng }, { width: mapWidth, height: mapHeight })), [officeLat, officeLng, mapWidth, mapHeight])
  const outside = useMemo(() => countOutsideOfficeView(pins, view), [pins, view])

  const legend = useMemo(() => dashboardJobsMapLegend(pins), [pins])
  const selected = useMemo(() => pins.find((p) => p.id === selectedId) ?? null, [pins, selectedId])
  useEffect(() => {
    if (selectedId && !pins.some((p) => p.id === selectedId)) setSelectedId(null)
  }, [pins, selectedId])

  const toggleHidden = useCallback(() => {
    setHidden((h) => {
      writeDashboardJobsMapHidden(!h)
      return !h
    })
    // A card opened again opens on the office view.
    setViewMode('office')
  }, [])
  // One press, two ways: every pin, or back to the office. The bump re-fits a map the person has dragged.
  const switchView = useCallback(() => {
    setViewMode((m) => (m === 'office' ? 'all' : 'office'))
    setFitSignal((n) => n + 1)
  }, [])
  const openJob = useCallback((p: DashboardJobsMapPin | DashboardJobsMapJob) => openJobDetailFromDashboardJobRow(p.row), [openJobDetailFromDashboardJobRow])
  const directions = useCallback((p: DashboardJobsMapPin | DashboardJobsMapJob) => openInExternalBrowser(dashboardJobsMapDirectionsUrl(p.address)), [])
  // Job pins as the shared canvas draws them, in the Jobs status colors, and the popup body for one.
  const canvasPins = useMemo(() => dashboardJobsMapCanvasPins(pins), [pins])
  const renderPopup = useCallback(
    (id: string) => {
      const p = pins.find((x) => x.id === id)
      return p ? <DashboardJobsMapPopupBody pin={p} onOpenJob={openJob} onDirections={directions} /> : null
    },
    [pins, openJob, directions],
  )

  if (role == null) return null
  if (!loading && total === 0) return null

  const unmappedAll = [...unmapped, ...noAddress]
  const unmappedLine = dashboardJobsMapUnmappedLine(unmappedAll.length)
  // With no office to centre on the map fits its pins, as it did, and Fit all is a plain re-fit.
  const onOfficeView = view != null && viewMode === 'office'
  const viewLine = view ? officeViewLine({ mode: viewMode, outside }) : null
  const viewPress = view ? (viewMode === 'office' ? OFFICE_VIEW_SHOW_ALL : OFFICE_VIEW_BACK) : OFFICE_VIEW_SHOW_ALL
  const pressView = view ? switchView : () => setFitSignal((n) => n + 1)
  // The press earns its place when there is more than one pin to fit, or a view to come back to.
  const showViewPress = !hidden && pins.length > 0 && (view ? pins.length > 1 || outside > 0 || viewMode === 'all' : pins.length > 1)

  return (
    <section
      aria-label="Your jobs on a map"
      style={{
        border: '1px solid var(--border)',
        borderRadius: isMobile ? 12 : 8,
        background: 'var(--surface)',
        padding: isMobile ? '0.75rem' : '1rem',
        marginTop: '2rem',
        marginBottom: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '0.625rem' : '0.75rem',
      }}
    >
      <DashboardCardHead
        card={{ top: isMobile ? '0.75rem' : '1rem', side: isMobile ? '0.75rem' : '1rem', radius: isMobile ? 12 : 8 }}
        below="0"
        closed={hidden}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
      >
        {/* The fold (v2.8330): the triangle and the title are one press, as on Assigned Jobs. On a phone it fills the head, so a touch anywhere on it folds the card. */}
        <button
          type="button"
          data-jobs-map-fold=""
          onClick={toggleHidden}
          aria-expanded={!hidden}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flex: isMobile ? '1 1 100%' : '0 1 auto',
            minWidth: 0,
            minHeight: isMobile ? 44 : undefined,
            padding: 0,
            border: 'none',
            background: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          <span aria-hidden style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {hidden ? '▶' : '▼'}
          </span>
          <PinGlyph />
          <DashboardCardTitle>Your jobs on a map</DashboardCardTitle>
        </button>
        {/* The head's own presses sit beside the fold, never inside it: a press on Fit all leaves the card open. */}
        {!isMobile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
            {legend.length > 0 ? <Legend legend={legend} /> : null}
            {showViewPress ? (
              <button type="button" data-jobs-map-view-press="" onClick={pressView} style={OUTLINE_BUTTON_STYLE}>
                {viewPress}
              </button>
            ) : null}
          </div>
        ) : null}
      </DashboardCardHead>

      {hidden ? null : (
        <>
          {/* A phone's head is the fold alone, so the counts and the view press share the line under it. */}
          {isMobile && (legend.length > 0 || showViewPress) ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              {legend.length > 0 ? <Legend legend={legend} /> : <span />}
              {showViewPress && office.settled ? (
                <button type="button" data-jobs-map-view-press="" onClick={pressView} style={{ ...MOBILE_ACTION_STYLE, flex: '0 0 auto', padding: '0.4rem 0.9rem' }}>
                  {viewPress}
                </button>
              ) : null}
            </div>
          ) : null}

          {loading && pins.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : pins.length > 0 && !office.settled ? (
            // The first view depends on the office, so the map waits for it: one view, never two.
            <div ref={setMapBox} style={{ position: 'relative', height: mapHeight, borderRadius: isMobile ? 10 : 6, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-muted)' }} />
          ) : pins.length > 0 ? (
            <div ref={setMapBox} data-jobs-map-view={onOfficeView ? 'office' : 'all'} style={{ minWidth: 0 }}>
            <PinsMapFrame
              surface="dashboard-jobs-map"
              style={{ borderRadius: isMobile ? 10 : 6, overflow: 'hidden', border: '1px solid var(--border)' }}
              pins={canvasPins}
              selectedId={selectedId}
              onSelect={setSelectedId}
              renderPopup={renderPopup}
              fitSignal={fitSignal}
              // The office view is the canvases' own fit override: the box they land on its zoom for. Every pin still draws.
              fitPoints={view && viewMode === 'office' ? view.fitPoints : null}
              height={mapHeight}
              isMobile={isMobile}
              timeDotsWords={MAP_TIME_PINS_WORDS}
              // The card sits in the Dashboard's scroll: the wheel scrolls the page until the map is clicked
              scrollZoomAfterClick
            />
            </div>
          ) : (
            <div style={{ position: 'relative', height: mapHeight, borderRadius: isMobile ? 10 : 6, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                {resolving ? 'Finding your jobs on the map…' : <EmptyState compact main="None of your jobs has a map location yet." />}
              </div>
            </div>
          )}

          {isMobile && selected ? (
            <div style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 10, padding: '0.625rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.9375rem' }}>{selected.label}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: 2 }}>{selected.address}</div>
                  {dashboardJobsMapDetailLine(selected) ? <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{dashboardJobsMapDetailLine(selected)}</div> : null}
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: DASHBOARD_JOBS_MAP_STATUS_COLOR[selected.status],
                    background: 'var(--surface)',
                    border: `1px solid ${DASHBOARD_JOBS_MAP_STATUS_COLOR[selected.status]}`,
                    borderRadius: 999,
                    padding: '2px 8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selected.status === 'working' ? 'Working' : 'Waiting'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => openJob(selected)} style={MOBILE_ACTION_STYLE}>
                  Open job
                </button>
                <button type="button" onClick={() => directions(selected)} style={MOBILE_ACTION_STYLE}>
                  Directions
                </button>
              </div>
            </div>
          ) : null}

          {/* A job the office view leaves out is named here, with the press that shows it, so none is lost. */}
          {pins.length > 0 && office.settled && viewLine ? (
            <div data-jobs-map-view-line="" style={{ fontSize: '0.875rem', color: 'var(--text-base)' }}>
              <ValueSentence text={viewLine} />
              {viewMode === 'office' ? <span> {OFFICE_VIEW_SHOW_ALL} shows every job.</span> : null}
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap', fontSize: isMobile ? '0.8125rem' : '0.875rem', color: 'var(--text-muted)' }}>
            {!isMobile ? <span>Tap a pin to open the job. Only jobs you're assigned to.</span> : null}
            {unmappedLine ? (
              <span>
                {unmappedLine}
                {unmappedAll.length <= 3
                  ? unmappedAll.map((j) => (
                      <span key={j.id}>
                        {' · '}
                        <button type="button" onClick={() => openJob(j)} style={LINK_BUTTON_STYLE}>
                          {j.label}
                        </button>
                      </span>
                    ))
                  : null}
              </span>
            ) : resolving && pins.length > 0 ? (
              <span>Placing the rest…</span>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}

function Legend({ legend }: { legend: { status: 'working' | 'waiting'; count: number }[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-base)' }}>
      {legend.map((l) => (
        <span key={l.status} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: DASHBOARD_JOBS_MAP_STATUS_COLOR[l.status], display: 'inline-block' }} />
          {l.count} {l.status}
        </span>
      ))}
    </div>
  )
}
