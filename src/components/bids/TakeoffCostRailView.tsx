import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { formatCurrency } from '../../lib/format'
import type { TakeoffCoverageSummary } from '../../lib/bids/takeoffCoverage'
import type { BookFillPlan } from '../../lib/bids/takeoffBookFill'
import { buildCopyFromBidPreview, type CopyFromBidCandidate } from '../../lib/bids/takeoffFixtureHistory'
import { fixtureUnitCosts, rfqScopeForZeroPrice, zeroPriceQueue } from '../../lib/bids/takeoffCostRail'
import type { TakeoffFixtureHistoryRow } from '../../types/database-functions'
import type { BidCountRow } from '../../types/bids'
import type { MaterialTemplateWithAssemblyType, TakeoffRoughPartLineRow } from '../../lib/bids/bidPricingEngineTypes'
import { TakeoffCoverageStrip } from './TakeoffCoverageStrip'

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
const mini = (primary: boolean, disabled = false): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  height: 28,
  padding: '0 0.75rem',
  borderRadius: 6,
  fontSize: '0.8rem',
  fontWeight: 600,
  border: primary ? '1px solid #2563eb' : '1px solid var(--border)',
  background: disabled ? '#9ca3af' : primary ? '#2563eb' : 'var(--surface)',
  color: primary || disabled ? '#fff' : 'var(--text-strong)',
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
  focusRequest,
}: {
  countRows: BidCountRow[]
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
  /** A cross-tab row jump: show every row so the flash can find it. */
  focusRequest?: { countRowId: string; nonce: number } | null
}) {
  const [filter, setFilter] = useState<'all' | 'uncosted' | 'zero'>('all')
  const [busyRow, setBusyRow] = useState<string | null>(null)
  const [pickedBid, setPickedBid] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [showUnitCosts, setShowUnitCosts] = useState(false)
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

  return (
    <div data-testid="takeoff-cost-rail-view">
      <TakeoffCoverageStrip coverage={coverage} onClickUncosted={() => setFilter('uncosted')} onClickZeroPrice={() => setFilter('zero')}>
        <button type="button" onClick={onFillAll} disabled={fillButton.disabled} title={fillButton.title || undefined} style={{ padding: '0.4rem 0.8rem', background: fillButton.disabled ? '#9ca3af' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: fillButton.disabled ? 'default' : 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          {fillButton.label}
        </button>
        <button type="button" onClick={onFocusView} style={{ padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }} title="Walk the fixtures one at a time (New 1)">
          One at a time
        </button>
      </TakeoffCoverageStrip>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '1rem', alignItems: 'start' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{filter === 'uncosted' ? 'Every fixture has lines.' : 'No $0 lines.'}</p>
          ) : (
            renderLinesTable(visibleRows, { suggestionFor })
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 8 }}>
          <div style={{ ...panel, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
            <span style={panelK}>What Pricing sees</span>
            <div style={kv}>
              <span>Materials on this bid</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(coverage.materialsTotal)}</span>
            </div>
            <div style={kv}>
              <span style={{ color: 'var(--text-muted)' }}>Costed fixtures</span>
              <span style={{ fontWeight: 700, color: coverage.uncostedIds.length === 0 ? 'var(--text-green-700)' : 'var(--text-amber-700)' }}>
                {coverage.costed} of {coverage.fixtures}
              </span>
            </div>
            {coverage.uncostedIds.length > 0 ? (
              <div style={{ padding: '0.4rem 0.6rem', borderRadius: 6, background: 'var(--bg-red-tint)', color: 'var(--text-red-700)', fontSize: '0.78rem', fontWeight: 600 }}>
                {coverage.uncostedIds.length} fixture{coverage.uncostedIds.length === 1 ? '' : 's'} carr{coverage.uncostedIds.length === 1 ? 'ies' : 'y'} no material cost — Pricing shows {coverage.uncostedIds.length === 1 ? 'it' : 'them'} as "No Takeoffs cost"
              </div>
            ) : null}
            <button type="button" onClick={() => setShowUnitCosts((v) => !v)} style={{ ...kv, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-blue-700)', font: 'inherit', fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Per-fixture unit costs</span>
              <span>{showUnitCosts ? 'hide' : 'show'}</span>
            </button>
            {showUnitCosts ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.8rem' }}>
                {unitCosts.map((u) => (
                  <div key={u.countRowId} style={kv}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.fixture}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: u.incomplete ? 'var(--text-red-700)' : undefined, whiteSpace: 'nowrap' }}>
                      ${formatCurrency(u.unitCost)}{u.incomplete ? ' · incomplete' : ''}
                    </span>
                  </div>
                ))}
                {unitCosts.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>No costed fixtures yet.</span> : null}
              </div>
            ) : null}
          </div>

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
                <button type="button" onClick={() => onRequestQuotes(rfqScopeForZeroPrice(queue))} style={mini(true)}>
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
        </div>
      </div>
    </div>
  )
}
