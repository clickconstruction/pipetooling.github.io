import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useToastContext } from '../../contexts/ToastContext'
import { MercuryTransactionAllocationsModal } from '../MercuryTransactionAllocationsModal'
import { fetchOverheadOfficeJobLedgerIdFromAppSettings } from '../../lib/overheadOfficeJobSettings'
import {
  formatNoncardOutflowAmount,
  formatNoncardPostedDate,
  mercuryTxRowFromNoncardQueueRow,
  noncardKindLabel,
  noncardQueueTotalOutflow,
  splitNoncardQueueRowsByWindow,
  NONCARD_QUEUE_WINDOW_DAYS,
  type NoncardAttributionQueueRow,
} from '../../lib/banking/noncardAttributionQueue'

/** A queue row resolved in this session, still undoable (or linked to Banking when not). */
type SessionResolution = {
  row: NoncardAttributionQueueRow
  action: 'office' | 'payroll' | 'card_bill' | 'not_expense' | 'split'
}

const ACTION_LABELS: Record<SessionResolution['action'], string> = {
  office: 'Office',
  payroll: 'Payroll',
  card_bill: 'Card bill',
  not_expense: 'Not an expense',
  split: 'Split across jobs',
}

const rowActionButtonStyle = (disabled: boolean): CSSProperties => ({
  padding: '0.3rem 0.6rem',
  borderRadius: 6,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: disabled ? 'var(--text-muted)' : 'var(--text-700)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap',
})

const officeButtonStyle = (disabled: boolean): CSSProperties => ({
  ...rowActionButtonStyle(disabled),
  background: disabled ? 'var(--bg-slate-tint)' : '#2563eb',
  border: '1px solid #2563eb',
  color: disabled ? 'var(--text-muted)' : '#ffffff',
})

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '0.4rem 0.6rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
}

const tdStyle: CSSProperties = {
  padding: '0.5rem 0.6rem',
  fontSize: '0.875rem',
  borderBottom: '1px solid var(--border)',
  verticalAlign: 'top',
}

/**
 * Body of the Quickfill "Bank transfers needing attribution" section: non-card
 * (ACH/wire/check) money-out Mercury transactions with no attribution. Rows come
 * from the page-level `useQuickfillNoncardAttribution` hook (which also drives
 * the eligibility gate and metric); each action calls its capability-gated RPC
 * and refreshes through the passed `refetch`.
 */
