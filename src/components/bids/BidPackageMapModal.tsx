import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/format'
import { computeBidPricingRows, coverLetterTotalsFromPricingRows } from '../../lib/bidPricingRowCalculations'
import { submissionHiddenIdsForVersion } from '../../lib/bids/submissionHides'
import { latestSendByVersion, type VersionSendRow } from '../../lib/bids/versionSends'
import { buildPackageMap, type PackageMap, type PackageMapPrice } from '../../lib/bids/bidPackageMap'
import type { BidVersion, PriceBookVersion } from '../../lib/bids/bidPricingEngineTypes'

/**
 * Package map (v2.2374): a read-only tree of the whole bid — GC packets →
 * versions → price options with value, margin, and who sees it. Opened from
 * the Map button on the Send to strip; clicking a price hands off to
 * `onOpenPrice`, which views it on the Pricing tab (viewing never moves a ★).
 */
type BidPackageMapModalProps = {
  bid: {
    id: string
    bid_number: string | null
    project_name: string | null
    bid_date_sent: string | null
    selected_price_book_version_id: string | null
  }
  bidGcName: string | null
  bidVersions: BidVersion[]
  selectedBidVersionId: string | null
  selectedPricingVersionId: string | null
  /** The bid-wide cost (Pricing's totalCost); null = not loaded → margins hidden. */
  sharedCost: number | null
  onClose: () => void
  /** View this price on the Pricing tab (session-only — never re-stars). */
  onOpenPrice: (versionId: string | null, pricingId: string) => void
}

type CountRowLite = { id: string; bid_version_id: string | null; fixture: string; count: number; sequence_order: number }
type AssignmentLite = { count_row_id: string; price_book_entry_id: string; price_book_version_id: string | null; is_fixed_price: boolean | null; unit_price_override: number | null }
type CustomLite = { count_row_id: string; price_book_version_id: string | null; unit_price: number }
type HideLite = { bid_id: string; count_row_id: string; created_at: string; price_book_version_id: string }
type EntryLite = { id: string; version_id: string; fixture_type_id: string | null; total_price: number }

