/**
 * The Sales window (punch list #192, v2.5932; rebuilt on the shared frame for punch list #318, PR 3,
 * drawn in `to-dos/market-sales-won-rates/mockup.html`): the modal behind the Bridge's Sales step.
 *
 * It opens on where Sales stands: what is out and what that is worth at the won rates (`salesWorth.ts`, the owner's
 * rules of 2026-11-11), then up to three things to do this week, each with one press, then why we lost in three
 * lines. Everything the window used to print whole waits behind a press at the foot: every asker ranked with the
 * flip to open dollars, the pile's three tiles and four bands, every decided bid by loss reason with a door on each
 * unreasoned loss, and how it is counted. Nothing records here: every door opens where the app keeps the answer.
 * Pure on its props: `salesDesk.ts` does the arithmetic of the lists and writes their words, `salesWeek.ts` picks
 * the rows and writes the open view's words.
 */
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../EmptyState'
import { BridgeStepWindow, type StepFoldSpec, type StepGroup } from './BridgeStepWindow'
import { stageUsd } from '../../lib/bridge/stageFlow'
import type { BidWins, MarketWorth } from '../../lib/bridge/bidWins'
import type { EstimateWins } from '../../lib/bridge/estimateWins'
import { BID_BOARD_PATH, ESTIMATES_PATH, SALES_BLIND_DOOR, SALES_OFF_PILE_DOOR, salesFlipNote, salesSortButtonLabel, salesSubLines, sortSalesRows, type SalesDesk, type SalesDeskRow, type SalesRowState, type SalesSortKey } from '../../lib/bridge/sales/salesDesk'
import { SALES_BAR_INKS } from '../../lib/bridge/sales/salesBarInks'
import { salesOutWorth } from '../../lib/bridge/sales/salesWorth'
import { SALES_WEEK_EMPTY, salesHowCounted, salesLostReasons, salesWeekHeadline, salesWeekLine, salesWeekRows, type SalesLostReason } from '../../lib/bridge/sales/salesWeek'

const label: CSSProperties = { fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }
const det: CSSProperties = { fontSize: '0.78rem', color: 'var(--text-muted)' }
const card: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.7rem 0.85rem' }
const door: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text)', fontWeight: 600, fontSize: '0.82rem', background: 'var(--surface)' }
const fold: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, fontVariantNumeric: 'tabular-nums' }

const TONE_COLOR = { red: 'var(--text-red-600)', amber: 'var(--text-amber-800)', green: 'var(--text-green-700)', plain: 'var(--text)' } as const
const STATE_STYLE: Record<SalesRowState['kind'], CSSProperties> = {
  inside: { background: 'var(--bg-green-tint)', color: 'var(--text-green-700)' },
  past: { background: 'var(--bg-amber-100)', color: 'var(--text-amber-800)' },
  aging: { background: 'var(--bg-red-tint)', color: 'var(--text-red-600)' },
  dead: { background: 'var(--bg-subtle)', color: 'var(--text-muted)' },
}
const FUNNEL_COLOR: Record<string, string> = { won: '#15803d', price: '#d97706', no_answer: 'var(--text-muted)', other_sub: '#7c3aed', project_died: '#0f766e', gc_lost: 'var(--text-700)', no_bid: 'var(--text-red-700)', none: 'var(--border)' }
const pct = (share: number): string => (share > 0 && share < 0.01 ? 'under 1%' : `${Math.round(share * 100)}%`)

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
  /** The Market amount at the won rates. The page passes it to Market and Sales alike; Sales reads its own pile below. */
  worth?: MarketWorth | null
  /** The bids by the owner's rules (`bidWins.ts`): the headline, the old bids with no mark and the rate for each size. */
  bidWins?: BidWins | null
  /** The estimates by the owner's rules (`estimateWins.ts`): what is still out and its won rate. */
  estimateWins?: EstimateWins | null
  /** "Mon, Oct 26 · pay week Oct 25–31". */
  readStamp: string
  onClose: () => void
}

