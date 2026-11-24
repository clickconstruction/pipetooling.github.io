import { orderRoundingTitle } from '../../lib/bids/takeoffOrderRounding'
import { TakeoffOrderListPanel } from './TakeoffOrderListPanel'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import type { TakeoffCoverageSummary } from '../../lib/bids/takeoffCoverage'
import { sumByAlternate } from '../../lib/bids/alternateScope'
import { isAlternateRow } from '../../lib/bids/countSheet'
import type { BookFillPlan } from '../../lib/bids/takeoffBookFill'
import { buildCopyFromBidPreview, type CopyFromBidCandidate } from '../../lib/bids/takeoffFixtureHistory'
import { fixtureUnitCosts, rfqScopeForZeroPrice, zeroPriceQueue } from '../../lib/bids/takeoffCostRail'
import type { TakeoffFixtureHistoryRow } from '../../types/database-functions'
import type { BidCountRow } from '../../types/bids'
import type { MaterialTemplateWithAssemblyType, TakeoffRoughPartLineRow } from '../../lib/bids/bidPricingEngineTypes'
import { TakeoffCoverageStrip } from './TakeoffCoverageStrip'
import { EmptyState } from '../EmptyState'
import { DEAD_PRESS_FILL, DEAD_PRESS_TEXT } from '../../lib/deadPress'
import { Money } from '../Money'
import { useMeasuredWidth } from '../../hooks/useMeasuredWidth'
import { TAKEOFF_RAIL_PX, railFitsBeside } from '../../lib/bids/takeoffSheetFit'
import { RAIL_FOLD_WORDS, railFoldHint, railMode, railPressOutcome, railStorage, readRailHintDone, readStoredRailChoice, writeRailHintDone, writeStoredRailChoice, type RailChoice } from '../../lib/bids/takeoffRailFold'
import { TakeoffRailStrip } from './TakeoffRailStrip'

/**
 * New 2 — "Cost rail" (v2.2781, docs/TAKEOFFS_REFRESH_PLAN.md; mockup C):
 * today's sheet kept familiar — the tab's own line editor with the book's
 * suggestion inline on every empty fixture — beside a sticky rail that says
 * what Pricing sees, queues unpriced parts into a quote request, copies
 * uncosted fixtures from a previous bid, and shows what the book knows.
 */

const panel: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '0.8rem 0.9rem', display: 'flex', flexDirection: 'column', gap: 8 }
const panelK: React.CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const kv: React.CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, fontSize: '0.85rem' }
/** v2.4191: the ALT mark an alternate's row wears (the Count Sheet's). */
const altChipStyle: React.CSSProperties = { fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0 0.3rem', borderRadius: 3, border: '1px solid var(--text-amber-700)', color: 'var(--text-amber-700)', marginLeft: '0.35rem', verticalAlign: '1px' }
const mini = (primary: boolean, disabled = false): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 0.75rem',
  borderRadius: 6,
  fontSize: '0.8rem',
  fontWeight: 600,
  border: primary ? '1px solid #2563eb' : '1px solid var(--border)',
  background: disabled ? DEAD_PRESS_FILL : primary ? '#2563eb' : 'var(--surface)',
  color: disabled ? DEAD_PRESS_TEXT : primary ? '#fff' : 'var(--text-strong)',
  cursor: disabled ? 'default' : 'pointer',
  alignSelf: 'flex-start',
})

