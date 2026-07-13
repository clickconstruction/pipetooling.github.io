import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { mercuryBankDescriptionFromRaw } from '../../lib/mercuryBankDescriptionFromRaw'
import { formatBankingDate, formatUsd } from './bankingMercuryDragSortLedger'
import { clusterDuplicatePairs, type DuplicateCluster } from '../../lib/mercuryDuplicateClusters'
import {
  clearMercuryTransactionDuplicate,
  dismissMercuryDuplicatePair,
  fetchExcludedDuplicates,
  fetchMercuryDuplicatePairs,
  markMercuryTransactionDuplicate,
  type ExcludedDuplicateRow,
} from '../../lib/fetchMercuryDuplicates'

export type BankingMercuryDuplicatesPanelProps = {
  /** Called after a mark/undo so the parent reloads rows and totals. */
  onAfterChange: () => void
  nicknameByAccount?: Record<string, string>
}

const sourceBadge = (source: string) =>
  source === 'manual'
    ? { label: 'Manual', bg: '#fef3c7', fg: '#92400e' }
    : { label: 'Synced', bg: '#e0f2fe', fg: '#075985' }

export function BankingMercuryDuplicatesPanel({ onAfterChange, nicknameByAccount }: BankingMercuryDuplicatesPanelProps) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [includeSyncedRepeats, setIncludeSyncedRepeats] = useState(false)
  const [clusters, setClusters] = useState<DuplicateCluster[]>([])
  const [excluded, setExcluded] = useState<ExcludedDuplicateRow[]>([])
  const [keeperByCluster, setKeeperByCluster] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [showExcluded, setShowExcluded] = useState(false)
  const loadSeqRef = useRef(0)

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      const [pairs, exc] = await Promise.all([
        fetchMercuryDuplicatePairs({ manualOnly: !includeSyncedRepeats }),
        fetchExcludedDuplicates(),
      ])
      if (loadSeqRef.current !== seq) return
      setClusters(clusterDuplicatePairs(pairs))
      setExcluded(exc)
    } catch (e) {
      if (loadSeqRef.current !== seq) return
      showToast(e instanceof Error ? e.message : 'Could not load possible duplicates', 'error')
    } finally {
      if (loadSeqRef.current === seq) setLoading(false)
    }
  }, [includeSyncedRepeats, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const keeperFor = useCallback(
    (c: DuplicateCluster) => keeperByCluster[c.key] ?? c.members[0]?.id ?? '',
    [keeperByCluster],
  )

  const handleMarkDuplicate = useCallback(
    async (c: DuplicateCluster) => {
      const keeperId = keeperFor(c)
      const dupes = c.members.filter((m) => m.id !== keeperId)
      if (dupes.length === 0) return
      setBusyKey(c.key)
      try {
        for (const d of dupes) {
          await markMercuryTransactionDuplicate(d.id, keeperId)
        }
        showToast(
          dupes.length === 1 ? 'Marked as duplicate — excluded from the books.' : `Excluded ${dupes.length} duplicates.`,
          'success',
        )
        setClusters((prev) => prev.filter((x) => x.key !== c.key))
        onAfterChange()
        void load()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not mark duplicate', 'error')
      } finally {
        setBusyKey(null)
      }
    },
    [keeperFor, load, onAfterChange, showToast],
  )

  const handleDismiss = useCallback(
    async (c: DuplicateCluster) => {
      setBusyKey(c.key)
      try {
        for (const pk of c.pairKeys) {
          const [idA, idB] = pk.split('|')
          if (idA && idB) await dismissMercuryDuplicatePair(idA, idB)
        }
        showToast('Marked “not a duplicate”.', 'success')
        setClusters((prev) => prev.filter((x) => x.key !== c.key))
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not dismiss', 'error')
      } finally {
        setBusyKey(null)
      }
    },
    [showToast],
  )

  const handleUndo = useCallback(
    async (row: ExcludedDuplicateRow) => {
      setBusyKey(row.id)
      try {
        await clearMercuryTransactionDuplicate(row.id)
        showToast('Restored — back in the books.', 'success')
        setExcluded((prev) => prev.filter((x) => x.id !== row.id))
        onAfterChange()
        void load()
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not restore', 'error')
      } finally {
        setBusyKey(null)
      }
    },
    [load, onAfterChange, showToast],
  )

  const totalCount = clusters.length
  const accountName = useCallback(
    (id: string) => nicknameByAccount?.[id] ?? null,
    [nicknameByAccount],
  )

  const headerNote = useMemo(() => {
    if (loading && totalCount === 0 && excluded.length === 0) return 'Checking for possible duplicates…'
    return null
  }, [loading, totalCount, excluded.length])

  // Hide the panel entirely when there's nothing to show and nothing excluded.
  if (!loading && totalCount === 0 && excluded.length === 0 && !includeSyncedRepeats) return null

  return (
    <section
      style={{
        marginBottom: '1.5rem',
        border: '1px solid #fde68a',
        background: 'var(--bg-amber-tint)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}
        >
          <span style={{ color: 'var(--text-amber-800)' }}>{expanded ? '▼' : '▶'}</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-amber-800)' }}>
            Possible duplicates{totalCount > 0 ? ` (${totalCount.toLocaleString()})` : ''}
          </span>
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-amber-800)', cursor: 'pointer' }}
          title="By default only pairs involving a manually-entered transaction are shown — the real duplicate risk. Turn on to also review same-amount, same-counterparty repeats between synced transactions (usually legitimate)."
        >
          <input type="checkbox" checked={includeSyncedRepeats} onChange={(e) => setIncludeSyncedRepeats(e.target.checked)} />
          Include synced repeats
        </label>
      </div>

      {expanded ? (
        <div style={{ marginTop: '0.75rem' }}>
          {headerNote ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-amber-800)' }}>{headerNote}</div>
          ) : totalCount === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-amber-800)' }}>
              No possible duplicates{includeSyncedRepeats ? '' : ' involving manual entries'}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {clusters.map((c) => {
                const keeperId = keeperFor(c)
                const busy = busyKey === c.key
                return (
                  <div key={c.key} style={{ border: '1px solid #fcd34d', borderRadius: 8, background: 'var(--surface)', padding: '0.65rem 0.8rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 700 }}>
                        {formatUsd(c.members[0]?.amount ?? 0)} · {c.members[0]?.counterpartyName ?? '—'}
                        <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {' '}· {c.members.length} transactions{c.maxDaysApart > 0 ? ` · up to ${c.maxDaysApart}d apart` : ' · same day'}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      Choose the one to <strong>keep</strong>; the rest are excluded from the books (reversible).
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {c.members.map((m) => {
                        const badge = sourceBadge(m.source)
                        const acct = accountName(m.mercuryAccountId)
                        return (
                          <label
                            key={m.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.35rem 0.5rem',
                              borderRadius: 6,
                              background: m.id === keeperId ? 'var(--bg-green-tint)' : 'var(--bg-slate-tint)',
                              border: m.id === keeperId ? '1px solid #bbf7d0' : '1px solid var(--border)',
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="radio"
                              name={`keep-${c.key}`}
                              checked={m.id === keeperId}
                              onChange={() => setKeeperByCluster((prev) => ({ ...prev, [c.key]: m.id }))}
                            />
                            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: badge.bg, color: badge.fg }}>
                              {badge.label}
                            </span>
                            <span style={{ fontSize: '0.8rem', minWidth: '5.5rem' }}>{formatBankingDate(m.postedAt)}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-slate-600)', flex: '1 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {mercuryBankDescriptionFromRaw(m.raw) ?? '—'}
                              {acct ? ` · ${acct}` : ''}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: m.id === keeperId ? '#16a34a' : 'var(--text-faint)', fontWeight: 600 }}>
                              {m.id === keeperId ? 'Keep' : 'Exclude'}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleMarkDuplicate(c)}
                        style={{ padding: '0.4rem 0.8rem', fontWeight: 600, fontSize: '0.85rem', background: busy ? '#94a3b8' : '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer' }}
                      >
                        {busy ? 'Working…' : 'Mark as duplicate'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleDismiss(c)}
                        style={{ padding: '0.4rem 0.8rem', fontWeight: 600, fontSize: '0.85rem', background: 'var(--surface)', color: 'var(--text-slate-900)', border: '1px solid var(--border)', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer' }}
                      >
                        Not a duplicate
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {excluded.length > 0 ? (
            <div style={{ marginTop: '0.85rem', borderTop: '1px solid #fde68a', paddingTop: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setShowExcluded((v) => !v)}
                aria-expanded={showExcluded}
                style={{ all: 'unset', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-amber-800)' }}
              >
                {showExcluded ? '▼' : '▶'} Excluded duplicates ({excluded.length.toLocaleString()})
              </button>
              {showExcluded ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
                  {excluded.map((r) => {
                    const busy = busyKey === r.id
                    return (
                      <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', padding: '0.3rem 0.5rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                        <span style={{ minWidth: '5.5rem' }}>{formatBankingDate(r.postedAt)}</span>
                        <span style={{ fontWeight: 600 }}>{formatUsd(r.amount)}</span>
                        <span style={{ flex: '1 1 auto', minWidth: 0, color: 'var(--text-slate-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.counterpartyName ?? mercuryBankDescriptionFromRaw(r.raw) ?? '—'}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleUndo(r)}
                          style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', fontWeight: 600, background: 'var(--surface)', color: 'var(--text-blue-700)', border: '1px solid #bfdbfe', borderRadius: 6, cursor: busy ? 'not-allowed' : 'pointer' }}
                        >
                          {busy ? '…' : 'Undo'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
