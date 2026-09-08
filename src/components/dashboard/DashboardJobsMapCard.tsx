/**
 * Dashboard "Your jobs on a map" card (v2.3131) — every role.
 *
 * Plots the viewer's active jobs: team-assigned jobs (the Assigned Jobs rows)
 * plus, for a superintendent, the jobs on their assigned projects. Mounts
 * above the Assigned Jobs section; renders nothing when there is no job to
 * show. The Leaflet canvas is lazy (`DashboardJobsMapCanvas`) so the Dashboard
 * bundle stays map-free; coordinates come from `useDashboardJobsMapPins`.
 *
 * Interactions: a pin opens the same read-only / tabbed job window the job
 * rows open (`openJobDetailFromDashboardJobRow`); Directions is the rows'
 * Google Maps link via `openInExternalBrowser`; Hide map is a per-device
 * preference; Fit all re-centers on every pin.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { UserRole } from '../../hooks/useAuth'
import { useDashboardJobsMapPins } from '../../hooks/useDashboardJobsMapPins'
import {
  DASHBOARD_JOBS_MAP_STATUS_COLOR,
  dashboardJobsMapDetailLine,
  dashboardJobsMapDirectionsUrl,
  dashboardJobsMapLegend,
  dashboardJobsMapUnmappedLine,
  googleMapsBrowserKey,
  readDashboardJobsMapHidden,
  resolveDashboardMapProvider,
  writeDashboardJobsMapHidden,
  type DashboardJobsMapJob,
  type DashboardJobsMapPin,
} from '../../lib/dashboardJobsMap'
import type { DashboardTeamAssignedJobRow } from '../../lib/dashboardTeamAssignedJobRow'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { DashboardListRowSkeleton } from './DashboardSkeletons'

const DashboardJobsMapCanvas = lazy(() => import('./DashboardJobsMapCanvas'))
const DashboardJobsMapGoogleCanvas = lazy(() => import('./DashboardJobsMapGoogleCanvas'))

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
  // v2.3145: Google Maps when a browser key is configured and the API loads; OpenStreetMap
  // otherwise. A failure is sticky for this page so a bad key never flickers.
  const [googleFailed, setGoogleFailed] = useState(false)
  const provider = resolveDashboardMapProvider({ key: googleMapsBrowserKey(), googleFailed })
  const googleUnavailable = useCallback((reason: string) => {
    console.warn(`[jobs map] Google Maps unavailable, using OpenStreetMap — ${reason}`)
    setGoogleFailed(true)
  }, [])
  const { pins, unmapped, noAddress, resolving, total } = useDashboardJobsMapPins(assignedJobs, superintendentJobs, !hidden)

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
  }, [])
  const openJob = useCallback((p: DashboardJobsMapPin | DashboardJobsMapJob) => openJobDetailFromDashboardJobRow(p.row), [openJobDetailFromDashboardJobRow])
  const directions = useCallback((p: DashboardJobsMapPin | DashboardJobsMapJob) => openInExternalBrowser(dashboardJobsMapDirectionsUrl(p.address)), [])

  if (role == null) return null
  if (!loading && total === 0) return null

  const unmappedAll = [...unmapped, ...noAddress]
  const unmappedLine = dashboardJobsMapUnmappedLine(unmappedAll.length)
  const mapHeight = isMobile ? 260 : 360

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--text-muted)' }}>
          <PinGlyph />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Your jobs on a map</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.875rem', flexWrap: 'wrap' }}>
          {!isMobile && legend.length > 0 ? <Legend legend={legend} /> : null}
          {!hidden && pins.length > 1 && !isMobile ? (
            <button type="button" onClick={() => setFitSignal((n) => n + 1)} style={OUTLINE_BUTTON_STYLE}>
              Fit all
            </button>
          ) : null}
          <button type="button" onClick={toggleHidden} aria-expanded={!hidden} style={{ ...LINK_BUTTON_STYLE, minHeight: isMobile ? 44 : undefined }}>
            {hidden ? 'Show map' : isMobile ? 'Hide' : 'Hide map'}
          </button>
        </div>
      </div>

      {hidden ? null : (
        <>
          {isMobile && legend.length > 0 ? <Legend legend={legend} /> : null}

          {loading && pins.length === 0 ? (
            <DashboardListRowSkeleton rows={2} />
          ) : (
            <div
              // isolation contains Leaflet's internal z-indexes (panes 200–700, controls 1000) so they can't paint over header dropdowns
              style={{ position: 'relative', height: mapHeight, borderRadius: isMobile ? 10 : 6, overflow: 'hidden', border: '1px solid var(--border)', isolation: 'isolate', background: 'var(--bg-muted)' }}
            >
              {pins.length > 0 ? (
                <Suspense fallback={<div style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading map…</div>}>
                  {provider === 'google' ? (
                    <DashboardJobsMapGoogleCanvas
                      apiKey={googleMapsBrowserKey()}
                      onUnavailable={googleUnavailable}
                      pins={pins}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onOpenJob={openJob}
                      onDirections={directions}
                      fitSignal={fitSignal}
                      height={mapHeight}
                      isMobile={isMobile}
                    />
                  ) : (
                    <DashboardJobsMapCanvas
                      pins={pins}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      onOpenJob={openJob}
                      onDirections={directions}
                      fitSignal={fitSignal}
                      height={mapHeight}
                      isMobile={isMobile}
                    />
                  )}
                </Suspense>
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {resolving ? 'Finding your jobs on the map…' : 'None of your jobs has a map location yet.'}
                </div>
              )}
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
