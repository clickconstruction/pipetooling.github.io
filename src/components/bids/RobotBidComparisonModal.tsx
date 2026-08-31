import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import type { Bid } from '../../types/bids'

// bid_audits predates the generated types (BidsAuditsTab pattern) — untyped client for that one query.
const auditDb = supabase as unknown as SupabaseClient
import {
  percentDelta,
  summarizeDraftForComparison,
  type ComparisonAssignment,
  type ComparisonCountRow,
  type DraftComparisonSummary,
} from '../../lib/bids/robotBidComparison'

type RobotBidComparisonModalProps = {
  /** null = closed. source = the human bid; twin = its robot copy. */
  pair: { source: Bid; twin: Bid } | null
  onClose: () => void
  onOpenBidTab: (bid: Bid, tab: 'counts' | 'pricing') => void
  onOpenRobotBoard: (twin: Bid) => void
}

type LoadedComparison = {
  robot: DraftComparisonSummary
  ours: DraftComparisonSummary
  ctViewUrl: string | null
}

/**
 * The colorful-🤖 click (v2.2532): how the robot's bid compares to ours, with
 * jump links into both bids' Counts/Pricing and the robot's CountTooling
 * takeoff. Totals use the same draft-pricing rules as the Audits tab; the
 * human side prefers the real bid_value when one is set.
 */
