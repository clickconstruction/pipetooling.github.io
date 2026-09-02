/**
 * Quote compare modal (RFQ Phase 1b, v2.2630 — docs/SUPPLY_HOUSE_RFQ_PLAN.md;
 * design canvas artboard 4 with the deep-review corrections). Renders
 * `buildQuoteComparison` over the bid's saved quotes: D22-grouped rows, house
 * columns with expired-graying, a COST-SIDE baseline (current cost/unit when
 * provided, else the name-keyed last-quoted memory — never the sale book),
 * per-line picks (persisted on `bid_quote_lines.picked` for the future PO
 * handoff), coverage per house, and apples-to-apples common-line totals.
 */
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'

import { buildQuoteComparison, type CompareQuote } from '../../lib/rfq/quoteCompare'
import { type SpecSectionMatchKind, type SpecSectionMatchRule } from '../../lib/classifySpecSection'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'

const MODAL_Z = 10050
const KNOWN_KINDS = new Set<string>(['starts_with', 'contains', 'exact'])

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: MODAL_Z,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '1.5rem 1rem',
  overflowY: 'auto',
}

const panel: CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 8,
  maxWidth: 1160,
  width: '100%',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
  padding: '1.1rem 1.25rem 0.9rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
}

function money(cents: number | null | undefined): string {
  return cents == null ? '—' : `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function QuoteCompareModal({
  open,
  onClose,
  onPlugIn,
  bidId,
  bidLabel,
  rows,
}: {
  open: boolean
  onClose: () => void
  /** Open the Plug-in modal for another quote. */
  onPlugIn: () => void
  bidId: string
  bidLabel: string
  rows: Array<{ id: string; fixture: string; count: number }>
}) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(true)
  const [quotes, setQuotes] = useState<CompareQuote[]>([])
  const [rules, setRules] = useState<SpecSectionMatchRule[]>([])
  const [lastQuoted, setLastQuoted] = useState<Map<string, number>>(new Map())
  const [lineIdByCell, setLineIdByCell] = useState<Map<string, string>>(new Map())
  // Phase 3 (v2.2632): the bid's nearest RFQ needed-by — quotes that expire
  // before it get called out in the header.
  const [neededBy, setNeededBy] = useState<string | null>(null)
  const [snapshotQty, setSnapshotQty] = useState<Map<string, number> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [quoteRows, ruleRows] = await Promise.all([
        withSupabaseRetry(
          () =>
            supabase
              .from('bid_quotes')
              .select('id, supply_house_id, received_at, valid_until, supply_house:supply_houses(name), bid_quote_lines(id, fixture, unit_price_each_cents, cant_supply, alternate_note, picked)')
              .eq('bid_id', bidId)
              .order('received_at'),
          'load bid quotes',
        ),
        withSupabaseRetry(
          () => supabase.from('spec_section_match_rules').select('pattern, match_kind, section_code, priority'),
          'load spec rules',
        ),
      ])
      try {
        const rfqs = await withSupabaseRetry(
          () =>
            supabase
              .from('bid_rfqs')
              .select('needed_by, scope, created_at')
              .eq('bid_id', bidId)
              .neq('status', 'draft')
              .order('created_at', { ascending: false })
              .limit(20),
          'load rfqs for needed-by + drift snapshot',
        )
        const dates = (rfqs ?? []).map((r) => r.needed_by as string | null).filter((d): d is string => !!d).sort()
        setNeededBy(dates[0] ?? null)
        // Lane B (v2.2636): the newest request's scope snapshot feeds the
        // quantity-drift badge — "quoted at 752 ft, now 1,100".
        const newest = (rfqs ?? [])[0]?.scope as { lines?: Array<{ fixture?: string; count?: number }> } | null
        const snap = new Map<string, number>()
        for (const l of newest?.lines ?? []) {
          if (typeof l.fixture === 'string' && Number.isFinite(Number(l.count))) {
            snap.set(l.fixture.trim().toLowerCase(), Number(l.count))
          }
        }
        setSnapshotQty(snap.size > 0 ? snap : null)
      } catch {
        setNeededBy(null)
        setSnapshotQty(null)
      }
      const cellIds = new Map<string, string>()
      const mapped: CompareQuote[] = (quoteRows ?? [])
        .filter((q) => q.supply_house_id)
        .map((q) => {
          const houseRel = q.supply_house as unknown as { name: string } | { name: string }[] | null
          const houseName = Array.isArray(houseRel) ? (houseRel[0]?.name ?? '—') : (houseRel?.name ?? '—')
          for (const l of q.bid_quote_lines ?? []) cellIds.set(`${q.id}|${l.fixture.trim().toLowerCase()}`, l.id)
          return {
            id: q.id,
            supplyHouseId: q.supply_house_id!,
            houseName,
            receivedAt: q.received_at,
            validUntil: q.valid_until,
            lines: (q.bid_quote_lines ?? []).map((l) => ({
              fixture: l.fixture,
              unitPriceEachCents: l.unit_price_each_cents,
              cantSupply: l.cant_supply,
              alternateNote: l.alternate_note,
              picked: l.picked,
            })),
          }
        })
      setQuotes(mapped)
      setLineIdByCell(cellIds)
      setRules(
        (ruleRows ?? [])
          .filter((r) => KNOWN_KINDS.has(r.match_kind))
          .map((r) => ({ pattern: r.pattern, matchKind: r.match_kind as SpecSectionMatchKind, sectionCode: r.section_code, priority: r.priority })),
      )
      const houseIds = [...new Set(mapped.map((m) => m.supplyHouseId))]
      if (houseIds.length > 0) {
        const memory = await withSupabaseRetry(
          () => supabase.from('supply_house_fixture_prices').select('fixture_key, unit_price_each_cents').in('supply_house_id', houseIds),
          'load price memory',
        )
        const best = new Map<string, number>()
        for (const m of memory ?? []) {
          if (m.fixture_key == null) continue
          const prev = best.get(m.fixture_key)
          if (prev == null || m.unit_price_each_cents < prev) best.set(m.fixture_key, m.unit_price_each_cents)
        }
        setLastQuoted(best)
      } else {
        setLastQuoted(new Map())
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not load quotes.', 'error')
    } finally {
      setLoading(false)
    }
  }, [bidId, showToast])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const currentQtyByName = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const k = r.fixture.trim().toLowerCase()
      if (Number.isFinite(r.count) && r.count > 0) m.set(k, (m.get(k) ?? 0) + r.count)
    }
    return m
  }, [rows])

  const comparison = useMemo(
    () =>
      buildQuoteComparison({
        quotes,
        currentQtyByName,
        snapshotQtyByName: snapshotQty ?? undefined,
        lastQuotedEachCentsByName: lastQuoted,
        rules,
        today: new Date().toISOString().slice(0, 10),
      }),
    [quotes, currentQtyByName, snapshotQty, lastQuoted, rules],
  )

  async function pick(fixtureKey: string, houseId: string) {
    const row = comparison.rows.find((r) => r.fixture.trim().toLowerCase() === fixtureKey)
    if (!row) return
    try {
      for (const [hid, cell] of Object.entries(row.perHouse)) {
        const lineId = lineIdByCell.get(`${cell.quoteId}|${fixtureKey}`)
        if (!lineId) continue
        const shouldPick = hid === houseId ? !cell.picked : false
        if (cell.picked !== shouldPick) {
          const { error } = await supabase.from('bid_quote_lines').update({ picked: shouldPick }).eq('id', lineId)
          if (error) throw error
        }
      }
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the pick.', 'error')
    }
  }

  if (!open || typeof document === 'undefined') return null

  const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const houseCols = comparison.houses
  const grid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1.5fr) 4.5rem repeat(${Math.max(1, houseCols.length)}, minmax(6.5rem, 1fr)) minmax(6rem, 0.9fr)`,
    gap: '0.5rem',
    alignItems: 'center',
    padding: '0.3rem 0.6rem',
  }

  let lastSection: string | null | undefined
  return createPortal(
    <div style={overlay} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label="Supply house quotes" style={panel} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-strong)' }}>Supply house quotes</h2>
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {bidLabel} · unit prices, totals at today’s counts. Tap a price to pick it for that part.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" onClick={onPlugIn} style={{ padding: '0.4rem 0.85rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem', fontWeight: 600 }}>
              + Plug in a quote
            </button>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)', padding: '0 0.25rem' }}>×</button>
          </div>
        </div>

        {loading ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading quotes…</p>
        ) : quotes.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>No quotes on this bid yet — plug in the first one.</p>
        ) : (
          <>
            {(() => {
              if (!neededBy) return null
              // Latest quote per house (matching the kernel's latest-wins rule).
              const atRisk = comparison.houses.filter((h) => {
                const q = [...quotes].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).find((x) => x.supplyHouseId === h.supplyHouseId)
                return q?.validUntil != null && q.validUntil < neededBy
              })
              if (atRisk.length === 0) return null
              return (
                <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-amber-700)', background: 'var(--bg-yellow-tint)', border: '1px solid #f59e0b', borderRadius: 6, padding: '0.35rem 0.7rem' }}>
                  {atRisk.length === 1 ? `${atRisk[0]?.houseName}’s quote expires` : `${atRisk.length} quotes expire`} before the needed-by ({neededBy}) — worth re-asking before ordering.
                </p>
              )
            })()}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {houseCols.map((h) => (
                <span key={h.supplyHouseId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${h.expired ? 'var(--border-strong)' : '#bbf7d0'}`, background: h.expired ? 'var(--bg-muted)' : 'var(--bg-green-tint)', color: h.expired ? 'var(--text-muted)' : '#15803d', borderRadius: 999, padding: '0.25rem 0.7rem', fontSize: '0.75rem', fontWeight: 600 }}>
                  {h.houseName} · {h.quotedLines} of {h.totalLines} lines{h.expired ? ' · expired' : ''}
                  {h.commonLinesTotalCents != null ? ` · ${money(h.commonLinesTotalCents)}${comparison.commonLineCount > 0 ? ` on ${comparison.commonLineCount} common` : ''}` : ''}
                </span>
              ))}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ ...grid, background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                <span>Part</span>
                <span>Qty</span>
                {houseCols.map((h) => (<span key={h.supplyHouseId}>{h.houseName}</span>))}
                <span>Last quoted</span>
              </div>
              <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
                {comparison.rows.map((r) => {
                  const key = r.fixture.trim().toLowerCase()
                  const sectionHeader = r.sectionCode !== lastSection ? (lastSection = r.sectionCode) ?? 'No code yet' : null
                  return (
                    <div key={key}>
                      {sectionHeader != null ? (
                        <div style={{ padding: '0.25rem 0.6rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{sectionHeader}</div>
                      ) : null}
                      <div style={{ ...grid, borderBottom: '1px solid var(--bg-muted)' }}>
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
                          {r.fixture}
                          {r.drift ? <span title={`Quoted at ${r.qtySnapshot}, now ${r.qtyNow}`} style={{ color: 'var(--text-amber-700)', fontSize: '0.7rem' }}> · qty changed</span> : null}
                        </span>
                        <span style={{ ...smallMuted, fontVariantNumeric: 'tabular-nums' }}>{r.qtyNow || '—'}</span>
                        {houseCols.map((h) => {
                          const cell = r.perHouse[h.supplyHouseId]
                          if (!cell) return <span key={h.supplyHouseId} style={{ color: 'var(--text-faint)' }}>—</span>
                          const best = r.bestHouseId === h.supplyHouseId
                          return (
                            <button
                              key={h.supplyHouseId}
                              type="button"
                              onClick={() => void pick(key, h.supplyHouseId)}
                              disabled={cell.cantSupply || cell.unitPriceEachCents == null}
                              title={cell.expired ? 'Quote expired' : cell.picked ? 'Picked — tap to unpick' : 'Tap to pick'}
                              style={{
                                textAlign: 'right',
                                padding: '0.25rem 0.5rem',
                                borderRadius: 4,
                                border: cell.picked ? '2px solid #16a34a' : '1px solid transparent',
                                background: 'none',
                                cursor: cell.cantSupply || cell.unitPriceEachCents == null ? 'default' : 'pointer',
                                font: 'inherit',
                                fontSize: '0.8125rem',
                                fontVariantNumeric: 'tabular-nums',
                                color: cell.cantSupply ? 'var(--text-faint)' : cell.expired ? 'var(--text-faint)' : best ? '#15803d' : 'var(--text-strong)',
                                fontWeight: best ? 700 : 400,
                                textDecoration: cell.expired ? 'line-through' : undefined,
                              }}
                            >
                              {cell.cantSupply ? 'n/a' : money(cell.unitPriceEachCents)}
                              {best && !cell.expired ? ' ★' : ''}
                            </button>
                          )
                        })}
                        <span style={{ ...smallMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {r.baselineSource === 'last-quoted' ? money(r.baselineEachCents) : '—'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
              <span style={smallMuted}>
                Picked total <strong style={{ color: 'var(--text-strong)' }}>{money(comparison.pickedTotalCents)}</strong> at today’s counts · picks are saved and ready for a future PO handoff.
              </span>
              <button type="button" onClick={onClose} style={{ padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
