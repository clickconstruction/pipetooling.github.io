/**
 * Quote compare modal (RFQ Phase 1b, v2.2630 — docs/SUPPLY_HOUSE_RFQ_PLAN.md;
 * design canvas artboard 4 with the deep-review corrections). Renders
 * `buildQuoteComparison` over the bid's saved quotes: D22-grouped rows, house
 * columns with expired-graying, a COST-SIDE baseline (current cost/unit when
 * provided, else the name-keyed last-quoted memory — never the sale book),
 * per-line picks (persisted on `bid_quote_lines.picked` for the future PO
 * handoff), coverage per house, and apples-to-apples common-line totals.
 *
 * Price Matrix PR 4 (docs/PRICE_MATRIX_PLAN.md, canvas board 3): the grid
 * reads the robot's structured quotes. A fixture priced as a KIT (a `kit`
 * subtotal + component roles + a carrier from another sheet) shows one $/each
 * and expands into its parts; a house that skipped a part is "incomplete" and
 * never ★; an option group nobody chose from reads "needs a choice" with the
 * range and a Settle door that writes `option_chosen`; the Robot column says
 * why each pick was made, or that the estimator overruled it. Every human
 * unpick / repick / choice lands in `fixture_component_corrections` so the
 * pricer learns next session.
 */
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { buildQuoteComparison, type CompareQuote, type CompareQuoteLine, type CompareRowCell } from '../../lib/rfq/quoteCompare'
import { COMPONENT_ROLE_LABELS, describeKitBasis, isComponentRole, type ComponentRole } from '../../lib/rfq/quoteKits'
import { describeChoiceRange, describeIncomplete, robotColumnText, summarizeRobotWork } from '../../lib/rfq/compareRobotSummary'
import { ApplyPicksToCostsModal, type ApplyPickItem } from './ApplyPicksToCostsModal'
import { type SpecSectionMatchKind, type SpecSectionMatchRule } from '../../lib/classifySpecSection'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../hooks/useAuth'
import { todayYmdInAppTz } from '../../utils/dateUtils'

const MODAL_Z = 10050
const KNOWN_KINDS = new Set<string>(['starts_with', 'contains', 'exact'])

// Price Matrix tables/columns landed with 20260911023538; the untyped client
// keeps the modal honest while a checkout runs ahead of the types.
const db = supabase as unknown as SupabaseClient

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

const roleLabel = (role: string) => (isComponentRole(role) ? COMPONENT_ROLE_LABELS[role] : role)

type RawLine = {
  id: string
  fixture: string
  unit_price_each_cents: number | null
  cant_supply: boolean
  alternate_note: string | null
  picked: boolean
  lot_id: string | null
  lot_total_cents: number | null
  component_role?: string | null
  label?: string | null
  option_group?: string | null
  option_label?: string | null
  option_chosen?: boolean | null
  page_ref?: string | null
  pick_reason?: string | null
  pick_source?: string | null
}

type RawQuote = {
  id: string
  supply_house_id: string | null
  received_at: string
  valid_until: string | null
  freight_cents: number | null
  source?: string | null
  supply_house: { name: string } | Array<{ name: string }> | null
  bid_quote_lines: RawLine[] | null
}

type RobotRequestSummary = { id: string; status: string; summary: string | null; result: Record<string, unknown> | null; finished_at: string | null }

const LINE_COLS_BASE = 'id, fixture, unit_price_each_cents, cant_supply, alternate_note, picked, lot_id, lot_total_cents'
const LINE_COLS_KIT = `${LINE_COLS_BASE}, component_role, label, option_group, option_label, option_chosen, page_ref, pick_reason, pick_source`

