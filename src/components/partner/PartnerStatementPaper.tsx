import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { getBidServiceTypeTag } from '../../utils/unifiedJobBidSearch'
import type { LedgerDisplayRow } from '../../lib/partnerLedger/partnerLedgerJournal'
import { balanceWords, crossingText, postingLabel, shortDate, signedBalanceLabel, weekOfLabel, weekRangeLabel } from '../../lib/partnerLedger/partnerLedgerFormat'
import { balanceHeadline, longDate, partnerSinceLabel } from '../../lib/partnerLedger/partnerStatementModel'
import type { PartnerJobCosting, PartnerJobsPayload } from '../../lib/partnerLedger/partnerJobsPayload'
import type { PartnerSummary, WeekCard } from '../../lib/partnerLedger/partnerWeeks'
import { COPPER, FAINT, HAIR, INK, MUTED, NOTE_BAND, PAPER, PAPER_GREEN, PORTAL_FONT } from '../../lib/portal/portalTheme'

/**
 * The partner statement as paper (v2.2157) — the customer portal's sibling.
 * Same letterhead, same palette, same ruled-ledger grammar: balance with its
 * words, the selected week laid out like the printed statement (Week opened →
 * lines → double-rule total), the last statement underneath while it awaits
 * the partner's jobs, and the full ledger. Purely presentational
 * and inline-styled on purpose: `printMode` renders the identical markup into
 * a print window, so print IS the page (D4). Every color is painted
 * explicitly — this surface pins light like every customer/print surface.
 */

export type PartnerStatementPaperProps = {
  summary: PartnerSummary
  /** Newest-first; index 0 is the live week. */
  cards: WeekCard[]
  idx: number
  onIdx?: (i: number) => void
  fullRows: LedgerDisplayRow[] | null
  jobs: PartnerJobsPayload | null
  openJob?: string | null
  costing?: PartnerJobCosting | null
  costingErr?: string | null
  onToggleCosting?: (jobId: string) => void
  onPrint?: () => void
  /** Office lens ("View as …"): read-only — statement actions hidden, ack status lives on the Statements tab. */
  lens?: boolean
  /** Static rendering for the print window: no buttons, no nav, no costing sheets. */
  printMode?: boolean
  isMobile: boolean
  todayLabel: string
  nowYear: number
}

const money = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const signed = (n: number) => `${n < 0 ? '−' : '+'}${money(n)}`

const eyebrow = (copper = true): CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: copper ? COPPER : MUTED,
})
const sectionHead: CSSProperties = { ...eyebrow(), display: 'block', paddingBottom: 6, borderBottom: `1.5px solid ${INK}`, marginTop: 26 }
const hairRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', padding: '10px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 13.5 }
const amt: CSSProperties = { fontVariantNumeric: 'tabular-nums', fontWeight: 600, whiteSpace: 'nowrap' }
const inkButton: CSSProperties = { font: 'inherit', background: INK, color: PAPER, border: `1px solid ${INK}`, padding: '8px 14px', fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', cursor: 'pointer' }
const outlineButton: CSSProperties = { ...inkButton, background: 'transparent', color: INK }
const navButton = (disabled: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: 12,
  fontWeight: 700,
  color: disabled ? FAINT : INK,
  border: `1px solid ${disabled ? HAIR : INK}`,
  background: 'transparent',
  padding: '5px 10px',
  cursor: disabled ? 'default' : 'pointer',
})

