import { useEffect, useMemo, useId, useState, type CSSProperties } from 'react'
import type { BidBoardWeekSentSummary } from '../../lib/bidBoardWeeklySentStats'
import type { BidBoardWeeklyLaborCostCell } from '../../lib/bidBoardWeeklyEstimatorLaborCost'
import {
  aggregateClockHoursByUserAndWeek,
  BID_BOARD_ESTIMATOR_UNASSIGNED_KEY,
  formatLaborCentsPerDollarSent,
  buildBidBoardWeeklyLaborCostMatrix,
  buildHourlyWageLookupByNormalizedName,
  hourlyWageForUserName,
  type ClockSessionRowForLaborCost,
} from '../../lib/bidBoardWeeklyEstimatorLaborCost'
import { buildBidBoardWeeklySentPivot } from '../../lib/bidBoardWeeklySentStats'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import { APP_CALENDAR_TZ, formatScheduleDispatchWeekNavLabel } from '../../utils/dateUtils'

const thBase: CSSProperties = {
  padding: '0.375rem 0.75rem',
  textAlign: 'left',
  borderBottom: '1px solid #d6c089',
  fontSize: '0.8125rem',
}

const thWeek: CSSProperties = {
  ...thBase,
  textAlign: 'center',
  verticalAlign: 'bottom',
  minWidth: '7.5rem',
}

const stickyCorner: CSSProperties = {
  ...thBase,
  position: 'sticky',
  left: 0,
  zIndex: 3,
  background: '#fdfaf3',
  boxShadow: '1px 0 0 #d6c089',
}

const stickyRowHeader: CSSProperties = {
  padding: '0.375rem 0.75rem',
  fontSize: '0.875rem',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: 'var(--surface)',
  boxShadow: '1px 0 0 #e5e7eb',
}

const SESSION_PAGE_SIZE = 1000

async function fetchClockSessionsLaborWindow(args: {
  userIds: string[]
  dateStart: string
  dateEnd: string
}): Promise<ClockSessionRowForLaborCost[]> {
  const { userIds, dateStart, dateEnd } = args
  if (userIds.length === 0) return []

  const all: ClockSessionRowForLaborCost[] = []
  let offset = 0
  for (;;) {
    const chunk = ((await withSupabaseRetry(
      async () =>
        supabase
          .from('clock_sessions')
          .select('user_id, work_date, clocked_in_at, clocked_out_at, rejected_at, revoked_at')
          .in('user_id', userIds)
          .gte('work_date', dateStart)
          .lte('work_date', dateEnd)
          .range(offset, offset + SESSION_PAGE_SIZE - 1)
          .order('work_date', { ascending: true }),
      'bid board estimator labor clock_sessions range',
    )) ?? []) as ClockSessionRowForLaborCost[]
    all.push(...chunk)
    if (chunk.length < SESSION_PAGE_SIZE) break
    offset += SESSION_PAGE_SIZE
  }
  return all
}