export function QuoteCompareModal({
  open,
  onClose,
  onPlugIn,
  bidId,
  bidLabel,
  rows,
  takeoffMaterialsByCountRowId,
  taxPercent,
  currentTotals,
  onCostsApplied,
}: {
  open: boolean
  onClose: () => void
  /** Open the Plug-in modal for another quote. */
  onPlugIn: () => void
  bidId: string
  bidLabel: string
  rows: Array<{ id: string; fixture: string; count: number }>
  /** Rung G (v2.2655): inputs for Apply picks to costs. */
  takeoffMaterialsByCountRowId: Record<string, number>
  taxPercent: number
  currentTotals: { totalRevenue: number; totalCost: number } | null
  onCostsApplied: () => void
}) {
  const { showToast } = useToastContext()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [quotes, setQuotes] = useState<CompareQuote[]>([])
  const [rules, setRules] = useState<SpecSectionMatchRule[]>([])
  const [lastQuoted, setLastQuoted] = useState<Map<string, number>>(new Map())
  /** Every line id per "quoteId|fixtureKey" — a kit is several lines, picked together. */
  const [lineIdsByCell, setLineIdsByCell] = useState<Map<string, string[]>>(new Map())
  const [robotRequest, setRobotRequest] = useState<RobotRequestSummary | null>(null)
  const [robotQuoteCount, setRobotQuoteCount] = useState(0)
  // Phase 3 (v2.2632): the bid's nearest RFQ needed-by — quotes that expire
  // before it get called out in the header.
  const [neededBy, setNeededBy] = useState<string | null>(null)
  const [snapshotQty, setSnapshotQty] = useState<Map<string, number> | null>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  /** The Settle popover: which row + house is choosing an option. */
  const [settling, setSettling] = useState<{ fixtureKey: string; houseId: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Kit columns first; a checkout ahead of the migration falls back to the legacy shape.
      let quoteRows: RawQuote[] | null = null
      const wide = await supabase
        .from('bid_quotes')
        .select(`id, supply_house_id, received_at, valid_until, freight_cents, source, supply_house:supply_houses(name), bid_quote_lines(${LINE_COLS_KIT})`)
        .eq('bid_id', bidId)
        .order('received_at')
      if (!wide.error) quoteRows = wide.data as unknown as RawQuote[]
      else {
        quoteRows = await withSupabaseRetry(
          () =>
            supabase
              .from('bid_quotes')
              .select(`id, supply_house_id, received_at, valid_until, freight_cents, supply_house:supply_houses(name), bid_quote_lines(${LINE_COLS_BASE})`)
              .eq('bid_id', bidId)
              .order('received_at'),
          'load bid quotes',
        ) as unknown as RawQuote[]
      }
      const ruleRows = await withSupabaseRetry(
        () => supabase.from('spec_section_match_rules').select('pattern, match_kind, section_code, priority'),
        'load spec section rules',
      )
      // The bid's price requests: nearest needed-by + the newest scope snapshot (drift badges).
      const { data: rfqRows } = await supabase
        .from('bid_rfqs')
        .select('needed_by, scope, created_at')
        .eq('bid_id', bidId)
        .neq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(20)
      const earliest = (rfqRows ?? []).map((r) => r.needed_by).filter((d): d is string => !!d).sort()[0] ?? null
      setNeededBy(earliest)
      const newest = (rfqRows ?? [])[0]
      if (newest?.scope && typeof newest.scope === 'object' && Array.isArray((newest.scope as { lines?: unknown }).lines)) {
        const m = new Map<string, number>()
        for (const l of (newest.scope as { lines: Array<{ fixture?: string; count?: number }> }).lines) {
          if (l.fixture && typeof l.count === 'number') m.set(l.fixture.trim().toLowerCase(), l.count)
        }
        setSnapshotQty(m)
      } else setSnapshotQty(null)
      // Price Matrix PR 4: the newest robot request with a result — the banner's facts.
      try {
        const { data: req } = await db
          .from('bid_price_matrix_requests')
          .select('id, status, summary, result, finished_at')
          .eq('bid_id', bidId)
          .in('status', ['ready', 'done'])
          .order('finished_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle()
        setRobotRequest((req as RobotRequestSummary | null) ?? null)
      } catch {
        setRobotRequest(null)
      }

      const ids = new Map<string, string[]>()
      const mapped: CompareQuote[] = (quoteRows ?? [])
        .filter((q) => q.supply_house_id)
        .map((q) => {
          const house = Array.isArray(q.supply_house) ? q.supply_house[0] : q.supply_house
          const lines: CompareQuoteLine[] = (q.bid_quote_lines ?? []).map((l) => {
            const key = `${q.id}|${l.fixture.trim().toLowerCase()}`
            ids.set(key, [...(ids.get(key) ?? []), l.id])
            return {
              id: l.id,
              fixture: l.fixture,
              unitPriceEachCents: l.unit_price_each_cents,
              cantSupply: l.cant_supply,
              alternateNote: l.alternate_note,
              picked: l.picked,
              lotId: l.lot_id,
              lotTotalCents: l.lot_total_cents,
              componentRole: isComponentRole(l.component_role) ? l.component_role : null,
              label: l.label ?? null,
              optionGroup: l.option_group ?? null,
              optionLabel: l.option_label ?? null,
              optionChosen: l.option_chosen === true,
              pageRef: l.page_ref ?? null,
              pickReason: l.pick_reason ?? null,
              pickSource: l.pick_source === 'human' || l.pick_source === 'robot' ? l.pick_source : null,
            }
          })
          return {
            id: q.id,
            supplyHouseId: q.supply_house_id as string,
            houseName: house?.name ?? 'Supply house',
            receivedAt: q.received_at,
            validUntil: q.valid_until,
            freightCents: q.freight_cents,
            lines,
          }
        })
      setRobotQuoteCount((quoteRows ?? []).filter((q) => q.source === 'robot').length)
      setLineIdsByCell(ids)
      setQuotes(mapped)
      setRules(
        (ruleRows ?? [])
          .filter((r) => KNOWN_KINDS.has(r.match_kind))
          .map((r) => ({ pattern: r.pattern, matchKind: r.match_kind as SpecSectionMatchKind, sectionCode: r.section_code, priority: r.priority })),
      )

      // Last-quoted memory for these houses (min $/each per fixture key).
      const houseIds = mapped.map((q) => q.supplyHouseId)
      if (houseIds.length) {
        const { data: mem } = await supabase
          .from('supply_house_fixture_prices')
          .select('fixture_key, unit_price_each_cents')
          .in('supply_house_id', houseIds)
        const best = new Map<string, number>()
        for (const m of mem ?? []) {
          if (!m.fixture_key) continue
          const prev = best.get(m.fixture_key)
          if (prev == null || m.unit_price_each_cents < prev) best.set(m.fixture_key, m.unit_price_each_cents)
        }
        setLastQuoted(best)
      } else setLastQuoted(new Map())
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not load quotes.', 'error')
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
      if (e.key === 'Escape') {
        if (settling) setSettling(null)
        else onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose, settling])

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
        today: todayYmdInAppTz(),
      }),
    [quotes, currentQtyByName, snapshotQty, lastQuoted, rules],
  )
  const robot = useMemo(() => summarizeRobotWork(comparison.rows), [comparison])

  /** One teaching row per human act on a robot's work — the pricer digests these next session. */
  async function recordCorrection(input: { action: 'unpick' | 'repick' | 'choose_option'; fixture: string; toFixture?: string | null; lineId: string | null; note?: string | null }) {
    try {
      await db.from('fixture_component_corrections').insert({
        request_id: robotRequest?.id ?? null,
        bid_id: bidId,
        quote_line_id: input.lineId,
        action: input.action,
        from_fixture: input.fixture,
        to_fixture: input.toFixture ?? input.fixture,
        rule_text: input.note ?? null,
        created_by: user?.id ?? null,
      })
    } catch {
      // Teaching is best-effort; the pick itself already landed.
    }
  }

  async function pick(fixtureKey: string, houseId: string) {
    const row = comparison.rows.find((r) => r.fixture.trim().toLowerCase() === fixtureKey)
    if (!row) return
    try {
      const target = row.perHouse[houseId]
      if (!target) return
      // Lots pick atomically: toggling any member toggles every line in the lot.
      if (target.lotId != null) {
        const { error } = await supabase.from('bid_quote_lines').update({ picked: !target.picked }).eq('lot_id', target.lotId)
        if (error) throw error
        await load()
        return
      }
      const wasRobotPick = Object.values(row.perHouse).find((c) => c.picked)?.pickSource === 'robot'
      for (const [hid, cell] of Object.entries(row.perHouse)) {
        const lineIds = lineIdsByCell.get(`${cell.quoteId}|${fixtureKey}`) ?? []
        if (lineIds.length === 0) continue
        const shouldPick = hid === houseId ? !cell.picked : false
        if (cell.picked !== shouldPick) {
          // Kit lines pick together; a human pick is stamped so the Scoreboard can tell hers from the robot's.
          const patch = shouldPick ? { picked: true, pick_source: 'human' } : { picked: false, pick_source: cell.pickSource === 'robot' ? 'robot' : null }
          const { error } = await db.from('bid_quote_lines').update(patch).in('id', lineIds)
          if (error) throw error
        }
      }
      if (wasRobotPick) {
        const unpicking = target.picked
        await recordCorrection({
          action: unpicking ? 'unpick' : 'repick',
          fixture: row.fixture,
          lineId: (lineIdsByCell.get(`${target.quoteId}|${fixtureKey}`) ?? [])[0] ?? null,
          note: unpicking ? 'unpicked the robot’s choice' : `picked ${comparison.houses.find((h) => h.supplyHouseId === houseId)?.houseName ?? 'another house'} instead of the robot’s choice`,
        })
      }
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the pick.', 'error')
    }
  }

  /** Settle an option group: the chosen line prices the cell; the others stay as history. */
  async function chooseOption(fixtureKey: string, houseId: string, lineId: string, label: string) {
    const row = comparison.rows.find((r) => r.fixture.trim().toLowerCase() === fixtureKey)
    const cell = row?.perHouse[houseId]
    if (!row || !cell?.kit?.needsChoice) return
    try {
      const optionIds = cell.kit.needsChoice.options.map((o) => o.lineId)
      const { error: clearErr } = await db.from('bid_quote_lines').update({ option_chosen: false }).in('id', optionIds)
      if (clearErr) throw clearErr
      const { error } = await db.from('bid_quote_lines').update({ option_chosen: true }).eq('id', lineId)
      if (error) throw error
      await recordCorrection({ action: 'choose_option', fixture: row.fixture, lineId, note: `chose ${label}` })
      setSettling(null)
      showToast(`${row.fixture}: ${label} it is. Tap the price to pick it.`, 'success')
      await load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save the choice.', 'error')
    }
  }

  /** The picked selections, shaped for Apply picks to costs. */
  const applyItems: ApplyPickItem[] = useMemo(() => {
    const items: ApplyPickItem[] = []
    const lotsSeen = new Map<string, { houseName: string; totalCents: number; fixtures: string[] }>()
    const houseNameById = new Map(comparison.houses.map((h) => [h.supplyHouseId, h.houseName]))
    for (const r of comparison.rows) {
      for (const [houseId, cell] of Object.entries(r.perHouse)) {
        if (!cell.picked || cell.cantSupply) continue
        if (cell.lotId != null && cell.lotTotalCents != null) {
          const lot = lotsSeen.get(cell.lotId) ?? { houseName: houseNameById.get(houseId) ?? '—', totalCents: cell.lotTotalCents, fixtures: [] }
          lot.fixtures.push(r.fixture)
          lotsSeen.set(cell.lotId, lot)
        } else if (cell.unitPriceEachCents != null) {
          items.push({
            kind: 'line',
            fixture: r.fixture,
            houseName: houseNameById.get(houseId) ?? '—',
            unitCents: cell.unitPriceEachCents,
            quoteLineId: (lineIdsByCell.get(`${cell.quoteId}|${r.fixture.trim().toLowerCase()}`) ?? [])[0] ?? null,
          })
        }
      }
    }
    for (const [lotId, lot] of lotsSeen) items.push({ kind: 'lot', lotId, ...lot })
    return items
  }, [comparison, lineIdsByCell])

  if (!open || typeof document === 'undefined') return null

  const smallMuted: CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)' }
  const houseCols = comparison.houses
  const showRobotCol = robot.hasRobotWork || robotQuoteCount > 0
  const grid: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1.5fr) 4.5rem repeat(${Math.max(1, houseCols.length)}, minmax(6.5rem, 1fr)) minmax(6rem, 0.9fr)${showRobotCol ? ' minmax(8rem, 1fr)' : ''}`,
    gap: '0.5rem',
    alignItems: 'center',
    padding: '0.3rem 0.6rem',
  }
  const result = (robotRequest?.result ?? null) as { houses_read?: number; pages_read?: number; rows_priced?: number; rows_asked?: number; rows_total?: number; expired_houses?: string[] } | null
  const toggleExpanded = (key: string) => {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpanded(next)
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
            {robotQuoteCount > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--bg-blue-tint)', border: '1px solid var(--border-blue)', borderRadius: 6, padding: '0.55rem 0.75rem' }} data-testid="robot-banner">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="4" y="8" width="16" height="11" rx="2" />
                  <circle cx="9" cy="13.5" r="1.2" fill="#2563eb" stroke="none" />
                  <circle cx="15" cy="13.5" r="1.2" fill="#2563eb" stroke="none" />
                  <path d="M12 8V5" />
                  <circle cx="12" cy="4" r="1" />
                  <path d="M9 17h6" />
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-blue-800)' }}>
                    The robot read {robotQuoteCount} quote{robotQuoteCount === 1 ? '' : 's'}
                    {result?.rows_priced != null ? ` · picked ${result.rows_priced} of ${result.rows_total ?? comparison.rows.length} rows` : ''}
                    {robot.needsChoice.length ? ` · ${robot.needsChoice.length} to settle` : ''}
                    {robot.incompleteCells ? ` · ${robot.incompleteCells} incomplete kit${robot.incompleteCells === 1 ? '' : 's'}` : ''}
                  </div>
                  {robotRequest?.summary ? <div style={{ fontSize: '0.75rem', color: 'var(--text-blue-800)' }}>{robotRequest.summary}</div> : null}
                  {result?.expired_houses?.length ? (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-amber-700)' }}>Expired when read: {result.expired_houses.join(', ')} — ask for a re-issue before ordering.</div>
                  ) : null}
                </div>
              </div>
            ) : null}
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
                  {h.freightCents != null && h.freightCents > 0 ? ` + ${money(h.freightCents)} freight${h.commonWithFreightCents != null ? ` = ${money(h.commonWithFreightCents)}` : ''}` : ''}
                  {h.freightCents === 0 ? ' · free freight' : ''}
                  {h.freightCents == null ? <span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}> · freight not stated</span> : null}
                </span>
              ))}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ ...grid, background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                <span>Part</span>
                <span>Qty</span>
                {houseCols.map((h) => (<span key={h.supplyHouseId}>{h.houseName}</span>))}
                <span>Last quoted</span>
                {showRobotCol ? <span>Robot</span> : null}
              </div>
              <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
                {comparison.rows.map((r) => {
                  const key = r.fixture.trim().toLowerCase()
                  const sectionHeader = r.sectionCode !== lastSection ? (lastSection = r.sectionCode) ?? 'No code yet' : null
                  const isKit = Object.values(r.perHouse).some((c) => c.kit && c.kit.components.length > 1)
                  const isOpen = expanded.has(key)
                  const robotText = showRobotCol ? robotColumnText(r) : null
                  return (
                    <div key={key}>
                      {sectionHeader != null ? (
                        <div style={{ padding: '0.25rem 0.6rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>{sectionHeader}</div>
                      ) : null}
                      <div style={{ ...grid, borderBottom: '1px solid var(--bg-muted)', background: robot.needsChoice.some((n) => n.fixture === r.fixture) ? 'var(--bg-yellow-tint)' : undefined }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                          {isKit ? (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(key)}
                              aria-expanded={isOpen}
                              aria-label={isOpen ? `Hide the parts of ${r.fixture}` : `Show the parts of ${r.fixture}`}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', font: 'inherit', fontSize: '0.75rem', lineHeight: 1 }}
                            >
                              {isOpen ? '▾' : '▸'}
                            </button>
                          ) : null}
                          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', color: 'var(--text-strong)', overflowWrap: 'anywhere' }}>
                            {r.fixture}
                            {r.drift ? <span title={`Quoted at ${r.qtySnapshot}, now ${r.qtyNow}`} style={{ color: 'var(--text-amber-700)', fontSize: '0.7rem' }}> · qty changed</span> : null}
                          </span>
                          {isKit ? <span style={{ ...smallMuted, fontSize: '0.7rem' }}>kit</span> : null}
                        </span>
                        <span style={{ ...smallMuted, fontVariantNumeric: 'tabular-nums' }}>{r.qtyNow || '—'}</span>
                        {houseCols.map((h) => {
                          const cell = r.perHouse[h.supplyHouseId]
                          if (!cell) return <span key={h.supplyHouseId} style={{ color: 'var(--text-faint)' }}>—</span>
                          const best = r.bestHouseId === h.supplyHouseId
                          return <CellButton key={h.supplyHouseId} cell={cell} best={best} onPick={() => void pick(key, h.supplyHouseId)} onSettle={() => setSettling({ fixtureKey: key, houseId: h.supplyHouseId })} />
                        })}
                        <span style={{ ...smallMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {r.baselineSource === 'last-quoted' ? money(r.baselineEachCents) : '—'}
                        </span>
                        {showRobotCol ? (
                          <span style={{ fontSize: '0.7rem', lineHeight: 1.25, color: robotText?.startsWith('needs') ? 'var(--text-amber-700)' : robotText?.startsWith('you changed') ? 'var(--text-muted)' : 'var(--text-blue-800)', fontWeight: robotText?.startsWith('needs') ? 600 : 500 }}>
                            {robotText ?? ''}
                          </span>
                        ) : null}
                      </div>
                      {isKit && isOpen
                        ? (() => {
                            // One sub-row per role/label seen in any house's kit for this fixture.
                            const rolesSeen: Array<{ role: ComponentRole | null; label: string | null }> = []
                            for (const c of Object.values(r.perHouse)) {
                              for (const comp of c.kit?.components ?? []) {
                                const keyRole = `${comp.role ?? ''}|${comp.role ? '' : comp.label ?? ''}`
                                if (!rolesSeen.some((x) => `${x.role ?? ''}|${x.role ? '' : x.label ?? ''}` === keyRole)) rolesSeen.push({ role: comp.role, label: comp.label })
                              }
                            }
                            return rolesSeen.map((rs, i) => (
                              <div key={`${key}-${i}`} style={{ ...grid, padding: '0.15rem 0.6rem 0.15rem 1.6rem', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--bg-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, fontSize: '0.75rem', color: 'var(--text-base)' }}>
                                  <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', minWidth: '4.5rem' }}>{rs.role ? roleLabel(rs.role) : 'part'}</span>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {Object.values(r.perHouse).map((c) => c.kit?.components.find((x) => (rs.role ? x.role === rs.role : x.label === rs.label))?.label).find(Boolean) ?? ''}
                                  </span>
                                </span>
                                <span />
                                {houseCols.map((h) => {
                                  const comp = r.perHouse[h.supplyHouseId]?.kit?.components.find((x) => (rs.role ? x.role === rs.role : x.label === rs.label))
                                  return (
                                    <span key={h.supplyHouseId} style={{ textAlign: 'right', fontSize: '0.75rem', color: comp ? 'var(--text-base)' : 'var(--text-amber-700)', fontVariantNumeric: 'tabular-nums' }} title={comp?.pageRef ?? undefined}>
                                      {!comp ? 'not quoted' : comp.inKit ? 'in kit' : comp.unitPriceEachCents != null ? money(comp.unitPriceEachCents) : '—'}
                                      {comp?.pageRef ? <span style={{ ...smallMuted, fontSize: '0.65rem' }}> · {comp.pageRef}</span> : null}
                                    </span>
                                  )
                                })}
                                <span />
                                {showRobotCol ? <span /> : null}
                              </div>
                            ))
                          })()
                        : null}
                    </div>
                  )
                })}
              </div>
              {robot.needsChoice.length > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.6rem', background: 'var(--bg-yellow-tint)', borderTop: '1px solid #f59e0b', fontSize: '0.8125rem', color: 'var(--text-amber-700)' }} data-testid="settle-strip">
                  <strong>{robot.needsChoice.length} row{robot.needsChoice.length === 1 ? '' : 's'} to settle:</strong>
                  <span style={{ flex: 1 }}>
                    {robot.needsChoice.map((n) => n.fixture).join(', ')} — the quote lists options and the plans decide. Tap <em>needs a choice</em> on the row to pick one.
                  </span>
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.7rem' }}>
              <span style={smallMuted}>
                Picked total{' '}
                {comparison.pickedFreight.length > 0 ? (
                  <>
                    parts <strong style={{ color: 'var(--text-strong)' }}>{money(comparison.pickedTotalCents)}</strong>
                    {comparison.pickedFreight.map((f) => (
                      <span key={f.supplyHouseId}>
                        {' + '}
                        {f.houseName} freight{' '}
                        {f.freightCents != null ? <strong style={{ color: 'var(--text-strong)' }}>{money(f.freightCents)}</strong> : <span style={{ color: 'var(--text-amber-700)' }}>not stated</span>}
                      </span>
                    ))}
                    {' = '}
                    <strong style={{ color: 'var(--text-strong)' }}>{money(comparison.pickedTotalWithFreightCents)}</strong>
                  </>
                ) : (
                  <strong style={{ color: 'var(--text-strong)' }}>{money(comparison.pickedTotalCents)}</strong>
                )}{' '}
                at today’s counts · picks are saved and ready for a future PO handoff.
                {robot.hasRobotWork ? ` · robot picked ${robot.robotPicked}, you changed ${robot.humanChanged}.` : ''}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={applyItems.length === 0}
                  title={applyItems.length === 0 ? 'Pick some prices first' : 'Write the picked prices onto this bid’s row costs (materials only, with revert tags)'}
                  onClick={() => setApplyOpen(true)}
                  style={{ padding: '0.5rem 0.9rem', background: applyItems.length === 0 ? 'var(--bg-200)' : '#16a34a', color: applyItems.length === 0 ? 'var(--text-faint)' : 'white', border: 'none', borderRadius: 4, cursor: applyItems.length === 0 ? 'not-allowed' : 'pointer', font: 'inherit', fontWeight: 600 }}
                >
                  Apply picks to costs
                </button>
                <button type="button" onClick={onClose} style={{ padding: '0.5rem 0.9rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>Close</button>
              </div>
            </div>
          </>
        )}
      </div>
      {settling
        ? (() => {
            const row = comparison.rows.find((r) => r.fixture.trim().toLowerCase() === settling.fixtureKey)
            const cell = row?.perHouse[settling.houseId]
            const houseName = comparison.houses.find((h) => h.supplyHouseId === settling.houseId)?.houseName ?? 'this house'
            if (!row || !cell?.kit?.needsChoice) return null
            const nc = cell.kit.needsChoice
            return (
              <div style={{ ...overlay, zIndex: MODAL_Z + 5, alignItems: 'center' }} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSettling(null) }}>
                <div role="dialog" aria-modal="true" aria-label={`Choose the ${nc.group} for ${row.fixture}`} style={{ ...panel, maxWidth: 520 }} onMouseDown={(e) => e.stopPropagation()}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>
                      {row.fixture} — which {nc.group}?
                    </h3>
                    <p style={{ margin: '0.15rem 0 0', ...smallMuted }}>{houseName} quoted {nc.options.length} options. The plans decide; pick the one this bid calls for.</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {nc.options.map((o) => (
                      <button
                        key={o.lineId}
                        type="button"
                        onClick={() => void chooseOption(settling.fixtureKey, settling.houseId, o.lineId, o.label)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
                      >
                        <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--text-strong)' }}>{o.label}</span>
                        <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-strong)' }}>{money(o.unitPriceEachCents)}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                    <button type="button" onClick={() => setSettling(null)} style={{ padding: '0.45rem 0.85rem', background: 'var(--bg-muted)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', borderRadius: 4, cursor: 'pointer', font: 'inherit' }}>
                      Not now
                    </button>
                  </div>
                </div>
              </div>
            )
          })()
        : null}
      <ApplyPicksToCostsModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        onApplied={() => {
          onCostsApplied()
        }}
        bidId={bidId}
        items={applyItems}
        countRows={rows}
        takeoffMaterialsByCountRowId={takeoffMaterialsByCountRowId}
        taxPercent={taxPercent}
        currentTotals={currentTotals}
      />
    </div>,
    document.body,
  )
}

/** One house's cell: the price to tap, a kit's basis in the title, or the incomplete / needs-a-choice state. */
function CellButton({ cell, best, onPick, onSettle }: { cell: CompareRowCell; best: boolean; onPick: () => void; onSettle: () => void }) {
  const kit = cell.kit
  if (kit?.needsChoice) {
    return (
      <button
        type="button"
        onClick={onSettle}
        title={`${kit.needsChoice.options.length} options quoted — choose the ${kit.needsChoice.group} the plans call for`}
        style={{ textAlign: 'right', padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px dashed #f59e0b', background: 'none', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', color: 'var(--text-amber-700)', fontWeight: 600, lineHeight: 1.25 }}
      >
        needs a choice
        <span style={{ display: 'block', fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>{describeChoiceRange(kit.needsChoice.minCents, kit.needsChoice.maxCents, money)}</span>
      </button>
    )
  }
  if (kit?.incomplete && !cell.cantSupply) {
    return (
      <span title="A part another house priced is missing here — an incomplete kit is never the cheapest" style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--text-amber-700)', lineHeight: 1.25 }}>
        incomplete
        <span style={{ display: 'block', fontWeight: 400, color: 'var(--text-muted)' }}>{describeIncomplete(cell, roleLabel)}</span>
      </span>
    )
  }
  const basis = kit ? describeKitBasis(kit, money) : null
  const disabled = cell.cantSupply || (cell.unitPriceEachCents == null && cell.lotId == null)
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      title={cell.expired ? 'Quote expired' : cell.picked ? `Picked${cell.pickSource === 'robot' ? ' by the robot' : ''} — tap to unpick${basis ? ` · ${basis}` : ''}` : `Tap to pick${basis ? ` · ${basis}` : ''}`}
      style={{
        textAlign: 'right',
        padding: '0.25rem 0.5rem',
        borderRadius: 4,
        border: cell.picked ? '2px solid #16a34a' : '1px solid transparent',
        background: 'none',
        cursor: disabled ? 'default' : 'pointer',
        font: 'inherit',
        fontSize: '0.8125rem',
        fontVariantNumeric: 'tabular-nums',
        color: cell.cantSupply ? 'var(--text-faint)' : cell.expired ? 'var(--text-faint)' : best ? '#15803d' : 'var(--text-strong)',
        fontWeight: best ? 700 : 400,
        textDecoration: cell.expired ? 'line-through' : undefined,
      }}
    >
      {cell.cantSupply
        ? 'n/a'
        : cell.lotId != null && cell.lotTotalCents != null
          ? `in lot · ${money(cell.lotTotalCents)}`
          : money(cell.unitPriceEachCents)}
      {best && !cell.expired ? ' ★' : ''}
    </button>
  )
}
