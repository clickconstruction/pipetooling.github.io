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
  bidEstimatorsBidMatchesSearch,
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
  normalizeBidEstimatorsSearchQuery,
  type BidEstimatorsAllTimeHoursRow,
  type BidEstimatorsWindowHoursRow,
} from '../../lib/bidEstimatorsTab'
import {
  formatBidLedgerNumberLabel,
  resolveBidLedgerPrefix,
} from '../../lib/ledgerDisplayPrefixes'
import type { Database } from '../../types/database'
import { BidsEstimatorsExtraUsersModal } from './BidsEstimatorsExtraUsersModal'
import { isAssistantLike } from '../../lib/subcontractorLikeRole'

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
  gc_builder_name: string | null
}

/** Raw shape returned by the nested PostgREST select before we collapse into BidLabelRow. */
type BidLabelRowRaw = {
  id: string
  bid_number: string | null
  service_type_id: string | null
  project_name: string | null
  bid_value: number | null
  customers: { name: string | null } | { name: string | null }[] | null
  bids_gc_builders: { name: string | null } | { name: string | null }[] | null
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
  borderBottom: '1px solid var(--border)',
  fontSize: '0.8125rem',
}

const stickyCorner: CSSProperties = {
  ...thBase,
  position: 'sticky',
  left: 0,
  zIndex: 3,
  background: 'var(--bg-subtle)',
  boxShadow: '1px 0 0 #e5e7eb',
}

const stickyRowHeader: CSSProperties = {
  padding: '0.375rem 0.5rem',
  fontSize: '0.875rem',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
  position: 'sticky',
  left: 0,
  zIndex: 2,
  background: 'var(--surface)',
  boxShadow: '1px 0 0 #e5e7eb',
  whiteSpace: 'nowrap',
}

const thEstimator: CSSProperties = {
  ...thBase,
  textAlign: 'center',
  verticalAlign: 'bottom',
  minWidth: '8rem',
}

const todayCellBg: CSSProperties = { background: 'var(--bg-amber-tint)' }