function Row({ row, rank, open, onToggle }: { row: SalesDeskRow; rank: number; open: boolean; onToggle: () => void }) {
  const detailId = `bridge-sales-det-${row.key}`
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden', minWidth: 0 }} data-testid="bridge-sales-row">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={onToggle}
        style={{ width: '100%', font: 'inherit', textAlign: 'left', background: 'none', border: 0, padding: '10px 12px', minHeight: 44, cursor: 'pointer', display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) 14px', gap: '4px 10px', alignItems: 'center', color: 'inherit' }}
      >
        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-muted)' }}>{rank}</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center', minWidth: 0 }}>
          <span style={{ fontWeight: 700, flex: '2 1 170px', minWidth: 0, overflowWrap: 'anywhere' }}>
            {row.name}
            <span style={{ display: 'block', fontWeight: 400, ...det }}>{row.meta}</span>
          </span>
          <span style={{ fontWeight: 700, flex: '1 1 64px' }}>
            {stageUsd(row.openUsd)}
            <span style={{ display: 'block', ...label, fontSize: '0.62rem' }}>open</span>
          </span>
          <span style={{ fontWeight: 700, fontSize: '0.86rem', flex: '1.5 1 120px', minWidth: 0 }}>
            {row.winsLabel}
            {row.paceLabel ? <span style={{ display: 'block', fontWeight: 400, ...det, fontSize: '0.72rem' }}>{row.paceLabel}</span> : null}
          </span>
          <span style={{ fontSize: '1rem', fontWeight: 800, flex: '1 1 64px' }}>
            {stageUsd(row.expectedUsd)}
            <span style={{ display: 'block', ...label, fontSize: '0.62rem' }}>worth</span>
          </span>
          <span style={{ flex: '0 0 108px', display: 'flex' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap', ...STATE_STYLE[row.state.kind] }}>{row.state.label}</span>
          </span>
        </span>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)', display: 'inline-block', transition: 'transform .15s', transform: open ? 'rotate(90deg)' : undefined }}>
          ›
        </span>
      </button>
      {open && (
        <div id={detailId} style={{ padding: '2px 12px 12px 44px', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
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

/** Why we lost, in the open view: the top reasons, dollars and count at the right, and the door on the losses with no reason. */
function WhyLost({ reasons }: { reasons: SalesLostReason[] }) {
  if (reasons.length === 0) return null
  return (
    <section data-testid="bridge-sales-why-lost" style={{ minWidth: 0 }}>
      <div style={label}>Why we lost, last 12 months</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', fontVariantNumeric: 'tabular-nums' }}>
        <tbody>
          {reasons.map((r) => (
            // Both cells sit on the reason's own line, so the dollars stay beside it when the door wraps under it on a phone.
            <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }} data-testid="bridge-sales-why-row">
              <td style={{ padding: r.door ? 0 : '0.45rem 0', color: 'var(--text-strong)', verticalAlign: 'baseline' }}>
                <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0 0.8rem' }}>
                  <span style={r.door ? { paddingTop: '0.45rem' } : undefined}>{r.label}</span>
                  {r.door ? (
                    <Link to={r.door.to} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: 'var(--text-link)', fontWeight: 600, textDecoration: 'none' }} data-testid="bridge-sales-name-it">
                      {r.door.label} ›
                    </Link>
                  ) : null}
                </span>
              </td>
              <td style={{ padding: '0.45rem 0 0.45rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-strong)', verticalAlign: 'baseline' }}>
                {stageUsd(r.usd)} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· {r.count}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** Every asker: the whole ranked list, the flip to open dollars, and the two page doors. */
function AskersFold({ desk, sortBy, onFlip, openKey, onToggle }: { desk: SalesDesk; sortBy: SalesSortKey; onFlip: () => void; openKey: string | null; onToggle: (key: string) => void }) {
  const rows = sortSalesRows(desk.rows, sortBy)
  const flipNote = salesFlipNote(desk.rows, sortBy)
  return (
    <div style={fold}>
      <div style={det}>This list ranks each asker by their own record. Press a row for the story, the move and the door.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          aria-pressed={sortBy === 'open'}
          onClick={onFlip}
          style={{ font: 'inherit', fontSize: '0.82rem', fontWeight: 700, border: `1px solid ${sortBy === 'open' ? 'var(--text-blue-700)' : 'var(--border)'}`, background: sortBy === 'open' ? 'var(--bg-blue-tint)' : 'var(--surface)', color: sortBy === 'open' ? 'var(--text-blue-700)' : 'var(--text)', borderRadius: 999, padding: '8px 14px', minHeight: 44, cursor: 'pointer', textAlign: 'left' }}
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
      {rows.length === 0 ? <EmptyState main="No bid or estimate waits on an answer inside the window." compact /> : rows.map((r, i) => <Row key={r.key} row={r} rank={i + 1} open={openKey === r.key} onToggle={() => onToggle(r.key)} />)}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to={BID_BOARD_PATH} style={door}>
          Open the Bid Board ›
        </Link>
        <Link to={ESTIMATES_PATH} style={door}>
          Open Estimates ›
        </Link>
      </div>
    </div>
  )
}

/** What is in the pile: the three tiles and the four bands, read by each asker's own record. */
function PileFold({ desk, subLines }: { desk: SalesDesk; subLines: string[] }) {
  const barTotal = desk.bar.protectedUsd + desk.bar.atRiskUsd + desk.bar.evaporatingUsd
  return (
    <div style={fold}>
      <div style={det}>These figures read each asker by their own record, so they differ from the headline.</div>
      <div style={{ fontSize: '0.92rem', fontWeight: 700 }} data-testid="bridge-sales-verdict">
        {desk.verdict}
      </div>
      <div style={det}>
        {subLines.join(' ')} {desk.ruleLines.join(' ')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {desk.tiles.map((t) => (
          <div key={t.head} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={label}>{t.head}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: TONE_COLOR[t.tone] }}>{t.value}</div>
            <div style={{ fontSize: '0.82rem' }}>{t.words}</div>
          </div>
        ))}
      </div>
      <span style={det}>what each ask is worth, by where it stands against its asker's usual answer</span>
      <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }} aria-hidden="true">
        {desk.legend.map((l) => {
          if (l.key === 'dead') return desk.bar.deadOpenUsd > 0 ? <div key={l.key} title={l.label} style={{ width: '2%', minWidth: 10, borderLeft: '2px dashed var(--text-muted)', background: 'transparent' }} /> : null
          if (!(l.usd > 0) || !(barTotal > 0)) return null
          const share = l.usd / barTotal
          return (
            <div key={l.key} title={l.label} style={{ width: `${share * 98}%`, background: SALES_BAR_INKS[l.key].fill, display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: '0.72rem', color: SALES_BAR_INKS[l.key].words, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>
              {share > 0.12 ? stageUsd(l.usd) : ''}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, fontSize: '0.8rem' }}>
        {desk.legend.map((l) => (
          <div key={l.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: l.key === 'dead' ? 'transparent' : SALES_BAR_INKS[l.key].fill, display: 'inline-block', border: l.key === 'dead' ? '1px dashed var(--text-muted)' : undefined }} />
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
  )
}

/** Every decided bid: won and each loss reason, then every loss with no reason, each with a door onto its bid. */
function DecidedFold({ desk }: { desk: SalesDesk }) {
  const funnelTotal = desk.funnel.won.usd + desk.funnel.lost.usd
  return (
    <div style={fold} data-testid="bridge-sales-funnel">
      <span style={det}>the last 12 months, by the reason the app keeps on each lost bid</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {desk.funnel.lines.map((l) => {
          const share = funnelTotal > 0 ? l.usd / funnelTotal : 0
          return (
            <div key={l.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 1fr) minmax(0, 2fr)', gap: 10, alignItems: 'center', fontSize: '0.82rem' }}>
              <span style={{ fontWeight: l.key === 'won' ? 700 : 500, color: l.key === 'none' ? 'var(--text-red-600)' : undefined }}>{l.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
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
              <span style={{ fontWeight: 600, flex: '1 1 160px', overflowWrap: 'anywhere' }}>{b.label}</span>
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
  )
}

/** How this is counted: the headline's rules, the rate for each size of bid, then the list's own rules once the desk has landed. */
function HowFold({ desk, bidWins, estimateWins, readStamp }: { desk: SalesDesk | null; bidWins: BidWins | null; estimateWins: EstimateWins | null; readStamp: string }) {
  const how = salesHowCounted(bidWins, estimateWins)
  const words: CSSProperties = { fontSize: '0.84rem', color: 'var(--text-700)', lineHeight: 1.45 }
  return (
    <div style={fold} data-testid="bridge-sales-how">
      <div style={words}>{how.join(' ')}</div>
      {bidWins && bidWins.coefficient != null && (
        <div>
          <div style={label}>The won rate for each size of bid</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }} data-testid="bridge-sales-sizes">
            <tbody>
              {bidWins.sizes.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.3rem 0', color: 'var(--text-strong)' }}>{s.label}</td>
                  <td style={{ padding: '0.3rem 0.6rem', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-strong)' }}>{s.usedRate != null ? `${pct(s.usedRate)} won` : ''}</td>
                  <td style={{ padding: '0.3rem 0', color: 'var(--text-muted)' }}>{s.rate != null ? `${s.won.count} won, ${s.lost.count} lost, ${s.noMark.count} with no mark` : 'nothing won or lost yet'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {desk ? <div style={words}>{desk.howItReads}</div> : null}
      <div style={det}>Read {readStamp}</div>
    </div>
  )
}

export function BridgeSalesDesk(props: BridgeSalesDeskProps) {
  const { desk, error, card: cardLines, paces, isLink, readStamp, onClose } = props
  const bidWins = props.bidWins ?? null
  const estimateWins = props.estimateWins ?? null
  const [sortBy, setSortBy] = useState<SalesSortKey>('expected')
  const [openKey, setOpenKey] = useState<string | null>(null)

  const headline = salesWeekHeadline(salesOutWorth(bidWins, estimateWins)) ?? (desk ? desk.headline : `${stageUsd(cardLines.awaitingUsd)} asked`)
  const weekRows = salesWeekRows(desk, bidWins)
  const week: StepGroup = {
    key: 'week',
    title: 'Do this week',
    rows: weekRows.map((r, i) => ({ key: r.key, title: r.title, sub: r.sub, press: { label: r.press.label, to: r.press.to, primary: i === 0, testId: r.kind === 'call' ? 'bridge-sales-call' : 'bridge-sales-mark' } })),
    // While the reads are in flight an empty list is not yet a quiet week, so the group stays hidden.
    empty: desk ? SALES_WEEK_EMPTY : undefined,
  }
  const reasons = desk ? salesLostReasons(desk.funnel) : []
  const decided = desk ? desk.funnel.won.count + desk.funnel.lost.count : 0

  const folds: StepFoldSpec[] = []
  if (desk) {
    folds.push({ key: 'askers', label: `Every asker (${desk.askers.length})`, content: <AskersFold desk={desk} sortBy={sortBy} onFlip={() => setSortBy((s) => (s === 'open' ? 'expected' : 'open'))} openKey={openKey} onToggle={(key) => setOpenKey((k) => (k === key ? null : key))} /> })
    folds.push({ key: 'pile', label: 'What is in the pile', content: <PileFold desk={desk} subLines={salesSubLines(desk, paces).slice(0, 2)} /> })
    if (decided > 0) folds.push({ key: 'decided', label: `Every decided bid (${decided})`, content: <DecidedFold desk={desk} /> })
  }
  folds.push({ key: 'how', label: 'How this is counted', content: <HowFold desk={desk} bidWins={bidWins} estimateWins={estimateWins} readStamp={readStamp} /> })

  const summary = error ? (
    <div role="status" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-red-700)', overflowWrap: 'anywhere' }}>
      Sales could not be read: {error}
    </div>
  ) : !desk ? (
    <div style={det}>Reading Sales…</div>
  ) : undefined

  return (
    <BridgeStepWindow testId="bridge-sales-desk" ariaLabel="Sales, broken down" eyebrow="Sales · bids and estimates that are out" headline={headline} headlineTestId="bridge-sales-headline" tone={isLink ? 'bad' : 'plain'} line={salesWeekLine(paces) ?? undefined} summary={summary} groups={[week]} folds={folds} onClose={onClose}>
      <WhyLost reasons={reasons} />
    </BridgeStepWindow>
  )
}
