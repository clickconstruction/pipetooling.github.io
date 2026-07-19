import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import type { MercuryJobAllocationWithAttributionRow } from '../../lib/fetchMercuryJobAllocationsWithAttributionForJob'
import { useToastContext } from '../../contexts/ToastContext'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { supabase } from '../../lib/supabase'
import type { SearchableSelectOption } from '../SearchableSelect'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { shortUuidPrefix } from '../../lib/shortUuidPrefix'
import {
  resolveUnambiguousUserFromCardNickname,
  type BankingAttributionUser,
} from '../../lib/mercuryCardNicknameUserMatch'
import { dedupeUnattributedRows } from '../../lib/dedupeUnattributedMercuryRows'

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10050,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
}

const panel: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 8,
  maxWidth: 960,
  width: '100%',
  maxHeight: 'min(80vh, 640px)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
}

function formatPosted(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: APP_CALENDAR_TZ,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  } catch {
    return '—'
  }
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export { dedupeUnattributedRows } from '../../lib/dedupeUnattributedMercuryRows'

type Props = {
  open: boolean
  /** Backdrop, X, or empty state — also clears “flow” ref in parent. */
  onRequestClose: () => void
  /** List closes for Assign handoff; do not clear parent ref (needed for post-save refetch). */
  onListCloseForAssign?: () => void
  jobId: string
  rows: MercuryJobAllocationWithAttributionRow[] | null
  onAssignToTransaction: (mercuryTransactionId: string) => void | Promise<void>
  /** Same maps as Banking / MercuryTransactionAllocationsModal; optional for tests. */
  nicknameByDebitCard?: Record<string, string>
  nicknameByAccount?: Record<string, string>
  /** Same roster as `list_users_for_banking_attribution` (e.g. `bankingAttributionUsersOptions` as id+name). */
  usersForMatch?: BankingAttributionUser[]
  /** One-click set user attribution when `resolveUnambiguousUserFromCardNickname` finds a match. */
  onQuickAddUser?: (mercuryTransactionId: string, user: BankingAttributionUser) => void | Promise<void>
}

/**
 * List Mercury allocation lines (this job) with no person/user attribution.
 * Parent loads alloc modal; parent should clear parts-tab Mercury cache on save.
 */
export function PartsUnattributedMercuryListModal({
  open,
  onRequestClose,
  onListCloseForAssign,
  jobId,
  rows,
  onAssignToTransaction,
  nicknameByDebitCard: nicknameByDebitCardProp = {},
  nicknameByAccount: nicknameByAccountProp = {},
  usersForMatch = [],
  onQuickAddUser,
}: Props) {
  const { showToast } = useToastContext()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [allocLoadingId, setAllocLoadingId] = useState<string | null>(null)
  const [quickAddLoadingId, setQuickAddLoadingId] = useState<string | null>(null)

  const onAssign = useCallback(
    async (mercuryTransactionId: string) => {
      setLoadError(null)
      setAllocLoadingId(mercuryTransactionId)
      try {
        await onAssignToTransaction(mercuryTransactionId)
        onListCloseForAssign?.()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not open allocation editor.'
        setLoadError(msg)
        showToast(msg, 'error')
      } finally {
        setAllocLoadingId(null)
      }
    },
    [onListCloseForAssign, onAssignToTransaction, showToast],
  )

  const onQuickAdd = useCallback(
    async (mercuryTransactionId: string, user: BankingAttributionUser) => {
      if (!onQuickAddUser) return
      setLoadError(null)
      setQuickAddLoadingId(mercuryTransactionId)
      try {
        await onQuickAddUser(mercuryTransactionId, user)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save attribution.'
        setLoadError(msg)
        showToast(msg, 'error')
      } finally {
        setQuickAddLoadingId(null)
      }
    },
    [onQuickAddUser, showToast],
  )

  const unattributed = rows?.filter((r) => r.attributionDisplayName == null) ?? []
  const lines = dedupeUnattributedRows(unattributed)

  useEffect(() => {
    if (open) setLoadError(null)
  }, [open])

  if (!open) return null

  return (
    <div style={overlay} onClick={onRequestClose} role="presentation">
      <div
        style={panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Unattributed card lines for job ${shortJobLabel(jobId)}`}
      >
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Unattributed card (this job)</h2>
            <button type="button" onClick={onRequestClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }} aria-label="Close">×</button>
        </div>
        {loadError && (
          <p style={{ margin: 0, padding: '0.5rem 1rem', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>{loadError}</p>
        )}
        <div style={{ padding: '0.75rem 1rem', overflow: 'auto', flex: 1, minHeight: 0 }}>
          {lines.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>No unattributed card lines for this job.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-muted)' }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Posted</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Card</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Account</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Counterparty</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>Allocated to this job</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}> </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map(({ mercury_transaction_id, lineAmount, sample }) => {
                    const tx = sample.mercury_transactions
                    const posted = formatPosted(tx?.posted_at ?? null)
                    const cp = tx?.counterparty_name ?? '—'
                    const debitId = tx ? mercuryDebitCardIdFromRaw(tx.raw) : null
                    const cardNickname =
                      debitId != null && nicknameByDebitCardProp[debitId] ? nicknameByDebitCardProp[debitId] : undefined
                    const cardLabel =
                      debitId != null
                        ? cardNickname ?? formatMercuryDebitCardIdCompact(debitId)
                        : '—'
                    const quickAddUser = onQuickAddUser
                      ? resolveUnambiguousUserFromCardNickname(cardNickname, usersForMatch)
                      : null
                    const rowBusy = allocLoadingId === mercury_transaction_id || quickAddLoadingId === mercury_transaction_id
                    const accId = tx?.mercury_account_id
                    const accountLabel = accId
                      ? nicknameByAccountProp[accId] ?? shortUuidPrefix(accId)
                      : '—'
                    return (
                      <tr key={mercury_transaction_id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{posted}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{cardLabel}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{accountLabel}</td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>{cp}</td>
                        <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{formatCurrency(lineAmount)}</td>
                        <td
                          style={{
                            padding: '0.4rem 0.5rem',
                            textAlign: 'right',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.35rem',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {quickAddUser ? (
                            <button
                              type="button"
                              onClick={() => void onQuickAdd(mercury_transaction_id, quickAddUser)}
                              disabled={rowBusy}
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                padding: '4px 10px',
                                borderRadius: 6,
                                border: '1px solid #047857',
                                background: 'var(--bg-emerald-tint)',
                                color: '#047857',
                                cursor: rowBusy ? 'wait' : 'pointer',
                              }}
                            >
                              {quickAddLoadingId === mercury_transaction_id
                                ? '…'
                                : `Add ${quickAddUser.name}`}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void onAssign(mercury_transaction_id)}
                            disabled={rowBusy}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '4px 10px',
                              borderRadius: 6,
                              border: '1px solid var(--border)',
                              background: 'var(--surface)',
                              color: 'var(--text-link)',
                              cursor: rowBusy ? 'wait' : 'pointer',
                            }}
                          >
                            {allocLoadingId === mercury_transaction_id ? '…' : 'Assign'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function shortJobLabel(id: string): string {
  if (id.length <= 16) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

export async function loadUsersOptionsForBankingAttribution(): Promise<SearchableSelectOption[]> {
  const data = await withSupabaseRetry(
    () => supabase.rpc('list_users_for_banking_attribution'),
    'list users banking attribution',
  )
  const rowsU = (data ?? []) as { id: string; name: string }[]
  return rowsU.map((p) => ({ value: p.id, label: p.name }))
}