export function BidPackageMapModal({
  bid,
  bidGcName,
  bidVersions,
  selectedBidVersionId,
  selectedPricingVersionId,
  sharedCost,
  onClose,
  onOpenPrice,
}: BidPackageMapModalProps) {
  const [loading, setLoading] = useState(true)
  const [pricings, setPricings] = useState<PriceBookVersion[]>([])
  const [sends, setSends] = useState<VersionSendRow[]>([])
  const [gcNames, setGcNames] = useState<Record<string, string>>({})
  const [recipients, setRecipients] = useState<Array<{ customerId: string; name: string }>>([])
  const [countRows, setCountRows] = useState<CountRowLite[]>([])
  const [assignments, setAssignments] = useState<AssignmentLite[]>([])
  const [customs, setCustoms] = useState<CustomLite[]>([])
  const [hides, setHides] = useState<HideLite[]>([])
  const [entries, setEntries] = useState<EntryLite[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const gcIds = [...new Set(bidVersions.map((v) => v.customer_id).filter((id): id is string => !!id))]
      const [pricingsRes, sendsRes, gcRes, recipRes, countsRes, assignRes, customRes, hidesRes] = await Promise.all([
        supabase.from('price_book_versions').select('*').eq('bid_id', bid.id).order('sort_order', { ascending: true }),
        supabase.from('bid_version_sends').select('bid_version_id, sent_on, value, is_alternate, created_at').eq('bid_id', bid.id),
        gcIds.length > 0 ? supabase.from('customers').select('id, name').in('id', gcIds) : Promise.resolve({ data: [] as Array<{ id: string; name: string | null }> }),
        supabase.from('bid_gc_recipients').select('customer_id, customers(name)').eq('bid_id', bid.id),
        supabase.from('bids_count_rows').select('id, bid_version_id, fixture, count, sequence_order').eq('bid_id', bid.id).order('sequence_order', { ascending: true }),
        supabase.from('bid_pricing_assignments').select('count_row_id, price_book_entry_id, price_book_version_id, is_fixed_price, unit_price_override').eq('bid_id', bid.id),
        supabase.from('bid_count_row_custom_prices').select('count_row_id, price_book_version_id, unit_price').eq('bid_id', bid.id),
        supabase.from('bid_count_row_submission_hides').select('bid_id, count_row_id, created_at, price_book_version_id').eq('bid_id', bid.id),
      ])
      if (cancelled) return
      let loadedPricings = (pricingsRes.data as PriceBookVersion[] | null) ?? []
      // Legacy bids: a version's ★ can point at a shared (non-bid-owned) pricing —
      // fetch those by id so the version doesn't read "no price options yet".
      const missingStarIds = [
        ...new Set(bidVersions.map((v) => v.starred_price_book_version_id).filter((id): id is string => !!id)),
      ].filter((id) => !loadedPricings.some((p) => p.id === id))
      if (missingStarIds.length > 0) {
        const starsRes = await supabase.from('price_book_versions').select('*').in('id', missingStarIds)
        if (cancelled) return
        loadedPricings = [...loadedPricings, ...(((starsRes.data as PriceBookVersion[] | null) ?? []))]
      }
      setPricings(loadedPricings)
      setSends((sendsRes.data as VersionSendRow[] | null) ?? [])
      setGcNames(Object.fromEntries(((gcRes.data as Array<{ id: string; name: string | null }> | null) ?? []).map((c) => [c.id, c.name ?? '—'])))
      type RecRow = { customer_id: string; customers: { name: string | null } | { name: string | null }[] | null }
      setRecipients((((recipRes.data ?? []) as RecRow[])).map((r) => ({ customerId: r.customer_id, name: (Array.isArray(r.customers) ? r.customers[0]?.name : r.customers?.name) ?? '—' })))
      setCountRows((countsRes.data as CountRowLite[] | null) ?? [])
      setAssignments((assignRes.data as AssignmentLite[] | null) ?? [])
      setCustoms((customRes.data as CustomLite[] | null) ?? [])
      setHides((hidesRes.data as HideLite[] | null) ?? [])
      const pricingIds = loadedPricings.map((p) => p.id)
      if (pricingIds.length > 0) {
        const entriesRes = await supabase.from('price_book_entries').select('id, version_id, fixture_type_id, total_price').in('version_id', pricingIds)
        if (cancelled) return
        setEntries((entriesRes.data as EntryLite[] | null) ?? [])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [bid.id, bidVersions])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const map: PackageMap | null = useMemo(() => {
    if (loading) return null
    const countsByVersion = new Map<string | null, CountRowLite[]>()
    for (const r of countRows) {
      const key = r.bid_version_id ?? null
      const list = countsByVersion.get(key) ?? []
      list.push(r)
      countsByVersion.set(key, list)
    }
    // Mirrors the workbench's per-scenario revenue: the cover-letter kernel on
    // the version's own counts, prices only (no labor/materials → revenue).
    const revenueOf = (pricingId: string, versionId: string | null): number | null => {
      const rows = countsByVersion.get(versionId) ?? countsByVersion.get(null) ?? []
      const customMap = new Map<string, number>()
      for (const c of customs) if (c.price_book_version_id === pricingId) customMap.set(c.count_row_id, Number(c.unit_price))
      const result = computeBidPricingRows({
        countRows: rows,
        assignments: assignments
          .filter((a) => a.price_book_version_id === pricingId)
          .map((a) => ({ count_row_id: a.count_row_id, price_book_entry_id: a.price_book_entry_id, is_fixed_price: a.is_fixed_price ?? false, unit_price_override: a.unit_price_override })),
        entries: entries.filter((e) => e.version_id === pricingId),
        customUnitPriceByCountRowId: customMap,
        laborRows: [],
        totalMaterials: 0,
        laborRate: 0,
        taxPercent: 0,
        materialsFromTakeoffByCountRowId: {},
        hiddenSubmissionCountRowIds: submissionHiddenIdsForVersion(hides, pricingId),
      })
      return coverLetterTotalsFromPricingRows(result.rows).revenueSum
    }
    return buildPackageMap({
      versions: bidVersions,
      pricings,
      bidGcName,
      gcNames,
      latestSends: latestSendByVersion(sends),
      bidDateSent: bid.bid_date_sent,
      recipients,
      revenueOf,
      sharedCost,
      selectedVersionId: selectedBidVersionId,
      selectedPricingId: selectedPricingVersionId,
      bidStarredPricingId: bid.selected_price_book_version_id,
    })
  }, [loading, countRows, customs, assignments, entries, hides, bidVersions, pricings, bidGcName, gcNames, sends, bid.bid_date_sent, bid.selected_price_book_version_id, recipients, sharedCost, selectedBidVersionId, selectedPricingVersionId])

  const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
  const mColor = (m: number) => (m >= 0.35 ? 'var(--text-green-700)' : m >= 0.15 ? 'var(--text-amber-700)' : 'var(--text-red-700)')

  const priceRow = (p: PackageMapPrice, versionId: string | null) => (
    <button
      key={p.id}
      type="button"
      onClick={() => onOpenPrice(versionId, p.id)}
      title={p.viewing ? 'The price open on the Workbench now' : 'Open this price on the Pricing tab (viewing only — the GC still sees their ★)'}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.55rem', width: '100%', textAlign: 'left', font: 'inherit',
        border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
        background: p.status === 'base' ? 'var(--bg-green-tint)' : 'var(--bg-subtle)',
        padding: '0.32rem 0.6rem',
      }}
    >
      {p.status === 'base' ? <span aria-hidden style={{ color: 'var(--text-green-700)', fontWeight: 700 }}>★</span> : null}
      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)', flex: '1 1 auto', minWidth: '6rem' }}>{p.name}</span>
      {p.viewing ? (
        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fff', background: '#3b82f6', borderRadius: 999, padding: '0.08rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>viewing</span>
      ) : null}
      {p.unpriced ? (
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-amber-700)', background: 'var(--bg-amber-tint)', borderRadius: 999, padding: '0.06rem 0.5rem', whiteSpace: 'nowrap' }}>No prices yet</span>
      ) : (
        <>
          {p.revenue != null ? <span style={{ fontFamily: 'inherit', fontSize: '0.8rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>{money(p.revenue)}</span> : null}
          {p.margin != null ? <span style={{ fontSize: '0.72rem', fontWeight: 700, color: mColor(p.margin) }}>{Math.round(p.margin * 100)}%</span> : null}
        </>
      )}
      <span style={{ fontSize: '0.64rem', whiteSpace: 'nowrap', color: p.status === 'base' ? 'var(--text-green-700)' : p.status === 'alternate' ? 'var(--text-blue-500)' : 'var(--text-muted)', fontWeight: p.status === 'private' ? 400 : 600 }}>
        {p.status === 'base' ? 'on their letter' : p.status === 'alternate' ? 'alternate on letter' : 'only you see this'}
      </span>
    </button>
  )

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 60, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '3.5rem 1rem 1rem', overflowY: 'auto' }}>
      <div
        role="dialog"
        aria-label="Package map"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 12, maxWidth: '36rem', width: '100%', boxShadow: '0 10px 32px rgba(15, 23, 42, 0.22)', overflow: 'hidden' }}
      >
        <div style={{ padding: '0.7rem 1rem 0.55rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-strong)' }}>
            {bid.bid_number ? `BP${bid.bid_number} · ` : ''}{bid.project_name ?? 'This bid'} — the whole package
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
            {map
              ? <>
                  {map.gcCount} GC{map.gcCount === 1 ? '' : 's'} · {map.versionCount} version{map.versionCount === 1 ? '' : 's'} · {map.priceCount} price{map.priceCount === 1 ? '' : 's'}
                  {sharedCost != null ? <> · our cost <span style={{ fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(sharedCost)}</span> is shared by all of them</> : null}
                </>
              : 'Loading…'}
          </div>
        </div>

        {map ? (
          <div style={{ padding: '0.6rem 1rem 0.8rem', maxHeight: '60vh', overflowY: 'auto' }}>
            {map.packets.map((g) => (
              <div key={g.key || 'own-gc'} style={{ marginTop: '0.55rem' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-strong)' }}>{g.name}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {g.sentOn ? `sent ${g.sentOn.slice(5).replace('-', '/')}` : 'not sent'}
                    {g.sentValue != null ? ` · ${money(g.sentValue)}` : ''}
                    {g.outcome === 'won' || g.outcome === 'lost' ? '' : g.sentOn ? ' · waiting to hear' : ''}
                  </span>
                  {g.outcome === 'won' ? <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-green-700)', background: 'var(--bg-green-tint)', borderRadius: 999, padding: '0.06rem 0.5rem' }}>won</span> : null}
                  {g.outcome === 'lost' ? <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--text-red-700)', background: 'var(--bg-red-tint)', borderRadius: 999, padding: '0.06rem 0.5rem' }}>lost</span> : null}
                </div>
                {g.sharedLetter ? (
                  <div style={{ marginLeft: '0.55rem', borderLeft: '2px solid var(--border)', paddingLeft: '0.9rem', marginTop: '0.3rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    got the same letter as {bidGcName ?? 'the bid’s GC'} — no packet of its own yet
                  </div>
                ) : (
                  <div style={{ marginLeft: '0.55rem', borderLeft: '2px solid var(--border)', paddingLeft: '0.9rem', marginTop: '0.3rem', display: 'grid', gap: '0.35rem' }}>
                    {g.versions.map((v) => (
                      <div key={v.id ?? 'current'}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-strong)' }}>{v.name}</span>
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>version</span>
                          {v.viewing ? <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#fff', background: '#3b82f6', borderRadius: 999, padding: '0.08rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>viewing</span> : null}
                        </div>
                        <div style={{ marginLeft: '0.55rem', borderLeft: '2px solid var(--border)', paddingLeft: '0.9rem', marginTop: '0.25rem', display: 'grid', gap: '0.3rem' }}>
                          {v.prices.length > 0 ? v.prices.map((p) => priceRow(p, v.id)) : (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-amber-700)' }}>no price options yet</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {map.unattached.length > 0 ? (
              <div style={{ marginTop: '0.8rem' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Not tied to a GC</div>
                <div style={{ marginTop: '0.25rem', display: 'grid', gap: '0.3rem' }}>
                  {map.unattached.map((p) => priceRow(p, selectedBidVersionId))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ padding: '1.2rem 1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading the package…</div>
        )}

        <div style={{ padding: '0.5rem 1rem 0.7rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Click a price to open it on the Pricing tab — viewing never changes what a GC sees. Labor &amp; cost are shared.
          </span>
          <button type="button" onClick={onClose} style={{ font: 'inherit', padding: '0.35rem 0.8rem', border: '1px solid var(--border-strong)', borderRadius: 5, background: 'var(--bg-muted)', color: 'var(--text-strong)', cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
