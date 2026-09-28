/**
 * Expected Manpower — the section under the Schedule Dispatch hub's People
 * grid: a day (or "All week") picker, the hours / jobs / people headline, the
 * crew breakdown, and a table of the jobs scheduled with who is on each.
 *
 * Which day is selected belongs to the page (`hubExpectedManpowerDayKey`),
 * which keeps it valid across week changes; which jobs are folded belongs
 * here. The section is always mounted and draws nothing while `show` is false
 * or no day is visible, so what is folded survives either.
 */
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { DispatchSwimLanesData } from '../../lib/dispatchSwimLanes'
import { summarizeExpectedManpowerByLane } from '../../lib/dispatchSwimLaneSections'
import { formatCurrency } from '../../lib/format'
import type { JobScheduleBlockRow } from '../../lib/jobScheduleBlocks'
import { SCHEDULE_DISPATCH_TODAY_COLUMN_BG } from '../../lib/scheduleDispatchColumnFocus'
import { hubDayColumnHeaderLabel } from '../../lib/scheduleDispatch/hubDayLabels'
import {
  expectedManpowerJobGroupPayrollEstimate,
  expectedManpowerJobGroupsForDay,
  expectedManpowerPersonHoursTotalForDayKeys,
  expectedManpowerRowsForDay,
  expectedManpowerRowsForVisibleDays,
  expectedManpowerStatsForRows,
  formatExpectedManpowerPersonHours,
  HUB_EXPECTED_MANPOWER_ALL_WEEK,
} from '../../lib/scheduleDispatchExpectedManpower'
import {
  formatManpowerWithHidden,
  scheduleHiddenManpowerForDayKeys,
  type ScheduleHiddenBlockCount,
} from '../../lib/scheduleHiddenBlocks'
import { formatScheduleDispatchVisibleDateRange } from '../../utils/dateUtils'

const hubExpectedManpowerSrOnly: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/** Chevron column; indent for expanded assignee detail (dashboard strip rhythm). */
const HUB_EXPECTED_MANPOWER_EXPAND_COL = '1.75rem'
const HUB_EXPECTED_MANPOWER_JOB_COL_SPAN = 2

const hubExpectedManpowerSectionTh: CSSProperties = {
  textAlign: 'left' as const,
  padding: '0.45rem',
  border: '1px solid var(--border)',
  background: 'var(--bg-muted)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--text-strong)',
}

const hubExpectedManpowerRowTd: CSSProperties = {
  padding: '0.45rem',
  border: '1px solid var(--border)',
  verticalAlign: 'middle' as const,
  fontSize: '0.8125rem',
}

export type HubExpectedManpowerSectionProps = {
  /** When false the section draws nothing (e.g. the Quickfill tomorrow snapshot). */
  show: boolean
  hubWeekBlocks: JobScheduleBlockRow[]
  visibleDayKeys: string[]
  /** Raw hidden-count rows so the headline shows the true total ("83 · 38 on your projects"). */
  hiddenBlockCounts?: readonly ScheduleHiddenBlockCount[]
  hubExpectedManpowerDayKey: string | null
  onHubExpectedManpowerDayChange: (dayKey: string) => void
  getJobDisplayTitle: (jobId: string) => string
  hubPeopleNameById: ReadonlyMap<string, string>
  swimLanes?: DispatchSwimLanesData | null
  canShowExpectedManpowerPayroll: boolean
  hubHourlyWageByUserId: ReadonlyMap<string, number>
  onOpenJob: (jobId: string) => void
  scheduleTodayYmd: string
}

