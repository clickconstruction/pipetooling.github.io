import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatCurrency } from '../../lib/format'
import { effectiveCountUnit } from '../../lib/bids/countRowUnit'
import { fixtureKey } from '../../lib/bids/takeoffFixtureKey'
import { nextUncostedFixtureId, type TakeoffCoverageSummary } from '../../lib/bids/takeoffCoverage'
import { focusRailItems, initialFocusId, isTypingTarget, moveFocus, type FocusRailStatus } from '../../lib/bids/takeoffFocus'
import type { BookFillPlan } from '../../lib/bids/takeoffBookFill'
import { pickSameAsChips } from '../../lib/bids/takeoffFixtureHistory'
import type { TakeoffFixtureHistoryLine, TakeoffFixtureHistoryRow } from '../../types/database-functions'
import type { BidCountRow } from '../../types/bids'
import type { MaterialTemplateWithAssemblyType, TakeoffRoughPartLineRow } from '../../lib/bids/bidPricingEngineTypes'
import { TakeoffCoverageStrip } from './TakeoffCoverageStrip'

/**
 * New 1 — "One fixture at a time" (v2.2778, docs/TAKEOFFS_REFRESH_PLAN.md):
 * a guided pass over a Combined takeoff. Left: the fixtures with done / to-do /
 * $0 dots. Right: the focused fixture — what it usually gets (the book entry
 * and the last bids that costed the same fixture), the lines on this bid
 * (the same row editor Old uses, handed in by the tab), Remember for the
 * book, and Done → next uncosted. Enter = Done, ↑/↓ move, when nothing is
 * being typed into.
 */

const DOT: Record<FocusRailStatus, { bg: string; border: string; title: string }> = {
  done: { bg: 'var(--text-green-700)', border: 'var(--text-green-700)', title: 'Costed' },
  todo: { bg: 'transparent', border: 'var(--text-amber-700)', title: 'No lines yet' },
  zero: { bg: 'var(--text-red-700)', border: 'var(--text-red-700)', title: 'Has a $0 line' },
}

function sentLabel(sentOn: string | null): string {
  if (!sentOn) return ''
  const [y, m, d] = sentOn.split('-')
  return y && m && d ? `${Number(m)}/${Number(d)}` : sentOn
}

