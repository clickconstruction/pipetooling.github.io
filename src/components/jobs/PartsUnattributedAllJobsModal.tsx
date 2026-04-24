import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import { useToastContext } from '../../contexts/ToastContext'
import { formatMercuryDebitCardIdCompact, mercuryDebitCardIdFromRaw } from '../../lib/mercuryRawDebitCard'
import { shortUuidPrefix } from '../../lib/shortUuidPrefix'
import {
  resolveUnambiguousUserFromCardNickname,
  type BankingAttributionUser,
} from '../../lib/mercuryCardNicknameUserMatch'
import type { UnattributedMercuryLineForJob } from '../../lib/fetchUnattributedMercuryForManyJobs'

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
  background: 'white',
  borderRadius: 8,
  maxWidth: 1024,
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

export function rowActionKey(jobId: string, mercuryTransactionId: string): string {
  return `${jobId}::${mercuryTransactionId}`
}

type Props = {
  open: boolean
  onRequestClose: () => void
  onListCloseForAssign?: () => void
  loading: boolean
  lines: UnattributedMercuryLineForJob[] | null
  /** Omitted for read-only (no Banking-style access). */
  onAssignToTransaction?: (mercuryTransactionId: string, jobId: string) => void | Promise<void>
  nicknameByDebitCard?: Record<string, string>
  nicknameByAccount?: Record<string, string>
  usersForMatch?: BankingAttributionUser[]
  onQuickAddUser?: (mercuryTransactionId: string, user: BankingAttributionUser, jobId: string) => void | Promise<void>
}

/**
 * Unattributed Mercury card lines across multiple jobs (Parts tab).
 * Actions must set parent `partsUnattribFlowJobIdRef` via jobId in callbacks.
 */
export function PartsUnattributedAllJobsModal({
  open,
  onRequestClose,
  onListCloseForAssign,
  loading,
  lines,
  onAssignToTransaction,
  nicknameByDebitCard: nicknameByDebitCardProp = {},
  nicknameByAccount: nicknameByAccountProp = {},
  usersForMatch = [],
  onQuickAddUser,
}: Props) {
  const { showToast } = useToastContext()
  const [loadError, setLoadError] = useState<string | null>(null)
  const [allocLoadingKey, setAllocLoadingKey] = useState<string | null>(null)
  const [quickAddLoadingKey, setQuickAddLoadingKey] = useState<string | null>(null)

  const onAssign = useCallback(
    async (mercuryTransactionId: string, jobId: string) => {
      if (!onAssignToTransaction) return
      const k = rowActionKey(jobId, mercuryTransactionId)
      setLoadError(null)
      setAllocLoadingKey(k)
      try {
        await onAssignToTransaction(mercuryTransactionId, jobId)
        onListCloseForAssign?.()
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not open allocation editor.'
        setLoadError(msg)
        showToast(msg, 'error')
      } finally {
        setAllocLoadingKey(null)
      }
    },
    [onListCloseForAssign, onAssignToTransaction, showToast],
  )

  const canEdit = Boolean(onAssignToTransaction)

  const onQuickAdd = useCallback(
    async (mercuryTransactionId: string, user: BankingAttributionUser, jobId: string) => {
      if (!onQuickAddUser) return
      const k = rowActionKey(jobId, mercuryTransactionId)
      setLoadError(null)
      setQuickAddLoadingKey(k)
      try {
        await onQuickAddUser(mercuryTransactionId, user, jobId)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not save attribution.'
        setLoadError(msg)
        showToast(msg, 'error')
      } finally {
        setQuickAddLoadingKey(null)
      }
    },
    [onQuickAddUser, showToast],
  )

  useEffect(() => {
    if (open) setLoadError(null)
  }, [open])

  if (!open) return null

  const displayLines = lines ?? []
  const showEmpty = !loading && displayLines.length === 0

  return (
    <div style={overlay} onClick={onRequestClose} role="presentation">
      <div
        style={panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Unattributed card lines for all jobs"
      >
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>Unattributed card (all jobs)</h2>
          <button type="button" onClick={onRequestClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }} aria-label="Close">
            ×
          </button>
        </div>
        {loadError && (
          <p style={{ margin: 0, padding: '0.5rem 1rem', color: '#b91c1c', fontSize: '0.875rem' }}>{loadError}</p>
        )}
        <div style={{ padding: '0.75rem 1rem', overflow: 'auto', flex: 1, minHeight: 0 }}>
          {loading ? (
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Loading…</p>
          ) : showEmpty ? (
            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>No unattributed card lines in scope, or no jobs with card activity.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Job</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Posted</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Card</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Account</th>
                    <th style={{ textAlign: 'left', padding: '0.4rem 0.5rem' }}>Counterparty</th>
                    <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}>Allocated to this job</th>
                    {canEdit ? <th style={{ textAlign: 'right', padding: '0.4rem 0.5rem' }}> </th> : null}
                  </tr>
                </thead>
                <tbody>
                  {displayLines.map(
                    ({ jobId, jobLabel, mercury_transaction_id, lineAmount, sample }) => {
                      const k = rowActionKey(jobId, mercury_transaction_id)
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
                      const quickAddUser =
                        onQuickAddUser && onAssignToTransaction
                          ? resolveUnambiguousUserFromCardNickname(cardNickname, usersForMatch)
                          : null
                      const accId = tx?.mercury_account_id
                      const accountLabel = accId
                        ? nicknameByAccountProp[accId] ?? shortUuidPrefix(accId)
                        : '—'
                      const rowBusy = allocLoadingKey === k || quickAddLoadingKey === k
                      return (
                        <tr key={k} style={{ borderTop: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{jobLabel}</td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{posted}</td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{cardLabel}</td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{accountLabel}</td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>{cp}</td>
                          <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right' }}>{formatCurrency(lineAmount)}</td>
                          {canEdit ? (
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
                                  onClick={() => void onQuickAdd(mercury_transaction_id, quickAddUser, jobId)}
                                  disabled={rowBusy}
                                  style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    padding: '4px 10px',
                                    borderRadius: 6,
                                    border: '1px solid #047857',
                                    background: '#ecfdf5',
                                    color: '#047857',
                                    cursor: rowBusy ? 'wait' : 'pointer',
                                  }}
                                >
                                  {quickAddLoadingKey === k ? '…' : `Add ${quickAddUser.name}`}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void onAssign(mercury_transaction_id, jobId)}
                                disabled={rowBusy}
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                  border: '1px solid #e2e8f0',
                                  background: '#fff',
                                  color: '#2563eb',
                                  cursor: rowBusy ? 'wait' : 'pointer',
                                }}
                              >
                                {allocLoadingKey === k ? '…' : 'Assign'}
                              </button>
                            </td>
                          ) : null}
                        </tr>
                      )
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
