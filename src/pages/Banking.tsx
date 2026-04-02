import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useToastContext } from '../contexts/ToastContext'
import { withSupabaseRetry } from '../utils/errorHandling'
import type { Database } from '../types/database'
import { BankingAccountNicknamesModal } from '../components/BankingAccountNicknamesModal'
import { BankingDebitCardNicknamesModal } from '../components/BankingDebitCardNicknamesModal'
import { BankingDebitCardRecentTxModal } from '../components/BankingDebitCardRecentTxModal'
import { BankingSortingConfigModal } from '../components/BankingSortingConfigModal'
import { BankingUserCardLinkModal } from '../components/BankingUserCardLinkModal'
import { formatMercuryKind } from '../lib/mercuryKindLabels'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../lib/mercuryRawDebitCard'
import {
  defaultBankingSortingConfig,
  loadBankingSortingConfig,
  saveBankingSortingConfig,
  type BankingSortingConfigV1,
} from '../lib/bankingSortingConfig'
import { countSortingUnmatched, filterMercuryRowsForSorting } from '../lib/bankingSortingCounts'
import { shortUuidPrefix } from '../lib/shortUuidPrefix'
import { fetchAttributionsByMercuryTxIds, fetchJobAllocationsByMercuryTxIds } from '../lib/fetchMercuryRelationsByTxIds'
import { pageUnderlineTabStyle } from '../lib/pageUnderlineTabStyle'
import {
  MercuryTransactionAllocationsModal,
  type MercuryAllocSavedDetail,
  type MercuryJobSplit,
} from '../components/MercuryTransactionAllocationsModal'
import type { SearchableSelectOption } from '../components/SearchableSelect'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']
const DEBIT_CARD_RECENT_TX_CAP = 50
type SortKey = 'posted_at' | 'mercury_account_id' | 'mercury_id'
type BankingTab = 'ledger' | 'sorting'

type BankingNicknamesMenuProps = {
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  showAccount: boolean
  showDebit: boolean
  onOpenAccount: () => void
  onOpenDebit: () => void
}

function BankingNicknamesMenu({
  menuOpen,
  onMenuOpenChange,
  showAccount,
  showDebit,
  onOpenAccount,
  onOpenDebit,
}: BankingNicknamesMenuProps) {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onMenuOpenChange(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onMenuOpenChange(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, onMenuOpenChange])

  if (!showAccount && !showDebit) return null

  const menuId = 'banking-nicknames-menu'
  const itemStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '0.5rem 0.75rem',
    textAlign: 'left',
    border: 'none',
    borderBottom: '1px solid #e5e7eb',
    background: 'white',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#111827',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuId}
        onClick={() => onMenuOpenChange(!menuOpen)}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: 4,
          border: '1px solid #d1d5db',
          background: 'white',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Nicknames <span aria-hidden>▾</span>
      </button>
      {menuOpen ? (
        <div
          id={menuId}
          role="menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            minWidth: '12.5rem',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            boxShadow: '0 4px 6px rgba(0,0,0,0.08)',
            zIndex: 40,
            overflow: 'hidden',
          }}
        >
          {showAccount ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMenuOpenChange(false)
                onOpenAccount()
              }}
              style={{ ...itemStyle, borderBottom: showDebit ? itemStyle.borderBottom : 'none' }}
            >
              Account nicknames
            </button>
          ) : null}
          {showDebit ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onMenuOpenChange(false)
                onOpenDebit()
              }}
              style={{ ...itemStyle, borderBottom: 'none' }}
            >
              Debit card nicknames
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function sortMercuryRowsStable(list: MercuryTxRow[], sort: { key: SortKey; dir: 'asc' | 'desc' }): MercuryTxRow[] {
  const dirMul = sort.dir === 'asc' ? 1 : -1
  const byPosted = (a: MercuryTxRow, b: MercuryTxRow) => {
    const ta = a.posted_at ? new Date(a.posted_at).getTime() : NaN
    const tb = b.posted_at ? new Date(b.posted_at).getTime() : NaN
    const aOk = !Number.isNaN(ta)
    const bOk = !Number.isNaN(tb)
    if (!aOk && !bOk) return 0
    if (!aOk) return 1
    if (!bOk) return -1
    return (ta - tb) * dirMul
  }
  const byAccount = (a: MercuryTxRow, b: MercuryTxRow) =>
    a.mercury_account_id.localeCompare(b.mercury_account_id) * dirMul
  const byMercuryId = (a: MercuryTxRow, b: MercuryTxRow) => a.mercury_id.localeCompare(b.mercury_id) * dirMul

  return [...list].sort((a, b) => {
    let c = 0
    if (sort.key === 'posted_at') c = byPosted(a, b)
    else if (sort.key === 'mercury_account_id') c = byAccount(a, b)
    else c = byMercuryId(a, b)
    if (c !== 0) return c
    return a.id.localeCompare(b.id)
  })
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function formatMercuryCategory(cat: MercuryTxRow['mercury_category']): string {
  if (cat == null) return '—'
  if (typeof cat === 'object' && !Array.isArray(cat) && cat !== null && 'name' in cat) {
    const name = (cat as { name?: unknown }).name
    if (typeof name === 'string') return name
  }
  try {
    return JSON.stringify(cat)
  } catch {
    return String(cat)
  }
}

const bankingAllocMuted: CSSProperties = {
  color: '#64748b',
  fontSize: '0.8125rem',
}

const bankingAllocLinkButtonStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
  fontFamily: 'inherit',
  flexShrink: 0,
}