export function HubExpectedManpowerSection({
  show,
  hubWeekBlocks,
  visibleDayKeys,
  hiddenBlockCounts,
  hubExpectedManpowerDayKey,
  onHubExpectedManpowerDayChange,
  getJobDisplayTitle,
  hubPeopleNameById,
  swimLanes = null,
  canShowExpectedManpowerPayroll,
  hubHourlyWageByUserId,
  onOpenJob,
  scheduleTodayYmd,
}: HubExpectedManpowerSectionProps) {
  const [expectedManpowerByJobSectionCollapsed, setExpectedManpowerByJobSectionCollapsed] = useState(false)
  const [collapsedExpectedManpowerJobIds, setCollapsedExpectedManpowerJobIds] = useState<Set<string>>(
    () => new Set(),
  )
  const prevHubExpectedManpowerKeyRef = useRef<string | null>(null)

  const expectedManpowerWeekPersonHours = useMemo(
    () => expectedManpowerPersonHoursTotalForDayKeys(hubWeekBlocks, visibleDayKeys),
    [hubWeekBlocks, visibleDayKeys],
  )

  const expectedManpowerDayRows = useMemo(() => {
    if (hubExpectedManpowerDayKey == null) return []
    if (hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK) {
      return expectedManpowerRowsForVisibleDays(
        hubWeekBlocks,
        visibleDayKeys,
        getJobDisplayTitle,
        (uid) => hubPeopleNameById.get(uid) ?? 'Unknown',
      )
    }
    return expectedManpowerRowsForDay(
      hubWeekBlocks,
      hubExpectedManpowerDayKey,
      getJobDisplayTitle,
      (uid) => hubPeopleNameById.get(uid) ?? 'Unknown',
    )
  }, [
    hubWeekBlocks,
    hubExpectedManpowerDayKey,
    visibleDayKeys,
    getJobDisplayTitle,
    hubPeopleNameById,
  ])

  const expectedManpowerSelectionLabel = useMemo(() => {
    if (hubExpectedManpowerDayKey == null) return ''
    if (hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK) {
      const range = formatScheduleDispatchVisibleDateRange(visibleDayKeys)
      return range ? `All week (${range})` : 'All week'
    }
    return hubDayColumnHeaderLabel(hubExpectedManpowerDayKey)
  }, [hubExpectedManpowerDayKey, visibleDayKeys])

  const expectedManpowerShowDayColumn =
    hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK

  const expectedManpowerJobGroups = useMemo(
    () => expectedManpowerJobGroupsForDay(expectedManpowerDayRows),
    [expectedManpowerDayRows],
  )

  const expectedManpowerDayStats = useMemo(
    () => expectedManpowerStatsForRows(expectedManpowerDayRows),
    [expectedManpowerDayRows],
  )

  /** Hidden (RLS-excluded) blocks in the current manpower selection; null when nothing is hidden. */
  const expectedManpowerHiddenSelection = useMemo(() => {
    if (!hiddenBlockCounts || hiddenBlockCounts.length === 0 || hubExpectedManpowerDayKey == null) return null
    const keys =
      hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK ? visibleDayKeys : [hubExpectedManpowerDayKey]
    const r = scheduleHiddenManpowerForDayKeys(hiddenBlockCounts, keys)
    return r.count > 0 ? r : null
  }, [hiddenBlockCounts, hubExpectedManpowerDayKey, visibleDayKeys])
  const expectedManpowerHiddenWeekHours = useMemo(
    () =>
      hiddenBlockCounts && hiddenBlockCounts.length > 0
        ? scheduleHiddenManpowerForDayKeys(hiddenBlockCounts, visibleDayKeys).hours
        : 0,
    [hiddenBlockCounts, visibleDayKeys],
  )
  const expectedManpowerSelectionHeadline = useMemo(
    () =>
      formatManpowerWithHidden(
        expectedManpowerDayStats?.personHours ?? 0,
        expectedManpowerHiddenSelection?.hours ?? 0,
        formatExpectedManpowerPersonHours,
      ),
    [expectedManpowerDayStats, expectedManpowerHiddenSelection],
  )
  const expectedManpowerWeekHeadline = useMemo(
    () =>
      formatManpowerWithHidden(
        expectedManpowerWeekPersonHours,
        expectedManpowerHiddenWeekHours,
        formatExpectedManpowerPersonHours,
      ),
    [expectedManpowerWeekPersonHours, expectedManpowerHiddenWeekHours],
  )

  /** Lane-scoped manpower breakdown — [] hides the line (no lanes configured). */
  const expectedManpowerLaneRows = useMemo(() => {
    if (!swimLanes || expectedManpowerDayRows.length === 0) return []
    return summarizeExpectedManpowerByLane(expectedManpowerDayRows, swimLanes)
  }, [swimLanes, expectedManpowerDayRows])

  useEffect(() => {
    const prev = prevHubExpectedManpowerKeyRef.current
    const cur = hubExpectedManpowerDayKey
    prevHubExpectedManpowerKeyRef.current = cur

    if (cur == null) {
      setCollapsedExpectedManpowerJobIds(new Set())
      return
    }

    if (cur === HUB_EXPECTED_MANPOWER_ALL_WEEK) {
      if (prev !== HUB_EXPECTED_MANPOWER_ALL_WEEK) {
        setCollapsedExpectedManpowerJobIds(new Set(expectedManpowerJobGroups.map((g) => g.jobId)))
      }
      return
    }

    if (prev !== cur) {
      setCollapsedExpectedManpowerJobIds(new Set())
    }
  }, [hubExpectedManpowerDayKey, expectedManpowerJobGroups])

  if (!(visibleDayKeys.length > 0 && show)) return null

  return (
    <section
      style={{ marginTop: '1.25rem' }}
      aria-label="Expected manpower for the selected day or week"
    >
      <h3
        style={{
          margin: '0 0 0.65rem',
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: 'var(--text-strong)',
        }}
      >
        Expected Manpower
      </h3>
      <div
        role="tablist"
        aria-label="Expected manpower day or all week"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: '0.65rem',
          alignItems: 'center',
        }}
      >
        {visibleDayKeys.map((dk) => {
          const selected = dk === hubExpectedManpowerDayKey
          const isToday = dk === scheduleTodayYmd
          const background = isToday
            ? SCHEDULE_DISPATCH_TODAY_COLUMN_BG
            : selected
              ? 'var(--bg-blue-tint)'
              : 'var(--surface)'
          return (
            <button
              key={dk}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`hub-expected-manpower-tab-${dk}`}
              aria-controls="hub-expected-manpower-panel"
              title={isToday ? 'Today' : undefined}
              onClick={() => onHubExpectedManpowerDayChange(dk)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: 6,
                border: selected ? '2px solid #2563eb' : '1px solid var(--border-strong)',
                background,
                color: selected ? 'var(--text-blue-700)' : 'var(--text-700)',
                fontWeight: selected ? 600 : 400,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {hubDayColumnHeaderLabel(dk)}
            </button>
          )
        })}
        {(() => {
          const allWeekSelected = hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK
          return (
            <button
              type="button"
              role="tab"
              id="hub-expected-manpower-tab-all-week"
              aria-selected={allWeekSelected}
              aria-controls="hub-expected-manpower-panel"
              title={`Visible week: ${formatScheduleDispatchVisibleDateRange(visibleDayKeys)}`}
              onClick={() => onHubExpectedManpowerDayChange(HUB_EXPECTED_MANPOWER_ALL_WEEK)}
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: 6,
                border: allWeekSelected ? '2px solid #059669' : '1px solid #34d399',
                background: allWeekSelected ? 'var(--bg-green-100)' : 'var(--bg-emerald-tint)',
                color: allWeekSelected ? '#047857' : 'var(--text-emerald-800)',
                fontWeight: allWeekSelected ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginLeft: 2,
              }}
            >
              All week
            </button>
          )
        })()}
      </div>

      <div
        role="tabpanel"
        id="hub-expected-manpower-panel"
        aria-labelledby={
          hubExpectedManpowerDayKey
            ? hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK
              ? 'hub-expected-manpower-tab-all-week'
              : `hub-expected-manpower-tab-${hubExpectedManpowerDayKey}`
            : undefined
        }
      >
        {hubExpectedManpowerDayKey == null ? null : expectedManpowerDayRows.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {expectedManpowerHiddenSelection ? (
              <>
                No blocks on your projects for {expectedManpowerSelectionLabel} ·{' '}
                <strong style={{ color: 'var(--text-700)' }}>
                  {formatExpectedManpowerPersonHours(expectedManpowerHiddenSelection.hours)}
                </strong>{' '}
                person-hours busy elsewhere ({expectedManpowerHiddenSelection.people}{' '}
                {expectedManpowerHiddenSelection.people === 1 ? 'person' : 'people'})
              </>
            ) : (
              <>No schedule blocks for {expectedManpowerSelectionLabel}.</>
            )}
          </p>
        ) : (
          <>
            {expectedManpowerDayStats ? (
              <p style={{ margin: '0 0 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {expectedManpowerSelectionLabel}:{' '}
                <strong style={{ color: 'var(--text-700)' }}>
                  {expectedManpowerSelectionHeadline.total}
                </strong>{' '}
                person-hours
                {expectedManpowerSelectionHeadline.detail ? ` · ${expectedManpowerSelectionHeadline.detail}` : ''}
                {' · '}
                {expectedManpowerDayStats.jobCount}{' '}
                {expectedManpowerDayStats.jobCount === 1 ? 'job' : 'jobs'} ·{' '}
                {expectedManpowerDayStats.distinctPeople}{' '}
                {expectedManpowerDayStats.distinctPeople === 1 ? 'person' : 'people'}
                {expectedManpowerHiddenSelection
                  ? ` · ${expectedManpowerHiddenSelection.people} busy elsewhere`
                  : ''}
              </p>
            ) : null}
            {expectedManpowerLaneRows.length > 0 ? (
              <p style={{ margin: '-0.35rem 0 0.65rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {expectedManpowerLaneRows.map((lane, i) => (
                  <span key={lane.laneId ?? 'rest'}>
                    {i > 0 ? ' · ' : ''}
                    {lane.label}{' '}
                    <strong style={{ color: 'var(--text-700)' }}>
                      {formatExpectedManpowerPersonHours(lane.personHours)}
                    </strong>{' '}
                    ({lane.distinctPeople} {lane.distinctPeople === 1 ? 'person' : 'people'})
                  </span>
                ))}
              </p>
            ) : null}
            <div
              id="hub-expected-manpower-by-job-panel"
              role="region"
              aria-labelledby="hub-expected-manpower-by-job-section-toggle"
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th
                        style={{
                          ...hubExpectedManpowerSectionTh,
                          width: HUB_EXPECTED_MANPOWER_EXPAND_COL,
                          textAlign: 'center',
                          verticalAlign: 'middle',
                        }}
                      >
                        <button
                          type="button"
                          id="hub-expected-manpower-by-job-section-toggle"
                          aria-expanded={!expectedManpowerByJobSectionCollapsed}
                          aria-controls="hub-expected-manpower-by-job-panel"
                          onClick={() => setExpectedManpowerByJobSectionCollapsed((v) => !v)}
                          aria-label={
                            expectedManpowerByJobSectionCollapsed
                              ? `Show scheduled jobs for this day, ${expectedManpowerJobGroups.length} jobs`
                              : `Hide scheduled jobs for this day, ${expectedManpowerJobGroups.length} jobs`
                          }
                          style={{
                            border: 'none',
                            background: 'none',
                            padding: '0.1rem',
                            cursor: 'pointer',
                            fontSize: '0.65rem',
                            color: 'var(--text-700)',
                            lineHeight: 1,
                          }}
                        >
                          <span aria-hidden>
                            {expectedManpowerByJobSectionCollapsed ? '\u25B6' : '\u25BC'}
                          </span>
                        </button>
                      </th>
                      <th scope="col" style={hubExpectedManpowerSectionTh}>
                        <span style={hubExpectedManpowerSrOnly}>{'Expand rows per job. '}</span>
                        Scheduled by job ({expectedManpowerJobGroups.length})
                      </th>
                    </tr>
                  </thead>
                  <tbody hidden={expectedManpowerByJobSectionCollapsed}>
                    {expectedManpowerJobGroups.map((job) => {
                      const hasDetail = job.rows.length > 0
                      const jobDetailExpanded =
                        hasDetail && !collapsedExpectedManpowerJobIds.has(job.jobId)
                      const jobDetailScope =
                        hubExpectedManpowerDayKey === HUB_EXPECTED_MANPOWER_ALL_WEEK
                          ? 'all-week'
                          : hubExpectedManpowerDayKey
                      const jobDetailId = `hub-expected-manpower-job-${job.jobId}-${jobDetailScope}`
                      const statsLabel = `${formatExpectedManpowerPersonHours(job.totalPersonHours)} person-hours, ${
                        job.distinctPeopleCount
                      } ${job.distinctPeopleCount === 1 ? 'person' : 'people'}`
                      return (
                        <Fragment key={job.jobId}>
                          <tr>
                            <td
                              style={{
                                ...hubExpectedManpowerRowTd,
                                width: HUB_EXPECTED_MANPOWER_EXPAND_COL,
                                textAlign: 'center',
                                verticalAlign: 'middle',
                              }}
                            >
                              {hasDetail ? (
                                <button
                                  type="button"
                                  aria-expanded={jobDetailExpanded}
                                  aria-controls={jobDetailId}
                                  aria-label={
                                    jobDetailExpanded
                                      ? `Hide assignees for ${job.jobTitle}`
                                      : `Show assignees for ${job.jobTitle}`
                                  }
                                  onClick={() =>
                                    setCollapsedExpectedManpowerJobIds((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(job.jobId)) next.delete(job.jobId)
                                      else next.add(job.jobId)
                                      return next
                                    })
                                  }
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    padding: '0.1rem',
                                    cursor: 'pointer',
                                    fontSize: '0.65rem',
                                    color: 'var(--text-700)',
                                    lineHeight: 1,
                                  }}
                                >
                                  <span aria-hidden>{jobDetailExpanded ? '\u25BC' : '\u25B6'}</span>
                                </button>
                              ) : null}
                            </td>
                            <td style={hubExpectedManpowerRowTd}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  gap: '0.15rem',
                                  flexWrap: 'wrap',
                                  minWidth: 0,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => onOpenJob(job.jobId)}
                                  title={`${job.jobTitle} — ${statsLabel}`}
                                  aria-label={`Open job ${job.jobTitle}, ${statsLabel}`}
                                  style={{
                                    padding: 0,
                                    margin: 0,
                                    border: 'none',
                                    background: 'none',
                                    color: 'var(--text-blue-700)',
                                    cursor: 'pointer',
                                    font: 'inherit',
                                    fontWeight: 600,
                                    textAlign: 'left',
                                    textDecoration: 'underline',
                                    textUnderlineOffset: 2,
                                    wordBreak: 'break-word',
                                    flex: '0 1 auto',
                                    minWidth: 0,
                                  }}
                                >
                                  {job.jobTitle}
                                </button>
                                <span
                                  style={{
                                    flexShrink: 0,
                                    color: 'var(--text-600)',
                                    fontWeight: 400,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {'[ '}
                                  <span style={{ fontWeight: 400, color: 'var(--text-700)' }}>
                                    {formatExpectedManpowerPersonHours(job.totalPersonHours)}
                                  </span>
                                  <span style={{ color: 'var(--text-600)' }}>{' • '}</span>
                                  <span style={{ fontWeight: 600 }}>{job.distinctPeopleCount}</span>
                                  {' ]'}
                                </span>
                                {canShowExpectedManpowerPayroll ? (
                                  <span
                                    style={{
                                      flexShrink: 0,
                                      color: 'var(--text-muted)',
                                      fontWeight: 400,
                                      whiteSpace: 'nowrap',
                                    }}
                                    title="Uses People Pay hourly wage times scheduled hours. Salary-only rows may show $0 if no hourly rate is set. Not a full payroll estimate (no overtime or burden)."
                                  >
                                    {' · Est. $'}
                                    {formatCurrency(
                                      expectedManpowerJobGroupPayrollEstimate(job.rows, (id) => {
                                        return hubHourlyWageByUserId.get(id) ?? 0
                                      }),
                                    )}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                          {jobDetailExpanded && hasDetail ? (
                            <tr>
                              <td
                                colSpan={HUB_EXPECTED_MANPOWER_JOB_COL_SPAN}
                                style={{
                                  ...hubExpectedManpowerRowTd,
                                  borderBottom: 'none',
                                  background: 'var(--bg-page)',
                                  padding: '0.35rem 0.5rem 0.45rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                <div
                                  id={jobDetailId}
                                  role="region"
                                  aria-label={`Scheduled assignees on ${job.jobTitle}`}
                                >
                                  <div
                                    style={{
                                      overflowX: 'auto',
                                      maxWidth: '100%',
                                      marginLeft: `calc(${HUB_EXPECTED_MANPOWER_EXPAND_COL} + 0.45rem)`,
                                      borderLeft: '2px solid var(--border)',
                                      paddingLeft: '0.45rem',
                                    }}
                                  >
                                    <span style={hubExpectedManpowerSrOnly}>
                                      {`Assignees for ${job.jobTitle}`}
                                    </span>
                                    <table
                                      style={{
                                        borderCollapse: 'collapse',
                                        fontSize: '0.72rem',
                                        color: 'var(--text-600)',
                                        width: '100%',
                                      }}
                                    >
                                      <thead>
                                        <tr>
                                          {expectedManpowerShowDayColumn ? (
                                            <th
                                              scope="col"
                                              style={{
                                                textAlign: 'left',
                                                padding: '0.25rem 0.4rem 0.35rem 0',
                                                borderBottom: '1px solid var(--border)',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                              }}
                                            >
                                              Day
                                            </th>
                                          ) : null}
                                          <th
                                            scope="col"
                                            style={{
                                              textAlign: 'left',
                                              padding: '0.25rem 0.4rem 0.35rem 0',
                                              borderBottom: '1px solid var(--border)',
                                              fontWeight: 600,
                                            }}
                                          >
                                            Person
                                          </th>
                                          <th
                                            scope="col"
                                            style={{
                                              textAlign: 'right',
                                              padding: '0.25rem 0.4rem 0.35rem 0',
                                              borderBottom: '1px solid var(--border)',
                                              fontWeight: 600,
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            Hours
                                          </th>
                                          <th
                                            scope="col"
                                            style={{
                                              textAlign: 'left',
                                              padding: '0.25rem 0.4rem 0.35rem 0',
                                              borderBottom: '1px solid var(--border)',
                                              fontWeight: 600,
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            Window
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {job.rows.map((r) => (
                                          <tr key={r.blockId}>
                                            {expectedManpowerShowDayColumn ? (
                                              <td
                                                style={{
                                                  padding: '0.3rem 0.45rem 0.3rem 0',
                                                  verticalAlign: 'top',
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {hubDayColumnHeaderLabel(r.workDate)}
                                              </td>
                                            ) : null}
                                            <td style={{ padding: '0.3rem 0.4rem 0.3rem 0', verticalAlign: 'top' }}>
                                              {r.personName}
                                            </td>
                                            <td
                                              style={{
                                                padding: '0.3rem 0.4rem',
                                                textAlign: 'right',
                                                whiteSpace: 'nowrap',
                                                verticalAlign: 'top',
                                              }}
                                            >
                                              {formatExpectedManpowerPersonHours(r.personHours)}
                                            </td>
                                            <td
                                              style={{
                                                padding: '0.3rem 0 0.3rem 0.4rem',
                                                verticalAlign: 'top',
                                              }}
                                            >
                                              {r.windowLabel}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <p
        style={{
          margin: '0.75rem 0 0',
          fontSize: '0.8125rem',
          color: 'var(--text-700)',
          fontWeight: 500,
        }}
      >
        This week: {expectedManpowerWeekHeadline.total} person-hours
        {expectedManpowerWeekHeadline.detail ? ` · ${expectedManpowerWeekHeadline.detail}` : ''}
      </p>
    </section>
  )
}
