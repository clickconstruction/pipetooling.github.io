/**
 * The Market desk (punch list #192, v2.5931): the modal behind the Bridge's
 * Market card. The intake over the relationship book: a strip of asks by
 * value over the last 26 pay weeks against what feeding the field takes, the
 * three tiles, one row per GC by what the relationship pays, the pricing
 * spend, the $0 bids, what the desk cannot see, and the footnote on how it
 * reads. Pure on its props: the page reads, `src/lib/bridge/market` does the
 * arithmetic and the words. It opens doors and records nothing.
 *
 * Punch list #318, PR 3 (`to-dos/market-sales-won-rates/mockup.html`): the window opens on the shared frame
 * (`BridgeStepWindow`). It leads with what Market is worth at the won rates, the two parts, the won rate for each
 * bid size and up to three things to do this week. The sources, the asks by week, what it cannot see and how it is
 * counted each wait behind a press at the foot. `marketStepWindow.ts` picks the rows and writes the words.
 */
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import { stageUsd } from '../../lib/bridge/stageFlow'
import type { BidWins, MarketWorth } from '../../lib/bridge/bidWins'
import type { EstimateWins } from '../../lib/bridge/estimateWins'
import { MARKET_CANNOT_SEE, MARKET_DESK_WEEKS, MARKET_RECORDED_LINE, type MarketDesk, type MarketHeader, type MarketRow, type MarketRowState } from '../../lib/bridge/market/marketDesk'
import { MARKET_STEP_WORDS, buildMarketStep, marketErrorWords, type MarketStepModel } from '../../lib/bridge/market/marketStepWindow'
import { BridgeStepWindow, type StepFoldSpec, type StepGroup } from './BridgeStepWindow'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }
const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', textDecoration: 'none', fontWeight: 600, fontSize: '0.82rem' }

const GC_BAR = 'var(--text-blue-500)'
const CUSTOMER_BAR = '#e0a526'
/** The won part of a size's bar. */
const WON_BAR = '#16a34a'
const TONE_COLOR = { red: 'var(--text-red-600)', green: 'var(--text-green-700)', plain: 'var(--text-muted)' } as const
const STATE_STYLE: Record<MarketRowState, CSSProperties> = {
  feeding: { background: 'var(--bg-green-100)', color: 'var(--text-green-700)' },
  fading: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  'new name': { background: 'var(--bg-blue-200)', color: 'var(--text-blue-800)' },
  'no answers': { background: 'var(--bg-red-100)', color: 'var(--text-red-600)' },
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
  /** What Market is worth a week at the won rates (`bidWins.ts`); null until both kinds read. The headline leads with it. */
  worth?: MarketWorth | null
  /** The bids part and the won rate for each bid size. */
  bidWins?: BidWins | null
  /** The estimates part. */
  estimateWins?: EstimateWins | null
  /** Dollars a week the field builds. Left out, the window uses the header's own figure. */
  fieldPerWeekUsd?: number | null
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


const sub: CSSProperties = { fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }
const footDoor: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'var(--text-link)', textDecoration: 'none', fontSize: '0.84rem' }