export function PartnerStatementPaper(p: PartnerStatementPaperProps) {
  const { summary, cards, idx, fullRows, jobs, isMobile, printMode, lens } = p
  const card = cards[idx] ?? null
  const live = cards[0]?.open ? cards[0] : null
  const headline = live ? live.closing : summary.balance
  // The deal's start date when the partnership record has one; else the oldest week on file.
  const since = summary.started_on ? `partner since ${longDate(summary.started_on)}` : partnerSinceLabel(cards)
  const rates = [summary.rates.field > 0 ? `field $${summary.rates.field}` : null, summary.rates.estimating > 0 ? `estimating $${summary.rates.estimating}` : null].filter(Boolean).join(' · ')
  const sub = [since, rates ? `${rates} / h` : null].filter(Boolean).join(' · ')

  return (
    <div data-theme="light" style={{ background: PAPER, color: INK, fontFamily: PORTAL_FONT, padding: isMobile ? '22px 18px 28px' : '28px 34px 34px', maxWidth: 760, margin: '0 auto', boxSizing: 'border-box' }}>
      {/* Letterhead */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, padding: '0 0 12px' }}>
        <div>
          <div style={{ fontSize: isMobile ? 24 : 27, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
            CLICK<span style={{ color: COPPER }}>.</span>
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.22em', textTransform: 'uppercase', color: MUTED, marginTop: 4 }}>
            Plumbing, Electrical, and HVAC
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: MUTED, lineHeight: 1.6, whiteSpace: 'nowrap' }}>
          Partner account{summary.company_name ? ` · ${summary.company_name}` : ''}
          <br />
          {p.todayLabel}
        </div>
      </div>
      <div style={{ height: 3, background: INK }} />

      {/* Head: who · balance with its words */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', padding: '16px 0 6px' }}>
        <div>
          <div style={eyebrow()}>Partner statement</div>
          <div style={{ fontSize: isMobile ? 18 : 19, fontWeight: 700, marginTop: 2 }}>{summary.display_name}</div>
          {sub ? <div style={{ fontSize: 12, color: MUTED }}>{sub}</div> : null}
        </div>
        <div style={{ textAlign: 'right', ...(isMobile ? { flexBasis: '100%' } : {}) }}>
          <div style={eyebrow(false)}>Balance</div>
          <div style={{ fontSize: isMobile ? 32 : 34, fontWeight: 900, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {signedBalanceLabel(headline)}
          </div>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: COPPER, marginTop: 4 }}>
            {balanceHeadline(headline)}
          </div>
          <div style={{ width: 64, height: 3, background: COPPER, margin: '6px 0 0 auto' }} />
        </div>
      </div>

      {/* Week band */}
      {card ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: printMode ? '1fr' : 'auto 1fr auto', alignItems: 'center', gap: 10, margin: '16px 0 0', padding: '9px 0', borderTop: `1.5px solid ${INK}`, borderBottom: `1px solid ${HAIR}` }}>
            {!printMode ? (
              <button type="button" disabled={idx >= cards.length - 1} onClick={() => p.onIdx?.(Math.min(cards.length - 1, idx + 1))} style={navButton(idx >= cards.length - 1)}>
                ‹ Older
              </button>
            ) : null}
            <div style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              {weekOfLabel(card.weekStart, p.nowYear)}
              <span style={{ display: 'block', letterSpacing: '0.04em', textTransform: 'none', fontWeight: 500, color: MUTED, fontSize: 11, marginTop: 1 }}>
                {card.open ? 'in progress · updates as hours approve' : weekRangeLabel(card.weekStart, card.weekEnd)}
              </span>
            </div>
            {!printMode ? (
              <button type="button" disabled={idx <= 0} onClick={() => p.onIdx?.(Math.max(0, idx - 1))} style={navButton(idx <= 0)}>
                Newer ›
              </button>
            ) : null}
          </div>
          <WeekLines card={card} />
          <WeekTotal card={card} />
          {!printMode && !lens ? <WeekActions card={card} p={p} /> : null}
        </>
      ) : null}


      {/* Your jobs */}
      {jobs ? (
        <div>
          <span style={sectionHead}>Your jobs</span>
          {jobs.rows.length === 0 ? (
            <div style={{ fontSize: 13, color: MUTED, padding: '10px 0' }}>Jobs appear here once the office confirms you did the majority of the work.</div>
          ) : (
            jobs.rows.map((j) => {
              const tag = getBidServiceTypeTag(j.service_type_name ?? '')
              const open = p.openJob === j.job_id
              return (
                <Fragment key={j.job_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 13.5 }}>
                    <span style={{ minWidth: 0 }}>
                      {tag ? <span style={{ fontWeight: 800, letterSpacing: '0.04em', color: tag.color }}>{tag.tag.toUpperCase()}</span> : null}
                      {tag ? ' ' : null}
                      <b style={{ fontWeight: 700 }}>{j.label}</b>
                      {j.job_name && j.job_name !== j.label ? (
                        <>
                          <span style={{ color: FAINT, padding: '0 3px' }}>•</span>
                          {j.job_name}
                        </>
                      ) : null}
                      <span style={{ display: 'block', fontSize: 11, color: FAINT, marginTop: 2 }}>
                        {[j.status, j.confirmed_at ? `yours since ${new Date(j.confirmed_at).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}
                        {j.profit_share != null ? (
                          <>
                            {' · '}
                            <span style={{ color: PAPER_GREEN, fontWeight: 600 }}>profit share +{money(j.profit_share)} posted</span>
                          </>
                        ) : null}
                      </span>
                    </span>
                    {!printMode && jobs.costingOn ? (
                      <button type="button" onClick={() => p.onToggleCosting?.(j.job_id)} style={{ ...outlineButton, fontSize: 11.5, padding: '5px 10px', whiteSpace: 'nowrap' }}>
                        {open ? 'Close' : 'Costing ›'}
                      </button>
                    ) : null}
                  </div>
                  {open ? <CostingSheet costing={p.costing ?? null} err={p.costingErr ?? null} /> : null}
                </Fragment>
              )
            })
          )}
        </div>
      ) : null}

      {/* Full ledger */}
      <div>
        <span style={sectionHead}>Full ledger</span>
        {fullRows == null ? (
          <div style={{ fontSize: 12.5, color: MUTED, padding: '8px 0' }}>Loading…</div>
        ) : fullRows.length === 0 ? (
          <div style={{ fontSize: 12.5, color: MUTED, padding: '8px 0' }}>Nothing posted yet.</div>
        ) : isMobile ? (
          <FullLedgerStacked rows={fullRows} nowYear={p.nowYear} />
        ) : (
          <FullLedgerTable rows={fullRows} nowYear={p.nowYear} />
        )}
      </div>

      <div style={{ paddingTop: 18, fontSize: 10, color: FAINT }}>Private to you · only approved hours post · every closing opens the next week</div>
    </div>
  )
}

function WeekLines({ card }: { card: WeekCard }) {
  return (
    <div>
      <div style={{ ...hairRow, color: MUTED }}>
        <span>
          Week opened
          <span style={{ display: 'block', fontSize: 11, color: FAINT }}>{card.opening != null ? 'where last week closed' : ''}</span>
        </span>
        <span style={{ ...amt, fontWeight: 500, color: MUTED }}>{card.opening != null ? signedBalanceLabel(card.opening) : '—'}</span>
      </div>
      {card.lines.length === 0 ? (
        <div style={{ fontSize: 13, color: MUTED, padding: '10px 0', borderBottom: `1px solid ${HAIR}` }}>Nothing posted this week yet.</div>
      ) : (
        card.lines.map((l, i) => (
          <Fragment key={i}>
            <div style={hairRow}>
              <span style={{ minWidth: 0 }}>
                {l.label}
                {l.sub ? <span style={{ display: 'block', fontSize: 11, color: FAINT }}>{l.sub}</span> : null}
                {l.amount == null ? <span style={{ display: 'block', fontSize: 11, color: FAINT }}>pending office approval — posts when approved</span> : null}
              </span>
              <span style={{ ...amt, ...(l.amount == null ? { color: FAINT, fontWeight: 500, fontStyle: 'italic' } : {}) }}>
                {l.amount == null ? '—' : l.amount === 0 ? '0.00' : signed(l.amount)}
              </span>
            </div>
            {card.crossings
              .filter((x) => x.afterLineIndex === i)
              .map((x, k) => (
                <div key={`x${k}`} style={{ textAlign: 'center', fontSize: 11, fontStyle: 'italic', color: MUTED, padding: '6px 0', borderBottom: `1px solid ${HAIR}` }}>
                  {crossingText(x)}
                </div>
              ))}
          </Fragment>
        ))
      )}
    </div>
  )
}

function WeekTotal({ card }: { card: WeekCard }) {
  const words = balanceWords(card.closing) || 'even'
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, padding: '12px 0 4px' }}>
      <span style={{ fontSize: 14, fontWeight: 700 }}>
        {card.open ? 'So far this week' : 'Week closed'}
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 400, color: MUTED, marginTop: 2, maxWidth: '28ch' }}>
          {card.open ? `${words} · what settling up today would mean` : words}
        </span>
      </span>
      <span style={{ fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums', borderTop: `1px solid ${INK}`, borderBottom: `3px double ${INK}`, padding: '3px 0', whiteSpace: 'nowrap' }}>
        {signedBalanceLabel(card.closing)}
      </span>
    </div>
  )
}

function WeekActions({ card, p }: { card: WeekCard; p: PartnerStatementPaperProps }) {
  if (!card.open && !card.stubId) {
    return <div style={{ fontSize: 11.5, color: MUTED, marginTop: 10 }}>Charges only — no statement was issued this week.</div>
  }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
      <button type="button" onClick={() => p.onPrint?.()} style={outlineButton}>
        Print / save PDF
      </button>
    </div>
  )
}

function CostingSheet({ costing, err }: { costing: PartnerJobCosting | null; err: string | null }) {
  const head = (t: string) => <div style={{ ...eyebrow(false), fontSize: 9.5, letterSpacing: '0.14em', margin: '10px 0 2px' }}>{t}</div>
  const line = (l: ReactNode, r: string, key: string | number) => (
    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 12.5 }}>
      <span style={{ minWidth: 0, color: INK }}>{l}</span>
      <span style={amt}>{r}</span>
    </div>
  )
  return (
    <div style={{ margin: '6px 0 10px', padding: '6px 12px 10px', borderLeft: `2px solid ${COPPER}`, background: NOTE_BAND }}>
      {err ? (
        <div style={{ fontSize: 12.5, color: MUTED }}>{err}</div>
      ) : !costing ? (
        <div style={{ fontSize: 12.5, color: MUTED }}>Loading…</div>
      ) : (
        <>
          {costing.revenue != null ? <div style={{ fontSize: 12, color: MUTED }}>job total {money(costing.revenue)}</div> : null}
          {costing.hours.length > 0 ? (
            <>
              {head('Reported hours')}
              {costing.hours.map((h, i) => line(h.name, `${h.hours.toFixed(1)} h`, i))}
            </>
          ) : null}
          {costing.supply_invoices.length > 0 ? (
            <>
              {head('Supply house invoices')}
              {costing.supply_invoices.map((iv, i) =>
                line(`${iv.vendor ?? 'Invoice'}${iv.invoice_number ? ` #${iv.invoice_number}` : ''}${iv.invoice_date ? ` · ${iv.invoice_date}` : ''} · ${iv.pct}% allocated`, money(iv.allocated), i),
              )}
            </>
          ) : null}
          {costing.card_charges.length > 0 ? (
            <>
              {head('Card charges')}
              {costing.card_charges.map((c, i) => line(`${c.counterparty ?? 'Charge'}${c.posted_at ? ` · ${c.posted_at.slice(0, 10)}` : ''}`, money(c.allocated), i))}
            </>
          ) : null}
          {costing.direct.length > 0 ? (
            <>
              {head('Direct expenses')}
              {costing.direct.map((m, i) => line(m.description || '—', money(m.amount), i))}
            </>
          ) : null}
          <div style={{ fontSize: 10.5, color: FAINT, marginTop: 8 }}>
            Figures as of {costing.as_of ? new Date(costing.as_of).toLocaleString() : 'now'} — best efforts. No one’s wages appear here; labor dollars show only in the job’s totals.
          </div>
        </>
      )}
    </div>
  )
}

function FullLedgerStacked({ rows, nowYear }: { rows: LedgerDisplayRow[]; nowYear: number }) {
  return (
    <div>
      {[...rows].reverse().map((r, i) =>
        r.kind === 'note' ? (
          <div key={i} style={{ padding: '8px 6px', margin: '0 -6px', borderBottom: `1px solid ${HAIR}`, fontSize: 12.5, fontStyle: 'italic', color: MUTED, background: NOTE_BAND }}>
            <span style={{ fontStyle: 'normal' }}>{shortDate(r.date, nowYear)} · </span>
            {r.label}
          </div>
        ) : r.amount == null || r.balance == null ? null : (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 12.5 }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>{shortDate(r.date, nowYear)}</span>
              {postingLabel(r)}
              {r.detail ? <span style={{ color: MUTED }}> · {r.detail}</span> : null}
            </span>
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ display: 'block', fontWeight: 600 }}>{signed(r.amount)}</span>
              <span style={{ display: 'block', fontSize: 11, color: MUTED }}>bal {signedBalanceLabel(r.balance)}</span>
            </span>
          </div>
        ),
      )}
    </div>
  )
}

function FullLedgerTable({ rows, nowYear }: { rows: LedgerDisplayRow[]; nowYear: number }) {
  // Fixed money columns (not `auto`): every row is its own grid, so auto columns
  // sized per row and the header's AMOUNT/BALANCE drifted off the numbers (v2.2212).
  const grid: CSSProperties = { display: 'grid', gridTemplateColumns: '72px 1fr 96px 104px', gap: '0 14px', alignItems: 'baseline', padding: '8px 0', borderBottom: `1px solid ${HAIR}`, fontSize: 12.5 }
  const right: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  return (
    <div>
      <div style={{ ...grid, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: FAINT, borderBottom: `1.5px solid ${INK}`, padding: '0 0 6px' }}>
        <span>Date</span>
        <span>Posting</span>
        <span style={right}>Amount</span>
        <span style={right}>Balance</span>
      </div>
      {[...rows].reverse().map((r, i) =>
        r.kind === 'note' ? (
          <div key={i} style={{ ...grid, fontStyle: 'italic', color: MUTED, background: NOTE_BAND, margin: '0 -6px', padding: '8px 6px' }}>
            <span style={{ fontStyle: 'normal', whiteSpace: 'nowrap' }}>{shortDate(r.date, nowYear)}</span>
            <span style={{ gridColumn: '2 / 5' }}>{r.label}</span>
          </div>
        ) : r.amount == null || r.balance == null ? null : (
          <div key={i} style={grid}>
            <span style={{ color: MUTED, whiteSpace: 'nowrap' }}>{shortDate(r.date, nowYear)}</span>
            <span style={{ minWidth: 0 }}>
              {postingLabel(r)}
              {r.detail ? <span style={{ color: FAINT }}> · {r.detail}</span> : null}
            </span>
            <span style={{ ...right, fontWeight: 600 }}>{signed(r.amount)}</span>
            <span style={right}>{signedBalanceLabel(r.balance)}</span>
          </div>
        ),
      )}
    </div>
  )
}