export function BidBoardWeeklyEstimatorLaborDevSection({ weeks }: { weeks: BidBoardWeekSentSummary[] }) {
  const pivot = useMemo(() => buildBidBoardWeeklySentPivot(weeks), [weeks])
  const headingId = useId()
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [matrix, setMatrix] = useState(() => new Map<string, BidBoardWeeklyLaborCostCell>())

  const estimatorIdsSorted = useMemo(() => {
    const ids = pivot.rows.map((r) => r.estimatorKey).filter((k) => k !== BID_BOARD_ESTIMATOR_UNASSIGNED_KEY)
    return [...new Set(ids)].sort((a, b) => a.localeCompare(b))
  }, [pivot.rows])

  const sessionWindow = useMemo(() => {
    if (pivot.weeks.length === 0) return null
    const newest = pivot.weeks[0]!
    const oldest = pivot.weeks[pivot.weeks.length - 1]!
    return { dateStart: oldest.weekStart, dateEnd: newest.weekEnd } as const
  }, [pivot.weeks])

  useEffect(() => {
    if (!sessionWindow || estimatorIdsSorted.length === 0) {
      setMatrix(new Map())
      setFetchError(null)
      setLoading(false)
      return
    }

    let cancelled = false

    void (async () => {
      setLoading(true)
      setFetchError(null)
      try {
        const [userRows, payRows] = await Promise.all([
          withSupabaseRetry(async () => supabase.from('users').select('id, name').in('id', estimatorIdsSorted), 'bid board estimator labor users'),
          withSupabaseRetry(
            async () => supabase.from('people_pay_config').select('person_name, hourly_wage'),
            'bid board estimator labor pay configs',
          ),
        ])
        if (cancelled) return

        const userRowsTyped = (userRows ?? []) as { id: string; name: string | null }[]
        const payRowsTyped = (payRows ?? []) as { person_name: string; hourly_wage: number | null }[]
        const wageLookup = buildHourlyWageLookupByNormalizedName(payRowsTyped)
        const wageByUserId = new Map<string, number | null>()
        for (const uid of estimatorIdsSorted) {
          const u = userRowsTyped.find((r) => r.id === uid)
          wageByUserId.set(uid, hourlyWageForUserName(u?.name ?? null, wageLookup))
        }

        const sessions = await fetchClockSessionsLaborWindow({
          userIds: estimatorIdsSorted,
          dateStart: sessionWindow.dateStart,
          dateEnd: sessionWindow.dateEnd,
        })
        if (cancelled) return

        const hoursMap = aggregateClockHoursByUserAndWeek(sessions, Date.now())
        const m = buildBidBoardWeeklyLaborCostMatrix({
          pivot,
          hoursByUserWeek: hoursMap,
          wageByUserId,
        })
        setMatrix(m)
      } catch (e: unknown) {
        if (!cancelled) {
          setFetchError(formatErrorMessage(e))
          setMatrix(new Map())
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [pivot, estimatorIdsSorted, sessionWindow])

  function formatCostCell(cost: number | null): string {
    return cost !== null && Number.isFinite(cost) ? `$${formatCurrency(cost)}` : '—'
  }

  const bodyRows = pivot.rows.filter((r) => r.estimatorKey !== BID_BOARD_ESTIMATOR_UNASSIGNED_KEY)

  return (
    <section
      style={{
        marginTop: '1.25rem',
        padding: '0.85rem',
        border: '2px dashed #ca8a04',
        borderRadius: 6,
        background: '#fdfaf3',
      }}
      aria-label="Development only — internal estimator labor cost per weekly bid sends. Not payroll or billing."
    >
      <div style={{ marginBottom: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'baseline' }}>
        <span
          style={{
            display: 'inline-block',
            fontSize: '0.65rem',
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#854d0e',
            border: '1px solid #ca8a04',
            padding: '0.15rem 0.35rem',
            borderRadius: 3,
          }}
        >
          Dev only
        </span>
        <h3 id={headingId} style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
          Estimator labor cost (weekly bids sent)
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-amber-800)' }}>
          Rough labor cost vs. bids sent ({APP_CALENDAR_TZ} Sunday–Saturday). Uses all clock hours for the estimator each
          week (by work date); hourly wage from People pay settings.
        </span>
      </div>

      {loading && <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Loading labor data…</p>}
      {fetchError !== null && !loading ? (
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-700)' }}>{fetchError}</p>
      ) : null}

      {pivot.weeks.length === 0 ? (
        <p style={{ margin: '.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No sent bids in this view.</p>
      ) : estimatorIdsSorted.length === 0 ? (
        <p style={{ margin: '.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No assigned estimators in this weekly sent breakdown.
        </p>
      ) : (
        <div
          style={{
            marginTop: '0.5rem',
            border: '1px solid #d6c089',
            borderRadius: 4,
            overflowX: 'auto',
            background: 'var(--surface)',
          }}
        >
          <table
            aria-labelledby={headingId}
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              minWidth: Math.max(480, 160 + pivot.weeks.length * 120),
            }}
          >
            <thead style={{ background: '#fdfaf3' }}>
              <tr>
                <th scope="col" style={stickyCorner}>
                  Estimator
                </th>
                {pivot.weeks.map((w) => (
                  <th key={w.weekStart} scope="col" style={thWeek} id={`${headingId}-wk-${w.weekStart}`}>
                    <div>{formatScheduleDispatchWeekNavLabel(w.weekStart, w.weekEnd)}</div>
                    <div style={{ marginTop: 4, fontSize: '0.68rem', fontWeight: 500, color: '#78350f' }}>
                      Labor $ / estimate
                      <br />
                      cents / $ bid value
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((row) => (
                <tr key={row.estimatorKey} style={{ borderBottom: '1px solid var(--border)' }}>
                  <th scope="row" style={stickyRowHeader}>
                    {row.displayName}
                  </th>
                  {pivot.weeks.map((w) => {
                    const key = `${row.estimatorKey}::${w.weekStart}`
                    const cellMetrics = matrix.get(key)
                    const weekTitle = formatScheduleDispatchWeekNavLabel(w.weekStart, w.weekEnd)
                    const dollarLine = formatCostCell(cellMetrics?.costPerEstimateDollars ?? null)
                    const centsLine =
                      cellMetrics?.laborCentsPerDollarSent != null && Number.isFinite(cellMetrics.laborCentsPerDollarSent)
                        ? formatLaborCentsPerDollarSent(cellMetrics.laborCentsPerDollarSent)
                        : '—'
                    const aria = `${row.displayName}, ${weekTitle}: Labor cost per estimate sent ${dollarLine}. Labor cents per dollar of bid value sent ${centsLine}.`
                    return (
                      <td
                        key={`${row.estimatorKey}-${w.weekStart}`}
                        aria-label={aria}
                        headers={`${headingId}-wk-${w.weekStart}`}
                        style={{
                          padding: '0.375rem 0.55rem',
                          fontSize: '0.8125rem',
                          textAlign: 'right',
                          verticalAlign: 'middle',
                          lineHeight: 1.35,
                        }}
                      >
                        <div style={{ whiteSpace: 'nowrap' }}>{dollarLine}</div>
                        <div style={{ whiteSpace: 'nowrap', color: '#78350f' }}>{centsLine}</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