export function TakeoffCostRailView({
  countRows,
  lines,
  coverage,
  bookPlan,
  bookVersions,
  selectedBookVersionId,
  onSelectBook,
  materialTemplates,
  partNameById,
  history,
  renderLinesTable,
  fillButton,
  onFillAll,
  onApplyBook,
  onCopyFromBid,
  onRequestQuotes,
  onFocusView,
  onRefreshOrderRules = null,
  focusRequest,
  stagesPanel = null,
  alternateTags = [],
}: {
  countRows: BidCountRow[]
  /** v2.4191: the bid's alternate groups — the rail splits materials into the base and what each alternate adds. */
  alternateTags?: readonly string[]
  lines: TakeoffRoughPartLineRow[]
  coverage: TakeoffCoverageSummary
  bookPlan: BookFillPlan | null
  bookVersions: ReadonlyArray<{ id: string; name: string }>
  selectedBookVersionId: string | null
  onSelectBook: (id: string | null) => void
  materialTemplates: MaterialTemplateWithAssemblyType[]
  partNameById: ReadonlyMap<string, string>
  history: Map<string, TakeoffFixtureHistoryRow[]> | null
  renderLinesTable: (rows: BidCountRow[], opts?: { suggestionFor?: (row: BidCountRow) => ReactNode }) => ReactNode
  fillButton: { label: string; disabled: boolean; title: string }
  onFillAll: () => void
  onApplyBook: (countRowId: string, templateIds: string[]) => Promise<void>
  onCopyFromBid: (candidate: CopyFromBidCandidate) => Promise<void>
  onRequestQuotes: (scope: { lines: Array<{ fixture: string; count: number; unit?: string | null }>; text: string }) => void
  onFocusView: () => void
  /** Sold in (v2.3409): re-snapshot every line's rule from the catalog. */
  onRefreshOrderRules?: (() => Promise<{ updated: number; cleared: number }>) | null
  /** A cross-tab row jump: show every row so the flash can find it. */
  focusRequest?: { countRowId: string; nonce: number } | null
  /** Materials by stage (v2.3672): the Stages panel, rendered under What Pricing sees. */
  stagesPanel?: ReactNode
}) {
  const [filter, setFilter] = useState<'all' | 'uncosted' | 'zero'>('all')
  const [busyRow, setBusyRow] = useState<string | null>(null)
  const [pickedBid, setPickedBid] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [showUnitCosts, setShowUnitCosts] = useState(false)
  // v2.8476: the rail sits beside the list only where both fit, so no row press ends up under it.
  // v2.8480: anywhere else, and wherever the person hid it, it folds to a strip across the top of the sheet
  // (`lib/bids/takeoffRailFold.ts`). A narrow window always starts folded; there Show opens the rail over the
  // list, and Hide, Esc or any press on the list puts it away. Only a wide window's choice is kept.
  const [sheetRef, sheetWidth] = useMeasuredWidth<HTMLDivElement>()
  const railFits = railFitsBeside(sheetWidth)
  const [railChoice, setRailChoice] = useState<RailChoice | null>(() => readStoredRailChoice(railStorage()))
  const [railPanelOpen, setRailPanelOpen] = useState(false)
  const railIs = railMode({ fits: railFits, choice: railChoice, panelOpen: railPanelOpen })
  const railPanelId = useId()
  // The line that says where the rail went, until the person has opened it once in a narrow window.
  const [railHintDone, setRailHintDone] = useState(() => readRailHintDone(railStorage()))
  // Show and Hide are different buttons in a wide window, and Esc can close the rail from inside it:
  // the focus goes to the press that is left, never to nowhere.
  const railFocusPress = useRef(false)
  const pressRail = (press: 'show' | 'hide') => {
    const out = railPressOutcome(press, railFits)
    setRailPanelOpen(out.panelOpen)
    railFocusPress.current = true
    if (out.choice) {
      setRailChoice(out.choice)
      writeStoredRailChoice(railStorage(), out.choice)
    } else if (press === 'show' && !railHintDone) {
      setRailHintDone(true)
      writeRailHintDone(railStorage())
    }
  }
  useEffect(() => {
    if (!railFocusPress.current) return
    railFocusPress.current = false
    sheetRef.current?.querySelector<HTMLElement>('[data-rail-press]')?.focus()
  }, [railIs, sheetRef])
  // A window dragged wide again has the rail beside the list: the panel over the list is done with.
  useEffect(() => {
    if (railFits) setRailPanelOpen(false)
  }, [railFits])
  // Esc puts the open rail away, unless a window is open on top of it: then Esc is that window's.
  useEffect(() => {
    if (railIs !== 'over') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      railFocusPress.current = document.activeElement?.closest('.takeoffRailOver') != null
      setRailPanelOpen(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [railIs])
  useEffect(() => {
    if (focusRequest) setFilter('all')
  }, [focusRequest?.nonce, focusRequest])

  const uncosted = useMemo(() => new Set(coverage.uncostedIds), [coverage])
  const zeroRows = useMemo(() => new Set(lines.filter((l) => coverage.zeroPriceLineIds.includes(l.id)).map((l) => l.countRowId)), [lines, coverage])
  const visibleRows = useMemo(
    () => (filter === 'all' ? countRows : filter === 'uncosted' ? countRows.filter((r) => uncosted.has(r.id)) : countRows.filter((r) => zeroRows.has(r.id))),
    [countRows, filter, uncosted, zeroRows],
  )
  const queue = useMemo(() => zeroPriceQueue(countRows, lines, partNameById), [countRows, lines, partNameById])
  const unitCosts = useMemo(() => fixtureUnitCosts(countRows, coverage), [countRows, coverage])
  // v2.4191: each fixture's costed total (its lines × count + its slice of the sticks) summed by alternate scope.
  const altSplit = useMemo(() => sumByAlternate(countRows, alternateTags, (r) => coverage.perFixture.get(r.id)?.total ?? 0), [countRows, alternateTags, coverage])
  const altRowIds = useMemo(() => new Set(countRows.filter((r) => isAlternateRow(r, alternateTags)).map((r) => r.id)), [countRows, alternateTags])
  // What the Workbench calls "no cost": no lines, or lines that all price at $0.
  const noCostCount = useMemo(() => coverage.uncostedIds.length + unitCosts.filter((u) => u.unitCost === 0).length, [coverage, unitCosts])
  const candidates = useMemo(() => (history ? buildCopyFromBidPreview(countRows, coverage.uncostedIds, [...history.values()].flat()).slice(0, 3) : []), [history, countRows, coverage])
  const picked = candidates.find((c) => c.bidId === pickedBid) ?? candidates[0] ?? null
  const bookMatched = bookPlan ? bookPlan.matched : 0
  const suggestionByRow = useMemo(() => new Map((bookPlan?.fillable ?? []).map((m) => [m.countRowId, m])), [bookPlan])

  const suggestionFor = (row: BidCountRow): ReactNode => {
    const m = suggestionByRow.get(row.id)
    if (!m) return null
    const names = m.templateIds.map((t) => materialTemplates.find((x) => x.id === t)?.name ?? 'Assembly').join(' + ')
    const busy = busyRow === row.id
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
        <span style={{ color: 'var(--text-muted)' }}>
          · book suggests <strong style={{ color: 'var(--text-strong)' }}>{names}</strong>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusyRow(row.id)
            try {
              await onApplyBook(row.id, m.templateIds)
            } finally {
              setBusyRow(null)
            }
          }}
          style={{ ...mini(true, busy), height: 24, fontSize: '0.75rem' }}
        >
          {busy ? 'Applying…' : 'Apply'}
        </button>
      </span>
    )
  }

  const chip = (id: typeof filter, label: string, n: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      style={{ display: 'inline-flex', alignItems: 'center', height: 28, padding: '0 0.7rem', borderRadius: 999, border: `1px solid ${filter === id ? 'var(--text-strong)' : 'var(--border)'}`, background: filter === id ? 'var(--text-strong)' : 'var(--surface)', color: filter === id ? 'var(--surface)' : 'var(--text-strong)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
    >
      {label} · {n}
    </button>
  )

  // The rail's panels, drawn once: beside the list, or hung under the strip over it.
  const railPanels = (
    <>
          <div style={{ ...panel, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
            <span style={{ ...panelK, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {RAIL_FOLD_WORDS.name}
              {railIs === 'beside' ? (
                <button type="button" className="takeoffRailHide" data-rail-press onClick={() => pressRail('hide')} aria-label={RAIL_FOLD_WORDS.hideName} title={RAIL_FOLD_WORDS.hideName} aria-expanded>
                  {RAIL_FOLD_WORDS.hide}
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 15l6-6 6 6" />
                  </svg>
                </button>
              ) : null}
            </span>
            <div style={kv}>
              <span>Materials on this bid</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><Money amount={coverage.materialsTotal} /></span>
            </div>
            {coverage.orderRounding.extraCost > 0 ? (
              <div style={{ ...kv, fontSize: '0.78rem' }} title={orderRoundingTitle(coverage.orderRounding)} data-testid="takeoff-rail-order-rounding">
                <span style={{ color: 'var(--text-muted)' }}>incl. order rounding · {coverage.orderRounding.partsRounded} part{coverage.orderRounding.partsRounded === 1 ? '' : 's'} sold in packs</span>
                <span style={{ fontWeight: 700, color: 'var(--text-violet-700)', fontVariantNumeric: 'tabular-nums' }}>+<Money amount={coverage.orderRounding.extraCost} /></span>
              </div>
            ) : null}
            {altSplit ? (
              <div data-testid="takeoff-rail-alternates" style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.8rem', padding: '0.35rem 0.5rem', borderRadius: 6, background: 'var(--bg-amber-tint)' }} title="The customer wants this section priced with and without — the Counts tab's alternate groups">
                <div style={kv}><span style={{ color: 'var(--text-muted)' }}>Base</span><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><Money amount={altSplit.base} /></span></div>
                {altSplit.alternates.map((a) => (
                  <div key={a.label} style={kv}><span style={{ color: 'var(--text-amber-700)', fontWeight: 600 }}>+ {a.label} <span style={altChipStyle}>ALT</span></span><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><Money amount={a.value} /></span></div>
                ))}
                <div style={kv}><span style={{ color: 'var(--text-muted)' }}>With {altSplit.alternates.length === 1 ? 'the alternate' : 'every alternate'}</span><span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}><Money amount={altSplit.total} /></span></div>
              </div>
            ) : null}
            <div style={kv}>
              <span style={{ color: 'var(--text-muted)' }}>Costed fixtures</span>
              <span style={{ fontWeight: 700, color: coverage.uncostedIds.length === 0 ? 'var(--text-green-700)' : 'var(--text-amber-700)' }}>
                {coverage.costed} of {coverage.fixtures}
              </span>
            </div>
            {noCostCount > 0 ? (
              <div style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', fontSize: '0.78rem', fontWeight: 600 }}>
                {noCostCount} fixture{noCostCount === 1 ? '' : 's'} carr{noCostCount === 1 ? 'ies' : 'y'} no material cost — Pricing shows {noCostCount === 1 ? 'it' : 'them'} as "no cost"
              </div>
            ) : null}
            <button type="button" onClick={() => setShowUnitCosts((v) => !v)} style={{ ...kv, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-blue-700)', fontFamily: 'inherit', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Per-fixture unit costs</span>
              <span>{showUnitCosts ? 'hide' : 'show'}</span>
            </button>
            {showUnitCosts ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.8rem' }}>
                {unitCosts.map((u) => (
                  <div key={u.countRowId} style={kv}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.fixture}{altRowIds.has(u.countRowId) ? <span style={altChipStyle}>ALT</span> : null}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: u.incomplete ? 'var(--text-red-700)' : undefined, whiteSpace: 'nowrap' }}>
                      <Money amount={u.unitCost} />{u.incomplete ? ' · incomplete' : ''}
                    </span>
                  </div>
                ))}
                {unitCosts.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>No costed fixtures yet.</span> : null}
              </div>
            ) : null}
          </div>

          {stagesPanel ? (
            <div style={panel} data-testid="takeoff-rail-stages">
              <span style={panelK}>Stages · materials by stage</span>
              {stagesPanel}
            </div>
          ) : null}

          <TakeoffOrderListPanel rounding={coverage.orderRounding} partNameById={partNameById} onRefreshRules={onRefreshOrderRules ?? null} />

          <div style={panel}>
            <span style={panelK}>Needs a price</span>
            {queue.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Every part line has a price.</span>
            ) : (
              <>
                {queue.slice(0, 6).map((q) => (
                  <div key={q.lineId} style={kv}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.partName}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{q.fixture}</span>
                  </div>
                ))}
                {queue.length > 6 ? <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+ {queue.length - 6} more</span> : null}
                <button type="button" onClick={() => onRequestQuotes(rfqScopeForZeroPrice(queue, coverage.orderRounding))} style={mini(true)}>
                  Request quotes · {queue.length} part{queue.length === 1 ? '' : 's'}
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Opens a quote request to your supply houses; picked prices land back on these lines.</span>
              </>
            )}
          </div>

          <div style={panel}>
            <span style={panelK}>Copy fixtures from a previous bid</span>
            {history == null ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Looking at previous bids…</span>
            ) : coverage.uncostedIds.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Every fixture has lines — nothing to fill.</span>
            ) : candidates.length === 0 ? (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No previous bid costed these fixtures.</span>
            ) : (
              <>
                {candidates.map((c) => (
                  <label key={c.bidId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="radio" name="takeoff-copy-from-bid" checked={picked?.bidId === c.bidId} onChange={() => setPickedBid(c.bidId)} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      B{c.bidNumber ?? '?'} · {c.projectName ?? '—'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {c.fills.length} of {coverage.uncostedIds.length} match
                    </span>
                  </label>
                ))}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Fills only the uncosted fixtures, matched by fixture name; parts re-price at today's lowest catalog price.</span>
                <button
                  type="button"
                  disabled={!picked || copying}
                  onClick={async () => {
                    if (!picked) return
                    setCopying(true)
                    try {
                      await onCopyFromBid(picked)
                    } finally {
                      setCopying(false)
                    }
                  }}
                  style={mini(false, !picked || copying)}
                >
                  {copying ? 'Copying…' : picked ? `Copy ${picked.lineCount} line${picked.lineCount === 1 ? '' : 's'} from B${picked.bidNumber ?? '?'}` : 'Copy'}
                </button>
              </>
            )}
          </div>

          <div style={panel}>
            <span style={panelK}>Book · {bookVersions.find((v) => v.id === selectedBookVersionId)?.name ?? 'none picked'}</span>
            <div style={kv}>
              <span style={{ color: 'var(--text-muted)' }}>Knows</span>
              <span style={{ fontWeight: 600 }}>{bookMatched} of {countRows.length} fixture{countRows.length === 1 ? '' : 's'}</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Finish a fixture in One at a time and tick Remember, and the next bid starts filled in.</span>
          </div>
    </>
  )

  return (
    <div data-testid="takeoff-cost-rail-view" ref={sheetRef} data-rail={railIs}>
      <TakeoffCoverageStrip coverage={coverage} onClickUncosted={() => setFilter('uncosted')} onClickZeroPrice={() => setFilter('zero')}>
        <button type="button" onClick={onFillAll} disabled={fillButton.disabled} title={fillButton.title || undefined} style={{ padding: '0.4rem 0.8rem', background: fillButton.disabled ? DEAD_PRESS_FILL : '#2563eb', color: fillButton.disabled ? DEAD_PRESS_TEXT : '#fff', border: 'none', borderRadius: 4, cursor: fillButton.disabled ? 'default' : 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          {fillButton.label}
        </button>
        <button type="button" onClick={onFocusView} style={{ padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }} title="Walk the fixtures one at a time, with the book and your last bids">
          One at a time
        </button>
      </TakeoffCoverageStrip>

      {railIs === 'beside' ? null : (
        <TakeoffRailStrip
          materialsTotal={coverage.materialsTotal}
          costed={coverage.costed}
          fixtures={coverage.fixtures}
          uncosted={coverage.uncostedIds.length}
          noCost={noCostCount}
          open={railIs === 'over'}
          onPress={() => pressRail(railIs === 'over' ? 'hide' : 'show')}
          panelId={railPanelId}
          hint={railFoldHint({ mode: railIs, fits: railFits, hintDone: railHintDone })}
        >
          {railIs === 'over' ? (
            <div id={railPanelId} className="takeoffRailOver" role="region" aria-label={RAIL_FOLD_WORDS.name} data-testid="takeoff-rail">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{railPanels}</div>
            </div>
          ) : null}
        </TakeoffRailStrip>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: railIs === 'beside' ? `minmax(0, 1fr) ${TAKEOFF_RAIL_PX}px` : 'minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
        {/* While the rail is open over the list, any press on the list puts it away, and the press still lands.
            So does the Tab key walking out of the rail into the list: a focused field is never under the rail. */}
        <div data-testid="takeoff-sheet-list" onPointerDownCapture={railIs === 'over' ? () => setRailPanelOpen(false) : undefined} onFocusCapture={railIs === 'over' ? () => setRailPanelOpen(false) : undefined} style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Takeoff book</label>
            <select
              value={selectedBookVersionId ?? ''}
              onChange={(e) => onSelectBook(e.target.value || null)}
              style={{ padding: '0.35rem 0.5rem', border: '1px solid var(--border-strong)', borderRadius: 4, minWidth: '10rem', background: 'var(--surface)', color: 'inherit' }}
            >
              <option value="">— Select a book —</option>
              {bookVersions.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <span style={{ flex: 1 }} />
            {chip('all', 'All', countRows.length)}
            {chip('uncosted', 'Uncosted', coverage.uncostedIds.length)}
            {chip('zero', '$0 price', zeroRows.size)}
          </div>
          {countRows.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add fixtures in the Counts tab first.</p>
          ) : visibleRows.length === 0 ? (
            <EmptyState compact main={filter === 'uncosted' ? 'Every fixture has lines.' : 'No $0 lines.'} next={{ label: 'All', onPress: () => setFilter('all') }} tail="shows every fixture." />
          ) : (
            renderLinesTable(visibleRows, { suggestionFor })
          )}
        </div>

        {railIs === 'beside' ? (
          <div data-testid="takeoff-rail" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, position: 'sticky', top: 8 }}>
            {railPanels}
          </div>
        ) : null}
      </div>
    </div>
  )
}
