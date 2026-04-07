import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { scheduleFormatWindow } from '../../lib/jobScheduleChicago'
import { hubPersonDayKey, type ScheduleDispatchHubJobRow } from '../../lib/scheduleDispatchHub'
import { APP_CALENDAR_TZ, formatMmDdSlash, referenceDateForWorkDateYmd } from '../../utils/dateUtils'
import { ScheduleDispatchWeekNav } from './ScheduleDispatchWeekNav'

export type ScheduleDispatchHubMergedRow = ScheduleDispatchHubJobRow & {
  displayTitle: string
  totalBlocks: number
  byDay: Record<string, number>
}

function shortDowLabel(dateKey: string): string {
  const d = referenceDateForWorkDateYmd(dateKey)
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: APP_CALENDAR_TZ }).format(d)
}

function hubDayColumnHeaderLabel(dateKey: string): string {
  return `${shortDowLabel(dateKey)} (${formatMmDdSlash(dateKey)})`
}

type HubJobsPanelProps = {
  rows: ScheduleDispatchHubMergedRow[]
  loading: boolean
  jobsError: string | null
  summariesError: string | null
  visibleDayKeys: string[]
  hideWeekend: boolean
  onHideWeekendChange: (hide: boolean) => void
  onOpenJob: (jobId: string) => void
}

