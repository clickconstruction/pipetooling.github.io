/**
 * The Schedule Dispatch hub's Jobs tab: one row per job (and, under them, per
 * bid visit) against the visible days, each cell the number of blocks that day.
 * It reads what the page hands it and owns only its search, its two filters
 * and its phone menu; opening a job goes back to the page.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ScheduleDispatchHubMergedRow } from '../../lib/scheduleDispatchHub'
import type { ScheduleDispatchHubBidMatrixRow } from '../../lib/scheduleBlockTitle'
import { formatMmDdSlash } from '../../utils/dateUtils'
import {
  scheduleDispatchDayColumnHeaderStyle,
  scheduleDispatchDayColumnJobsSummaryCellBg,
  useScrollScheduleDispatchColumnIntoView,
} from '../../lib/scheduleDispatchColumnFocus'
import { hubPeopleToolbarIconBtn } from '../../lib/scheduleDispatch/hubChromeStyle'
import { shortDowLabel } from '../../lib/scheduleDispatch/hubDayLabels'
import { filterHubJobsPanelBidRows, filterHubJobsPanelRows } from '../../lib/scheduleDispatch/hubPanels'
import { useIsMobile } from '../../hooks/useIsMobile'

/** Jobs-grid day header (v2.1362): weekday over date on two lines so columns stay narrow. */
function hubDayColumnHeaderStacked(dateKey: string) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.25 }}>
      <span>{shortDowLabel(dateKey)}</span>
      <span style={{ fontWeight: 400 }}>({formatMmDdSlash(dateKey)})</span>
    </span>
  )
}

export type HubJobsPanelProps = {
  rows: ScheduleDispatchHubMergedRow[]
  /** Bid visits with a block this week — rendered under the job rows (Tier-2 #22, J18-F7). */
  bidRows: ScheduleDispatchHubBidMatrixRow[]
  loading: boolean
  jobsError: string | null
  summariesError: string | null
  visibleDayKeys: string[]
  hideWeekend: boolean
  onHideWeekendChange: (hide: boolean) => void
  onOpenJob: (jobId: string) => void
  scheduleTodayYmd: string
  columnFocusDayYmd: string
  columnScrollKey: string
}