export function TakeoffFocusView({
  bidId,
  countRows,
  lines,
  coverage,
  bookPlan,
  bookVersionName,
  materialTemplates,
  renderLinesTable,
  onApplyBook,
  onUseLines,
  onRemember,
  fillButton,
  onFillAll,
  onSheetView,
  showToast,
  history,
  focusRequest,
}: {
  bidId: string
  countRows: BidCountRow[]
  lines: TakeoffRoughPartLineRow[]
  coverage: TakeoffCoverageSummary
  bookPlan: BookFillPlan | null
  bookVersionName: string | null
  materialTemplates: MaterialTemplateWithAssemblyType[]
  /** The tab renders the Old row editor for the given rows (drag context, header, rows, add-line footer). */
  renderLinesTable: (rows: BidCountRow[]) => ReactNode
  onApplyBook: (countRowId: string, templateIds: string[]) => Promise<void>
  onUseLines: (countRowId: string, sourceLines: TakeoffFixtureHistoryLine[]) => Promise<void>
  /** Returns true when the fixture was remembered (false = nothing to remember or failed). */
  onRemember: (row: BidCountRow) => Promise<boolean>
  fillButton: { label: string; disabled: boolean; title: string }
  onFillAll: () => void
  onSheetView: () => void
  showToast: (message: string, kind?: 'success' | 'error' | 'info') => void
  /** From `useTakeoffFixtureHistory` — null while loading. */
  history: Map<string, TakeoffFixtureHistoryRow[]> | null
  /** A cross-tab row jump: focus this fixture (nonce so the same row can be requested twice). */
  focusRequest?: { countRowId: string; nonce: number } | null
}) {
  const [focusId, setFocusId] = useState<string | null>(() => initialFocusId(countRows, coverage.uncostedIds))
  const [remember, setRemember] = useState(false)
  const [busy, setBusy] = useState<'book' | 'lines' | 'done' | null>(null)
  const focusIdRef = useRef(focusId)
  focusIdRef.current = focusId

  // Anchor on the first uncosted fixture once the bid's rows AND lines are in
  // (rows can arrive a beat before lines, which would read as "all uncosted");
  // re-anchor when the bid changes or the focused row disappears.
  const anchoredForRef = useRef<string | null>(null)
  useEffect(() => {
    if (anchoredForRef.current !== bidId && countRows.length > 0 && (lines.length > 0 || coverage.costed > 0)) {
      anchoredForRef.current = bidId
      setFocusId(initialFocusId(countRows, coverage.uncostedIds))
      return
    }
    if (focusId && countRows.some((r) => r.id === focusId)) return
    setFocusId(initialFocusId(countRows, coverage.uncostedIds))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId, countRows, lines.length, coverage.costed])


  useEffect(() => {
    if (focusRequest && countRows.some((r) => r.id === focusRequest.countRowId)) setFocusId(focusRequest.countRowId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.nonce])

  const bookMatchedIds = useMemo(() => new Set((bookPlan?.fillable ?? []).map((m) => m.countRowId)), [bookPlan])
  const rail = useMemo(() => focusRailItems(countRows, coverage, bookMatchedIds), [countRows, coverage, bookMatchedIds])
  const order = useMemo(() => countRows.map((r) => r.id), [countRows])
  const focused = countRows.find((r) => r.id === focusId) ?? null
  const focusedLines = useMemo(
    () => (focused ? lines.filter((l) => l.countRowId === focused.id).sort((a, b) => a.sequenceOrder - b.sequenceOrder) : []),
    [lines, focused],
  )
  const focusedCoverage = focused ? coverage.perFixture.get(focused.id) : undefined
  const focusedMatch = focused ? bookPlan?.fillable.find((m) => m.countRowId === focused.id) ?? null : null
  const focusedHistory = focused && history ? pickSameAsChips(history.get(fixtureKey(focused.fixture)) ?? [], 3) : []
  const leftCount = coverage.uncostedIds.length
  const position = focused ? order.indexOf(focused.id) + 1 : 0

  async function done() {
    const row = countRows.find((r) => r.id === focusIdRef.current)
    if (!row || busy) return
    setBusy('done')
    try {
      if (remember && focusedLines.length > 0) {
        await onRemember(row)
        setRemember(false)
      }
      const next = nextUncostedFixtureId(countRows, coverage.uncostedIds, row.id)
      if (next) setFocusId(next)
      else showToast(leftCount === 0 || (leftCount === 1 && coverage.uncostedIds[0] === row.id) ? 'Every fixture has lines.' : 'No other uncosted fixture.', 'info')
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.key === 'Enter') {
        e.preventDefault()
        void done()
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusId((cur) => moveFocus(order, cur, e.key === 'ArrowDown' ? 1 : -1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, remember, focusedLines.length, coverage.uncostedIds, busy])

  const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 0.85rem', display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--surface)' }
  const mini = (on?: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    height: 28,
    padding: '0 0.7rem',
    borderRadius: 6,
    fontSize: '0.8rem',
    fontWeight: 600,
    border: on ? '1px solid #2563eb' : '1px solid var(--border)',
    background: on ? '#2563eb' : 'var(--surface)',
    color: on ? '#fff' : 'var(--text-strong)',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    marginTop: 4,
  })
  const sectionLabel: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }

  return (
    <div data-testid="takeoff-focus-view">
      <TakeoffCoverageStrip
        coverage={coverage}
        compact
        onClickUncosted={() => {
          const next = nextUncostedFixtureId(countRows, coverage.uncostedIds, focusId)
          if (next) setFocusId(next)
        }}
      >
        <button type="button" onClick={onFillAll} disabled={fillButton.disabled} title={fillButton.title || undefined} style={{ padding: '0.4rem 0.8rem', background: fillButton.disabled ? '#9ca3af' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: fillButton.disabled ? 'default' : 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          {fillButton.label}
        </button>
        <button type="button" onClick={onSheetView} style={{ padding: '0.4rem 0.8rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }} title="See every fixture as a sheet (New 2)">
          Sheet view
        </button>
      </TakeoffCoverageStrip>

      {countRows.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add fixtures in the Counts tab first.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 300px) minmax(0, 1fr)', gap: '1rem', alignItems: 'start' }}>
          <div role="listbox" aria-label="Fixtures" style={{ display: 'flex', flexDirection: 'column', gap: 2, border: '1px solid var(--border)', borderRadius: 10, padding: 6, background: 'var(--bg-subtle)', position: 'sticky', top: 8, maxHeight: 'calc(100vh - 8rem)', overflowY: 'auto' }}>
            <div style={{ ...sectionLabel, padding: '4px 10px 6px' }}>
              Fixtures · {leftCount === 0 ? 'all costed' : `${leftCount} left`}
            </div>
            {rail.map((item) => {
              const row = countRows.find((r) => r.id === item.countRowId)!
              const on = item.countRowId === focusId
              const dot = DOT[item.status]
              return (
                <button
                  key={item.countRowId}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => setFocusId(item.countRowId)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, border: 'none', background: on ? 'var(--bg-blue-tint)' : 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', minHeight: 36 }}
                >
                  <span title={dot.title} style={{ width: 10, height: 10, borderRadius: 999, background: dot.bg, border: `2px solid ${dot.border}`, boxSizing: 'border-box', flex: '0 0 auto' }} />
                  <span style={{ flex: 1, fontWeight: on ? 700 : 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ({row.count}) {row.fixture}
                  </span>
                  {item.status !== 'todo' ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>${formatCurrency(item.total)}</span>
                  ) : item.bookMatch ? (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-blue-700)', fontWeight: 700 }}>book</span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {focused ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.1rem', background: 'var(--surface)', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700 }}>{focused.fixture}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    count {focused.count} {effectiveCountUnit(focused)} · {focusedLines.length === 0 ? 'no lines yet' : `${focusedLines.length} line${focusedLines.length === 1 ? '' : 's'} · $${formatCurrency(focusedCoverage?.total ?? 0)}`}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {position} of {countRows.length} · ↑ ↓ move · Enter = Done
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={sectionLabel}>What a {fixtureKey(focused.fixture) || 'fixture like this'} usually gets</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                  <div style={{ ...card, borderColor: focusedMatch ? '#2563eb' : 'var(--border)', background: focusedMatch ? 'var(--bg-blue-tint)' : 'var(--surface)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-blue-700)', fontWeight: 700 }}>Book · {bookVersionName ?? 'none picked'}</span>
                    {focusedMatch ? (
                      <>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {focusedMatch.templateIds.map((t) => materialTemplates.find((m) => m.id === t)?.name ?? 'Assembly').join(' + ')}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>expands into priced part lines</span>
                        <button
                          type="button"
                          disabled={busy != null}
                          onClick={async () => {
                            setBusy('book')
                            try {
                              await onApplyBook(focused.id, focusedMatch.templateIds)
                            } finally {
                              setBusy(null)
                            }
                          }}
                          style={mini(true)}
                        >
                          {busy === 'book' ? 'Applying…' : 'Apply'}
                        </button>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        {focusedLines.length > 0 ? 'Tick Remember below to teach the book this fixture.' : `No entry for "${fixtureKey(focused.fixture)}" yet — cost it once and tick Remember.`}
                      </span>
                    )}
                  </div>
                  {history == null ? (
                    <div style={card}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Looking at previous bids…</span>
                    </div>
                  ) : focusedHistory.length === 0 ? (
                    <div style={card}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Previous bids</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No other bid has costed this fixture.</span>
                    </div>
                  ) : (
                    focusedHistory.map((h) => (
                      <div key={`${h.bid_id}-${h.count_row_id}`} style={card}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          B{h.bid_number ?? '?'} · {h.project_name ?? '—'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                          {h.line_count} line{h.line_count === 1 ? '' : 's'} · ${formatCurrency(Number(h.per_unit_cost))} per {effectiveCountUnit(focused)}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {h.sent_on ? `sent ${sentLabel(h.sent_on)}` : 'not sent'}{h.outcome ? ` · ${h.outcome}` : ''}
                        </span>
                        <button
                          type="button"
                          disabled={busy != null}
                          onClick={async () => {
                            setBusy('lines')
                            try {
                              await onUseLines(focused.id, h.lines)
                            } finally {
                              setBusy(null)
                            }
                          }}
                          style={mini(false)}
                          title="Copy these lines onto this fixture, re-priced at today's lowest catalog price"
                        >
                          {busy === 'lines' ? 'Copying…' : 'Use these lines'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={sectionLabel}>Lines on this bid</div>
                {renderLinesTable([focused])}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: focusedLines.length === 0 ? 'var(--text-muted)' : 'var(--text-strong)' }} title={focusedLines.length === 0 ? 'Add lines first' : 'Save these lines as an assembly and teach the book this fixture name'}>
                  <input type="checkbox" checked={remember} disabled={focusedLines.length === 0 || !bookVersionName} onChange={(e) => setRemember(e.target.checked)} />
                  Remember these lines for "{fixtureKey(focused.fixture)}" in {bookVersionName ? `the ${bookVersionName} book` : 'the book (pick one first)'}
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setFocusId(moveFocus(order, focusId, 1))} style={{ padding: '0.45rem 0.9rem', background: 'var(--surface)', color: 'var(--text-strong)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                    Skip
                  </button>
                  <button type="button" onClick={() => void done()} disabled={busy != null} style={{ padding: '0.45rem 0.9rem', background: busy ? '#9ca3af' : '#3b82f6', color: '#fff', border: 'none', borderRadius: 4, cursor: busy ? 'wait' : 'pointer', fontWeight: 600 }}>
                    {busy === 'done' ? 'Saving…' : leftCount === 0 ? 'Done' : 'Done · next uncosted'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