export function RobotBidComparisonModal({ pair, onClose, onOpenBidTab, onOpenRobotBoard }: RobotBidComparisonModalProps) {
  const [loaded, setLoaded] = useState<LoadedComparison | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const sourceId = pair?.source.id ?? null
  const twinId = pair?.twin.id ?? null
  useEffect(() => {
    if (!sourceId || !twinId) return
    let cancelled = false
    setLoaded(null)
    setLoadError(null)
    void (async () => {
      try {
        const bidIds = [sourceId, twinId]
        const [rowsRes, assignsRes, auditRes] = await Promise.all([
          supabase.from('bids_count_rows').select('id, bid_id, fixture, count, bid_version_id').in('bid_id', bidIds),
          supabase.from('bid_pricing_assignments').select('bid_id, count_row_id, price_book_entry_id, unit_price_override').in('bid_id', bidIds),
          auditDb.from('bid_audits').select('ct_view_url').eq('bid_id', twinId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ])
        if (rowsRes.error) throw rowsRes.error
        if (assignsRes.error) throw assignsRes.error
        const rows = (rowsRes.data ?? []) as Array<ComparisonCountRow & { bid_id: string }>
        const assigns = (assignsRes.data ?? []) as Array<ComparisonAssignment & { bid_id: string }>
        const entryIds = [...new Set(assigns.map((a) => a.price_book_entry_id).filter((x): x is string => !!x))]
        const entries = entryIds.length
          ? await supabase.from('price_book_entries').select('id, total_price').in('id', entryIds)
          : { data: [], error: null }
        if (entries.error) throw entries.error
        const priceById = Object.fromEntries(
          ((entries.data ?? []) as Array<{ id: string; total_price: number | null }>).map((e) => [e.id, e.total_price ?? 0]),
        )
        const summarize = (bidId: string, versionId: string | null) =>
          summarizeDraftForComparison(
            rows.filter((r) => r.bid_id === bidId),
            versionId,
            assigns.filter((a) => a.bid_id === bidId),
            priceById,
          )
        if (cancelled || !pair) return
        setLoaded({
          robot: summarize(twinId, pair.twin.selected_bid_version_id ?? null),
          ours: summarize(sourceId, pair.source.selected_bid_version_id ?? null),
          ctViewUrl: auditRes.data?.ct_view_url ?? null,
        })
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, twinId])

  if (!pair) return null
  const { source, twin } = pair
  const money = (n: number) => `$${Math.round(n).toLocaleString()}`
  const ourTotal = source.bid_value != null ? Number(source.bid_value) : loaded ? loaded.ours.draftTotal : null
  const robotTotal = twin.bid_value != null ? Number(twin.bid_value) : loaded ? loaded.robot.draftTotal : null
  const delta = ourTotal != null && robotTotal != null ? percentDelta(robotTotal, ourTotal) : null

  const linkChipStyle: React.CSSProperties = {
    border: '1px solid var(--border-strong)',
    borderRadius: 999,
    padding: '0.25rem 0.8rem',
    fontSize: '0.8rem',
    color: 'var(--text-blue-500)',
    cursor: 'pointer',
    background: 'var(--surface)',
  }
  const cellStyle: React.CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' }
  const headStyle: React.CSSProperties = { ...cellStyle, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid var(--border)' }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="robot-bid-comparison-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1005,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        role="document"
        style={{
          background: 'var(--surface)',
          borderRadius: 8,
          maxWidth: 620,
          width: '100%',
          padding: '1.25rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="robot-bid-comparison-title" style={{ margin: '0 0 0.75rem', fontSize: '1.125rem', fontWeight: 600 }}>
          {'\u{1F916} '}Robot bid b{twin.bid_number ?? '?'} vs ours — {source.project_name ?? ''}
        </h2>

        {loadError ? (
          <p style={{ color: 'var(--text-red-600)', fontSize: '0.875rem' }}>Couldn&apos;t load the comparison: {loadError}</p>
        ) : !loaded ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading comparison…</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={{ ...headStyle, textAlign: 'left' }}></th>
                  <th style={{ ...headStyle, textAlign: 'right' }}>Robot (b{twin.bid_number ?? '?'})</th>
                  <th style={{ ...headStyle, textAlign: 'right' }}>Ours (b{source.bid_number ?? '?'})</th>
                  <th style={{ ...headStyle, textAlign: 'right' }}>Δ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={cellStyle}>Bid total{twin.bid_value == null || source.bid_value == null ? ' (draft-priced)' : ''}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{robotTotal != null ? money(robotTotal) : '—'}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{ourTotal != null ? money(ourTotal) : '—'}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600, color: delta == null ? 'var(--text-muted)' : delta < 0 ? 'var(--text-red-600)' : 'var(--text-emerald-800)' }}>
                    {delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`}
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle}>Count rows</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{loaded.robot.rowCount}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{loaded.ours.rowCount}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{loaded.robot.rowCount - loaded.ours.rowCount >= 0 ? '+' : ''}{loaded.robot.rowCount - loaded.ours.rowCount}</td>
                </tr>
                <tr>
                  <td style={cellStyle}>Fixtures / equipment (ea)</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{Math.round(loaded.robot.fixtureCount)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{Math.round(loaded.ours.fixtureCount)}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    {loaded.robot.fixtureCount === loaded.ours.fixtureCount ? 'exact' : `${loaded.robot.fixtureCount - loaded.ours.fixtureCount >= 0 ? '+' : ''}${Math.round(loaded.robot.fixtureCount - loaded.ours.fixtureCount)}`}
                  </td>
                </tr>
                <tr>
                  <td style={cellStyle}>Footage (ft, all systems)</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{Math.round(loaded.robot.footageFt).toLocaleString()}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{Math.round(loaded.ours.footageFt).toLocaleString()}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>
                    {loaded.ours.footageFt > 0 ? `${(loaded.robot.footageFt / loaded.ours.footageFt).toFixed(2)}×` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.9rem 0 1rem' }}>
          <button type="button" style={linkChipStyle} onClick={() => { onClose(); onOpenBidTab(twin, 'counts') }}>Robot counts</button>
          <button type="button" style={linkChipStyle} onClick={() => { onClose(); onOpenBidTab(twin, 'pricing') }}>Robot pricing</button>
          {loaded?.ctViewUrl ? (
            <a href={loaded.ctViewUrl} target="_blank" rel="noreferrer" style={{ ...linkChipStyle, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Robot takeoff (CountTooling) ↗
            </a>
          ) : null}
          <button type="button" style={linkChipStyle} onClick={() => { onClose(); onOpenBidTab(source, 'counts') }}>Our counts</button>
          <button type="button" style={linkChipStyle} onClick={() => { onClose(); onOpenBidTab(source, 'pricing') }}>Our pricing</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { onClose(); onOpenRobotBoard(twin) }}
            style={{ padding: '0.5rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', cursor: 'pointer' }}
          >
            Open on Robot Board
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
