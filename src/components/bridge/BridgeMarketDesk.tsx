/**
 * The Market desk (punch list #192, v2.5931): the modal behind the Bridge's
 * Market card. The intake over the relationship book: a strip of asks by
 * value over the last 26 pay weeks against what feeding the field takes, the
 * three tiles, one row per GC by what the relationship pays, the pricing
 * spend, the $0 bids, what the desk cannot see, and the footnote on how it
 * reads. Pure on its props: the page reads, `src/lib/bridge/market` does the
 * arithmetic and the words. It opens doors and records nothing.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { stageUsd } from '../../lib/bridge/stageFlow'
import { MARKET_DESK_WEEKS, type MarketDesk, type MarketHeader, type MarketRow, type MarketRowState } from '../../lib/bridge/market/marketDesk'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }
const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 36, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem' }

const GC_BAR = 'var(--text-blue-500)'
const CUSTOMER_BAR = '#e0a526'
const TONE_COLOR = { red: 'var(--text-red-600)', green: 'var(--text-green-700)', plain: 'var(--text-muted)' } as const
const STATE_STYLE: Record<MarketRowState, CSSProperties> = {
  feeding: { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' },
  fading: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  'new name': { background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)' },
  'dead weight': { background: 'var(--bg-red-100)', color: 'var(--text-red-600)' },
}

/** The strip's day labels: the first week, every fifth, the last. */
const WEEK_LABEL_EVERY = 5
const CHART_HEIGHT = 180

export type BridgeMarketDeskProps = {
  /** The headline and its sub-line from what the page already knows; draws before the desk's reads land. */
  header: MarketHeader
  /** The desk once its reads are in; null while reading. */
  desk: MarketDesk | null
  error: string | null
  /** Market is the lit link this week: the headline reads red. */
  isLink: boolean
  /** "Mon, Oct 26 · pay week Oct 25–31". */
  readStamp: string
  onClose: () => void
}