/** Between the headline and the rows: the error, the two parts, and the won rate for each bid size. */
function MarketSummary({ step, error, reading }: { step: MarketStepModel; error: string | null; reading: boolean }) {
  return (
    <>
      {error && (
        <div role="alert" style={{ fontSize: '0.86rem', color: 'var(--text-red-700)', lineHeight: 1.35, overflowWrap: 'anywhere' }} data-testid="bridge-market-error">
          {marketErrorWords(error)}
        </div>
      )}
      {reading && <div style={sub}>{MARKET_STEP_WORDS.reading}</div>}
      {step.figures.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
          {step.figures.map((f) => (
            <div key={f.key} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: 0 }} data-testid="bridge-market-figure">
              <b style={{ display: 'block', fontSize: '1.15rem', color: 'var(--text-strong)' }}>{f.value}</b>
              {f.words}
            </div>
          ))}
        </div>
      )}
      {step.bars.length > 0 && (
        <section style={{ minWidth: 0 }} data-testid="bridge-market-sizes">
          <div style={label}>{MARKET_STEP_WORDS.sizesHead}</div>
          {/* One grid for the four, so the labels and the percents line up. Each track is the whole 0 to 100%. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr) max-content', gap: '6px 10px', alignItems: 'center', marginTop: 6, fontSize: '0.8rem', color: 'var(--text-700)', fontVariantNumeric: 'tabular-nums' }}>
            {step.bars.map((b) => (
              <div key={b.id} style={{ display: 'contents' }} data-testid="bridge-market-size-bar">
                <span>{b.label}</span>
                <span aria-hidden="true" style={{ display: 'block', height: 10, borderRadius: 2, background: 'var(--bg-muted)', overflow: 'hidden' }}>
                  <span style={{ display: 'block', height: '100%', width: `${(b.share ?? 0) * 100}%`, background: WON_BAR }} data-testid="bridge-market-size-fill" />
                </span>
                <span style={{ textAlign: 'right', fontWeight: 700, color: 'var(--text-strong)' }}>{b.pct}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/** *Every source*: the week's move in one line, one row per source, the smaller ones in a line, and the pricing spend. */
function MarketSources({ desk }: { desk: MarketDesk }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-strong)' }} data-testid="bridge-market-verdict">
        {desk.verdict}
      </div>
      <div style={sub}>{MARKET_STEP_WORDS.sourcesNote}</div>
      {desk.rows.map((r) => (
        <MarketRowCard key={r.key} row={r} open={openKey === r.key} onToggle={() => setOpenKey((k) => (k === r.key ? null : r.key))} />
      ))}
      {desk.rows.length === 0 && <EmptyState main="Nothing was asked in the span." compact />}
      {desk.restLine && (
        <p style={{ ...det, fontSize: '0.8rem', margin: '2px 0 0' }} data-testid="bridge-market-rest">
          {desk.restLine}
        </p>
      )}
      {desk.pricingSpend.map((words) => (
        <div key={words} style={{ ...card, fontSize: '0.85rem' }} data-testid="bridge-market-pricing-spend">
          <b style={{ display: 'block' }}>The pricing spend</b>
          {words}
        </div>
      ))}
    </div>
  )
}

/** *The asks by week*: the three tiles and the strip. With the won rates read, the line that judged the asks at one win share is gone. */
function MarketAsks({ desk, byWonRates }: { desk: MarketDesk; byWonRates: boolean }) {
  const [pressedWeek, setPressedWeek] = useState<number | null>(null)
  const feedUsd = byWonRates ? null : desk.feedUsd
  const scale = Math.max(1, ...desk.weeks.map((w) => w.totalUsd), feedUsd ?? 0, desk.askedPerWeekUsd) * 1.08
  const px = (usd: number): number => (usd > 0 ? Math.max(2, Math.round((usd / scale) * (CHART_HEIGHT - 8))) : 0)
  const pressed = pressedWeek != null ? desk.weeks[pressedWeek] ?? null : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
      {!byWonRates && (
        <div style={sub} data-testid="bridge-market-subline">
          {desk.subLine}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {desk.tiles.map((t) => (
          <div key={t.head} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }} data-testid="bridge-market-tile">
            <div style={label}>{t.head}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
              {t.value}
              {t.delta && <span style={{ fontSize: '0.9rem', marginLeft: 8, color: TONE_COLOR[t.deltaTone] }}>{t.delta}</span>}
            </div>
            <div style={{ fontSize: '0.82rem', overflowWrap: 'anywhere' }}>{t.words}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700 }}>The asks, {MARKET_DESK_WEEKS} weeks deep</div>
        <div style={sub}>
          {MARKET_STEP_WORDS.asksNote}
          {feedUsd != null ? ` ${MARKET_STEP_WORDS.feedLineNote}` : ''}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ position: 'relative', height: CHART_HEIGHT, display: 'flex', alignItems: 'flex-end', gap: 3, borderBottom: '1px solid var(--border)', paddingBottom: 2, minWidth: 640 }} data-testid="bridge-market-strip">
            {feedUsd != null && (
              <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: `${(feedUsd / scale) * 100}%`, borderTop: '2px dashed var(--text-red-600)', pointerEvents: 'none', zIndex: 1 }}>
                <span style={{ position: 'absolute', right: 0, top: -17, fontSize: '0.72rem', color: 'var(--text-red-600)', fontWeight: 600, background: 'var(--surface)', padding: '0 4px' }}>{stageUsd(feedUsd)} a week to feed the field</span>
              </div>
            )}
            <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: `${(desk.askedPerWeekUsd / scale) * 100}%`, borderTop: '2px solid var(--text-muted)', opacity: 0.5, pointerEvents: 'none', zIndex: 1 }}>
              {/* On the right, over the latest weeks, unless the feed line's label holds that side. */}
              <span style={{ position: 'absolute', ...(feedUsd != null ? { left: 0 } : { right: 0 }), top: -16, fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface)', padding: '0 4px' }}>8-week average {stageUsd(desk.askedPerWeekUsd)}</span>
            </div>
            {desk.weeks.map((w, i) => (
              <button
                key={w.start}
                type="button"
                aria-label={w.ariaLabel}
                aria-pressed={pressedWeek === i}
                onClick={() => setPressedWeek((p) => (p === i ? null : i))}
                style={{ flex: 1, minWidth: 16, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1, background: pressedWeek === i ? 'var(--bg-subtle)' : 'none', border: 0, outline: pressedWeek === i ? '1px solid var(--text-blue-700)' : undefined, padding: '6px 1px 0', cursor: 'pointer', position: 'relative', borderRadius: 3, color: 'var(--text-red-600)', fontSize: '0.65rem', fontWeight: 700, alignItems: 'stretch' }}
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
              <div key={w.start} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', justifyContent: i === desk.weeks.length - 1 ? 'flex-end' : 'flex-start', whiteSpace: 'nowrap' }}>
                {i === 0 || i === desk.weeks.length - 1 || i % WEEK_LABEL_EVERY === 0 ? w.label : ''}
              </div>
            ))}
          </div>
        </div>
        <div role="status" style={{ ...det, minHeight: 18 }} data-testid="bridge-market-week-line">
          {pressed ? pressed.ariaLabel : ''}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: GC_BAR }} />
            {desk.legend.gc}
          </span>
          <span>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 5, verticalAlign: -1, background: CUSTOMER_BAR }} />
            {desk.legend.customers}
          </span>
          {desk.emptyWeeksNote && <span>{desk.emptyWeeksNote}</span>}
          {!byWonRates && desk.feedMissing && <span>{desk.feedMissing}</span>}
        </div>
      </div>
    </div>
  )
}

