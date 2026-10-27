/**
 * The Sales desk (punch list #192, v2.5932): the modal behind the Bridge's
 * Sales card. The pile in expected dollars, the three tiles, the bar and its
 * legend, who to call ranked by what a call protects with a flip to open
 * dollars, the decided asks as a funnel by loss category with a door on each
 * unreasoned loss, and the footnote on how it reads. Nothing records here:
 * every door opens where the app keeps the answer. Pure on its props:
 * `src/lib/bridge/sales/salesDesk.ts` does the arithmetic and the words.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import { stageUsd } from '../../lib/bridge/stageFlow'
import { BID_BOARD_PATH, ESTIMATES_PATH, SALES_BLIND_DOOR, SALES_OFF_PILE_DOOR, salesFlipNote, salesSortButtonLabel, salesSubLines, sortSalesRows, type SalesDesk, type SalesDeskRow, type SalesLegendEntry, type SalesRowState, type SalesSortKey } from '../../lib/bridge/sales/salesDesk'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }
const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem', background: 'var(--surface)' }

const TONE_COLOR = { red: 'var(--text-red-600)', amber: 'var(--text-amber-800)', green: 'var(--text-green-700)', plain: 'var(--text)' } as const
const BAR_COLOR: Record<SalesLegendEntry['key'], string> = { protected: '#15803d', risk: '#d97706', evaporating: '#c0392b', dead: 'var(--border)' }
const STATE_STYLE: Record<SalesRowState['kind'], CSSProperties> = {
  inside: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  past: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  aging: { background: 'var(--bg-red-tint)', color: 'var(--text-red-600)' },
  dead: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
}
const FUNNEL_COLOR: Record<string, string> = { won: '#15803d', price: '#d97706', no_answer: 'var(--text-muted)', other_sub: '#7c3aed', project_died: '#0f766e', gc_lost: 'var(--text-700)', no_bid: 'var(--text-red-700)', none: 'var(--border)' }

export type BridgeSalesDeskProps = {
  /** The desk from the kernel; null while the reads are in flight. */
  desk: SalesDesk | null
  /** The error the reads threw, shown as one line; null otherwise. */
  error: string | null
  /** The card's lines the page already knows, drawn before the reads land. */
  card: { awaitingUsd: number; bids: number; bidsUsd: number; estimates: number; estimatesUsd: number }
  paces: { soldPerWeekUsd: number | null; fieldPerWeekUsd: number | null }
  /** Sales is the lit link: the headline reads red. */
  isLink: boolean
  /** "Mon, Oct 26 · pay week Oct 25–31". */
  readStamp: string
  onClose: () => void
}