function MarketRowCard({ row, open, onToggle }: { row: MarketRow; open: boolean; onToggle: () => void }) {
  const detailId = `bridge-market-det-${row.key}`
  const maxQuarter = Math.max(1, ...row.quarters.map((q) => q.askedUsd))
  return (
    <div data-testid="bridge-market-row" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* The head is the one button; the chip, the bars and the figures are spans inside it, never a button in a button. */}
      <button type="button" aria-expanded={open} aria-controls={detailId} onClick={onToggle} style={{ width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: open ? 'var(--bg-subtle)' : 'none', border: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'var(--text)', flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 180px', minWidth: 0 }}>
          <b style={{ fontSize: '0.95rem' }}>{row.name}</b>
          <span style={{ ...det, display: 'block', fontSize: '0.75rem' }}>{row.desc}</span>
        </span>
        <span style={{ ...STATE_STYLE[row.state], fontSize: '0.7rem', fontWeight: 700, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', flex: 'none' }}>{row.state}</span>
        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 26, width: 64, flex: 'none' }}>
          {row.quarters.map((q) => (
            <i key={q.label} style={{ flex: 1, height: Math.max(2, Math.round((q.askedUsd / maxQuarter) * 26)), background: q.current ? 'var(--text-blue-700)' : 'var(--bg-blue-200)', borderRadius: '1px 1px 0 0' }} />
          ))}
        </span>
        <span style={{ ...det, fontSize: '0.82rem', whiteSpace: 'nowrap', width: 130, flex: 'none' }}>{row.askedWords}</span>
        <span style={{ fontWeight: 800, whiteSpace: 'nowrap', width: 76, textAlign: 'right', flex: 'none' }}>{row.paysWords}</span>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', flex: 'none', display: 'inline-block', transform: open ? 'rotate(90deg)' : undefined, transition: 'transform 0.12s' }}>
          ›
        </span>
      </button>
      {open && (
        <div id={detailId} style={{ padding: '6px 14px 12px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${row.quarters.length}, minmax(70px, 1fr))`, gap: '2px 14px', fontSize: '0.8rem', maxWidth: 560 }}>
            <span style={label} />
            {row.quarters.map((q) => (
              <span key={q.label} style={{ ...label, fontSize: '0.62rem', letterSpacing: '0.08em' }}>
                {q.label}
              </span>
            ))}
            <span style={det}>Asks</span>
            {row.quarters.map((q) => (
              <b key={q.label}>{q.asks > 0 ? stageUsd(q.askedUsd) : '—'}</b>
            ))}
            <span style={det}>Won</span>
            {row.quarters.map((q) => (
              <b key={q.label}>{q.wonWords}</b>
            ))}
          </div>
          <p style={{ fontSize: '0.82rem', margin: 0 }} data-testid="bridge-market-row-det">
            {row.detLine}
          </p>
          <div>
            <Link to={row.door.href} style={door}>
              {row.door.label} ›
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export function BridgeMarketDesk(props: BridgeMarketDeskProps) {
  const { header, desk, error, isLink, readStamp, onClose } = props
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [pressedWeek, setPressedWeek] = useState<number | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const scale = desk ? Math.max(1, ...desk.weeks.map((w) => w.totalUsd), desk.feedUsd ?? 0, desk.askedPerWeekUsd) * 1.08 : 1
  const px = (usd: number): number => (usd > 0 ? Math.max(2, Math.round((usd / scale) * (CHART_HEIGHT - 8))) : 0)
  const pressed = desk && pressedWeek != null ? desk.weeks[pressedWeek] ?? null : null

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)', zIndex: 750, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'calc(24px + var(--app-top-chrome, 0px)) 16px 24px', overflow: 'auto' }} data-testid="bridge-market-desk">
      <div role="dialog" aria-modal="true" aria-label="Market, broken down" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', width: 'min(1040px, 100%)', padding: '1.1rem 1.3rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', fontVariantNumeric: 'tabular-nums' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={label}>
              Market · demand <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}>· read {readStamp}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: isLink ? 'var(--text-red-600)' : 'var(--text)', lineHeight: 1.15 }} data-testid="bridge-market-headline">
              {desk ? desk.headline : header.headline}
            </div>
            {desk && (
              <div style={{ fontSize: '0.95rem', fontWeight: 700 }} data-testid="bridge-market-verdict">
                {desk.verdict}
              </div>
            )}
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{desk ? desk.subLine : header.subLine}</div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
            ×
          </button>
        </div>

        {!desk && !error && <div style={det}>Reading the Market desk…</div>}
        {error && <div style={{ ...det, color: 'var(--text-amber-800)' }}>The Market desk could not be read ({error}).</div>}

        {desk && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {desk.tiles.map((t) => (
                <div key={t.head} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="bridge-market-tile">
                  <div style={label}>{t.head}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                    {t.value}
                    {t.delta && <span style={{ fontSize: '0.9rem', marginLeft: 8, color: TONE_COLOR[t.deltaTone] }}>{t.delta}</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem' }}>{t.words}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>The asks, {MARKET_DESK_WEEKS} weeks deep</div>
                <span style={det}>every bid opened and estimate requested, by value · blue is GCs, amber is customers · press a week for its value · the dashed line is what feeding the field takes</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ position: 'relative', height: CHART_HEIGHT, display: 'flex', alignItems: 'flex-end', gap: 3, borderBottom: '1px solid var(--border)', paddingBottom: 2, minWidth: 640 }} data-testid="bridge-market-strip">
                  {desk.feedUsd != null && (
                    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: `${(desk.feedUsd / scale) * 100}%`, borderTop: '2px dashed var(--text-red-600)', pointerEvents: 'none' }}>
                      <span style={{ position: 'absolute', right: 0, top: -17, fontSize: '0.72rem', color: 'var(--text-red-600)', fontWeight: 600, background: 'var(--surface)', padding: '0 4px' }}>{stageUsd(desk.feedUsd)} a week to feed the field</span>
                    </div>
                  )}
                  <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: `${(desk.askedPerWeekUsd / scale) * 100}%`, borderTop: '2px solid var(--text-muted)', opacity: 0.5, pointerEvents: 'none' }}>
                    <span style={{ position: 'absolute', left: 0, top: -16, fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface)', padding: '0 4px' }}>8-week average {stageUsd(desk.askedPerWeekUsd)}</span>
                  </div>
                  {desk.weeks.map((w, i) => (
                    <button
                      key={w.start}
                      type="button"
                      aria-label={w.ariaLabel}
                      aria-pressed={pressedWeek === i}
                      onClick={() => setPressedWeek((p) => (p === i ? null : i))}
                      style={{ flex: 1, minWidth: 16, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1, background: pressedWeek === i ? 'var(--bg-subtle)' : 'none', border: 0, outline: pressedWeek === i ? '1px solid var(--text-blue-700)' : undefined, padding: '6px 1px 0', cursor: 'pointer', position: 'relative', borderRadius: 3, color: 'var(--text-red-600)', fontSize: '0.65rem', fontWeight: 700, alignItems: 'stretch' }}
                    >
                      {w.totalUsd > 0 ? (
                        <>
                          <span style={{ height: px(w.gcUsd), background: GC_BAR, borderRadius: '2px 2px 0 0', width: '100%' }} />
                          <span style={{ height: px(w.customerUsd), background: CUSTOMER_BAR, width: '100%' }} />
                        </>
                      ) : (
                        <span aria-hidden="true" style={{ textAlign: 'center' }}>
                          0
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, minWidth: 640 }} aria-hidden="true">
                  {desk.weeks.map((w, i) => (
                    <div key={w.start} style={{ flex: 1, textAlign: i === desk.weeks.length - 1 ? 'right' : 'left' }}>
                      {i === 0 || i === desk.weeks.length - 1 || i % WEEK_LABEL_EVERY === 0 ? w.label : ''}
                    </div>
                  ))}
                </div>
              </div>
              <div role="status" style={{ ...det, minHeight: 18 }} data-testid="bridge-market-week-line">
                {pressed ? pressed.ariaLabel : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: GC_BAR }} />
                  {desk.legend.gc}
                </span>
                <span>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: CUSTOMER_BAR }} />
                  {desk.legend.customers}
                </span>
                {desk.emptyWeeksNote && <span>{desk.emptyWeeksNote}</span>}
                {desk.feedMissing && <span>{desk.feedMissing}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: '1rem', fontWeight: 700 }}>The book: who feeds us, by what each relationship pays</div>
                <span style={det}>every source of asks in the last {MARKET_DESK_WEEKS} weeks · asks by quarter as bars, this quarter dark · press a row for its quarters and its door</span>
              </div>
              {desk.rows.map((r) => (
                <MarketRowCard key={r.key} row={r} open={openKey === r.key} onToggle={() => setOpenKey((k) => (k === r.key ? null : r.key))} />
              ))}
              {desk.rows.length === 0 && <div style={det}>Nothing was asked in the span.</div>}
              {desk.restLine && (
                <p style={{ ...det, fontSize: '0.8rem', margin: '2px 0 0' }} data-testid="bridge-market-rest">
                  {desk.restLine}
                </p>
              )}
            </div>

            {(desk.pricingSpend.length > 0 || desk.zeroBids) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                {desk.pricingSpend.map((words) => (
                  <div key={words} style={{ ...card, fontSize: '0.85rem' }} data-testid="bridge-market-pricing-spend">
                    <b style={{ display: 'block' }}>The pricing spend</b>
                    {words}
                  </div>
                ))}
                {desk.zeroBids && (
                  <div style={{ ...card, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }} data-testid="bridge-market-zero-bids">
                    <div>
                      <b style={{ display: 'block' }}>Fix the reading</b>
                      {desk.zeroBids.words}
                    </div>
                    <Link to="/bids" style={door}>
                      Open the bids ›
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div style={{ border: '1px solid var(--text-amber-800)', background: 'var(--bg-amber-100)', borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text)' }} data-testid="bridge-market-cannot-see">
              <b style={{ display: 'block', marginBottom: 2 }}>What this desk cannot see</b>
              {desk.cannotSee}
            </div>

            <div style={{ ...det, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div>{desk.howItReads}</div>
              <div style={{ marginTop: 6 }}>{desk.recordedLine}</div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10, flexWrap: 'wrap' }}>
          <Link to="/bids?tab=bid-board" style={door}>
            Open the Bid Board ›
          </Link>
          <Link to="/estimates" style={door}>
            Open Estimates ›
          </Link>
          <button type="button" onClick={onClose} style={{ height: 36, padding: '0 14px', borderRadius: 8, border: 0, background: 'var(--text-base)', color: 'var(--surface)', fontWeight: 700, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
