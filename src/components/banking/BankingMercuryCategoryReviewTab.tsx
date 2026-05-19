import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import {
  buildMercuryTxSearchHaystack,
  mercuryTxMatchesSearchQuery,
  type BankingMercurySearchNicknames,
} from '../../lib/bankingMercurySearch'
import type { UserReviewLabelRow } from '../../lib/bankingMercuryUserReviewPivot'
import {
  USER_REVIEW_TIME_WINDOW_DEFAULT,
  USER_REVIEW_TIME_WINDOW_OPTIONS,
  filterMercuryTxByUserReviewTimeWindow,
  formatUserReviewTimeWindowRange,
  type UserReviewTimeWindow,
} from '../../lib/bankingMercuryUserReviewTimeWindow'
import {
  buildCategoryReviewEntries,
  sortCategoryReviewEntries,
  totalsForCategoryReviewEntries,
  type CategoryReviewEntry,
  type CategoryReviewSort,
} from '../../lib/bankingMercuryCategoryReview'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
type DragLabelRow = Database['public']['Tables']['mercury_drag_sort_labels']['Row']

export type BankingMercuryCategoryReviewTabProps = {
  filteredTransactions: MercuryTxRow[]
  loading: boolean
  loadError: string | null
  mercurySearchNicknameCtx: BankingMercurySearchNicknames
  userIdByTxId: Map<string, string | null>
  personIdByTxId: Map<string, string | null>
  userNameById: Record<string, string>
  personNameById: Record<string, string>
}

