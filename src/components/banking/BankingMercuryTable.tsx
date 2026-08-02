import { Fragment, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react'
import type { Database } from '../../types/database'
import {
  mercuryTxHasNotePreview,
  MercuryTxNotesEditorPanel,
  MercuryTxNotesReadOnlyPreview,
  mercuryTxNotesPanelDomId,
  mercuryTxNotesPreviewDomId,
  mercuryTxNotesSubRowInnerStyle,
  mercuryTxNotesSubRowTdStyle,
  mercuryTxNotesToggleDomId,
} from './MercuryTxNotesDisclosure'
import { bankingMercuryNotesSubRowColSpans } from '../../lib/bankingMercuryNotesSubRowColSpan'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { shortUuidPrefix } from '../../lib/shortUuidPrefix'
import type { MercuryJobSplit } from '../MercuryTransactionAllocationsModal'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

/**
 * The shared Ledger / User Sort transaction table (+ `SortTh`,
 * `TransactionDetailPanel`, and the local date/currency format helpers) —
 * verbatim module move out of Banking.tsx (in-file component moves; see
 * BANKING_TABS_ARCHITECTURE.md). `SortKey` and `formatCurrency` moved with it;
 * the page imports them back.
 */
export type SortKey = 'posted_at' | 'mercury_account_id' | 'mercury_id'

export function formatCurrency(n: number): string {
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
  color: 'var(--text-slate-500)',
  fontSize: '0.8125rem',
}

const bankingAllocLinkButtonStyle: CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '4px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text-slate-600)',
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
        borderBottom: '1px solid var(--border)',
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
  const labelStyle: CSSProperties = { color: 'var(--text-muted)', fontWeight: 500 }

  return (
    <div
      style={{
        padding: '0.75rem 1rem',
        background: 'var(--bg-page)',
        borderTop: '1px solid var(--border)',
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
          background: 'var(--surface)',
          border: '1px solid var(--border)',
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
  /** Organization team notes for visible rows (from `useMercuryOrgNotesByTxId`). */
  orgNotesByTxId: Map<string, string>
  onOrgNoteUpdated: (txId: string, body: string) => void
}

export function BankingMercuryTable({
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
  orgNotesByTxId,
  onOrgNoteUpdated,
}: BankingMercuryTableProps) {
  const [notesExpandedTxId, setNotesExpandedTxId] = useState<string | null>(null)
  const tableColSpan =
    (hideKindColumn ? 7 : 8) + (showAllocations ? 2 : 0) - (counterpartyNoteCombined ? 1 : 0)
  const notesSubRowSpans = bankingMercuryNotesSubRowColSpans({
    hideKindColumn,
    debitAndAccountAfterAmount,
    showAllocations,
    counterpartyNoteCombined,
  })

  function allocationCells(r: MercuryTxRow, notesContinuationBelow: boolean) {
    const mainBb = notesContinuationBelow ? 'none' : '1px solid var(--border)'
    const pad = notesContinuationBelow ? '0.5rem 0.75rem 0 0.75rem' : '0.5rem 0.75rem'
    const uid = userIdByTxId.get(r.id) ?? null
    const pid = personIdByTxId.get(r.id) ?? null
    const personLabel =
      uid ? (userNameById[uid] ?? shortUuidPrefix(uid)) : pid ? (personNameById[pid] ?? shortUuidPrefix(pid)) : null

    return (
      <>
        <td style={{ padding: pad, borderBottom: mainBb, fontSize: '0.8125rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {personLabel ? (
            <span style={{ fontWeight: 500, color: 'var(--text-slate-900)' }} title={personLabel}>
              {personLabel}
            </span>
          ) : (
            <span style={bankingAllocMuted}>Unassigned</span>
          )}
        </td>
        <td style={{ padding: pad, borderBottom: mainBb, fontSize: '0.8125rem', verticalAlign: 'middle' }}>
          {(() => {
            const allocs = allocationsByTxId.get(r.id) ?? []
            const hasJobs = allocs.length > 0
            const summary = hasJobs
              ? `${allocs.length} job${allocs.length === 1 ? '' : 's'} · ${formatCurrency(allocs.reduce((s, a) => s + Math.abs(Number(a.amount)), 0))}`
              : null
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                {hasJobs ? (
                  <span style={{ color: 'var(--text-slate-900)', fontWeight: 500 }}>{summary}</span>
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
      <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Person</th>
      <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Jobs</th>
    </>
  ) : null

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 4 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left' }}>
            <th style={{ padding: '0.5rem 0.35rem', borderBottom: '1px solid var(--border)', width: '2.25rem' }} aria-label="Expand row" />
            <SortTh label="Posted" column="posted_at" sort={sort} onSort={onSortColumn} />
            <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Amount</th>
            {hideKindColumn ? null : (
              <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Kind</th>
            )}
            {debitAndAccountAfterAmount ? (
              <>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Debit card</th>
                <SortTh label="Account" column="mercury_account_id" sort={sort} onSort={onSortColumn} />
              </>
            ) : null}
            <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
              {counterpartyNoteCombined ? 'Counterparty / Note' : 'Counterparty'}
            </th>
            {showAllocations && allocationsAfterCounterparty ? allocationThPair : null}
            {counterpartyNoteCombined ? null : (
              <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Note</th>
            )}
            {debitAndAccountAfterAmount ? null : (
              <>
                <th style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>Debit card</th>
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
            const orgNoteBody = orgNotesByTxId.get(r.id) ?? ''
            const editorOpen = notesExpandedTxId === r.id
            const hasNotePreview = mercuryTxHasNotePreview(r, orgNoteBody)
            const notesContinuationBelow = (hasNotePreview && !editorOpen) || editorOpen
            const mainRowBb = notesContinuationBelow ? 'none' : '1px solid var(--border)'
            const padMain = notesContinuationBelow ? '0.5rem 0.75rem 0 0.75rem' : '0.5rem 0.75rem'
            const padExpand = notesContinuationBelow ? '0.5rem 0.35rem 0 0.35rem' : '0.5rem 0.35rem'
            const isExcludedDup = !!r.duplicate_of_transaction_id
            function toggleExpand() {
              setExpandedRowId((cur) => (cur === r.id ? null : r.id))
            }
            return (
              <Fragment key={r.id}>
                <tr
                  onClick={toggleExpand}
                  style={{
                    borderBottom: mainRowBb,
                    cursor: 'pointer',
                    opacity: isExcludedDup ? 0.55 : 1,
                    textDecoration: isExcludedDup ? 'line-through' : 'none',
                  }}
                >
                  <td
                    style={{ padding: padExpand, borderBottom: mainRowBb, verticalAlign: 'middle' }}
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
                        color: 'var(--text-700)',
                      }}
                    >
                      <span aria-hidden style={{ fontSize: '0.65rem' }}>{expanded ? '▼' : '▶'}</span>
                    </button>
                  </td>
                  <td style={{ padding: padMain, borderBottom: mainRowBb }}>
                    {formatDate(r.posted_at)}
                    {isExcludedDup ? (
                      <span
                        title="Marked as a duplicate — excluded from the books. Manage it in the Accounting tab's Possible duplicates panel."
                        style={{
                          display: 'inline-block',
                          marginTop: 2,
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          color: 'var(--text-amber-800)',
                          background: 'var(--bg-amber-100)',
                          borderRadius: 999,
                          padding: '1px 6px',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Excluded duplicate
                      </span>
                    ) : null}
                  </td>
                  <td
                    style={{
                      padding: padMain,
                      borderBottom: mainRowBb,
                      verticalAlign: 'top',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                      <span>{formatCurrency(Number(r.amount))}</span>
                      <button
                        type="button"
                        id={mercuryTxNotesToggleDomId(r.id)}
                        aria-expanded={editorOpen}
                        aria-controls={mercuryTxNotesPanelDomId(r.id)}
                        onClick={(e) => {
                          e.stopPropagation()
                          setNotesExpandedTxId((cur) => (cur === r.id ? null : r.id))
                        }}
                        style={{
                          padding: '2px 0',
                          margin: 0,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--text-slate-400)',
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {editorOpen ? 'Hide edit' : 'Edit note'}
                      </button>
                    </div>
                  </td>
                  {hideKindColumn ? null : (
                    <td style={{ padding: padMain, borderBottom: mainRowBb }}>{formatMercuryKind(r.kind)}</td>
                  )}
                  {debitAndAccountAfterAmount ? (
                    <>
                      <td style={{ padding: padMain, borderBottom: mainRowBb, fontSize: '0.8125rem' }}>
                        {debitCardId ? nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId) : '—'}
                      </td>
                      <td style={{ padding: padMain, borderBottom: mainRowBb, fontSize: '0.8125rem' }}>
                        {nicknameByAccount[r.mercury_account_id] ?? shortUuidPrefix(r.mercury_account_id)}
                      </td>
                    </>
                  ) : null}
                  {counterpartyNoteCombined ? (
                    <td
                      style={{
                        padding: padMain,
                        borderBottom: mainRowBb,
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
                              style={{ fontSize: '0.75rem', color: 'var(--text-slate-500)', wordBreak: 'break-word', lineHeight: 1.35 }}
                              title={nt}
                            >
                              {nt}
                            </span>
                          )
                        })()}
                      </div>
                    </td>
                  ) : (
                    <td style={{ padding: padMain, borderBottom: mainRowBb }}>{r.counterparty_name ?? '—'}</td>
                  )}
                  {showAllocations && allocationsAfterCounterparty ? allocationCells(r, notesContinuationBelow) : null}
                  {counterpartyNoteCombined ? null : (
                    <td style={{ padding: padMain, borderBottom: mainRowBb, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.note ?? '—'}
                    </td>
                  )}
                  {debitAndAccountAfterAmount ? null : (
                    <>
                      <td style={{ padding: padMain, borderBottom: mainRowBb, fontSize: '0.8125rem' }}>
                        {debitCardId ? nicknameByDebitCard[debitCardId] ?? formatMercuryDebitCardIdCompact(debitCardId) : '—'}
                      </td>
                      <td style={{ padding: padMain, borderBottom: mainRowBb, fontSize: '0.8125rem' }}>
                        {nicknameByAccount[r.mercury_account_id] ?? shortUuidPrefix(r.mercury_account_id)}
                      </td>
                    </>
                  )}
                  {showAllocations && !allocationsAfterCounterparty ? allocationCells(r, notesContinuationBelow) : null}
                </tr>
                {hasNotePreview && !editorOpen ? (
                  <tr>
                    {notesSubRowSpans.colsBeforeCounterparty > 0 ? (
                      <td
                        colSpan={notesSubRowSpans.colsBeforeCounterparty}
                        aria-hidden
                        style={mercuryTxNotesSubRowTdStyle}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : null}
                    <td
                      colSpan={notesSubRowSpans.colsFromCounterparty}
                      id={mercuryTxNotesPreviewDomId(r.id)}
                      role="region"
                      aria-label="Transaction notes"
                      style={mercuryTxNotesSubRowTdStyle}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={mercuryTxNotesSubRowInnerStyle}>
                        <MercuryTxNotesReadOnlyPreview row={r} orgBody={orgNoteBody} />
                      </div>
                    </td>
                  </tr>
                ) : null}
                {editorOpen ? (
                  <tr>
                    {notesSubRowSpans.colsBeforeCounterparty > 0 ? (
                      <td
                        colSpan={notesSubRowSpans.colsBeforeCounterparty}
                        aria-hidden
                        style={mercuryTxNotesSubRowTdStyle}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : null}
                    <td
                      colSpan={notesSubRowSpans.colsFromCounterparty}
                      id={mercuryTxNotesPanelDomId(r.id)}
                      role="region"
                      aria-labelledby={mercuryTxNotesToggleDomId(r.id)}
                      style={mercuryTxNotesSubRowTdStyle}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={mercuryTxNotesSubRowInnerStyle}>
                        <MercuryTxNotesEditorPanel
                          row={r}
                          orgBody={orgNoteBody}
                          onOrgNoteUpdated={onOrgNoteUpdated}
                          onSaveSuccess={() => setNotesExpandedTxId(null)}
                          onCloseRequest={() => setNotesExpandedTxId(null)}
                        />
                      </div>
                    </td>
                  </tr>
                ) : null}
                {expanded && (
                  <tr>
                    <td colSpan={tableColSpan} style={{ padding: 0, borderBottom: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                      <TransactionDetailPanel r={r} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {displayRows.length === 0 && <div style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>{emptyMessage}</div>}
    </div>
  )
}
