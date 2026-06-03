import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import type { BankingMercurySearchNicknames } from '../../lib/bankingMercurySearch'
import {
  USER_REVIEW_UNASSIGNED_USER_KEY,
  USER_REVIEW_UNLABELED_COL_KEY,
  buildUserReviewPivot,
  userReviewPivotCellTotals,
  userReviewPivotCellTxIds,
  type UserReviewLabelRow,
} from '../../lib/bankingMercuryUserReviewPivot'
import {
  USER_REVIEW_TIME_WINDOW_DEFAULT,
  USER_REVIEW_TIME_WINDOW_OPTIONS,
  formatUserReviewTimeWindowRange,
  getUserReviewTimeWindowRange,
  type UserReviewTimeWindow,
} from '../../lib/bankingMercuryUserReviewTimeWindow'
import { BankingMercuryUserReviewLedgerModal } from './BankingMercuryUserReviewLedgerModal'
import { TransactionDetailModal } from './TransactionDetailModal'
import { fetchMercuryTransactionRawById } from '../../lib/fetchMercuryTransactionRaws'
import type { SearchableSelectOption } from '../SearchableSelect'
import { bankingAttributionValueForSource } from '../../lib/bankingAttributionOptions'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']
/** One windowed tx row from the `user_review_rows` RPC — the standard Banking list
 * columns (minus `raw`) pre-joined with its attribution (user/person + names) and label. */
type UserReviewRpcRow = Database['public']['Functions']['user_review_rows']['Returns'][number]

export type BankingMercuryUserReviewTabProps = {
  mercurySearchNicknameCtx: BankingMercurySearchNicknames
  /** Assignable users + people (prefixed values) for the in-modal "assign" tool. */
  attributionOptions: SearchableSelectOption[]
  /** Operator auth user id (for recent-pick chips); null when unknown. */
  recentPersonPicksStorageKey: string | null
  /** Called after an attribution is set/changed/cleared (the tab refetches its own rows;
   * the parent may also refresh shared state). */
  onAttributionChanged: () => void
}

function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function amountColor(amount: number): string {
  if (amount > 0) return '#047857'
  if (amount < 0) return '#b91c1c'
  return '#374151'
}

const HIDE_EMPTY_STORAGE_KEY = 'banking_mercury_user_review_hide_empty_v1'
const TIME_WINDOW_STORAGE_KEY = 'banking_mercury_user_review_time_window_v1'

function readHideEmptyFromStorage(): boolean {
  try {
    const v = localStorage.getItem(HIDE_EMPTY_STORAGE_KEY)
    return v === '1'
  } catch {
    return false
  }
}