function HubJobsPanel({
  rows,
  loading,
  jobsError,
  summariesError,
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  onOpenJob,
}: HubJobsPanelProps) {
  const [search, setSearch] = useState('')
  const [onlyWithBlocks, setOnlyWithBlocks] = useState(true)

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows
    if (q) {
      list = list.filter(
        (r) =>
          (r.hcp_number ?? '').toLowerCase().includes(q) ||
          (r.job_name ?? '').toLowerCase().includes(q) ||
          r.displayTitle.toLowerCase().includes(q),
      )
    }
    if (onlyWithBlocks) {
      list = list.filter((r) => r.totalBlocks > 0)
    }
    return list
  }, [rows, search, onlyWithBlocks])

  return (
    <>
      {jobsError ? (
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{jobsError}</p>
      ) : null}
      {summariesError ? (
        <p style={{ color: '#92400e', fontSize: '0.875rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
          Could not load schedule counts for this week ({summariesError}). Counts shown as 0.
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search HCP or job name"
            aria-label="Search HCP or job name"
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', minWidth: 200 }}
          />
        </label>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={onlyWithBlocks} onChange={(e) => setOnlyWithBlocks(e.target.checked)} />
          Only jobs with blocks this week
        </label>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hideWeekend}
            onChange={(e) => onHideWeekendChange(e.target.checked)}
            aria-label="Hide Saturday and Sunday columns"
          />
          Hide weekend
        </label>
      </div>

      {loading ? <p style={{ color: '#6b7280' }}>Loading…</p> : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  border: '1px solid #e5e7eb',
                  background: '#f3f4f6',
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
                  border: '1px solid #e5e7eb',
                  background: '#f3f4f6',
                  whiteSpace: 'nowrap',
                }}
              >
                Total
              </th>
              {visibleDayKeys.map((dk) => (
                <th
                  key={dk}
                  style={{
                    textAlign: 'center',
                    padding: '0.35rem',
                    border: '1px solid #e5e7eb',
                    background: '#f3f4f6',
                    fontSize: '0.75rem',
                    minWidth: 88,
                  }}
                  title={dk}
                >
                  {hubDayColumnHeaderLabel(dk)}
                </th>
              ))}
              <th style={{ padding: '0.5rem', border: '1px solid #e5e7eb', background: '#f3f4f6' }} aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={2 + visibleDayKeys.length + 1}
                  style={{ padding: '1rem', border: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'center' }}
                >
                  {rows.length === 0 && !jobsError
                    ? 'No jobs to show.'
                    : 'No jobs match your search or filter.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      position: 'sticky',
                      left: 0,
                      background: '#fff',
                      zIndex: 1,
                      maxWidth: 280,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenJob(r.id)}
                      style={{
                        padding: 0,
                        margin: 0,
                        border: 'none',
                        background: 'none',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        font: 'inherit',
                        textAlign: 'left',
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                      }}
                    >
                      {r.displayTitle}
                    </button>
                  </td>
                  <td style={{ textAlign: 'center', padding: '0.5rem', border: '1px solid #e5e7eb', fontWeight: 600 }}>
                    {r.totalBlocks}
                  </td>
                  {visibleDayKeys.map((dk) => (
                    <td
                      key={dk}
                      style={{ textAlign: 'center', padding: '0.35rem', border: '1px solid #e5e7eb', color: '#4b5563' }}
                    >
                      {r.byDay[dk] ?? '—'}
                    </td>
                  ))}
                  <td style={{ padding: '0.5rem', border: '1px solid #e5e7eb', textAlign: 'center' }}>
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

const hubPeopleSalarySuffix: CSSProperties = {
  marginLeft: '0.15rem',
  fontSize: '0.68rem',
  color: '#9ca3af',
  fontWeight: 400,
}

type HubPeoplePanelProps = {
  visibleDayKeys: string[]
  hideWeekend: boolean
  onHideWeekendChange: (hide: boolean) => void
  allPeopleRows: { userId: string; displayName: string }[]
  userIdsWithBlocksThisWeek: ReadonlySet<string>
  salariedUserIds: ReadonlySet<string>
  personDayBlocks: Map<string, JobScheduleBlockRow[]>
  getJobDisplayTitle: (jobId: string) => string
  loading: boolean
  jobsError: string | null
  summariesError: string | null
  onOpenJob: (jobId: string) => void
  onOpenJobPreview: (jobId: string, workDateYmd: string) => void
}

function HubPeoplePanel({
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  allPeopleRows,
  userIdsWithBlocksThisWeek,
  salariedUserIds,
  personDayBlocks,
  getJobDisplayTitle,
  loading,
  jobsError,
  summariesError,
  onOpenJob,
  onOpenJobPreview,
}: HubPeoplePanelProps) {
  const [search, setSearch] = useState('')
  const [onlyWithBlocksThisWeek, setOnlyWithBlocksThisWeek] = useState(true)

  const afterBlockFilter = useMemo(() => {
    if (!onlyWithBlocksThisWeek) return allPeopleRows
    return allPeopleRows.filter((row) => userIdsWithBlocksThisWeek.has(row.userId))
  }, [allPeopleRows, onlyWithBlocksThisWeek, userIdsWithBlocksThisWeek])

  const filteredAssignees = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return afterBlockFilter
    return afterBlockFilter.filter((row) => {
      if (row.displayName.toLowerCase().includes(q)) return true
      for (const dk of visibleDayKeys) {
        const blocks = personDayBlocks.get(hubPersonDayKey(row.userId, dk)) ?? []
        for (const b of blocks) {
          if (getJobDisplayTitle(b.job_id).toLowerCase().includes(q)) return true
        }
      }
      return false
    })
  }, [afterBlockFilter, search, visibleDayKeys, personDayBlocks, getJobDisplayTitle])

  const emptyMessage = useMemo(() => {
    if (allPeopleRows.length === 0) {
      if (jobsError) return 'No people to show.'
      if (summariesError) return 'Could not load schedule blocks; people list may be incomplete.'
      return 'No people to show.'
    }
    if (afterBlockFilter.length === 0 && onlyWithBlocksThisWeek) {
      return 'No people have schedule blocks this week.'
    }
    return 'No people match your search.'
  }, [
    allPeopleRows.length,
    afterBlockFilter.length,
    onlyWithBlocksThisWeek,
    jobsError,
    summariesError,
  ])

  return (
    <>
      {jobsError ? (
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{jobsError}</p>
      ) : null}
      {summariesError ? (
        <p style={{ color: '#92400e', fontSize: '0.875rem', marginTop: '0.5rem', whiteSpace: 'pre-wrap' }}>
          Could not load schedule blocks for this week ({summariesError}). People grid is empty.
        </p>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Person or Job"
            aria-label="Search person or job"
            style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem', minWidth: 200 }}
          />
        </label>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={onlyWithBlocksThisWeek}
            onChange={(e) => setOnlyWithBlocksThisWeek(e.target.checked)}
          />
          Only people with blocks this week
        </label>
        <label style={{ fontSize: '0.8125rem', color: '#374151', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={hideWeekend}
            onChange={(e) => onHideWeekendChange(e.target.checked)}
            aria-label="Hide Saturday and Sunday columns"
          />
          Hide weekend
        </label>
      </div>

      {loading ? <p style={{ color: '#6b7280' }}>Loading…</p> : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: 'left',
                  padding: '0.5rem',
                  border: '1px solid #e5e7eb',
                  background: '#f3f4f6',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  minWidth: 140,
                }}
              >
                Person
              </th>
              {visibleDayKeys.map((dk) => (
                <th
                  key={dk}
                  style={{
                    textAlign: 'center',
                    padding: '0.35rem',
                    border: '1px solid #e5e7eb',
                    background: '#f3f4f6',
                    fontSize: '0.75rem',
                    minWidth: 104,
                  }}
                  title={dk}
                >
                  {hubDayColumnHeaderLabel(dk)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAssignees.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={1 + visibleDayKeys.length}
                  style={{ padding: '1rem', border: '1px solid #e5e7eb', color: '#6b7280', textAlign: 'center' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredAssignees.map((person) => (
                <tr key={person.userId}>
                  <td
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      position: 'sticky',
                      left: 0,
                      background: '#fff',
                      zIndex: 1,
                      fontWeight: 600,
                      color: '#111827',
                      verticalAlign: 'top',
                    }}
                  >
                    {person.displayName}
                    {salariedUserIds.has(person.userId) ? (
                      <span
                        title="Salaried (Pay settings)"
                        aria-label="Salaried (Pay settings)"
                        style={hubPeopleSalarySuffix}
                      >
                        {' '}(s)
                      </span>
                    ) : null}
                  </td>
                  {visibleDayKeys.map((dk) => {
                    const cellBlocks = personDayBlocks.get(hubPersonDayKey(person.userId, dk)) ?? []
                    return (
                      <td
                        key={dk}
                        style={{
                          padding: '0.35rem',
                          border: '1px solid #e5e7eb',
                          verticalAlign: 'top',
                          maxHeight: 180,
                          overflowY: 'auto',
                        }}
                      >
                        {cellBlocks.length === 0 ? (
                          <span style={{ color: '#d1d5db' }}>—</span>
                        ) : (
                          cellBlocks.map((b) => (
                            <div
                              key={b.id}
                              style={{
                                marginBottom: 4,
                                background: '#eff6ff',
                                border: '1px solid #93c5fd',
                                borderRadius: 4,
                                fontSize: '0.72rem',
                                color: '#1e3a8a',
                                overflow: 'hidden',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => onOpenJobPreview(b.job_id, dk)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '0.35rem 0.45rem',
                                  margin: 0,
                                  border: 'none',
                                  borderBottom: '1px solid #bfdbfe',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  font: 'inherit',
                                  color: 'inherit',
                                }}
                              >
                                <span style={{ fontWeight: 700, color: '#1e3a8a', wordBreak: 'break-word' }}>
                                  {getJobDisplayTitle(b.job_id)}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenJob(b.job_id)}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  padding: '0.35rem 0.45rem',
                                  margin: 0,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  font: 'inherit',
                                  color: 'inherit',
                                }}
                              >
                                <div style={{ color: '#1e40af' }}>{scheduleFormatWindow(b.time_start, b.time_end)}</div>
                                {b.note ? (
                                  <div style={{ color: '#4b5563', marginTop: 2, wordBreak: 'break-word' }}>{b.note}</div>
                                ) : null}
                              </button>
                            </div>
                          ))
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

type Props = {
  weekStart: string
  visibleDayKeys: string[]
  hideWeekend: boolean
  onHideWeekendChange: (hide: boolean) => void
  weekNavDateRangeOverride?: string
  /** Sorted full list (before search / filter). */
  rows: ScheduleDispatchHubMergedRow[]
  loading: boolean
  jobsError: string | null
  summariesError: string | null
  hubTab: 'jobs' | 'people'
  onHubTabChange: (t: 'jobs' | 'people') => void
  personDayBlocks: Map<string, JobScheduleBlockRow[]>
  allPeopleRows: { userId: string; displayName: string }[]
  userIdsWithBlocksThisWeek: ReadonlySet<string>
  salariedUserIds: ReadonlySet<string>
  getJobDisplayTitle: (jobId: string) => string
  onWeekShift: (deltaWeeks: number) => void
  onThisWeek: () => void
  onOpenJob: (jobId: string) => void
  onOpenJobPreview: (jobId: string, workDateYmd: string) => void
}

export function ScheduleDispatchHub({
  weekStart,
  visibleDayKeys,
  hideWeekend,
  onHideWeekendChange,
  weekNavDateRangeOverride,
  rows,
  loading,
  jobsError,
  summariesError,
  hubTab,
  onHubTabChange,
  personDayBlocks,
  allPeopleRows,
  userIdsWithBlocksThisWeek,
  salariedUserIds,
  getJobDisplayTitle,
  onWeekShift,
  onThisWeek,
  onOpenJob,
  onOpenJobPreview,
}: Props) {
  return (
    <div style={{ padding: '1rem 1.25rem', maxWidth: '100%' }}>
      <ScheduleDispatchWeekNav
        weekStart={weekStart}
        onWeekShift={onWeekShift}
        onThisWeek={onThisWeek}
        dateRangeOverride={weekNavDateRangeOverride}
        hideWeekend={hideWeekend}
        onHideWeekendChange={onHideWeekendChange}
      />

      <div
        role="tablist"
        aria-label="Hub view"
        style={{ display: 'flex', gap: 4, marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: 2 }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={hubTab === 'people'}
          onClick={() => onHubTabChange('people')}
          style={{
            padding: '0.5rem 0.9rem',
            fontSize: '0.875rem',
            border: 'none',
            borderBottom: hubTab === 'people' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -3,
            background: 'none',
            cursor: 'pointer',
            color: hubTab === 'people' ? '#1d4ed8' : '#6b7280',
            fontWeight: hubTab === 'people' ? 600 : 400,
          }}
        >
          People
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={hubTab === 'jobs'}
          onClick={() => onHubTabChange('jobs')}
          style={{
            padding: '0.5rem 0.9rem',
            fontSize: '0.875rem',
            border: 'none',
            borderBottom: hubTab === 'jobs' ? '2px solid #2563eb' : '2px solid transparent',
            marginBottom: -3,
            background: 'none',
            cursor: 'pointer',
            color: hubTab === 'jobs' ? '#1d4ed8' : '#6b7280',
            fontWeight: hubTab === 'jobs' ? 600 : 400,
          }}
        >
          Jobs
        </button>
      </div>

      {hubTab === 'jobs' ? (
        <HubJobsPanel
          rows={rows}
          loading={loading}
          jobsError={jobsError}
          summariesError={summariesError}
          visibleDayKeys={visibleDayKeys}
          hideWeekend={hideWeekend}
          onHideWeekendChange={onHideWeekendChange}
          onOpenJob={onOpenJob}
        />
      ) : (
        <HubPeoplePanel
          visibleDayKeys={visibleDayKeys}
          hideWeekend={hideWeekend}
          onHideWeekendChange={onHideWeekendChange}
          allPeopleRows={allPeopleRows}
          userIdsWithBlocksThisWeek={userIdsWithBlocksThisWeek}
          salariedUserIds={salariedUserIds}
          personDayBlocks={personDayBlocks}
          getJobDisplayTitle={getJobDisplayTitle}
          loading={loading}
          jobsError={jobsError}
          summariesError={summariesError}
          onOpenJob={onOpenJob}
          onOpenJobPreview={onOpenJobPreview}
        />
      )}
    </div>
  )
}