export function BridgeMarketDesk(props: BridgeMarketDeskProps) {
  const { header, desk, error, isLink, readStamp, onClose, worth, bidWins, estimateWins, fieldPerWeekUsd } = props
  const step = buildMarketStep({ header, desk, worth, bidWins, estimateWins, fieldPerWeekUsd })

  const groups: StepGroup[] = [
    {
      key: 'do',
      title: MARKET_STEP_WORDS.doHead,
      rows: step.rows.map((r) => ({ key: r.key, title: r.title, sub: r.sub, press: { ...r.press, testId: `bridge-market-do-${r.key}` } })),
      // Nothing to do is only known once the sources are read.
      empty: desk ? MARKET_STEP_WORDS.nothingToDo : undefined,
    },
  ]

  const folds: StepFoldSpec[] = []
  if (desk) {
    folds.push({ key: 'sources', label: `Every source (${step.sourceCount ?? desk.rows.length})`, content: <MarketSources desk={desk} /> })
    folds.push({ key: 'asks', label: 'The asks by week', content: <MarketAsks desk={desk} byWonRates={step.byWonRates} /> })
  }
  folds.push({
    key: 'cannot-see',
    label: 'What this window cannot see',
    content: (
      <div style={{ border: '1px solid var(--text-amber-800)', background: 'var(--bg-amber-100)', borderRadius: 10, padding: '10px 14px', fontSize: '0.85rem', color: 'var(--text)' }} data-testid="bridge-market-cannot-see">
        {desk ? desk.cannotSee : MARKET_CANNOT_SEE}
      </div>
    ),
  })
  folds.push({
    key: 'counted',
    label: 'How this is counted',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} data-testid="bridge-market-counted">
        {step.counted.map((c) => (
          <div key={c.key} style={sub}>
            <b style={{ display: 'block', color: 'var(--text-700)' }}>{c.head}</b>
            {c.words}
          </div>
        ))}
        <div style={sub}>{desk ? desk.recordedLine : MARKET_RECORDED_LINE}</div>
      </div>
    ),
  })

  // A row that already opens the Bid Board is its door: the foot does not offer it twice.
  const bidBoardInRows = step.rows.some((r) => r.press.to === '/bids?tab=bid-board')
  const footer = (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0 1.1rem', borderTop: '1px solid var(--border)', paddingTop: 4 }}>
      <span style={{ ...sub, fontSize: '0.76rem' }}>Read {readStamp}</span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: '0 1.1rem' }}>
        {!bidBoardInRows && (
          <Link to="/bids?tab=bid-board" style={footDoor}>
            Open the Bid Board ›
          </Link>
        )}
        <Link to="/estimates" style={footDoor}>
          Open Estimates ›
        </Link>
      </span>
    </div>
  )

  return (
    <BridgeStepWindow
      testId="bridge-market-desk"
      ariaLabel="Market, broken down"
      eyebrow={MARKET_STEP_WORDS.eyebrow}
      headline={step.headline}
      headlineTestId="bridge-market-headline"
      tone={isLink ? 'bad' : 'plain'}
      line={step.line}
      summary={<MarketSummary step={step} error={error} reading={!desk && !error} />}
      groups={groups}
      folds={folds}
      footer={footer}
      onClose={onClose}
    />
  )
}