function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function amountColor(amount: number): string {
  if (amount > 0) return '#047857'
  if (amount < 0) return '#b91c1c'
  return '#374151'
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

const HIDE_EMPTY_STORAGE_KEY = 'banking_mercury_category_review_hide_empty_v1'
const TIME_WINDOW_STORAGE_KEY = 'banking_mercury_category_review_time_window_v1'
const LEDGER_SORT_STORAGE_KEY = 'banking_mercury_category_review_ledger_sort_v1'

function readHideEmptyFromStorage(): boolean {
  try {
    return localStorage.getItem(HIDE_EMPTY_STORAGE_KEY) === '1'
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

const LEDGER_SORT_OPTIONS: { value: CategoryReviewSort; label: string }[] = [
  { value: 'amount_abs_desc', label: 'Largest total first' },
  { value: 'count_desc', label: 'Most transactions first' },
  { value: 'name_asc', label: 'Name (A → Z)' },
  { value: 'category_order', label: 'Schedule C order' },
]

function readLedgerSortFromStorage(): CategoryReviewSort {
  try {
    const v = localStorage.getItem(LEDGER_SORT_STORAGE_KEY)
    const match = LEDGER_SORT_OPTIONS.find((o) => o.value === v)
    if (match) return match.value
  } catch {
    /* ignore */
  }
  return 'amount_abs_desc'
}
function writeLedgerSortToStorage(value: CategoryReviewSort): void {
  try {
    localStorage.setItem(LEDGER_SORT_STORAGE_KEY, value)
  } catch {
    /* ignore */
  }
}

type TxTableSortKey = 'posted_at' | 'counterparty_name' | 'amount'
type TxTableSortDir = 'asc' | 'desc'

const DEFAULT_TX_SORT: { key: TxTableSortKey; dir: TxTableSortDir } = { key: 'posted_at', dir: 'desc' }

function nextSortState(
  current: { key: TxTableSortKey; dir: TxTableSortDir },
  next: TxTableSortKey,
): { key: TxTableSortKey; dir: TxTableSortDir } {
  if (current.key !== next) {
    // first click defaults: date desc, name asc, amount desc (largest first)
    if (next === 'counterparty_name') return { key: next, dir: 'asc' }
    return { key: next, dir: 'desc' }
  }
  return { key: next, dir: current.dir === 'desc' ? 'asc' : 'desc' }
}

function compareRows(
  a: MercuryTxRow,
  b: MercuryTxRow,
  key: TxTableSortKey,
  dir: TxTableSortDir,
): number {
  let cmp = 0
  if (key === 'posted_at') {
    const aIso = a.posted_at ?? a.created_at ?? ''
    const bIso = b.posted_at ?? b.created_at ?? ''
    cmp = aIso.localeCompare(bIso)
  } else if (key === 'counterparty_name') {
    const aN = a.counterparty_name?.trim() ?? ''
    const bN = b.counterparty_name?.trim() ?? ''
    if (aN === '' && bN !== '') return 1
    if (bN === '' && aN !== '') return -1
    cmp = aN.localeCompare(bN, undefined, { sensitivity: 'base' })
  } else if (key === 'amount') {
    const aA = Number.isFinite(a.amount) ? a.amount : 0
    const bA = Number.isFinite(b.amount) ? b.amount : 0
    cmp = aA - bA
  }
  if (cmp === 0) {
    // stable tiebreaker so swapping sort dir is deterministic
    cmp = a.id.localeCompare(b.id)
  }
  return dir === 'desc' ? -cmp : cmp
}

export function BankingMercuryCategoryReviewTab({
  filteredTransactions,
  loading,
  loadError,
  mercurySearchNicknameCtx,
}: BankingMercuryCategoryReviewTabProps) {
  const { showToast } = useToastContext()

  const [labels, setLabels] = useState<UserReviewLabelRow[]>([])
  const [labelsLoading, setLabelsLoading] = useState(false)
  const [assignmentLabelByTxId, setAssignmentLabelByTxId] = useState<Map<string, string>>(new Map())
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)

  const [hideEmptyCategories, setHideEmptyCategories] = useState<boolean>(() => readHideEmptyFromStorage())
  const [timeWindow, setTimeWindow] = useState<UserReviewTimeWindow>(() => readTimeWindowFromStorage())
  const [ledgerSort, setLedgerSort] = useState<CategoryReviewSort>(() => readLedgerSortFromStorage())

  const [selectedColKey, setSelectedColKey] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [txSort, setTxSort] = useState(DEFAULT_TX_SORT)

  const loadLabels = useCallback(async () => {
    setLabelsLoading(true)
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase
          .from('mercury_drag_sort_labels')
          .select('id, name, default_key, sort_order')
          .order('sort_order', { ascending: true })
          .order('name', { ascending: true })
      }, 'category review load drag sort labels')
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

  const windowedTransactions = useMemo(
    () => filterMercuryTxByUserReviewTimeWindow(filteredTransactions, timeWindow),
    [filteredTransactions, timeWindow],
  )

  const windowedRangeLabel = useMemo(() => formatUserReviewTimeWindowRange(timeWindow), [timeWindow])

  const loadAssignments = useCallback(async () => {
    const idSet = new Set(windowedTransactions.map((r) => r.id))
    if (idSet.size === 0) {
      setAssignmentLabelByTxId(new Map())
      return
    }
    setAssignmentsLoading(true)
    try {
      const ids = [...idSet]
      const batchSize = 400
      const map = new Map<string, string>()
      for (let i = 0; i < ids.length; i += batchSize) {
        const slice = ids.slice(i, i + batchSize)
        const rows = await withSupabaseRetry(async () => {
          return supabase
            .from('mercury_transaction_drag_sort_assignments')
            .select('mercury_transaction_id, label_id')
            .in('mercury_transaction_id', slice)
        }, 'category review load drag assignments')
        for (const row of (rows ?? []) as { mercury_transaction_id: string; label_id: string }[]) {
          if (idSet.has(row.mercury_transaction_id)) {
            map.set(row.mercury_transaction_id, row.label_id)
          }
        }
      }
      setAssignmentLabelByTxId(map)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load assignments', 'error')
      setAssignmentLabelByTxId(new Map())
    } finally {
      setAssignmentsLoading(false)
    }
  }, [windowedTransactions, showToast])

  useEffect(() => {
    void loadAssignments()
  }, [loadAssignments])

  const labelIdByTxId = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const tx of windowedTransactions) {
      m.set(tx.id, assignmentLabelByTxId.get(tx.id) ?? null)
    }
    return m
  }, [windowedTransactions, assignmentLabelByTxId])

  const entriesCanonical: CategoryReviewEntry[] = useMemo(
    () =>
      buildCategoryReviewEntries({
        transactions: windowedTransactions.map((r) => ({ id: r.id, amount: r.amount })),
        labelIdByTxId,
        allLabels: labels,
        hideEmptyCategories,
      }),
    [windowedTransactions, labelIdByTxId, labels, hideEmptyCategories],
  )

  const entriesDisplay = useMemo(
    () => sortCategoryReviewEntries(entriesCanonical, ledgerSort),
    [entriesCanonical, ledgerSort],
  )

  const ledgerTotals = useMemo(() => totalsForCategoryReviewEntries(entriesCanonical), [entriesCanonical])

  const txByIdMap = useMemo(() => {
    const m = new Map<string, MercuryTxRow>()
    for (const r of windowedTransactions) m.set(r.id, r)
    return m
  }, [windowedTransactions])

  const selectedEntry = useMemo(() => {
    if (selectedColKey == null) return null
    return entriesCanonical.find((e) => e.colKey === selectedColKey) ?? null
  }, [selectedColKey, entriesCanonical])

  const selectedTxRows = useMemo(() => {
    if (!selectedEntry) return [] as MercuryTxRow[]
    const out: MercuryTxRow[] = []
    for (const id of selectedEntry.txIds) {
      const row = txByIdMap.get(id)
      if (row) out.push(row)
    }
    return out
  }, [selectedEntry, txByIdMap])

  const selectedHaystackByTxId = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of selectedTxRows) {
      m.set(r.id, buildMercuryTxSearchHaystack(r, mercurySearchNicknameCtx).toLowerCase())
    }
    return m
  }, [selectedTxRows, mercurySearchNicknameCtx])

  const selectedFilteredRows = useMemo(() => {
    if (search.trim() === '') return selectedTxRows
    return selectedTxRows.filter((r) =>
      mercuryTxMatchesSearchQuery(selectedHaystackByTxId.get(r.id) ?? '', search),
    )
  }, [selectedTxRows, selectedHaystackByTxId, search])

  const selectedSortedRows = useMemo(() => {
    const copy = [...selectedFilteredRows]
    copy.sort((a, b) => compareRows(a, b, txSort.key, txSort.dir))
    return copy
  }, [selectedFilteredRows, txSort])

  const selectedFilteredTotalAmount = useMemo(() => {
    return selectedFilteredRows.reduce(
      (acc, r) => acc + (Number.isFinite(r.amount) ? r.amount : 0),
      0,
    )
  }, [selectedFilteredRows])

  // Reset selection + search when window or hide-empty toggle removes the selected category.
  useEffect(() => {
    if (selectedColKey == null) return
    const stillVisible = entriesCanonical.some((e) => e.colKey === selectedColKey)
    if (!stillVisible) {
      setSelectedColKey(null)
      setSearch('')
      setTxSort(DEFAULT_TX_SORT)
    }
  }, [selectedColKey, entriesCanonical])

  const isLoadingAny = loading || labelsLoading || assignmentsLoading

  if (loadError) {
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
        {loadError}
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
            Each row is an accounting label from the Drag Sort / Accounting tabs.
          </div>
          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
            Click any category to open a searchable, sortable ledger below.
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
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
              style={selectStyle}
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
            }}
          >
            <span style={{ color: '#6b7280' }}>Sort</span>
            <select
              value={ledgerSort}
              onChange={(e) => {
                const next = e.target.value as CategoryReviewSort
                setLedgerSort(next)
                writeLedgerSortToStorage(next)
              }}
              style={selectStyle}
            >
              {LEDGER_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
              checked={hideEmptyCategories}
              onChange={(e) => {
                const next = e.target.checked
                setHideEmptyCategories(next)
                writeHideEmptyToStorage(next)
              }}
              style={{ cursor: 'pointer' }}
            />
            Hide empty categories
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

      {entriesDisplay.length === 0 ? (
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
          {timeWindow === 'all'
            ? 'No accounting labels are visible. Toggle Hide empty categories off to see every label.'
            : `No transactions in ${windowedRangeLabel ?? 'this period'}. Try a longer Period.`}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 520, fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ ...ledgerThStyle, textAlign: 'left' }}>Category</th>
                <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Transactions</th>
                <th style={{ ...ledgerThStyle, textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {entriesDisplay.map((entry) => {
                const isSelected = selectedColKey === entry.colKey
                const rowBg = isSelected ? '#eff6ff' : '#ffffff'
                return (
                  <tr
                    key={entry.colKey}
                    style={{ borderBottom: '1px solid #f3f4f6', background: isSelected ? '#eff6ff' : undefined }}
                  >
                    <td style={{ ...ledgerTdStyle, background: rowBg, padding: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedColKey((prev) => (prev === entry.colKey ? null : entry.colKey))
                          setSearch('')
                          setTxSort(DEFAULT_TX_SORT)
                        }}
                        aria-pressed={isSelected}
                        aria-label={`${isSelected ? 'Hide' : 'Show'} ledger for ${entry.displayName}`}
                        style={{
                          all: 'unset',
                          display: 'block',
                          width: '100%',
                          padding: '0.55rem 0.65rem',
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                          color: entry.isUnlabeled ? '#9ca3af' : '#111827',
                          fontStyle: entry.isUnlabeled ? 'italic' : 'normal',
                          fontWeight: 500,
                          borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                        }}
                      >
                        <span>{entry.displayName}</span>
                        {entry.defaultKey ? (
                          <span style={{ display: 'block', fontSize: '0.6875rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                            {entry.defaultKey}
                          </span>
                        ) : null}
                      </button>
                    </td>
                    <td
                      style={{
                        ...ledgerTdStyle,
                        background: rowBg,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: entry.count === 0 ? '#d1d5db' : '#374151',
                      }}
                    >
                      {entry.count.toLocaleString()}
                    </td>
                    <td
                      style={{
                        ...ledgerTdStyle,
                        background: rowBg,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        color: amountColor(entry.totalAmount),
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatUsd(entry.totalAmount)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #d1d5db', background: '#f3f4f6' }}>
                <td style={{ ...ledgerTdStyle, fontWeight: 600, color: '#111827' }}>Total</td>
                <td
                  style={{
                    ...ledgerTdStyle,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 600,
                    color: '#111827',
                  }}
                >
                  {ledgerTotals.count.toLocaleString()}
                </td>
                <td
                  style={{
                    ...ledgerTdStyle,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: amountColor(ledgerTotals.totalAmount),
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatUsd(ledgerTotals.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {selectedEntry ? (
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
              <div
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  color: selectedEntry.isUnlabeled ? '#9ca3af' : '#111827',
                  fontStyle: selectedEntry.isUnlabeled ? 'italic' : 'normal',
                }}
              >
                {selectedEntry.displayName}
              </div>
              <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', color: '#6b7280' }}>
                {selectedEntry.count.toLocaleString()} transactions ·{' '}
                <span style={{ color: amountColor(selectedEntry.totalAmount), fontWeight: 500 }}>
                  {formatUsd(selectedEntry.totalAmount)}
                </span>
                {windowedRangeLabel ? <span> · {windowedRangeLabel}</span> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedColKey(null)
                setSearch('')
                setTxSort(DEFAULT_TX_SORT)
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

          <div style={{ padding: '0.75rem 1rem 0 1rem' }}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions (counterparty, memo, card, amount…)"
              aria-label="Search transactions"
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: '0.875rem',
                color: '#111827',
                boxSizing: 'border-box',
              }}
            />
            {search.trim() !== '' ? (
              <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#6b7280' }}>
                Filtered: {selectedFilteredRows.length.toLocaleString()} of {selectedTxRows.length.toLocaleString()}
                {' · '}
                <span style={{ color: amountColor(selectedFilteredTotalAmount), fontWeight: 500 }}>
                  {formatUsd(selectedFilteredTotalAmount)}
                </span>
              </div>
            ) : null}
          </div>

          <div style={{ padding: '0.75rem 1rem 1rem 1rem' }}>
            {selectedSortedRows.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.875rem' }}>
                {selectedTxRows.length === 0
                  ? 'No transactions for this category in the current period.'
                  : 'No transactions match this search.'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      <SortableTh
                        label="Posted"
                        sortKey="posted_at"
                        currentKey={txSort.key}
                        currentDir={txSort.dir}
                        onClick={() => setTxSort((cur) => nextSortState(cur, 'posted_at'))}
                        align="left"
                      />
                      <SortableTh
                        label="Counterparty"
                        sortKey="counterparty_name"
                        currentKey={txSort.key}
                        currentDir={txSort.dir}
                        onClick={() => setTxSort((cur) => nextSortState(cur, 'counterparty_name'))}
                        align="left"
                      />
                      <SortableTh
                        label="Amount"
                        sortKey="amount"
                        currentKey={txSort.key}
                        currentDir={txSort.dir}
                        onClick={() => setTxSort((cur) => nextSortState(cur, 'amount'))}
                        align="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSortedRows.map((r) => (
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
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type SortableThProps = {
  label: string
  sortKey: TxTableSortKey
  currentKey: TxTableSortKey
  currentDir: TxTableSortDir
  onClick: () => void
  align: 'left' | 'right'
}

function SortableTh({ label, sortKey, currentKey, currentDir, onClick, align }: SortableThProps) {
  const isActive = currentKey === sortKey
  const indicator = isActive ? (currentDir === 'desc' ? ' ▼' : ' ▲') : ''
  return (
    <th
      scope="col"
      aria-sort={isActive ? (currentDir === 'desc' ? 'descending' : 'ascending') : 'none'}
      style={{
        ...detailThStyle,
        textAlign: align,
        padding: 0,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          all: 'unset',
          display: 'block',
          width: '100%',
          padding: '0.4rem 0.55rem',
          textAlign: align,
          fontWeight: 'inherit',
          fontSize: 'inherit',
          textTransform: 'inherit',
          letterSpacing: 'inherit',
          color: 'inherit',
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        <span>{label}</span>
        <span aria-hidden style={{ color: isActive ? '#374151' : 'transparent' }}>
          {isActive ? indicator : ' ▾'}
        </span>
      </button>
    </th>
  )
}

const selectStyle: CSSProperties = {
  padding: '0.35rem 0.5rem',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
  fontSize: '0.8125rem',
  color: '#111827',
  cursor: 'pointer',
}

const ledgerThStyle: CSSProperties = {
  padding: '0.5rem 0.65rem',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#374151',
  borderBottom: '1px solid #e5e7eb',
}

const ledgerTdStyle: CSSProperties = {
  padding: '0.5rem 0.65rem',
  verticalAlign: 'top',
}

const detailThStyle: CSSProperties = {
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
