import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { useLedgerPrefixMap } from '../../contexts/LedgerDisplayPrefixContext'
import { formatErrorMessage, withSupabaseRetry } from '../../utils/errorHandling'
import {
  APP_CALENDAR_TZ,
  calendarYmdInAppTzFromIso,
  formatMmDdSlash,
  referenceDateForWorkDateYmd,
} from '../../utils/dateUtils'
import {
  BID_ESTIMATORS_TAB_DEFAULT_WINDOW_DAYS,
  bidEstimatorsWindowStartYmd,
  buildBidEstimatorsCellMap,
  buildBidEstimatorsCostModeChip,
  buildBidEstimatorsWindowDays,
  distinctBidIdsFromWindowRows,
  formatBidEstimatorsCellHours,
  formatBidEstimatorsCellPercent,
  formatBidEstimatorsProjectNameClip,
  formatBidValueK,
  lookupBidEstimatorsCell,
  type BidEstimatorsAllTimeHoursRow,
  type BidEstimatorsWindowHoursRow,
} from '../../lib/bidEstimatorsTab'
import {
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'
import type { Database } from '../../types/database'
import { BidsEstimatorsExtraUsersModal } from './BidsEstimatorsExtraUsersModal'

type UserRow = Pick<
  Database['public']['Tables']['users']['Row'],
  'id' | 'name' | 'role'
>

type BidLabelRow = {
  id: string
  bid_number: string | null
  service_type_id: string | null
  project_name: string | null
  bid_value: number | null
}

export type BidsEstimatorsTabProps = {
  /** Set true when this tab is the active one — gates data load. */
  active: boolean
  /** Current viewer role; controls visibility of the "Manage columns" action. */
  viewerRole: Database['public']['Enums']['user_role'] | null
  /** Opens the bid preview modal when a bid chip is clicked. */
  onOpenBidPreview: (bidId: string) => void
}

const SESSION_PAGE_SIZE = 1000

const thBase: CSSProperties = {
  padding: '0.375rem 0.5rem',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  fontSize: '0.8125rem',
}

const stickyCorner: CSSProperties = {
  ...thBase,
  position: 'sticky',
  left: 0,
  zIndex: 3,
  background: '#f9fafb',
  boxShadow: '1px 0 0 #e5e7eb',
}

const stickyRowHeader: CSSProperties = {
  padding: '0.375rem 0.5rem',
  fontSize: '0.875rem',
  textAlign: 'left',
  borderBottom: '1px solid #e5e7eb',
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: '#fff',
  boxShadow: '1px 0 0 #e5e7eb',
  whiteSpace: 'nowrap',
}

const thEstimator: CSSProperties = {
  ...thBase,
  textAlign: 'center',
  verticalAlign: 'bottom',
  minWidth: '8rem',
}

const todayCellBg: CSSProperties = { background: '#fffbeb' }

function canManageColumns(role: Database['public']['Enums']['user_role'] | null): boolean {
  return role === 'dev' || role === 'master_technician' || role === 'assistant'
}

export function BidsEstimatorsTab({
  active,
  viewerRole,
  onOpenBidPreview,
}: BidsEstimatorsTabProps) {
  const { showToast } = useToastContext()
  const ledgerPrefixMap = useLedgerPrefixMap()

  const [columnUsers, setColumnUsers] = useState<UserRow[]>([])
  const [windowRows, setWindowRows] = useState<BidEstimatorsWindowHoursRow[]>([])
  const [allTimeRows, setAllTimeRows] = useState<BidEstimatorsAllTimeHoursRow[]>([])
  const [bidLabels, setBidLabels] = useState<Map<string, BidLabelRow>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extrasModalOpen, setExtrasModalOpen] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [costMode, setCostMode] = useState(false)

  const todayYmd = useMemo(
    () => calendarYmdInAppTzFromIso(new Date().toISOString()) || '',
    [],
  )
  const windowDays = BID_ESTIMATORS_TAB_DEFAULT_WINDOW_DAYS
  const days = useMemo(
    () => (todayYmd ? buildBidEstimatorsWindowDays(todayYmd, windowDays) : []),
    [todayYmd, windowDays],
  )
  const startYmd = useMemo(
    () => (todayYmd ? bidEstimatorsWindowStartYmd(todayYmd, windowDays) : ''),
    [todayYmd, windowDays],
  )

  const load = useCallback(async () => {
    if (!todayYmd) return
    setLoading(true)
    setError(null)
    try {
      // 1. Determine column users: role='estimator' + extras list.
      const [usersRaw, extrasRaw] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase
              .from('users')
              .select('id, name, role')
              .is('archived_at', null)
              .order('name', { ascending: true, nullsFirst: false }),
          'estimators tab: load users',
        ),
        withSupabaseRetry(
          async () => supabase.from('bid_estimators_extra_users').select('user_id'),
          'estimators tab: load extras',
        ),
      ])
      const users = ((usersRaw ?? []) as UserRow[]).filter(
        (u) => (u.name?.trim().toLowerCase() ?? '') !== 'delete',
      )
      const extras = new Set(
        ((extrasRaw ?? []) as { user_id: string }[]).map((r) => r.user_id),
      )
      const cols = users.filter(
        (u) => u.role === 'estimator' || extras.has(u.id),
      )
      setColumnUsers(cols)

      if (cols.length === 0) {
        setWindowRows([])
        setAllTimeRows([])
        setBidLabels(new Map())
        return
      }

      // 2. Window hours RPC.
      const windowRaw = await withSupabaseRetry(
        async () =>
          supabase.rpc('list_bid_estimators_window_hours', {
            p_user_ids: cols.map((u) => u.id),
            p_start_date: startYmd,
            p_end_date: todayYmd,
          }),
        'estimators tab: window RPC',
      )
      const window: BidEstimatorsWindowHoursRow[] = ((windowRaw ?? []) as BidEstimatorsWindowHoursRow[]).map(
        (r) => ({
          user_id: r.user_id,
          bid_id: r.bid_id,
          work_date: r.work_date,
          hours: Number(r.hours),
        }),
      )
      setWindowRows(window)

      const bidIds = distinctBidIdsFromWindowRows(window)
      if (bidIds.length === 0) {
        setAllTimeRows([])
        setBidLabels(new Map())
        return
      }

      // 3. All-time totals + bid labels in parallel.
      const [allTimeRaw, labelsRaw] = await Promise.all([
        withSupabaseRetry(
          async () =>
            supabase.rpc('list_bid_estimators_all_time_hours', {
              p_bid_ids: bidIds,
            }),
          'estimators tab: all-time RPC',
        ),
        loadBidLabels(bidIds),
      ])
      const at: BidEstimatorsAllTimeHoursRow[] = ((allTimeRaw ?? []) as BidEstimatorsAllTimeHoursRow[]).map(
        (r) => ({ bid_id: r.bid_id, hours: Number(r.hours) }),
      )
      setAllTimeRows(at)

      const labelMap = new Map<string, BidLabelRow>()
      for (const row of labelsRaw) labelMap.set(row.id, row)
      setBidLabels(labelMap)
    } catch (e: unknown) {
      const msg = formatErrorMessage(e, 'Failed to load Estimators tab')
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [todayYmd, startYmd, showToast])

  useEffect(() => {
    if (!active) return
    void load()
  }, [active, load, reloadKey])

  const cellMap = useMemo(
    () => buildBidEstimatorsCellMap(windowRows, allTimeRows),
    [windowRows, allTimeRows],
  )

  const bidLabelForId = useCallback(
    (bidId: string): string => {
      const row = bidLabels.get(bidId)
      if (!row) return 'B?'
      return formatBidLedgerNumberLabel(
        resolveBidLedgerPrefix(row.service_type_id, ledgerPrefixMap),
        row.bid_number,
      )
    },
    [bidLabels, ledgerPrefixMap],
  )

  const bidProjectForId = useCallback(
    (bidId: string): string => {
      const row = bidLabels.get(bidId)
      return row?.project_name?.trim() || ''
    },
    [bidLabels],
  )

  const bidValueForId = useCallback(
    (bidId: string): number | null => {
      const row = bidLabels.get(bidId)
      return row?.bid_value ?? null
    },
    [bidLabels],
  )

  const showManageBtn = canManageColumns(viewerRole)
  const showCostModeToggle = viewerRole === 'dev'
  const triggerReload = useCallback(() => setReloadKey((k) => k + 1), [])

  if (!active) return null

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Estimators</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {showCostModeToggle ? (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.55rem',
                background: costMode ? '#eff6ff' : '#f3f4f6',
                border: `1px solid ${costMode ? '#bfdbfe' : '#d1d5db'}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8125rem',
                color: '#374151',
                userSelect: 'none',
              }}
              title="Show scaled bid value | total bid value next to each chip (dev only)"
            >
              <input
                type="checkbox"
                checked={costMode}
                onChange={(e) => setCostMode(e.target.checked)}
                style={{ margin: 0 }}
              />
              Cost mode
            </label>
          ) : null}
          {showManageBtn ? (
            <button
              type="button"
              onClick={() => setExtrasModalOpen(true)}
              style={{
                padding: '0.4rem 0.7rem',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8125rem',
                color: '#374151',
              }}
            >
              Manage columns
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p style={{ color: '#b91c1c', fontSize: '0.875rem' }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
      ) : columnUsers.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          No estimator columns yet. {showManageBtn
            ? 'Use Manage columns to add users from the team.'
            : 'Ask a dev, master, or assistant to add users.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem' }}>
            <thead style={{ background: '#f9fafb' }}>
              <tr>
                <th style={stickyCorner}>Day</th>
                {columnUsers.map((u) => (
                  <th key={u.id} style={thEstimator} title={u.name?.trim() || ''}>
                    {u.name?.trim() || '—'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const isToday = d === todayYmd
                return (
                  <tr key={d}>
                    <th
                      scope="row"
                      style={{ ...stickyRowHeader, ...(isToday ? { background: '#fffbeb' } : null) }}
                      title={d}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                        <span style={{ fontWeight: 600 }}>{formatMmDdSlash(d)}</span>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{weekdayShortChicago(d)}</span>
                      </div>
                    </th>
                    {columnUsers.map((u) => {
                      const entries = lookupBidEstimatorsCell(cellMap, u.id, d)
                      return (
                        <td
                          key={u.id}
                          style={{
                            ...thBase,
                            verticalAlign: 'top',
                            borderLeft: '1px solid #f1f5f9',
                            ...(isToday ? todayCellBg : null),
                          }}
                        >
                          {entries.length === 0 ? (
                            <span style={{ color: '#d1d5db' }}>·</span>
                          ) : (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              {entries.map((entry) => {
                                const label = bidLabelForId(entry.bidId)
                                const project = bidProjectForId(entry.bidId)
                                const projectClip = formatBidEstimatorsProjectNameClip(project)
                                const pctText = formatBidEstimatorsCellPercent(entry.pctOfBidAllTime)
                                const costChip = costMode
                                  ? buildBidEstimatorsCostModeChip(
                                      bidValueForId(entry.bidId),
                                      entry.pctOfBidAllTime,
                                    )
                                  : null
                                const title =
                                  `${pctText} — ${label}${project ? ` (${project})` : ''}` +
                                  ` · ${formatBidEstimatorsCellHours(entry.hoursOnDay)} of ` +
                                  `${formatBidEstimatorsCellHours(entry.bidAllTimeHours)} total` +
                                  (costChip
                                    ? costChip.kind === 'value'
                                      ? ` · ${formatBidValueK(costChip.scaledDollars)} | ${formatBidValueK(costChip.totalDollars)}`
                                      : ' · no bid value'
                                    : '')
                                return (
                                  <li key={entry.bidId} style={{ lineHeight: 1.2, fontSize: '0.8125rem' }}>
                                    <span style={{ color: '#374151', fontVariantNumeric: 'tabular-nums' }}>{pctText}</span>
                                    <span style={{ color: '#6b7280', margin: '0 0.35rem' }}>—</span>
                                    <button
                                      type="button"
                                      onClick={() => onOpenBidPreview(entry.bidId)}
                                      title={title}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        color: '#2563eb',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        fontSize: '0.8125rem',
                                      }}
                                    >
                                      {label}
                                    </button>
                                    {projectClip ? (
                                      <span style={{ color: '#6b7280', marginLeft: '0.3rem' }}>({projectClip})</span>
                                    ) : null}
                                    {costChip ? (
                                      costChip.kind === 'value' ? (
                                        <span
                                          style={{
                                            color: '#374151',
                                            marginLeft: '0.4rem',
                                            fontVariantNumeric: 'tabular-nums',
                                          }}
                                        >
                                          {formatBidValueK(costChip.scaledDollars)}
                                          <span style={{ color: '#9ca3af', margin: '0 0.3rem' }}>|</span>
                                          {formatBidValueK(costChip.totalDollars)}
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            color: '#dc2626',
                                            marginLeft: '0.4rem',
                                            fontWeight: 500,
                                          }}
                                        >
                                          no bid value
                                        </span>
                                      )
                                    ) : null}
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <BidsEstimatorsExtraUsersModal
        open={extrasModalOpen}
        onClose={() => setExtrasModalOpen(false)}
        onChanged={triggerReload}
      />
    </div>
  )
}

async function loadBidLabels(bidIds: string[]): Promise<BidLabelRow[]> {
  if (bidIds.length === 0) return []
  const out: BidLabelRow[] = []
  // Paginate to stay well below URL length limits when many bids show up in the window.
  for (let i = 0; i < bidIds.length; i += SESSION_PAGE_SIZE) {
    const chunk = bidIds.slice(i, i + SESSION_PAGE_SIZE)
    const rows =
      (await withSupabaseRetry(
        async () =>
          supabase
            .from('bids')
            .select('id, bid_number, service_type_id, project_name, bid_value')
            .in('id', chunk),
        'estimators tab: load bid labels',
      )) ?? []
    out.push(...(rows as BidLabelRow[]))
  }
  return out
}

const weekdayShortChicagoFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  timeZone: APP_CALENDAR_TZ,
})

function weekdayShortChicago(ymd: string): string {
  try {
    return weekdayShortChicagoFmt.format(referenceDateForWorkDateYmd(ymd))
  } catch {
    return ''
  }
}
