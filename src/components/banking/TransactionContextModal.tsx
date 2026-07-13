import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Database } from '../../types/database'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { formatMercuryKind } from '../../lib/mercuryKindLabels'
import { mercuryBankDescriptionFromRaw } from '../../lib/mercuryBankDescriptionFromRaw'

type MercuryTxRow = Database['public']['Tables']['mercury_transactions']['Row']

const PAGE = 20

export type TransactionContextModalProps = {
  open: boolean
  onClose: () => void
  /** The transaction the surrounding window is centered on. */
  anchor: MercuryTxRow | null
  nicknameByAccount: Record<string, string>
  /** Re-anchor the Transaction Detail to a clicked row. */
  onOpenTransaction: (txId: string) => void
  zIndex?: number
}

function usd(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
function amountColor(n: number): string {
  if (n > 0) return '#047857'
  if (n < 0) return '#b91c1c'
  return '#374151'
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
function acct(id: string, nick: Record<string, string>): string {
  return nick[id] ?? `${id.slice(0, 8)}…`
}

export function TransactionContextModal({ open, onClose, anchor, nicknameByAccount, onOpenTransaction, zIndex = 1350 }: TransactionContextModalProps) {
  const { showToast } = useToastContext()
  // newerRows + olderRows are kept in display order (posted_at desc): newerRows above the anchor, olderRows below.
  const [newerRows, setNewerRows] = useState<MercuryTxRow[]>([])
  const [olderRows, setOlderRows] = useState<MercuryTxRow[]>([])
  const [hasMoreNewer, setHasMoreNewer] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [initialLoading, setInitialLoading] = useState(false)
  const [loadingNewer, setLoadingNewer] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNewer = useCallback(async (cursor: MercuryTxRow): Promise<MercuryTxRow[]> => {
    // RPC returns ascending (nearest-newer first); reverse to desc for display.
    const data = await withSupabaseRetry(
      async () =>
        supabase.rpc('list_mercury_transactions_keyset_before', {
          p_before_posted_at: cursor.posted_at ?? undefined,
          p_before_id: cursor.id,
          p_limit: PAGE,
        }),
      'tx context newer',
    )
    return ((data as MercuryTxRow[]) ?? []).slice().reverse()
  }, [])

  const fetchOlder = useCallback(async (cursor: MercuryTxRow): Promise<MercuryTxRow[]> => {
    const data = await withSupabaseRetry(
      async () =>
        supabase.rpc('list_mercury_transactions_keyset', {
          p_after_posted_at: cursor.posted_at ?? undefined,
          p_after_id: cursor.id,
          p_limit: PAGE,
        }),
      'tx context older',
    )
    return (data as MercuryTxRow[]) ?? []
  }, [])

  // Initial load when opened (or anchor changes).
  useEffect(() => {
    if (!open || !anchor) return
    let cancelled = false
    setInitialLoading(true)
    setError(null)
    setNewerRows([])
    setOlderRows([])
    void (async () => {
      try {
        const [newer, older] = await Promise.all([fetchNewer(anchor), fetchOlder(anchor)])
        if (cancelled) return
        const aid = anchor.id
        const dedupNewer = newer.filter((r) => r.id !== aid)
        const dedupOlder = older.filter((r) => r.id !== aid)
        setNewerRows(dedupNewer)
        setOlderRows(dedupOlder)
        setHasMoreNewer(newer.length === PAGE)
        setHasMoreOlder(older.length === PAGE)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load surrounding transactions')
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, anchor, fetchNewer, fetchOlder])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const loadMoreNewer = useCallback(async () => {
    const cursor = newerRows[0] ?? anchor
    if (!cursor || loadingNewer) return
    setLoadingNewer(true)
    try {
      const rows = await fetchNewer(cursor)
      const seen = new Set([anchor?.id, ...newerRows.map((r) => r.id), ...olderRows.map((r) => r.id)])
      const fresh = rows.filter((r) => !seen.has(r.id))
      setNewerRows((prev) => [...fresh, ...prev])
      setHasMoreNewer(rows.length === PAGE)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load more', 'error')
    } finally {
      setLoadingNewer(false)
    }
  }, [newerRows, olderRows, anchor, loadingNewer, fetchNewer, showToast])

  const loadMoreOlder = useCallback(async () => {
    const cursor = olderRows[olderRows.length - 1] ?? anchor
    if (!cursor || loadingOlder) return
    setLoadingOlder(true)
    try {
      const rows = await fetchOlder(cursor)
      const seen = new Set([anchor?.id, ...newerRows.map((r) => r.id), ...olderRows.map((r) => r.id)])
      const fresh = rows.filter((r) => !seen.has(r.id))
      setOlderRows((prev) => [...prev, ...fresh])
      setHasMoreOlder(rows.length === PAGE)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load more', 'error')
    } finally {
      setLoadingOlder(false)
    }
  }, [olderRows, newerRows, anchor, loadingOlder, fetchOlder, showToast])

  if (!open || !anchor) return null

  const renderRow = (r: MercuryTxRow, isAnchor: boolean) => {
    const cp = r.counterparty_name?.trim() || ''
    const bankDesc = mercuryBankDescriptionFromRaw(r.raw)?.trim() || ''
    const showBankDesc = bankDesc !== '' && bankDesc.toLowerCase() !== cp.toLowerCase()
    const cells = (
      <>
        <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDate(r.posted_at)}</td>
        <td style={td}>
          {cp ? <span>{cp}</span> : !showBankDesc ? <span style={{ color: 'var(--text-faint)' }}>—</span> : null}
          {showBankDesc ? (
            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-slate-400)', wordBreak: 'break-word' }}>{bankDesc}</span>
          ) : null}
        </td>
        <td style={{ ...td, fontSize: '0.75rem', color: 'var(--text-slate-500)', whiteSpace: 'nowrap' }}>{acct(r.mercury_account_id, nicknameByAccount)}</td>
        <td style={{ ...td, fontSize: '0.75rem', color: 'var(--text-slate-500)', whiteSpace: 'nowrap' }}>{formatMercuryKind(r.kind)}</td>
        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: amountColor(Number(r.amount)), fontWeight: 500, whiteSpace: 'nowrap' }}>
          {usd(Number(r.amount))}
        </td>
      </>
    )
    if (isAnchor) {
      return (
        <tr key={r.id} aria-current="true" style={{ background: '#fef9c3', borderLeft: '3px solid #ca8a04' }}>
          {cells}
        </tr>
      )
    }
    return (
      <tr
        key={r.id}
        onClick={() => {
          onOpenTransaction(r.id)
          onClose()
        }}
        style={{ cursor: 'pointer' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
      >
        {cells}
      </tr>
    )
  }

  const moreBtn = (label: string, loading: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{ width: '100%', padding: '0.5rem', border: 'none', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', background: 'var(--bg-slate-tint)', color: 'var(--text-link)', fontWeight: 600, fontSize: '0.8rem', cursor: loading ? 'wait' : 'pointer' }}
    >
      {loading ? 'Loading…' : label}
    </button>
  )

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex, padding: '1rem', boxSizing: 'border-box' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-context-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 10, maxWidth: 760, width: '100%', maxHeight: 'min(90vh, 720px)', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 id="tx-context-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
              Around {fmtDate(anchor.posted_at)}
            </h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-slate-500)', marginTop: 2 }}>Ledger transactions by date · all accounts · click a row to open it</div>
          </div>
          <button type="button" onClick={onClose} style={{ padding: '0.4rem 0.85rem', border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 6, cursor: 'pointer', fontSize: '0.875rem' }}>
            Close
          </button>
        </div>

        <div style={{ overflow: 'auto', flex: '1 1 auto' }}>
          {error ? (
            <p role="alert" style={{ margin: '1rem', padding: '0.5rem 0.75rem', borderRadius: 6, background: 'var(--bg-red-tint)', border: '1px solid #fecaca', color: 'var(--text-red-800)', fontSize: '0.8rem' }}>{error}</p>
          ) : initialLoading ? (
            <p style={{ margin: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading…</p>
          ) : (
            <>
              {hasMoreNewer ? moreBtn('↑ Show 20 newer', loadingNewer, () => void loadMoreNewer()) : null}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <tbody>
                  {newerRows.map((r) => renderRow(r, false))}
                  {renderRow(anchor, true)}
                  {olderRows.map((r) => renderRow(r, false))}
                </tbody>
              </table>
              {hasMoreOlder ? moreBtn('↓ Show 20 older', loadingOlder, () => void loadMoreOlder()) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const td: CSSProperties = { padding: '0.4rem 0.65rem', borderBottom: '1px solid #f3f4f6', color: '#1f2937' }