function SortTh({
  label,
  column,
  sort,
  onSort,
}: {
  label: string
  column: SortKey
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSort: (key: SortKey) => void
}) {
  const active = sort.key === column
  const arrow = active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''
  return (
    <th
      role="columnheader"
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={() => onSort(column)}
      style={{
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid #e5e7eb',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      {arrow}
    </th>
  )
}

function TransactionDetailPanel({ r }: { r: MercuryTxRow }) {
  const rawText =
    r.raw != null
      ? (() => {
          try {
            return JSON.stringify(r.raw, null, 2)
          } catch {
            return String(r.raw)
          }
        })()
      : '—'

  const mono: CSSProperties = { fontFamily: 'monospace', fontSize: '0.8125rem', wordBreak: 'break-all' }
  const labelStyle: CSSProperties = { color: '#6b7280', fontWeight: 500 }

  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        background: '#fafafa',
        borderTop: '1px solid #e5e7eb',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(7.5rem, auto) 1fr',
          gap: '0.35rem 1rem',
          alignItems: 'start',
          fontSize: '0.8125rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={labelStyle}>Row id</div>
        <div style={mono}>{r.id}</div>
        <div style={labelStyle}>Mercury id</div>
        <div style={mono}>{r.mercury_id}</div>
        <div style={labelStyle}>Account id</div>
        <div style={mono}>{r.mercury_account_id}</div>
        <div style={labelStyle}>Amount</div>
        <div>{formatCurrency(Number(r.amount))}</div>
        <div style={labelStyle}>Currency</div>
        <div>{r.currency}</div>
        <div style={labelStyle}>Created</div>
        <div>{formatDateTime(r.created_at)}</div>
        <div style={labelStyle}>Posted</div>
        <div>{formatDateTime(r.posted_at)}</div>
        <div style={labelStyle}>Synced</div>
        <div>{formatDateTime(r.synced_at)}</div>
        <div style={labelStyle}>Status</div>
        <div>{r.status}</div>
        <div style={labelStyle}>Kind</div>
        <div>{formatMercuryKind(r.kind)}</div>
        <div style={labelStyle}>Counterparty id</div>
        <div style={mono}>{r.counterparty_id ?? '—'}</div>
        <div style={labelStyle}>Counterparty</div>
        <div>{r.counterparty_name ?? '—'}</div>
        <div style={labelStyle}>Note</div>
        <div style={{ wordBreak: 'break-word' }}>{r.note ?? '—'}</div>
        <div style={labelStyle}>External memo</div>
        <div style={{ wordBreak: 'break-word' }}>{r.external_memo ?? '—'}</div>
        <div style={labelStyle}>Mercury category</div>
        <div style={{ wordBreak: 'break-word' }}>{formatMercuryCategory(r.mercury_category)}</div>
        <div style={labelStyle}>Dashboard</div>
        <div>
          {r.dashboard_link ? (
            <a href={r.dashboard_link} target="_blank" rel="noopener noreferrer">
              Open in Mercury
            </a>
          ) : (
            '—'
          )}
        </div>
        <div style={labelStyle}>Debit card id</div>
        <div style={mono}>{mercuryDebitCardIdFromRaw(r.raw) ?? '—'}</div>
      </div>
      <div style={{ ...labelStyle, marginBottom: '0.35rem' }}>Raw (Mercury API)</div>
      <pre
        style={{
          margin: 0,
          padding: '0.75rem',
          maxHeight: 'min(50vh, 24rem)',
          overflow: 'auto',
          fontSize: '0.75rem',
          lineHeight: 1.4,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 4,
          ...mono,
        }}
      >
        {rawText}
      </pre>
    </div>
  )
}

type BankingMercuryTableProps = {
  displayRows: MercuryTxRow[]
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  onSortColumn: (key: SortKey) => void
  expandedRowId: string | null
  setExpandedRowId: Dispatch<SetStateAction<string | null>>
  nicknameByAccount: Record<string, string>
  nicknameByDebitCard: Record<string, string>
  emptyMessage: string
  showAllocations: boolean
  allocationsByTxId: Map<string, MercuryJobSplit[]>
  personIdByTxId: Map<string, string | null>
  userIdByTxId: Map<string, string | null>
  personNameById: Record<string, string>
  userNameById: Record<string, string>
  onEditAllocations: (r: MercuryTxRow) => void
  /** When true (Sorting tab), Person and Jobs columns sit after Counterparty; otherwise after Account (Ledger). */
  allocationsAfterCounterparty?: boolean
  /** When true (Sorting tab), hide the Kind column (still visible in expanded row detail). */
  hideKindColumn?: boolean
  /** When true (Sorting tab), Debit card and Account columns follow Amount (after Kind if shown), before Counterparty. */
  debitAndAccountAfterAmount?: boolean
  /** When true (Sorting tab), merge Note into Counterparty column (second line when note present). */
  counterpartyNoteCombined?: boolean
}

function BankingMercuryTable({
  displayRows,
  sort,
  onSortColumn,
  expandedRowId,
  setExpandedRowId,
  nicknameByAccount,
  nicknameByDebitCard,
  emptyMessage,
  showAllocations,
  allocationsByTxId,
  personIdByTxId,
  userIdByTxId,
  personNameById,
  userNameById,
  onEditAllocations,
  allocationsAfterCounterparty = false,
  hideKindColumn = false,
  debitAndAccountAfterAmount = false,
  counterpartyNoteCombined = false,
}: BankingMercuryTableProps) {
  const tableColSpan = (hideKindColumn ? 7 : 8) + (showAllocations ? 2 : 0) - (counterpartyNoteCombined ? 1 : 0)

  function allocationCells(r: MercuryTxRow) {
    const uid = userIdByTxId.get(r.id) ?? null
    const pid = personIdByTxId.get(r.id) ?? null
    const personLabel =
      uid ? (userNameById[uid] ?? shortUuidPrefix(uid)) : pid ? (personNameById[pid] ?? shortUuidPrefix(pid)) : null

    return (
      <>
        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.8125rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {personLabel ? (
            <span style={{ fontWeight: 500, color: '#0f172a' }} title={personLabel}>
              {personLabel}
            </span>
          ) : (
            <span style={bankingAllocMuted}>Unassigned</span>
          )}
        </td>
        <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.8125rem', verticalAlign: 'middle' }}>
          {(() => {
            const allocs = allocationsByTxId.get(r.id) ?? []
            const hasJobs = allocs.length > 0
            const summary = hasJobs
              ? `${allocs.length} job${allocs.length === 1 ? '' : 's'} · ${formatCurrency(allocs.reduce((s, a) => s + Math.abs(Number(a.amount)), 0))}`
              : null
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                {hasJobs ? (
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>{summary}</span>
                ) : (
                  <span style={bankingAllocMuted}>Not split</span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEditAllocations(r)
                  }}
                  style={bankingAllocLinkButtonStyle}
                  aria-label="Link to person and jobs for this transaction"
                >
                  Link…
                </button>
              </span>
            )
          })()}
        </td>
      </>
    )
  }

  const allocationThPair = showAllocations ? (
    <>
      <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Person</th>
      <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Jobs</th>
    </>
  ) : null

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem 0.35rem', borderBottom: '1px solid #e5e7eb', width: '2.25rem' }} aria-label="Expand row" />
            <SortTh label="Posted" column="posted_at" sort={sort} onSort={onSortColumn} />
            <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
            {hideKindColumn ? null : (
              <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Kind</th>
            )}
            {debitAndAccountAfterAmount ? (
              <>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Debit card</th>
                <SortTh label="Account" column="mercury_account_id" sort={sort} onSort={onSortColumn} />
              </>
            ) : null}
            <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>
              {counterpartyNoteCombined ? 'Counterparty / Note' : 'Counterparty'}
            </th>
            {showAllocations && allocationsAfterCounterparty ? allocationThPair : null}
            {counterpartyNoteCombined ? null : (
              <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Note</th>
            )}
            {debitAndAccountAfterAmount ? null : (
              <>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb' }}>Debit card</th>
                <SortTh label="Account" column="mercury_account_id" sort={sort} onSort={onSortColumn} />
              </>
            )}
            {showAllocations && !allocationsAfterCounterparty ? allocationThPair : null}
          </tr>
        </thead>
        <tbody>
          {displayRows.map((r) => {
            const debitCardId = mercuryDebitCardIdFromRaw(r.raw)
            const expanded = expandedRowId === r.id
            function toggleExpand() {
              setExpandedRowId((cur) => (cur === r.id ? null : r.id))
            }
            return (
              <Fragment key={r.id}>
                <tr
                  onClick={toggleExpand}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                  }}
                >
                  <td
                    style={{ padding: '0.5rem 0.35rem', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpand()
                      }}
                      aria-expanded={expanded}
                      aria-label={expanded ? 'Collapse transaction details' : 'Expand transaction details'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2rem',
                        height: '2rem',
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        borderRadius: 4,
                        color: '#374151',
                      }}
                    >
                      <span aria-hidden style={{ fontSize: '0.65rem' }}>{expanded ? '▼' : '▶'}</span>
                    </button>
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{formatDate(r.posted_at)}</td>
                  <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{formatCurrency(Number(r.amount))}</td>
                  {hideKindColumn ? null : (
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{formatMercuryKind(r.kind)}</td>
                  )}
                  {debitAndAccountAfterAmount ? (
                    <>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.8125rem' }}>
                        {debitCardId ? nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.8125rem' }}>
                        {nicknameByAccount[r.mercury_account_id] ?? shortUuidPrefix(r.mercury_account_id)}
                      </td>
                    </>
                  ) : null}
                  {counterpartyNoteCombined ? (
                    <td
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid #f3f4f6',
                        maxWidth: 280,
                        verticalAlign: 'top',
                      }}
                      aria-label={
                        (() => {
                          const cp = r.counterparty_name?.trim() || '—'
                          const nt = (r.note ?? '').trim()
                          return nt !== '' ? `Counterparty: ${cp}. Note: ${nt}` : `Counterparty: ${cp}`
                        })()
                      }
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span>{r.counterparty_name ?? '—'}</span>
                        {(() => {
                          const nt = (r.note ?? '').trim()
                          if (nt === '') return null
                          return (
                            <span
                              style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-word', lineHeight: 1.35 }}
                              title={nt}
                            >
                              {nt}
                            </span>
                          )
                        })()}
                      </div>
                    </td>
                  ) : (
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>{r.counterparty_name ?? '—'}</td>
                  )}
                  {showAllocations && allocationsAfterCounterparty ? allocationCells(r) : null}
                  {counterpartyNoteCombined ? null : (
                    <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.note ?? '—'}
                    </td>
                  )}
                  {debitAndAccountAfterAmount ? null : (
                    <>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.8125rem' }}>
                        {debitCardId ? nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId) : '—'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', fontSize: '0.8125rem' }}>
                        {nicknameByAccount[r.mercury_account_id] ?? shortUuidPrefix(r.mercury_account_id)}
                      </td>
                    </>
                  )}
                  {showAllocations && !allocationsAfterCounterparty ? allocationCells(r) : null}
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={tableColSpan} style={{ padding: 0, borderBottom: '1px solid #f3f4f6' }} onClick={(e) => e.stopPropagation()}>
                      <TransactionDetailPanel r={r} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {displayRows.length === 0 && <div style={{ padding: '1.5rem', color: '#6b7280' }}>{emptyMessage}</div>}
    </div>
  )
}