function canManageColumns(role: Database['public']['Enums']['user_role'] | null): boolean {
  return role === 'dev' || role === 'master_technician' || isAssistantLike(role)
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
  const [searchInput, setSearchInput] = useState('')

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

  const normalizedQuery = useMemo(
    () => normalizeBidEstimatorsSearchQuery(searchInput),
    [searchInput],
  )
  const searchActive = normalizedQuery !== ''

  /**
   * Set of bidIds whose label/number/project/gc-builder matches the current
   * search. When the search is empty this stays empty too — callers should
   * branch on `searchActive` rather than treating an empty set as "no matches".
   */
  const matchedBidIds = useMemo(() => {
    const out = new Set<string>()
    if (!searchActive) return out
    for (const [bidId, row] of bidLabels) {
      const ledgerLabel = formatBidLedgerNumberLabel(
        resolveBidLedgerPrefix(row.service_type_id, ledgerPrefixMap),
        row.bid_number,
      )
      if (
        bidEstimatorsBidMatchesSearch(normalizedQuery, {
          ledgerLabel,
          bidNumber: row.bid_number,
          projectName: row.project_name,
          gcBuilderName: row.gc_builder_name,
        })
      ) {
        out.add(bidId)
      }
    }
    return out
  }, [bidLabels, ledgerPrefixMap, normalizedQuery, searchActive])

  /**
   * Days (rows) to render. When search is active, only days where at least one
   * cell contains a matched bid are kept. The estimator columns are NOT filtered
   * — layout stays stable across searches.
   */
  const visibleDays = useMemo(() => {
    if (!searchActive) return days
    return days.filter((d) =>
      columnUsers.some((u) =>
        lookupBidEstimatorsCell(cellMap, u.id, d).some((entry) =>
          matchedBidIds.has(entry.bidId),
        ),
      ),
    )
  }, [days, searchActive, columnUsers, cellMap, matchedBidIds])

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
                background: costMode ? 'var(--bg-blue-tint)' : 'var(--bg-muted)',
                border: `1px solid ${costMode ? '#bfdbfe' : '#d1d5db'}`,
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8125rem',
                color: 'var(--text-700)',
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
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8125rem',
                color: 'var(--text-700)',
              }}
            >
              Manage columns
            </button>
          ) : null}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search bids — number, project name, or GC/Builder"
          aria-label="Search bids on the Estimators tab"
          style={{
            flex: '1 1 16rem',
            minWidth: 0,
            padding: '0.4rem 0.6rem',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            fontSize: '0.875rem',
            background: 'var(--surface)',
            color: 'var(--text-strong)',
          }}
        />
        {searchActive ? (
          <>
            <span
              style={{
                fontSize: '0.8125rem',
                color: 'var(--text-700)',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
              aria-live="polite"
            >
              {matchedBidIds.size === 0
                ? 'No matching bids'
                : `${matchedBidIds.size} bid${matchedBidIds.size === 1 ? '' : 's'} · ${visibleDays.length} day${visibleDays.length === 1 ? '' : 's'}`}
            </span>
            <button
              type="button"
              onClick={() => setSearchInput('')}
              style={{
                padding: '0.35rem 0.6rem',
                background: 'var(--surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '0.8125rem',
                color: 'var(--text-700)',
              }}
            >
              Clear
            </button>
          </>
        ) : null}
      </div>
      {error ? (
        <p style={{ color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading…</p>
      ) : columnUsers.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No estimator columns yet. {showManageBtn
            ? 'Use Manage columns to add users from the team.'
            : 'Ask a dev, master, or assistant to add users.'}
        </p>
      ) : searchActive && visibleDays.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          No bids in the last {windowDays} days match <strong>{searchInput.trim()}</strong>.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.875rem' }}>
            <thead style={{ background: 'var(--bg-subtle)' }}>
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
              {visibleDays.map((d) => {
                const isToday = d === todayYmd
                return (
                  <tr key={d}>
                    <th
                      scope="row"
                      style={{ ...stickyRowHeader, ...(isToday ? { background: 'var(--bg-amber-tint)' } : null) }}
                      title={d}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                        <span style={{ fontWeight: 600 }}>{formatMmDdSlash(d)}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{weekdayShortChicago(d)}</span>
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
                            <span style={{ color: 'var(--text-faint-300)' }}>·</span>
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
                                const isMatch = searchActive && matchedBidIds.has(entry.bidId)
                                const liStyle: CSSProperties = {
                                  lineHeight: 1.2,
                                  fontSize: '0.8125rem',
                                  ...(isMatch
                                    ? {
                                        background: 'var(--bg-amber-100)',
                                        padding: '0.05rem 0.3rem',
                                        borderRadius: 3,
                                        boxShadow: 'inset 0 0 0 1px #fcd34d',
                                      }
                                    : null),
                                }
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
                                  <li key={entry.bidId} style={liStyle}>
                                    <span style={{ color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>{pctText}</span>
                                    <span style={{ color: 'var(--text-muted)', margin: '0 0.35rem' }}>—</span>
                                    <button
                                      type="button"
                                      onClick={() => onOpenBidPreview(entry.bidId)}
                                      title={title}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: 0,
                                        color: 'var(--text-link)',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        fontSize: '0.8125rem',
                                        fontWeight: isMatch ? 600 : undefined,
                                      }}
                                    >
                                      {label}
                                    </button>
                                    {projectClip ? (
                                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.3rem' }}>({projectClip})</span>
                                    ) : null}
                                    {costChip ? (
                                      costChip.kind === 'value' ? (
                                        <span
                                          style={{
                                            color: 'var(--text-700)',
                                            marginLeft: '0.4rem',
                                            fontVariantNumeric: 'tabular-nums',
                                          }}
                                        >
                                          {formatBidValueK(costChip.scaledDollars)}
                                          <span style={{ color: 'var(--text-faint)', margin: '0 0.3rem' }}>|</span>
                                          {formatBidValueK(costChip.totalDollars)}
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            color: 'var(--text-red-600)',
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

function pickNestedName(value: BidLabelRowRaw['customers']): string | null {
  if (value == null) return null
  if (Array.isArray(value)) return value[0]?.name ?? null
  return value.name ?? null
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
            .select(
              'id, bid_number, service_type_id, project_name, bid_value, customers(name), bids_gc_builders(name)',
            )
            .in('id', chunk),
        'estimators tab: load bid labels',
      )) ?? []
    for (const r of rows as BidLabelRowRaw[]) {
      const customerName = pickNestedName(r.customers)
      const legacyBuilderName = pickNestedName(r.bids_gc_builders)
      out.push({
        id: r.id,
        bid_number: r.bid_number,
        service_type_id: r.service_type_id,
        project_name: r.project_name,
        bid_value: r.bid_value,
        gc_builder_name: customerName ?? legacyBuilderName ?? null,
      })
    }
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