export function HubJobsPanel({
  rows,
  bidRows,
  loading,
  jobsError,
  summariesError,
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  onOpenJob,
  scheduleTodayYmd,
  columnFocusDayYmd,
  columnScrollKey,
}: HubJobsPanelProps) {
  const jobsScrollRef = useRef<HTMLDivElement>(null)
  useScrollScheduleDispatchColumnIntoView({
    columnFocusDayYmd,
    loading,
    scrollRootRef: jobsScrollRef,
    scrollKey: columnScrollKey,
  })

  const [search, setSearch] = useState('')
  const [onlyWithBlocks, setOnlyWithBlocks] = useState(true)
  // Phone (v2.1360): search behind a magnifier toggle; the two checkboxes move into a View menu.
  const jobsIsMobile = useIsMobile()
  const [mobileJobsSearchOpen, setMobileJobsSearchOpen] = useState(false)
  const [jobsViewMenuOpen, setJobsViewMenuOpen] = useState(false)
  const jobsViewMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!jobsViewMenuOpen) return
    const onDown = (e: globalThis.MouseEvent) => {
      if (jobsViewMenuRef.current && !jobsViewMenuRef.current.contains(e.target as Node)) setJobsViewMenuOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setJobsViewMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [jobsViewMenuOpen])

  const filteredRows = useMemo(
    () => filterHubJobsPanelRows(rows, search, onlyWithBlocks),
    [rows, search, onlyWithBlocks],
  )

  // Bid rows exist only because they have blocks, so the "only with blocks" filter is moot for them.
  const filteredBidRows = useMemo(() => filterHubJobsPanelBidRows(bidRows, search), [bidRows, search])

  return (
    <>
      {jobsError ? (
        <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{jobsError}</p>
      ) : null}
      {summariesError ? (
        <p style={{ color: 'var(--text-amber-800)', fontSize: '0.875rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
          Could not load schedule counts for this week ({summariesError}). Counts shown as 0.
        </p>
      ) : null}

      {jobsIsMobile ? (
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => setMobileJobsSearchOpen((o) => !o)}
              title="Search HCP or job name"
              aria-label="Search HCP or job name"
              aria-expanded={mobileJobsSearchOpen}
              style={{
                ...hubPeopleToolbarIconBtn,
                ...(mobileJobsSearchOpen || search.trim() !== ''
                  ? { borderColor: '#2563eb', background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)' }
                  : { borderColor: 'var(--border-strong)', color: 'var(--text-700)' }),
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14" fill="currentColor" aria-hidden="true" style={{ display: 'block' }}>
                <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4 457.4 502.6 330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z" />
              </svg>
            </button>
            <div ref={jobsViewMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={jobsViewMenuOpen}
                aria-label="View options: only jobs with blocks, hide weekend"
                onClick={() => setJobsViewMenuOpen((o) => !o)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 4,
                  background: jobsViewMenuOpen ? 'var(--bg-blue-tint)' : 'var(--surface)',
                  color: 'var(--text-700)',
                  cursor: 'pointer',
                }}
              >
                View
                <span aria-hidden style={{ fontSize: '0.65rem' }}>{jobsViewMenuOpen ? '▲' : '▼'}</span>
              </button>
              {jobsViewMenuOpen ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    zIndex: 60,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: '0.6rem 0.85rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 6,
                    boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={onlyWithBlocks} onChange={(e) => setOnlyWithBlocks(e.target.checked)} />
                    Only jobs with blocks this week
                  </label>
                  <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hideWeekend}
                      onChange={(e) => onHideWeekendChange(e.target.checked)}
                      aria-label="Hide Saturday and Sunday columns"
                    />
                    Hide weekend
                  </label>
                </div>
              ) : null}
            </div>
          </div>
          {mobileJobsSearchOpen ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem' }}>
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search HCP or job name"
                aria-label="Search HCP or job name"
                style={{ flex: 1, minWidth: 0, padding: '0.4rem 0.5rem', fontSize: '0.875rem', border: '1px solid var(--border-strong)', borderRadius: 4 }}
              />
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setMobileJobsSearchOpen(false)
                }}
                title="Clear search and close"
                aria-label="Clear search and close"
                style={{ ...hubPeopleToolbarIconBtn, borderColor: 'var(--border-strong)', color: 'var(--text-700)' }}
              >
                ×
              </button>
            </div>
          ) : null}
        </div>
      ) : (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search HCP or job name"
            aria-label="Search HCP or job name"
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', minWidth: 200 }}
          />
        </label>
        <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyWithBlocks} onChange={(e) => setOnlyWithBlocks(e.target.checked)} />
          Only jobs with blocks this week
        </label>
        <label style={{ fontSize: '0.8125rem', color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hideWeekend}
            onChange={(e) => onHideWeekendChange(e.target.checked)}
            aria-label="Hide Saturday and Sunday columns"
          />
          Hide weekend
        </label>
      </div>
      )}

      {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading…</p> : null}

      <div
        ref={jobsScrollRef}
        style={{
          overflowX: 'auto',
          marginLeft: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
          marginRight: 'calc(-1 * (var(--app-main-pad) + 1.25rem))',
        }}
      >
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-muted)',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                }}
              >
                Job
              </th>
              <th
                style={{
                  textAlign: 'center',
                  padding: '0.5rem',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                Total
              </th>
              {visibleDayKeys.map((dk) => (
                <th
                  key={dk}
                  data-schedule-column-day={dk}
                  style={{
                    textAlign: 'center',
                    padding: '0.35rem',
                    border: '1px solid var(--border)',
                    ...scheduleDispatchDayColumnHeaderStyle(dk, { scheduleTodayYmd, columnFocusDayYmd }, 'var(--bg-muted)'),
                    fontSize: '0.75rem',
                    minWidth: 60,
                  }}
                  title={dk}
                >
                  {hubDayColumnHeaderStacked(dk)}
                </th>
              ))}
              <th style={{ padding: '0.5rem', border: '1px solid var(--border)', background: 'var(--bg-muted)' }} aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && filteredBidRows.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={2 + visibleDayKeys.length + 1}
                  style={{ padding: '1rem', border: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'center' }}
                >
                  {rows.length === 0 && bidRows.length === 0 && !jobsError
                    ? 'No jobs to show.'
                    : 'No jobs match your search or filter.'}
                </td>
              </tr>
            ) : (
              <>
              {filteredRows.map((r) => (
                <tr key={r.id}>
                  <td
                    style={{
                      padding: '0.5rem',
                      border: '1px solid var(--border)',
                      position: 'sticky',
                      left: 0,
                      background: 'var(--surface)',
                      zIndex: 1,
                      minWidth: 130,
                      maxWidth: 280,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenJob(r.id)}
                      title={r.displayTitle}
                      style={{
                        padding: 0,
                        margin: 0,
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-blue-700)',
                        cursor: 'pointer',
                        font: 'inherit',
                        textAlign: 'left',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {r.displayTitle}
                    </button>
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid var(--border)', fontWeight: 600 }}>
                    {r.totalBlocks}
                  </td>
                  {visibleDayKeys.map((dk) => (
                    <td
                      key={dk}
                      style={{
                        textAlign: 'center',
                        padding: '0.35rem',
                        border: '1px solid var(--border)',
                        color: 'var(--text-600)',
                        background: scheduleDispatchDayColumnJobsSummaryCellBg(dk, {
                          scheduleTodayYmd,
                          columnFocusDayYmd,
                        }),
                      }}
                    >
                      {r.byDay[dk] ?? '—'}
                    </td>
                  ))}
                  <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onOpenJob(r.id)}
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBidRows.map((r) => (
                <tr key={r.id}>
                  <td
                    style={{
                      padding: '0.5rem',
                      border: '1px solid var(--border)',
                      position: 'sticky',
                      left: 0,
                      background: 'var(--bg-violet-100)',
                      zIndex: 1,
                      minWidth: 130,
                      maxWidth: 280,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenJob(r.id)}
                      title={`${r.displayTitle} — opens the bid`}
                      style={{
                        padding: 0,
                        margin: 0,
                        border: 'none',
                        background: 'none',
                        color: 'var(--text-violet-800)',
                        cursor: 'pointer',
                        font: 'inherit',
                        textAlign: 'left',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {r.displayTitle}
                    </button>
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid var(--border)', fontWeight: 600 }}>
                    {r.totalBlocks}
                  </td>
                  {visibleDayKeys.map((dk) => (
                    <td
                      key={dk}
                      style={{
                        textAlign: 'center',
                        padding: '0.35rem',
                        border: '1px solid var(--border)',
                        color: 'var(--text-600)',
                        background: scheduleDispatchDayColumnJobsSummaryCellBg(dk, {
                          scheduleTodayYmd,
                          columnFocusDayYmd,
                        }),
                      }}
                    >
                      {r.byDay[dk] ?? '—'}
                    </td>
                  ))}
                  <td style={{ padding: '0.5rem', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onOpenJob(r.id)}
                      title="Open the bid (Edit Bid)"
                      style={{
                        padding: '0.3rem 0.65rem',
                        fontSize: '0.75rem',
                        background: '#7c3aed',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