function writeHideEmptyToStorage(value: boolean): void {
  try {
    localStorage.setItem(HIDE_EMPTY_STORAGE_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function readTimeWindowFromStorage(): UserReviewTimeWindow {
  try {
    const v = localStorage.getItem(TIME_WINDOW_STORAGE_KEY)
    const match = USER_REVIEW_TIME_WINDOW_OPTIONS.find((o) => o.value === v)
    if (match) return match.value
  } catch {
    /* ignore */
  }
  return USER_REVIEW_TIME_WINDOW_DEFAULT
}

function writeTimeWindowToStorage(value: UserReviewTimeWindow): void {
  try {
    localStorage.setItem(TIME_WINDOW_STORAGE_KEY, value)
  } catch {
    /* ignore */
  }
}

export function BankingMercuryUserReviewTab({
  mercurySearchNicknameCtx,
  attributionOptions,
  recentPersonPicksStorageKey,
  onAttributionChanged,
}: BankingMercuryUserReviewTabProps) {
  const { showToast } = useToastContext()

  const [labels, setLabels] = useState<UserReviewLabelRow[]>([])
  const [labelsLoading, setLabelsLoading] = useState(false)
  // Windowed transactions pre-joined with attribution + label, from the
  // `user_review_rows` RPC. Single source for the pivot, drill-down, detail
  // panel, and search — replaces the parent's 15k master fetch + the separate
  // attributions/assignments fetches that the tab used to assemble client-side.
  const [userReviewRows, setUserReviewRows] = useState<UserReviewRpcRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [rowsError, setRowsError] = useState<string | null>(null)
  const [hideEmptyColumns, setHideEmptyColumns] = useState<boolean>(() => readHideEmptyFromStorage())

  const [drillRowKey, setDrillRowKey] = useState<string | null>(null)
  const [drillColKey, setDrillColKey] = useState<string | null>(null)
  const [detailTx, setDetailTx] = useState<MercuryTxRow | null>(null)
  const [expandedColKeys, setExpandedColKeys] = useState<Set<string>>(() => new Set())
  const [timeWindow, setTimeWindow] = useState<UserReviewTimeWindow>(() => readTimeWindowFromStorage())
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null)
  const [expandedDetailCategoryKeys, setExpandedDetailCategoryKeys] = useState<Set<string>>(() => new Set())

  const toggleDetailCategoryExpanded = useCallback((colKey: string) => {
    setExpandedDetailCategoryKeys((prev) => {
      const next = new Set(prev)
      if (next.has(colKey)) next.delete(colKey)
      else next.add(colKey)
      return next
    })
  }, [])

  const toggleColHeaderExpanded = useCallback((colKey: string) => {
    setExpandedColKeys((prev) => {
      const next = new Set(prev)
      if (next.has(colKey)) next.delete(colKey)
      else next.add(colKey)
      return next
    })
  }, [])

  const loadLabels = useCallback(async () => {
    setLabelsLoading(true)
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase
          .from('mercury_drag_sort_labels')
          .select('id, name, default_key, sort_order')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })
      }, 'user review load drag sort labels')
      setLabels(((data as Pick<DragLabelRow, 'id' | 'name' | 'default_key' | 'sort_order'>[]) ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        default_key: l.default_key,
        sort_order: l.sort_order,
      })))
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load accounting labels', 'error')
      setLabels([])
    } finally {
      setLabelsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadLabels()
  }, [loadLabels])

  const windowedRangeLabel = useMemo(() => formatUserReviewTimeWindowRange(timeWindow), [timeWindow])

  // Single scoped fetch: the windowed transactions already joined with their
  // attribution + label, computed server-side in `user_review_rows`. Replaces the
  // old three-source cascade (parent 15k master fetch + attributions + assignments).
  const loadUserReviewRows = useCallback(async () => {
    setRowsLoading(true)
    setRowsError(null)
    try {
      const range = getUserReviewTimeWindowRange(timeWindow)
      const data = await withSupabaseRetry(async () => {
        return supabase.rpc('user_review_rows', {
          p_start_ymd: range?.startYmd,
          p_end_ymd: range?.endYmd,
        })
      }, 'user review rows')
      setUserReviewRows((data as UserReviewRpcRow[]) ?? [])
    } catch (e) {
      setRowsError(e instanceof Error ? e.message : 'Could not load transactions')
      setUserReviewRows([])
    } finally {
      setRowsLoading(false)
    }
  }, [timeWindow])

  useEffect(() => {
    void loadUserReviewRows()
  }, [loadUserReviewRows])

  // After an attribution is set/changed/cleared, refetch this tab's joined rows so
  // the affected tx moves to its new user/person row; also let the parent refresh
  // any shared Banking state it still derives from attributions.
  const handleAttributionChanged = useCallback(() => {
    onAttributionChanged()
    void loadUserReviewRows()
  }, [onAttributionChanged, loadUserReviewRows])

  // The RPC rows carry the standard Banking list columns (minus `raw`), so they're
  // shape-compatible with the `MercuryTxRow` the drill-down / detail / search expect.
  const windowedTransactions = useMemo<MercuryTxRow[]>(
    () => userReviewRows as unknown as MercuryTxRow[],
    [userReviewRows],
  )

  // Attribution + label maps + display names, derived from the joined RPC rows
  // (replaces the parent-supplied maps and the separate assignments fetch).
  const { userIdByTxId, personIdByTxId, userNameById, personNameById, labelIdByTxId } = useMemo(() => {
    const uById = new Map<string, string | null>()
    const pById = new Map<string, string | null>()
    const lById = new Map<string, string | null>()
    const uNames: Record<string, string> = {}
    const pNames: Record<string, string> = {}
    for (const r of userReviewRows) {
      uById.set(r.id, r.user_id)
      pById.set(r.id, r.person_id)
      lById.set(r.id, r.label_id)
      if (r.user_id && r.user_name) uNames[r.user_id] = r.user_name
      if (r.person_id && r.person_name) pNames[r.person_id] = r.person_name
    }
    return { userIdByTxId: uById, personIdByTxId: pById, userNameById: uNames, personNameById: pNames, labelIdByTxId: lById }
  }, [userReviewRows])

  const pivot = useMemo(() => {
    return buildUserReviewPivot({
      transactions: windowedTransactions.map((r) => ({ id: r.id, amount: r.amount })),
      userIdByTxId,
      personIdByTxId,
      userNameById,
      personNameById,
      labelIdByTxId,
      allLabels: labels,
      hideEmptyLabelColumns: hideEmptyColumns,
    })
  }, [
    windowedTransactions,
    userIdByTxId,
    personIdByTxId,
    userNameById,
    personNameById,
    labelIdByTxId,
    labels,
    hideEmptyColumns,
  ])

  const txByIdMap = useMemo(() => {
    const m = new Map<string, MercuryTxRow>()
    for (const r of windowedTransactions) m.set(r.id, r)
    return m
  }, [windowedTransactions])

  const openTransactionDetail = useCallback(
    (txId: string) => {
      const row = txByIdMap.get(txId)
      if (!row) return
      setDetailTx(row) // open immediately; hydrate raw for debit-card/bankDescription/rules below
      void (async () => {
        try {
          const raw = await fetchMercuryTransactionRawById(txId, 'user review tx detail raw')
          setDetailTx((prev) => (prev && prev.id === txId ? { ...prev, raw } : prev))
        } catch {
          /* header/rules degrade gracefully without raw */
        }
      })()
    },
    [txByIdMap],
  )

  const drillRow = useMemo(() => {
    if (drillRowKey == null) return null
    return pivot.rows.find((r) => r.rowKey === drillRowKey) ?? null
  }, [pivot.rows, drillRowKey])

  const drillCol = useMemo(() => {
    if (drillColKey == null) return null
    return pivot.columns.find((c) => c.colKey === drillColKey) ?? null
  }, [pivot.columns, drillColKey])

  const drillRows = useMemo(() => {
    if (!drillRowKey || !drillColKey) return [] as MercuryTxRow[]
    const ids = userReviewPivotCellTxIds(pivot, drillRowKey, drillColKey)
    const out: MercuryTxRow[] = []
    for (const id of ids) {
      const row = txByIdMap.get(id)
      if (row) out.push(row)
    }
    return out
  }, [pivot, drillRowKey, drillColKey, txByIdMap])

  const drillTotalAmount = useMemo(() => {
    if (!drillRowKey || !drillColKey) return 0
    return userReviewPivotCellTotals(pivot, drillRowKey, drillColKey)?.totalAmount ?? 0
  }, [pivot, drillRowKey, drillColKey])

  // Per-user detail panel: every category that has transactions for the selected row,
  // sorted by absolute total descending (largest categories first).
  const selectedRow = useMemo(() => {
    if (selectedRowKey == null) return null
    return pivot.rows.find((r) => r.rowKey === selectedRowKey) ?? null
  }, [pivot.rows, selectedRowKey])

  type DetailCategoryEntry = {
    colKey: string
    displayName: string
    isUnlabeled: boolean
    count: number
    totalAmount: number
    rows: MercuryTxRow[]
  }

  const selectedUserDetailCategories = useMemo<DetailCategoryEntry[]>(() => {
    if (!selectedRowKey) return []
    const out: DetailCategoryEntry[] = []
    for (const col of pivot.columns) {
      const cell = userReviewPivotCellTotals(pivot, selectedRowKey, col.colKey)
      if (!cell || cell.count === 0) continue
      const ids = userReviewPivotCellTxIds(pivot, selectedRowKey, col.colKey)
      const rows: MercuryTxRow[] = []
      for (const id of ids) {
        const row = txByIdMap.get(id)
        if (row) rows.push(row)
      }
      rows.sort((a, b) => {
        const aIso = a.posted_at ?? a.created_at ?? ''
        const bIso = b.posted_at ?? b.created_at ?? ''
        if (aIso === bIso) return 0
        return bIso.localeCompare(aIso)
      })
      out.push({
        colKey: col.colKey,
        displayName: col.displayName,
        isUnlabeled: col.colKey === USER_REVIEW_UNLABELED_COL_KEY,
        count: cell.count,
        totalAmount: cell.totalAmount,
        rows,
      })
    }
    out.sort((a, b) => Math.abs(b.totalAmount) - Math.abs(a.totalAmount))
    return out
  }, [selectedRowKey, pivot, txByIdMap])

  const selectedRowTotals = useMemo(() => {
    if (!selectedRowKey) return null
    return pivot.rowTotals.get(selectedRowKey) ?? { count: 0, totalAmount: 0 }
  }, [selectedRowKey, pivot.rowTotals])

  // Clear selection when window/filter change yields a row that no longer exists.
  useEffect(() => {
    if (selectedRowKey == null) return
    const stillVisible = pivot.rows.some((r) => r.rowKey === selectedRowKey)
    if (!stillVisible) setSelectedRowKey(null)
  }, [selectedRowKey, pivot.rows])

  const isLoadingAny = rowsLoading || labelsLoading

  if (rowsError) {
    return (
      <div
        style={{
          margin: '1rem 0',
          padding: '0.75rem 1rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 4,
          color: '#991b1b',
          fontSize: '0.875rem',
        }}
      >
        {rowsError}
      </div>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.875rem', color: '#374151' }}>
            Rows = users (or persons) attributed to a Mercury transaction. Columns = accounting labels
            from the Drag Sort / Accounting tabs.
          </div>
          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
            Click any cell to open a searchable ledger; click a user name to see their per-category
            breakdown below the table.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8125rem',
              color: '#374151',
            }}
          >
            <span style={{ color: '#6b7280' }}>Period</span>
            <select
              value={timeWindow}
              onChange={(e) => {
                const next = e.target.value as UserReviewTimeWindow
                setTimeWindow(next)
                writeTimeWindowToStorage(next)
              }}
              style={{
                padding: '0.35rem 0.5rem',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                fontSize: '0.8125rem',
                color: '#111827',
                cursor: 'pointer',
              }}
            >
              {USER_REVIEW_TIME_WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {windowedRangeLabel ? (
              <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{windowedRangeLabel}</span>
            ) : null}
          </label>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.8125rem',
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={hideEmptyColumns}
              onChange={(e) => {
                const next = e.target.checked
                setHideEmptyColumns(next)
                writeHideEmptyToStorage(next)
              }}
              style={{ cursor: 'pointer' }}
            />
            Hide empty columns
          </label>
        </div>
      </div>

      {isLoadingAny ? (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            background: '#f3f4f6',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            color: '#374151',
            fontSize: '0.8125rem',
            marginBottom: '0.5rem',
          }}
        >
          Loading…
        </div>
      ) : null}

      {pivot.rows.length === 0 || pivot.columns.length === 0 ? (
        <div
          style={{
            padding: '1.5rem',
            border: '1px dashed #d1d5db',
            borderRadius: 6,
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '0.875rem',
          }}
        >
          {pivot.rows.length === 0
            ? timeWindow === 'all'
              ? 'No transactions in the current Banking view.'
              : `No transactions in ${windowedRangeLabel ?? 'this period'}. Try a longer Period.`
            : 'No accounting labels are visible. Toggle Hide empty columns off to see every label.'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 600, fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th
                  style={{
                    ...thBase,
                    textAlign: 'left',
                    position: 'sticky',
                    left: 0,
                    background: '#f9fafb',
                    zIndex: 2,
                    minWidth: 160,
                  }}
                >
                  User
                </th>
                {pivot.columns.map((c) => {
                  const isExpanded = expandedColKeys.has(c.colKey)
                  const needsTruncation = c.displayName.length > 10
                  const displayed = !needsTruncation || isExpanded
                    ? c.displayName
                    : `${c.displayName.slice(0, 10)}…`
                  return (
                    <th
                      key={c.colKey}
                      style={{
                        ...thBase,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        minWidth: 110,
                        color: c.colKey === USER_REVIEW_UNLABELED_COL_KEY ? '#9ca3af' : '#374151',
                        fontStyle: c.colKey === USER_REVIEW_UNLABELED_COL_KEY ? 'italic' : 'normal',
                        padding: 0,
                      }}
                      title={c.displayName}
                    >
                      <button
                        type="button"
                        onClick={() => toggleColHeaderExpanded(c.colKey)}
                        aria-expanded={isExpanded}
                        aria-label={
                          needsTruncation
                            ? `${isExpanded ? 'Collapse' : 'Expand'} column header: ${c.displayName}`
                            : c.displayName
                        }
                        style={{
                          all: 'unset',
                          display: 'block',
                          width: '100%',
                          padding: '0.5rem 0.65rem',
                          textAlign: 'right',
                          fontWeight: 'inherit',
                          fontSize: 'inherit',
                          textTransform: 'inherit',
                          letterSpacing: 'inherit',
                          color: 'inherit',
                          cursor: needsTruncation ? 'pointer' : 'default',
                          boxSizing: 'border-box',
                        }}
                      >
                        {displayed}
                      </button>
                    </th>
                  )
                })}
                <th
                  style={{
                    ...thBase,
                    textAlign: 'right',
                    background: '#f3f4f6',
                    borderLeft: '1px solid #e5e7eb',
                    minWidth: 110,
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {pivot.rows.map((row) => {
                const isUnassignedRow = row.rowKey === USER_REVIEW_UNASSIGNED_USER_KEY
                const isSelected = selectedRowKey === row.rowKey
                const rowTotal = pivot.rowTotals.get(row.rowKey) ?? { count: 0, totalAmount: 0 }
                const rowBg = isSelected ? '#eff6ff' : '#ffffff'
                return (
                  <tr
                    key={row.rowKey}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: isSelected ? '#eff6ff' : undefined,
                    }}
                  >
                    <td
                      style={{
                        ...tdBase,
                        position: 'sticky',
                        left: 0,
                        background: rowBg,
                        fontWeight: 500,
                        color: isUnassignedRow ? '#9ca3af' : '#111827',
                        fontStyle: isUnassignedRow ? 'italic' : 'normal',
                        zIndex: 1,
                        padding: 0,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRowKey((prev) => (prev === row.rowKey ? null : row.rowKey))
                          setExpandedDetailCategoryKeys(new Set())
                        }}
                        aria-pressed={isSelected}
                        aria-label={`${isSelected ? 'Hide' : 'Show'} per-category detail for ${row.displayName}`}
                        style={{
                          all: 'unset',
                          display: 'block',
                          width: '100%',
                          padding: '0.45rem 0.65rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                          color: 'inherit',
                          fontWeight: 'inherit',
                          fontStyle: 'inherit',
                          fontSize: 'inherit',
                          borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                        }}
                      >
                        <span>{row.displayName}</span>
                        {row.source === 'person' ? (
                          <span style={{ display: 'block', fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.125rem' }}>person</span>
                        ) : null}
                      </button>
                    </td>
                    {pivot.columns.map((col) => {
                      const cell = userReviewPivotCellTotals(pivot, row.rowKey, col.colKey)
                      if (!cell || cell.count === 0) {
                        return (
                          <td
                            key={col.colKey}
                            style={{
                              ...tdBase,
                              textAlign: 'right',
                              color: '#d1d5db',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            —
                          </td>
                        )
                      }
                      return (
                        <td
                          key={col.colKey}
                          style={{
                            ...tdBase,
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            padding: 0,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setDrillRowKey(row.rowKey)
                              setDrillColKey(col.colKey)
                            }}
                            style={drillButtonStyle(cell.totalAmount)}
                            aria-label={`Open ${row.displayName} · ${col.displayName} · ${cell.count} transactions · ${formatUsd(cell.totalAmount)}`}
                          >
                            <span style={{ fontVariantNumeric: 'tabular-nums', color: amountColor(cell.totalAmount), fontWeight: 500 }}>
                              {formatUsd(cell.totalAmount)}
                            </span>
                            <span style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                              {cell.count.toLocaleString()} tx
                            </span>
                          </button>
                        </td>
                      )
                    })}
                    <td
                      style={{
                        ...tdBase,
                        textAlign: 'right',
                        background: '#f9fafb',
                        borderLeft: '1px solid #e5e7eb',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <div style={{ color: amountColor(rowTotal.totalAmount), fontWeight: 500 }}>
                        {formatUsd(rowTotal.totalAmount)}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                        {rowTotal.count.toLocaleString()} tx
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #d1d5db', background: '#f3f4f6' }}>
                <td
                  style={{
                    ...tdBase,
                    position: 'sticky',
                    left: 0,
                    background: '#f3f4f6',
                    fontWeight: 600,
                    color: '#111827',
                    zIndex: 1,
                  }}
                >
                  Total
                </td>
                {pivot.columns.map((col) => {
                  const ct = pivot.colTotals.get(col.colKey) ?? { count: 0, totalAmount: 0 }
                  return (
                    <td
                      key={col.colKey}
                      style={{
                        ...tdBase,
                        textAlign: 'right',
                        whiteSpace: 'nowrap',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <div style={{ color: amountColor(ct.totalAmount), fontWeight: 500 }}>
                        {formatUsd(ct.totalAmount)}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                        {ct.count.toLocaleString()} tx
                      </div>
                    </td>
                  )
                })}
                <td
                  style={{
                    ...tdBase,
                    textAlign: 'right',
                    borderLeft: '1px solid #e5e7eb',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div style={{ color: amountColor(pivot.grandTotal.totalAmount), fontWeight: 600 }}>
                    {formatUsd(pivot.grandTotal.totalAmount)}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                    {pivot.grandTotal.count.toLocaleString()} tx
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {selectedRow && selectedRowTotals ? (
        <div
          style={{
            marginTop: '1rem',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#111827' }}>
                {selectedRow.displayName}
              </div>
              <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: '#6b7280' }}>
                {selectedUserDetailCategories.length.toLocaleString()} categor
                {selectedUserDetailCategories.length === 1 ? 'y' : 'ies'} ·{' '}
                {selectedRowTotals.count.toLocaleString()} transactions ·{' '}
                <span style={{ color: amountColor(selectedRowTotals.totalAmount), fontWeight: 500 }}>
                  {formatUsd(selectedRowTotals.totalAmount)}
                </span>
                {windowedRangeLabel ? <span> · {windowedRangeLabel}</span> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedRowKey(null)
                setExpandedDetailCategoryKeys(new Set())
              }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
          {selectedUserDetailCategories.length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
              No transactions for {selectedRow.displayName} in this period.
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {selectedUserDetailCategories.map((entry) => {
                const isExpanded = expandedDetailCategoryKeys.has(entry.colKey)
                return (
                  <li
                    key={entry.colKey}
                    style={{
                      borderTop: '1px solid #f3f4f6',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDetailCategoryExpanded(entry.colKey)}
                      aria-expanded={isExpanded}
                      style={{
                        all: 'unset',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        width: '100%',
                        padding: '0.65rem 1rem',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: entry.isUnlabeled ? '#9ca3af' : '#111827',
                          fontStyle: entry.isUnlabeled ? 'italic' : 'normal',
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          minWidth: 0,
                        }}
                      >
                        <span aria-hidden style={{ color: '#9ca3af', fontSize: '0.75rem', width: '0.75rem', textAlign: 'center' }}>
                          {isExpanded ? '▾' : '▸'}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.displayName}</span>
                        <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'normal' }}>
                          {entry.count.toLocaleString()} tx
                        </span>
                      </span>
                      <span
                        style={{
                          fontVariantNumeric: 'tabular-nums',
                          color: amountColor(entry.totalAmount),
                          fontWeight: 500,
                          fontSize: '0.875rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formatUsd(entry.totalAmount)}
                      </span>
                    </button>
                    {isExpanded ? (
                      <div style={{ padding: '0 1rem 0.85rem 2.25rem' }}>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <thead>
                            <tr style={{ background: '#f9fafb' }}>
                              <th style={detailThStyle}>Posted</th>
                              <th style={detailThStyle}>Counterparty</th>
                              <th style={{ ...detailThStyle, textAlign: 'right' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.rows.map((r) => (
                              <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                <td style={detailTdStyle}>{formatBankingDate(r.posted_at)}</td>
                                <td style={detailTdStyle}>
                                  {r.counterparty_name?.trim() || <span style={{ color: '#9ca3af' }}>—</span>}
                                </td>
                                <td
                                  style={{
                                    ...detailTdStyle,
                                    textAlign: 'right',
                                    fontVariantNumeric: 'tabular-nums',
                                    color: amountColor(r.amount ?? 0),
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {formatUsd(r.amount ?? 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ marginTop: '0.45rem', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setDrillRowKey(selectedRow.rowKey)
                              setDrillColKey(entry.colKey)
                            }}
                            style={{
                              padding: '0.3rem 0.6rem',
                              borderRadius: 6,
                              border: '1px solid #d1d5db',
                              background: '#fff',
                              fontSize: '0.75rem',
                              color: '#374151',
                              cursor: 'pointer',
                            }}
                          >
                            Open searchable ledger…
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}

      <BankingMercuryUserReviewLedgerModal
        open={drillRow != null && drillCol != null}
        onClose={() => {
          setDrillRowKey(null)
          setDrillColKey(null)
        }}
        rowName={drillRow?.displayName ?? ''}
        columnName={drillCol?.displayName ?? ''}
        rows={drillRows}
        totalAmount={drillTotalAmount}
        nicknameCtx={mercurySearchNicknameCtx}
        attributionOptions={attributionOptions}
        currentAttributionValue={bankingAttributionValueForSource(drillRow?.source ?? null, drillRow?.sourceId ?? null)}
        recentPersonPicksStorageKey={recentPersonPicksStorageKey}
        onAttributionChanged={handleAttributionChanged}
        onOpenTransactionDetail={openTransactionDetail}
      />

      <TransactionDetailModal
        open={detailTx != null}
        onClose={() => setDetailTx(null)}
        transaction={detailTx}
        attributionOptions={attributionOptions}
        nicknameByAccount={mercurySearchNicknameCtx.nicknameByAccount}
        nicknameByDebitCard={mercurySearchNicknameCtx.nicknameByDebitCard}
        recentPersonPicksStorageKey={recentPersonPicksStorageKey}
        onChanged={handleAttributionChanged}
      />
    </div>
  )
}

function formatBankingDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return '—'
  }
}

const detailThStyle: CSSProperties = {
  padding: '0.4rem 0.55rem',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: '0.7rem',
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid #e5e7eb',
}

const detailTdStyle: CSSProperties = {
  padding: '0.4rem 0.55rem',
  verticalAlign: 'top',
}

const thBase: CSSProperties = {
  padding: '0.5rem 0.65rem',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#374151',
  borderBottom: '1px solid #e5e7eb',
}

const tdBase: CSSProperties = {
  padding: '0.45rem 0.65rem',
  verticalAlign: 'top',
  borderRight: '1px solid #f3f4f6',
}

function drillButtonStyle(amount: number): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: '100%',
    padding: '0.45rem 0.65rem',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    color: amountColor(amount),
    textAlign: 'right',
  }
}