function Row({ row, rank, open, onToggle }: { row: SalesDeskRow; rank: number; open: boolean; onToggle: () => void }) {
  const detailId = `bridge-sales-det-${row.key}`
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }} data-testid="bridge-sales-row">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
        style={{ width: '100%', font: 'inherit', textAlign: 'left', background: 'none', border: 0, padding: '10px 12px', minHeight: 44, cursor: 'pointer', display: 'grid', gridTemplateColumns: '28px minmax(160px, 2.2fr) 1fr 1.5fr 1fr 1.1fr 18px', gap: '4px 12px', alignItems: 'center', color: 'inherit' }}
      >
        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-muted)' }}>{rank}</span>
        <span style={{ fontWeight: 700 }}>
          {row.name}
          <span style={{ display: 'block', fontWeight: 400, ...det }}>{row.meta}</span>
        </span>
        <span style={{ fontWeight: 700 }}>
          {stageUsd(row.openUsd)}
          <span style={{ display: 'block', ...label, fontSize: '0.62rem' }}>open</span>
        </span>
        <span style={{ fontWeight: 700, fontSize: '0.86rem' }}>
          {row.winsLabel}
          {row.paceLabel ? <span style={{ display: 'block', fontWeight: 400, ...det, fontSize: '0.72rem' }}>{row.paceLabel}</span> : null}
        </span>
        <span style={{ fontSize: '1rem', fontWeight: 800 }}>
          {stageUsd(row.expectedUsd)}
          <span style={{ display: 'block', ...label, fontSize: '0.62rem' }}>expected</span>
        </span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', justifySelf: 'start', ...STATE_STYLE[row.state.kind] }}>{row.state.label}</span>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', display: 'inline-block', transition: 'transform .15s', transform: open ? 'rotate(90deg)' : undefined }}>
          ›
        </span>
      </button>
      {open && (
        <div id={detailId} style={{ padding: '2px 12px 12px 52px', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>{row.story.join(' ')}</div>
          {row.say && <div style={{ ...det, fontStyle: 'italic' }}>{row.say}</div>}
          <div style={{ fontWeight: 700 }} data-testid="bridge-sales-move">
            {row.move}
          </div>
          <div>
            <Link to={row.door.to} style={door}>
              {row.door.label}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export function BridgeSalesDesk(props: BridgeSalesDeskProps) {
  const { desk, error, card: cardLines, paces, isLink, readStamp, onClose } = props
  const [sortBy, setSortBy] = useState<SalesSortKey>('expected')
  const [openKey, setOpenKey] = useState<string | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const rows = desk ? sortSalesRows(desk.rows, sortBy) : []
  const flipNote = desk ? salesFlipNote(desk.rows, sortBy) : null
  const subLines = desk ? salesSubLines(desk, paces) : salesSubLines({ pile: { bids: cardLines.bids, bidsUsd: cardLines.bidsUsd, estimates: cardLines.estimates, estimatesUsd: cardLines.estimatesUsd, askedUsd: cardLines.awaitingUsd, expectedUsd: 0 } }, paces)
  const barTotal = desk ? desk.bar.protectedUsd + desk.bar.atRiskUsd + desk.bar.evaporatingUsd : 0
  const funnelTotal = desk ? desk.funnel.won.usd + desk.funnel.lost.usd : 0

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 750, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(24px + var(--app-top-chrome, 0px)) 16px 24px', overflow: 'auto' }} data-testid="bridge-sales-desk">
      <div role="dialog" aria-modal="true" aria-label="Sales, broken down" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: 'min(1040px, 100%)', padding: '1.1rem 1.3rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={label}>
              Sales · the work asked for <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>· read {readStamp}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: isLink ? 'var(--text-red-600)' : 'var(--text)', lineHeight: 1.15 }} data-testid="bridge-sales-headline">
              {desk ? desk.headline : `${stageUsd(cardLines.awaitingUsd)} asked`}
            </div>
            {desk && (
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }} data-testid="bridge-sales-verdict">
                {desk.verdict}
              </div>
            )}
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {subLines.join(' ')}
              {desk ? ` ${desk.ruleLines.join(' ')}` : ''}
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            ×
          </button>
        </div>

        {error && (
          <div role="status" style={{ ...det, color: 'var(--text-amber-800)' }}>
            The Sales desk could not be read ({error}).
          </div>
        )}

        {!desk && !error && <div style={det}>Reading the sales desk…</div>}

        {desk && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {desk.tiles.map((t) => (
                <div key={t.head} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={label}>{t.head}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, color: TONE_COLOR[t.tone] }}>{t.value}</div>
                  <div style={{ fontSize: '0.82rem' }}>{t.words}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>What is in the pile</div>
                <span style={det}>in expected dollars, by where each ask stands against its asker's own pace</span>
              </div>
              <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }} aria-hidden="true">
                {desk.legend.map((l) => {
                  if (l.key === 'dead') return desk.bar.deadOpenUsd > 0 ? <div key={l.key} title={l.label} style={{ width: '2%', minWidth: 10, borderLeft: '2px dashed var(--text-muted)', background: 'transparent' }} /> : null
                  if (!(l.usd > 0) || !(barTotal > 0)) return null
                  const share = l.usd / barTotal
                  return (
                    <div key={l.key} title={l.label} style={{ width: `${share * 98}%`, background: BAR_COLOR[l.key], display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: '0.72rem', color: 'var(--surface)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      {share > 0.12 ? stageUsd(l.usd) : ''}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: '0.8rem' }}>
                {desk.legend.map((l) => (
                  <div key={l.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: l.key === 'dead' ? 'transparent' : BAR_COLOR[l.key], display: 'inline-block', border: l.key === 'dead' ? '1px dashed var(--text-muted)' : undefined }} />
                      <b>
                        {l.label} · {l.key === 'dead' ? `${stageUsd(l.usd)} open` : stageUsd(l.usd)}
                      </b>
                    </div>
                    <div style={det}>{l.words}</div>
                  </div>
                ))}
              </div>
              {desk.offPile.words && (
                <div style={{ ...det, border: '1px dashed var(--border)', borderRadius: 8, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span>{desk.offPile.words}</span>
                  <Link to={SALES_OFF_PILE_DOOR.to} style={door}>
                    {SALES_OFF_PILE_DOOR.label}
                  </Link>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>Who to call, by what a call protects</div>
                <span style={det}>press a row for the story, the move and the door</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  aria-pressed={sortBy === 'open'}
                  onClick={() => setSortBy((s) => (s === 'open' ? 'expected' : 'open'))}
                  style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: 700, border: `1px solid ${sortBy === 'open' ? 'var(--text-blue-700)' : 'var(--border)'}`, background: sortBy === 'open' ? 'var(--bg-blue-tint)' : 'var(--surface)', color: sortBy === 'open' ? 'var(--text-blue-700)' : 'var(--text)', borderRadius: 999, padding: '8px 14px', minHeight: 40, cursor: 'pointer' }}
                  data-testid="bridge-sales-flip"
                >
                  {salesSortButtonLabel(sortBy)}
                </button>
                {flipNote && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-amber-800)', fontWeight: 600 }} data-testid="bridge-sales-flip-note">
                    {flipNote}
                  </span>
                )}
              </div>
              {rows.length === 0 ? (
                <EmptyState main="No bid or estimate waits on an answer inside the window." compact />
              ) : (
                rows.map((r, i) => <Row key={r.key} row={r} rank={i + 1} open={openKey === r.key} onToggle={() => setOpenKey((k) => (k === r.key ? null : r.key))} />)
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }} data-testid="bridge-sales-funnel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>And the asks already decided?</div>
                <span style={det}>the last 12 months, by the reason the app keeps on each lost bid</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {desk.funnel.lines.map((l) => {
                  const share = funnelTotal > 0 ? l.usd / funnelTotal : 0
                  return (
                    <div key={l.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) 3fr', gap: 10, alignItems: 'center', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: l.key === 'won' ? 700 : 500, color: l.key === 'none' ? 'var(--text-red-600)' : undefined }}>{l.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div aria-hidden="true" style={{ width: `${Math.max(1, share * 100)}%`, maxWidth: '100%', height: 14, borderRadius: 4, background: l.key === 'none' ? 'transparent' : (FUNNEL_COLOR[l.key] ?? 'var(--text-muted)'), border: l.key === 'none' ? '1px dashed var(--text-red-600)' : undefined }} />
                        <span style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                          {stageUsd(l.usd)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {l.count}</span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={det}>{desk.funnel.words.join(' ')}</div>
              {desk.funnel.blind && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} data-testid="bridge-sales-blind">
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-red-600)' }}>{desk.funnel.blind}</div>
                  {desk.funnel.noReasonBids.map((b) => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: '0.82rem', paddingLeft: 12 }} data-testid="bridge-sales-no-reason">
                      <span style={{ fontWeight: 600, flex: '1 1 160px' }}>{b.label}</span>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{stageUsd(b.usd)}</span>
                      <Link to={b.door.to} style={door}>
                        {b.door.label}
                      </Link>
                    </div>
                  ))}
                  <div>
                    <Link to={SALES_BLIND_DOOR.to} style={door}>
                      {SALES_BLIND_DOOR.label}
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div style={{ ...det, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <b style={{ color: 'var(--text)' }}>How this reads.</b> {desk.howItReads}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
          <span style={det}>The week's call is recorded on the link desk above, not here.</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to={BID_BOARD_PATH} style={door}>
              Open the Bid Board ›
            </Link>
            <Link to={ESTIMATES_PATH} style={door}>
              Open Estimates ›
            </Link>
            <button type="button" onClick={onClose} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 0, background: 'var(--text-base)', color: 'var(--surface)', fontWeight: 700, cursor: 'pointer' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