export default function Banking() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToastContext()
  const [myRole, setMyRole] = useState<'dev' | 'master_technician' | 'assistant' | 'estimator' | 'primary' | 'superintendent' | 'subcontractor' | null>(
    null,
  )
  const [rows, setRows] = useState<MercuryTxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState<string>('')
  const [kindFilter, setKindFilter] = useState<string>('')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)
  const [nicknameByAccount, setNicknameByAccount] = useState<Record<string, string>>({})
  const [nicknameDrafts, setNicknameDrafts] = useState<Record<string, string>>({})
  const [savingNicknameId, setSavingNicknameId] = useState<string | null>(null)
  const [nicknamesModalOpen, setNicknamesModalOpen] = useState(false)
  const [nicknameByDebitCard, setNicknameByDebitCard] = useState<Record<string, string>>({})
  const [savingDebitCardNicknameId, setSavingDebitCardNicknameId] = useState<string | null>(null)
  const [debitCardNicknamesModalOpen, setDebitCardNicknamesModalOpen] = useState(false)
  const [nicknamesMenuOpen, setNicknamesMenuOpen] = useState(false)
  const [recentTxDebitCardId, setRecentTxDebitCardId] = useState<string | null>(null)
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'posted_at', dir: 'desc' })
  const [sortingConfig, setSortingConfig] = useState<BankingSortingConfigV1>(defaultBankingSortingConfig)
  const [sortingConfigModalOpen, setSortingConfigModalOpen] = useState(false)
  const [userCardLinkModalOpen, setUserCardLinkModalOpen] = useState(false)
  const [sortingSort, setSortingSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'posted_at', dir: 'desc' })
  const [allocationsByTxId, setAllocationsByTxId] = useState<Map<string, MercuryJobSplit[]>>(() => new Map())
  const [personIdByTxId, setPersonIdByTxId] = useState<Map<string, string | null>>(() => new Map())
  const [userIdByTxId, setUserIdByTxId] = useState<Map<string, string | null>>(() => new Map())
  const [personNameById, setPersonNameById] = useState<Record<string, string>>({})
  const [userNameById, setUserNameById] = useState<Record<string, string>>({})
  const [jobLabelByIdBanking, setJobLabelByIdBanking] = useState<Record<string, string>>({})
  const [usersSelectOptions, setUsersSelectOptions] = useState<SearchableSelectOption[]>([])
  const [allocModalTx, setAllocModalTx] = useState<MercuryTxRow | null>(null)

  const isDevBanking = myRole === 'dev'
  const canAccessBanking = myRole === 'dev' || myRole === 'assistant' || myRole === 'master_technician'

  const activeTab: BankingTab =
    myRole === 'assistant' || myRole === 'master_technician'
      ? 'sorting'
      : searchParams.get('tab') === 'sorting'
        ? 'sorting'
        : 'ledger'

  const setBankingTab = useCallback(
    (tab: BankingTab) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (tab === 'sorting') p.set('tab', 'sorting')
          else p.delete('tab')
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  useEffect(() => {
    setNicknamesMenuOpen(false)
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'sorting') {
      setSortingConfigModalOpen(false)
      setUserCardLinkModalOpen(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (!user?.id || !myRole) return
    if (myRole === 'dev') {
      setSortingConfig(loadBankingSortingConfig(user.id))
      return
    }
    if (myRole === 'assistant' || myRole === 'master_technician') {
      setSortingConfig(defaultBankingSortingConfig())
    }
  }, [user?.id, myRole])

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setMyRole((data?.role as typeof myRole) ?? null))
  }, [user?.id])

  useEffect(() => {
    if (myRole && myRole !== 'dev' && myRole !== 'assistant' && myRole !== 'master_technician') {
      navigate('/dashboard', { replace: true })
    }
  }, [myRole, navigate])

  useEffect(() => {
    if (myRole !== 'master_technician' || searchParams.get('tab') === 'sorting') return
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('tab', 'sorting')
        return p
      },
      { replace: true },
    )
  }, [myRole, searchParams, setSearchParams])

  useEffect(() => {
    if (myRole !== 'assistant' || searchParams.get('tab') === 'sorting') return
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('tab', 'sorting')
        return p
      },
      { replace: true },
    )
  }, [myRole, searchParams, setSearchParams])

  const loadRows = useCallback(async () => {
    if (myRole !== 'dev' && myRole !== 'assistant' && myRole !== 'master_technician') return
    setError(null)
    setLoading(true)
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase
          .from('mercury_transactions')
          .select('*')
          .order('posted_at', { ascending: false, nullsFirst: false })
          .limit(5000)
      }, 'load mercury_transactions')
      setRows((data as MercuryTxRow[]) ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [myRole])

  const loadNicknames = useCallback(async () => {
    if (myRole !== 'dev' && myRole !== 'assistant' && myRole !== 'master_technician') return
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase.from('mercury_account_nicknames').select('mercury_account_id, nickname')
      }, 'load mercury_account_nicknames')
      const list = (data ?? []) as Pick<Database['public']['Tables']['mercury_account_nicknames']['Row'], 'mercury_account_id' | 'nickname'>[]
      const next: Record<string, string> = {}
      for (const r of list) next[r.mercury_account_id] = r.nickname
      setNicknameByAccount(next)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load account nicknames', 'error')
    }
  }, [myRole, showToast])

  const loadDebitCardNicknames = useCallback(async () => {
    if (myRole !== 'dev' && myRole !== 'assistant' && myRole !== 'master_technician') return
    try {
      const data = await withSupabaseRetry(async () => {
        return supabase.from('mercury_debit_card_nicknames').select('mercury_debit_card_id, nickname')
      }, 'load mercury_debit_card_nicknames')
      const list = (data ?? []) as Pick<
        Database['public']['Tables']['mercury_debit_card_nicknames']['Row'],
        'mercury_debit_card_id' | 'nickname'
      >[]
      const next: Record<string, string> = {}
      for (const r of list) next[String(r.mercury_debit_card_id).toLowerCase()] = r.nickname
      setNicknameByDebitCard(next)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to load debit card nicknames', 'error')
    }
  }, [myRole, showToast])

  useEffect(() => {
    if (myRole !== 'dev' && myRole !== 'assistant' && myRole !== 'master_technician') return
    void Promise.all([loadRows(), loadNicknames(), loadDebitCardNicknames()])
  }, [myRole, loadRows, loadNicknames, loadDebitCardNicknames])

  const loadMercuryAllocations = useCallback(async () => {
    if (!canAccessBanking || rows.length === 0) {
      setAllocationsByTxId(new Map())
      setPersonIdByTxId(new Map())
      setUserIdByTxId(new Map())
      setPersonNameById({})
      setUserNameById({})
      setJobLabelByIdBanking({})
      return
    }
    const ids = rows.map((r) => r.id)
    try {
      const [allocRows, attrRows] = await Promise.all([
        fetchJobAllocationsByMercuryTxIds(ids, 'load'),
        fetchAttributionsByMercuryTxIds(ids, 'load'),
      ])

      const allocMap = new Map<string, MercuryJobSplit[]>()
      for (const row of allocRows) {
        const tid = row.mercury_transaction_id
        const list = allocMap.get(tid) ?? []
        const split: MercuryJobSplit = { job_id: row.job_id, amount: Number(row.amount) }
        if (row.note != null && row.note !== '') split.note = row.note
        list.push(split)
        allocMap.set(tid, list)
      }
      setAllocationsByTxId(allocMap)

      const personMap = new Map<string, string | null>()
      const userMap = new Map<string, string | null>()
      const personIds = new Set<string>()
      const userIds = new Set<string>()
      for (const row of attrRows) {
        personMap.set(row.mercury_transaction_id, row.person_id)
        userMap.set(row.mercury_transaction_id, row.user_id)
        if (row.person_id) personIds.add(row.person_id)
        if (row.user_id) userIds.add(row.user_id)
      }
      for (const id of ids) {
        if (!personMap.has(id)) personMap.set(id, null)
        if (!userMap.has(id)) userMap.set(id, null)
      }
      setPersonIdByTxId(personMap)
      setUserIdByTxId(userMap)

      const jobIds = [...new Set(allocRows.map((r) => r.job_id))]
      let jobLabels: Record<string, string> = {}
      if (jobIds.length > 0) {
        const jobRowsData = await withSupabaseRetry(
          async () =>
            supabase.from('jobs_ledger').select('id, hcp_number, job_name').in('id', jobIds),
          'banking allocation job labels',
        )
        for (const j of jobRowsData ?? []) {
          const row = j as { id: string; hcp_number?: string | null; job_name?: string | null }
          const label = `${row.hcp_number ?? ''} · ${row.job_name ?? ''}`.trim()
          jobLabels[row.id] = label || row.id
        }
      }
      setJobLabelByIdBanking(jobLabels)

      let names: Record<string, string> = {}
      if (personIds.size > 0) {
        const peopleRowsData = await withSupabaseRetry(
          async () => supabase.from('people').select('id, name').in('id', [...personIds]),
          'banking allocation people names',
        )
        for (const p of peopleRowsData ?? []) {
          const row = p as { id: string; name: string }
          names[row.id] = row.name
        }
      }
      setPersonNameById(names)

      let userNames: Record<string, string> = {}
      if (userIds.size > 0) {
        const userRowsData = await withSupabaseRetry(
          async () => supabase.from('users').select('id, name').in('id', [...userIds]),
          'banking allocation user names',
        )
        for (const u of userRowsData ?? []) {
          const row = u as { id: string; name: string }
          userNames[row.id] = row.name
        }
      }
      setUserNameById(userNames)
    } catch {
      setAllocationsByTxId(new Map())
      setPersonIdByTxId(new Map())
      setUserIdByTxId(new Map())
    }
  }, [canAccessBanking, rows])

  useEffect(() => {
    void loadMercuryAllocations()
  }, [loadMercuryAllocations])

  useEffect(() => {
    if (!canAccessBanking) return
    let cancelled = false
    void (async () => {
      try {
        const data = await withSupabaseRetry(
          async () => supabase.rpc('list_users_for_banking_attribution'),
          'list users banking attribution',
        )
        if (cancelled) return
        const rows = (data ?? []) as { id: string; name: string }[]
        setUsersSelectOptions(rows.map((p) => ({ value: p.id, label: p.name })))
      } catch (e) {
        if (!cancelled) {
          setUsersSelectOptions([])
          showToast(
            e instanceof Error ? e.message : 'Could not load users for Banking (apply latest migrations if this persists).',
            'error',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canAccessBanking, showToast])

  const setSortForColumn = useCallback((key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'posted_at' ? 'desc' : 'asc' },
    )
  }, [])

  const accountOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.mercury_account_id)
    return Array.from(set).sort()
  }, [rows])

  const filteredSorted = useMemo(() => {
    const list = rows.filter((r) => {
      if (accountFilter && r.mercury_account_id !== accountFilter) return false
      if (kindFilter && r.kind !== kindFilter) return false
      return true
    })
    return sortMercuryRowsStable(list, sort)
  }, [rows, accountFilter, kindFilter, sort])

  const nicknameManageIds = useMemo(() => {
    const ids = new Set<string>([...accountOptions, ...Object.keys(nicknameByAccount)])
    return Array.from(ids).sort()
  }, [accountOptions, nicknameByAccount])

  const debitCardIdsFromRows = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const id = mercuryDebitCardIdFromRaw(r.raw)
      if (id) set.add(id)
    }
    return Array.from(set).sort()
  }, [rows])

  const debitCardManageIds = useMemo(() => {
    const ids = new Set<string>([...debitCardIdsFromRows, ...Object.keys(nicknameByDebitCard)])
    return Array.from(ids).sort()
  }, [debitCardIdsFromRows, nicknameByDebitCard])

  const kindOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) set.add(r.kind)
    return Array.from(set).sort()
  }, [rows])

  const sortingFiltered = useMemo(() => filterMercuryRowsForSorting(rows, sortingConfig), [rows, sortingConfig])

  const sortingFilteredSorted = useMemo(() => sortMercuryRowsStable(sortingFiltered, sortingSort), [sortingFiltered, sortingSort])

  const totalAmount = useMemo(() => filteredSorted.reduce((s, r) => s + Number(r.amount), 0), [filteredSorted])
  const sortingTotalAmount = useMemo(
    () => sortingFilteredSorted.reduce((s, r) => s + Number(r.amount), 0),
    [sortingFilteredSorted],
  )

  const sortingUnmatchedCounts = useMemo(
    () => countSortingUnmatched(sortingFiltered, personIdByTxId, userIdByTxId, allocationsByTxId),
    [sortingFiltered, personIdByTxId, userIdByTxId, allocationsByTxId],
  )

  const setSortingSortForColumn = useCallback((key: SortKey) => {
    setSortingSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'posted_at' ? 'desc' : 'asc' },
    )
  }, [])

  const handleSortingConfigSave = useCallback(
    (cfg: BankingSortingConfigV1) => {
      if (myRole !== 'dev' || !user?.id) return
      saveBankingSortingConfig(user.id, cfg)
      setSortingConfig(cfg)
    },
    [user?.id, myRole],
  )

  useEffect(() => {
    const visible = activeTab === 'sorting' ? sortingFilteredSorted : filteredSorted
    if (expandedRowId && !visible.some((r) => r.id === expandedRowId)) {
      setExpandedRowId(null)
    }
  }, [activeTab, filteredSorted, sortingFilteredSorted, expandedRowId])

  async function handleSync() {
    setSyncing(true)
    setError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('sync-mercury-transactions', {
        body: { lookback_days: 90 },
      })
      if (fnErr) {
        setError(fnErr.message)
        return
      }
      const body = data as { error?: string; upserted?: number } | null
      if (body && typeof body.error === 'string') {
        setError(body.error)
        return
      }
      await loadRows()
      void Promise.all([loadNicknames(), loadDebitCardNicknames()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function persistNickname(mercuryAccountId: string) {
    const raw = (nicknameDrafts[mercuryAccountId] ?? nicknameByAccount[mercuryAccountId] ?? '').trim()
    if (raw.length > 120) {
      showToast('Nickname must be at most 120 characters.', 'error')
      return
    }
    setSavingNicknameId(mercuryAccountId)
    try {
      if (!raw) {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_account_nicknames').delete().eq('mercury_account_id', mercuryAccountId)
        }, 'delete mercury_account_nickname')
      } else {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_account_nicknames').upsert(
            { mercury_account_id: mercuryAccountId, nickname: raw },
            { onConflict: 'mercury_account_id' },
          )
        }, 'save mercury_account_nickname')
      }
      setNicknameDrafts((d) => {
        const next = { ...d }
        delete next[mercuryAccountId]
        return next
      })
      await loadNicknames()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save nickname', 'error')
    } finally {
      setSavingNicknameId(null)
    }
  }

  async function clearNicknameRow(mercuryAccountId: string) {
    if (!nicknameByAccount[mercuryAccountId]) return
    setSavingNicknameId(mercuryAccountId)
    try {
      await withSupabaseRetry(async () => {
        return supabase.from('mercury_account_nicknames').delete().eq('mercury_account_id', mercuryAccountId)
      }, 'delete mercury_account_nickname')
      setNicknameDrafts((d) => {
        const next = { ...d }
        delete next[mercuryAccountId]
        return next
      })
      await loadNicknames()
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not clear nickname', 'error')
    } finally {
      setSavingNicknameId(null)
    }
  }

  async function persistDebitCardNickname(mercuryDebitCardId: string, nicknameField: string): Promise<boolean> {
    const raw = nicknameField.trim()
    if (raw.length > 120) {
      showToast('Nickname must be at most 120 characters.', 'error')
      return false
    }
    setSavingDebitCardNicknameId(mercuryDebitCardId)
    try {
      if (!raw) {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_debit_card_nicknames').delete().eq('mercury_debit_card_id', mercuryDebitCardId.toLowerCase())
        }, 'delete mercury_debit_card_nickname')
      } else {
        await withSupabaseRetry(async () => {
          return supabase.from('mercury_debit_card_nicknames').upsert(
            { mercury_debit_card_id: mercuryDebitCardId.toLowerCase(), nickname: raw },
            { onConflict: 'mercury_debit_card_id' },
          )
        }, 'save mercury_debit_card_nickname')
      }
      await loadDebitCardNicknames()
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save debit card nickname', 'error')
      return false
    } finally {
      setSavingDebitCardNicknameId(null)
    }
  }

  async function clearDebitCardNicknameRow(mercuryDebitCardId: string): Promise<boolean> {
    if (!nicknameByDebitCard[mercuryDebitCardId]) return false
    setSavingDebitCardNicknameId(mercuryDebitCardId)
    try {
      await withSupabaseRetry(async () => {
        return supabase.from('mercury_debit_card_nicknames').delete().eq('mercury_debit_card_id', mercuryDebitCardId.toLowerCase())
      }, 'delete mercury_debit_card_nickname')
      await loadDebitCardNicknames()
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not clear debit card nickname', 'error')
      return false
    } finally {
      setSavingDebitCardNicknameId(null)
    }
  }

  if (myRole === null) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  if (!canAccessBanking) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>
  }

  return (
    <div style={{ padding: '0 2rem 2rem', maxWidth: 1200 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div
              role="tablist"
              aria-label="Banking sections"
              style={{ display: 'flex', alignItems: 'center', gap: 0, width: 'max-content' }}
            >
              {isDevBanking && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'ledger'}
                  id="banking-tab-ledger"
                  onClick={() => setBankingTab('ledger')}
                  style={pageUnderlineTabStyle(activeTab === 'ledger')}
                >
                  Ledger
                </button>
              )}
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'sorting'}
                id="banking-tab-sorting"
                onClick={() => setBankingTab('sorting')}
                style={pageUnderlineTabStyle(activeTab === 'sorting')}
              >
                Sorting
              </button>
            </div>
          </div>
        </div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, flexShrink: 0 }}>Banking</h1>
      </div>

      {activeTab === 'sorting' && (
        <div role="tabpanel" aria-labelledby="banking-tab-sorting">
          {!isDevBanking ? (
            <p
              style={{
                margin: '0 0 0.85rem',
                color: '#4b5563',
                maxWidth: 720,
                fontSize: '0.9375rem',
              }}
            >
              Read-only slice of Mercury transactions for sorting work (default date range and filters). Ask a developer if this list
              should use different kinds, accounts, or dates.
            </p>
          ) : null}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'nowrap',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '1rem',
              minWidth: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                overflowX: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'nowrap',
                  alignItems: 'center',
                  gap: '1rem',
                  width: 'max-content',
                }}
              >
                {isDevBanking ? (
                  <button
                    type="button"
                    onClick={() => void handleSync()}
                    disabled={syncing}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: 4,
                      border: '1px solid #1d4ed8',
                      background: '#2563eb',
                      color: 'white',
                      cursor: syncing ? 'wait' : 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {syncing ? 'Syncing from Mercury…' : 'Refresh from Mercury'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void Promise.all([loadRows(), loadNicknames(), loadDebitCardNicknames()])}
                  disabled={loading}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 4,
                    border: '1px solid #d1d5db',
                    background: 'white',
                    cursor: loading ? 'wait' : 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Reload table
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
              {isDevBanking ? (
                <button
                  type="button"
                  onClick={() => setSortingConfigModalOpen(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 4,
                    border: '1px solid #1d4ed8',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    flexShrink: 0,
                  }}
                >
                  Configuration
                </button>
              ) : null}
              {canAccessBanking ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => setUserCardLinkModalOpen(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: 4,
                      border: '1px solid #059669',
                      background: '#ecfdf5',
                      color: '#047857',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    User Card Link
                  </button>
                  <BankingNicknamesMenu
                    menuOpen={nicknamesMenuOpen}
                    onMenuOpenChange={setNicknamesMenuOpen}
                    showAccount={isDevBanking}
                    showDebit
                    onOpenAccount={() => setNicknamesModalOpen(true)}
                    onOpenDebit={() => setDebitCardNicknamesModalOpen(true)}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 4,
                color: '#991b1b',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center', gap: '0.75rem 1.25rem' }}>
            <div
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem 1.25rem', fontSize: '0.875rem', color: '#6b7280' }}
            >
              <span
                title="Rows in this list with no person or user linked (Person column shows Unassigned)."
                style={{ whiteSpace: 'nowrap' }}
              >
                Without person:{' '}
                <strong style={{ color: '#0f172a', fontWeight: 600 }}>{sortingUnmatchedCounts.withoutPerson}</strong>
              </span>
              <span
                title="Rows in this list with no job allocations (Jobs column shows Not split)."
                style={{ whiteSpace: 'nowrap' }}
              >
                Not split to jobs:{' '}
                <strong style={{ color: '#0f172a', fontWeight: 600 }}>{sortingUnmatchedCounts.withoutJobSplit}</strong>
              </span>
            </div>
            <div style={{ marginLeft: 'auto', fontWeight: 600 }}>
              Visible total: {formatCurrency(sortingTotalAmount)} ({sortingFilteredSorted.length} of {rows.length} loaded)
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Loading…</div>
          ) : (
            <BankingMercuryTable
              displayRows={sortingFilteredSorted}
              sort={sortingSort}
              onSortColumn={setSortingSortForColumn}
              expandedRowId={expandedRowId}
              setExpandedRowId={setExpandedRowId}
              nicknameByAccount={nicknameByAccount}
              nicknameByDebitCard={nicknameByDebitCard}
              emptyMessage={
                isDevBanking
                  ? 'No rows match your sorting configuration. Adjust Configuration or sync from Mercury.'
                  : 'No rows match the default sorting slice. A developer can change filters on Banking Ledger (Configuration).'
              }
              showAllocations={canAccessBanking}
              allocationsByTxId={allocationsByTxId}
              personIdByTxId={personIdByTxId}
              userIdByTxId={userIdByTxId}
              personNameById={personNameById}
              userNameById={userNameById}
              onEditAllocations={(r) => setAllocModalTx(r)}
              allocationsAfterCounterparty
              hideKindColumn
              debitAndAccountAfterAmount
              counterpartyNoteCombined
            />
          )}
        </div>
      )}

      {activeTab === 'ledger' && isDevBanking && (
        <div role="tabpanel" aria-labelledby="banking-tab-ledger">
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                onClick={() => void handleSync()}
                disabled={syncing}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 4,
                  border: '1px solid #1d4ed8',
                  background: '#2563eb',
                  color: 'white',
                  cursor: syncing ? 'wait' : 'pointer',
                }}
              >
                {syncing ? 'Syncing from Mercury…' : 'Refresh from Mercury'}
              </button>
              <button
                type="button"
                onClick={() => void Promise.all([loadRows(), loadNicknames(), loadDebitCardNicknames()])}
                disabled={loading}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 4,
                  border: '1px solid #d1d5db',
                  background: 'white',
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >
                Reload table
              </button>
            </div>
            {canAccessBanking ? (
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <BankingNicknamesMenu
                  menuOpen={nicknamesMenuOpen}
                  onMenuOpenChange={setNicknamesMenuOpen}
                  showAccount={isDevBanking}
                  showDebit
                  onOpenAccount={() => setNicknamesModalOpen(true)}
                  onOpenDebit={() => setDebitCardNicknamesModalOpen(true)}
                />
              </div>
            ) : null}
          </div>

          <p style={{ color: '#4b5563', marginBottom: '1rem', maxWidth: 720 }}>
            Dev-only ledger of Mercury transactions. Data is stored in <code>mercury_transactions</code> (RLS: devs). Configure{' '}
            <code>MERCURY_API_KEY</code> and deploy <code>sync-mercury-transactions</code>; optional <code>mercury-webhook</code> for live
            updates — see <strong>EDGE_FUNCTIONS.md</strong>.
          </p>

          {error && (
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.75rem 1rem',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 4,
                color: '#991b1b',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Account ID</span>
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                style={{ minWidth: 280, padding: '6px 8px' }}
              >
                <option value="">All accounts</option>
                {accountOptions.map((id) => (
                  <option key={id} value={id}>
                    {nicknameByAccount[id] ? `${nicknameByAccount[id]} (${shortUuidPrefix(id)})` : id}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Kind</span>
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} style={{ minWidth: 200, padding: '6px 8px' }}>
                <option value="">All kinds</option>
                {kindOptions.map((k) => (
                  <option key={k} value={k}>
                    {formatMercuryKind(k)}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ marginLeft: 'auto', fontWeight: 600 }}>
              Filtered total: {formatCurrency(totalAmount)} ({filteredSorted.length} of {rows.length} loaded)
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Loading…</div>
          ) : (
            <BankingMercuryTable
              displayRows={filteredSorted}
              sort={sort}
              onSortColumn={setSortForColumn}
              expandedRowId={expandedRowId}
              setExpandedRowId={setExpandedRowId}
              nicknameByAccount={nicknameByAccount}
              nicknameByDebitCard={nicknameByDebitCard}
              emptyMessage="No rows yet. Run Refresh from Mercury."
              showAllocations={canAccessBanking}
              allocationsByTxId={allocationsByTxId}
              personIdByTxId={personIdByTxId}
              userIdByTxId={userIdByTxId}
              personNameById={personNameById}
              userNameById={userNameById}
              onEditAllocations={(r) => setAllocModalTx(r)}
            />
          )}
        </div>
      )}

      {isDevBanking ? (
        <BankingAccountNicknamesModal
          open={nicknamesModalOpen}
          onClose={() => setNicknamesModalOpen(false)}
          accountIds={nicknameManageIds}
          nicknameByAccount={nicknameByAccount}
          nicknameDrafts={nicknameDrafts}
          setNicknameDrafts={setNicknameDrafts}
          savingNicknameId={savingNicknameId}
          onSave={(id) => void persistNickname(id)}
          onClear={(id) => void clearNicknameRow(id)}
        />
      ) : null}

      {canAccessBanking && (
        <BankingDebitCardNicknamesModal
          open={debitCardNicknamesModalOpen}
          onClose={() => {
            setRecentTxDebitCardId(null)
            setDebitCardNicknamesModalOpen(false)
          }}
          debitCardIds={debitCardManageIds}
          nicknameByDebitCard={nicknameByDebitCard}
          savingNicknameId={savingDebitCardNicknameId}
          onSave={(id, nickname) => persistDebitCardNickname(id, nickname)}
          onClear={(id) => clearDebitCardNicknameRow(id)}
          onOpenRecentTransactions={(id) => setRecentTxDebitCardId(id)}
          recentPreviewOpen={recentTxDebitCardId !== null}
        />
      )}

      <BankingDebitCardRecentTxModal
        open={recentTxDebitCardId !== null}
        onClose={() => setRecentTxDebitCardId(null)}
        debitCardId={recentTxDebitCardId}
        rows={rows}
        cap={DEBIT_CARD_RECENT_TX_CAP}
      />

      {canAccessBanking && (
        <MercuryTransactionAllocationsModal
          open={allocModalTx !== null}
          onClose={() => setAllocModalTx(null)}
          transaction={allocModalTx}
          initialAllocations={allocModalTx ? allocationsByTxId.get(allocModalTx.id) ?? [] : []}
          initialPersonId={allocModalTx ? personIdByTxId.get(allocModalTx.id) ?? null : null}
          initialUserId={allocModalTx ? userIdByTxId.get(allocModalTx.id) ?? null : null}
          legacyPersonDisplayName={
            allocModalTx
              ? (() => {
                  const pid = personIdByTxId.get(allocModalTx.id) ?? null
                  const uid = userIdByTxId.get(allocModalTx.id) ?? null
                  return pid && !uid ? personNameById[pid] ?? null : null
                })()
              : null
          }
          jobLabelById={jobLabelByIdBanking}
          usersOptions={usersSelectOptions}
          nicknameByDebitCard={nicknameByDebitCard}
          nicknameByAccount={nicknameByAccount}
          recentPersonPicksStorageKey={user?.id ?? null}
          onSaved={(_detail: MercuryAllocSavedDetail) => {
            void loadMercuryAllocations()
          }}
        />
      )}

      {isDevBanking && (
        <BankingSortingConfigModal
          open={sortingConfigModalOpen}
          onClose={() => setSortingConfigModalOpen(false)}
          initialConfig={sortingConfig}
          kindChoices={kindOptions}
          accountChoices={accountOptions}
          nicknameByAccount={nicknameByAccount}
          debitCardChoices={debitCardManageIds}
          nicknameByDebitCard={nicknameByDebitCard}
          onSave={handleSortingConfigSave}
        />
      )}

      {canAccessBanking ? (
        <BankingUserCardLinkModal
          open={userCardLinkModalOpen}
          onClose={() => setUserCardLinkModalOpen(false)}
          debitCardIds={debitCardManageIds}
          nicknameByDebitCard={nicknameByDebitCard}
          usersOptions={usersSelectOptions}
          authUserId={user?.id ?? null}
        />
      ) : null}
    </div>
  )
}