export function QuickfillNoncardAttributionSection({
  rows,
  loading,
  refetch,
}: {
  rows: NoncardAttributionQueueRow[]
  loading: boolean
  refetch: () => Promise<void>
}) {
  const { showToast } = useToastContext()
  const [showOlder, setShowOlder] = useState(false)
  const [busyTxId, setBusyTxId] = useState<string | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [sessionResolutions, setSessionResolutions] = useState<SessionResolution[]>([])
  const [splitRow, setSplitRow] = useState<NoncardAttributionQueueRow | null>(null)
  // null = configured-state unknown (still loading); '' = explicitly unset.
  const [officeJobId, setOfficeJobId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const id = await fetchOverheadOfficeJobLedgerIdFromAppSettings()
        if (!cancelled) setOfficeJobId(id ?? '')
      } catch {
        if (!cancelled) setOfficeJobId('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const { recent, older } = splitNoncardQueueRowsByWindow(rows, Date.now())
  const visibleRows = showOlder ? [...recent, ...older] : recent

  async function runRpc(
    row: NoncardAttributionQueueRow,
    action: SessionResolution['action'],
    call: () => PromiseLike<{ error: { message?: string } | null }>,
  ): Promise<void> {
    if (busyTxId !== null) return
    setBusyTxId(row.mercury_transaction_id)
    setErrorText(null)
    try {
      const { error } = await call()
      if (error) {
        // RPC error messages are user-readable (e.g. "Transaction is allocated
        // to jobs; remove job splits before…") — surface them verbatim.
        setErrorText(error.message ?? 'Something went wrong')
        return
      }
      setSessionResolutions((prev) => [{ row, action }, ...prev])
      showToast(`Labeled ${ACTION_LABELS[action]} — ${row.counterparty_name ?? 'transfer'}`, 'success', 3200)
      await refetch()
    } finally {
      setBusyTxId(null)
    }
  }

  // The queue RPCs are not in the generated types yet — established cast precedent.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = (supabase as any).rpc.bind(supabase)

  async function undoResolution(entry: SessionResolution): Promise<void> {
    if (busyTxId !== null) return
    setBusyTxId(entry.row.mercury_transaction_id)
    setErrorText(null)
    try {
      const { error } =
        entry.action === 'payroll'
          ? await rpc('attributor_flag_transaction_payroll', {
              p_mercury_transaction_id: entry.row.mercury_transaction_id,
              p_is_payroll: false,
            })
          : await rpc('unresolve_noncard_transaction_attribution', {
              p_mercury_transaction_id: entry.row.mercury_transaction_id,
            })
      if (error) {
        setErrorText(error.message ?? 'Something went wrong')
        return
      }
      setSessionResolutions((prev) => prev.filter((e) => e !== entry))
      showToast('Back in the queue', 'info', 2600)
      await refetch()
    } finally {
      setBusyTxId(null)
    }
  }

  const total = noncardQueueTotalOutflow(recent)

  return (
    <div>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Non-card money out (ACH, wire, check) with no label yet — assign each to the office job,
        payroll, a card bill payment, or split it across jobs.
        {recent.length > 0 ? (
          <>
            {' '}
            <strong style={{ color: 'var(--text-700)' }}>
              {recent.length} transfer{recent.length === 1 ? '' : 's'} ·{' '}
              {formatNoncardOutflowAmount(-total)}
            </strong>{' '}
            in the last {NONCARD_QUEUE_WINDOW_DAYS} days.
          </>
        ) : null}
      </p>

      {officeJobId === '' ? (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          One-tap Office labeling is off — the office job is configured in People → Overhead.
        </p>
      ) : null}

      {errorText !== null ? (
        <p role="alert" style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--text-red-600)', fontWeight: 500 }}>
          {errorText}
        </p>
      ) : null}

      {loading ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading…</p>
      ) : visibleRows.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {older.length > 0
            ? `Nothing in the last ${NONCARD_QUEUE_WINDOW_DAYS} days.`
            : 'All bank transfers are labeled. Nice.'}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Posted</th>
                <th style={thStyle}>Counterparty</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                <th style={thStyle}>Kind</th>
                <th style={thStyle}>Memo</th>
                <th style={thStyle}>Label as</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const busy = busyTxId === r.mercury_transaction_id
                const disabled = busyTxId !== null
                return (
                  <tr key={r.mercury_transaction_id} style={busy ? { opacity: 0.6 } : undefined}>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{formatNoncardPostedDate(r.posted_at)}</td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{r.counterparty_name ?? '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {formatNoncardOutflowAmount(r.amount)}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{noncardKindLabel(r.kind)}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', maxWidth: 260 }}>{r.external_memo ?? ''}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {officeJobId !== null && officeJobId !== '' ? (
                          <button
                            type="button"
                            disabled={disabled}
                            style={officeButtonStyle(disabled)}
                            title="Allocate 100% to the office job (rent, insurance, and other true overhead)"
                            onClick={() =>
                              void runRpc(r, 'office', () =>
                                rpc('attributor_allocate_transaction_to_job', {
                                  p_mercury_transaction_id: r.mercury_transaction_id,
                                  p_job_id: officeJobId,
                                }),
                              )
                            }
                          >
                            → Office
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={disabled}
                          style={rowActionButtonStyle(disabled)}
                          title="Contract labor and payroll — direct labor is already counted via hours × wage"
                          onClick={() =>
                            void runRpc(r, 'payroll', () =>
                              rpc('attributor_flag_transaction_payroll', {
                                p_mercury_transaction_id: r.mercury_transaction_id,
                                p_is_payroll: true,
                              }),
                            )
                          }
                        >
                          Payroll
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          style={rowActionButtonStyle(disabled)}
                          title="Credit-card bill payment — the underlying spend lives on the card statement"
                          onClick={() =>
                            void runRpc(r, 'card_bill', () =>
                              rpc('resolve_noncard_transaction_attribution', {
                                p_mercury_transaction_id: r.mercury_transaction_id,
                                p_resolution_kind: 'card_bill_payment',
                              }),
                            )
                          }
                        >
                          Card bill
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          style={rowActionButtonStyle(disabled)}
                          title="Not an expense in this system (owner draws, refunds, etc.)"
                          onClick={() =>
                            void runRpc(r, 'not_expense', () =>
                              rpc('resolve_noncard_transaction_attribution', {
                                p_mercury_transaction_id: r.mercury_transaction_id,
                                p_resolution_kind: 'not_an_expense_other',
                              }),
                            )
                          }
                        >
                          Not an expense
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          style={rowActionButtonStyle(disabled)}
                          onClick={() => setSplitRow(r)}
                        >
                          Split across jobs…
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {older.length > 0 ? (
        <button
          type="button"
          onClick={() => setShowOlder((v) => !v)}
          style={{
            marginTop: '0.75rem',
            padding: '0.35rem 0.75rem',
            borderRadius: 6,
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: 'var(--text-700)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showOlder ? 'Hide older' : `Show older (${older.length} more)`}
        </button>
      ) : null}

      {sessionResolutions.length > 0 ? (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.6rem 0.75rem',
            background: 'var(--bg-green-tint)',
            border: '1px solid var(--border-green)',
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-green-800)', marginBottom: '0.35rem' }}>
            Labeled this session
          </div>
          {sessionResolutions.map((entry) => {
            const undoable = entry.action === 'payroll' || entry.action === 'card_bill' || entry.action === 'not_expense'
            return (
              <div
                key={entry.row.mercury_transaction_id + entry.action}
                style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.2rem 0' }}
              >
                <span>
                  {entry.row.counterparty_name ?? 'Transfer'} · {formatNoncardOutflowAmount(entry.row.amount)} →{' '}
                  <strong>{ACTION_LABELS[entry.action]}</strong>
                </span>
                {undoable ? (
                  <button
                    type="button"
                    disabled={busyTxId !== null}
                    style={rowActionButtonStyle(busyTxId !== null)}
                    onClick={() => void undoResolution(entry)}
                  >
                    Undo
                  </button>
                ) : (
                  // Office/split undo is out of scope here — job allocations are
                  // edited on the Banking page.
                  <span style={{ color: 'var(--text-muted)' }}>
                    undo in <Link to="/banking">Banking</Link> (job splits are edited there)
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      <MercuryTransactionAllocationsModal
        open={splitRow !== null}
        onClose={() => setSplitRow(null)}
        transaction={splitRow ? mercuryTxRowFromNoncardQueueRow(splitRow) : null}
        initialAllocations={[]}
        initialPersonId={null}
        initialUserId={null}
        jobLabelById={{}}
        usersOptions={[]}
        recentPersonPicksStorageKey={null}
        onSaved={(detail) => {
          const row = splitRow
          setSplitRow(null)
          // Saving zero lines clears splits — the row stays in the queue, so
          // only record a session resolution when jobs were actually allocated.
          if (row && detail.allocations.length > 0) {
            setSessionResolutions((prev) => [{ row, action: 'split' }, ...prev])
          }
          void refetch()
        }}
      />
    </div>
  )
}
