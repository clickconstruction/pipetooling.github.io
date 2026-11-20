import { useMemo, useState, type CSSProperties } from 'react'
import { EmptyState } from '../EmptyState'
import { emptyWords, emptyWordsWithPress } from '../../lib/emptyWords'
import { PermitChip } from '../bids/PermitChip'
import { FindNamesSheet } from '../bids/FindNamesSheet'
import { BuilderSheet } from './PermitBuilders'
import { useBuilderAnswers } from '../../hooks/useBuilderAnswers'
import { usePermitMarket } from '../../hooks/usePermitMarket'
import { usePermitRecordsStart } from '../../hooks/usePermitRecordsStart'
import { recordsReach } from '../../lib/research/permitReach'
import { cityNamesPlumbers, type BuilderRow } from '../../lib/research/permitBuilders'
import { withAnsweredBids } from '../../lib/research/builderAnswers'
import type { BuilderAnswersGround } from '../../lib/research/builderAnswersIo'
import type { ResearchPermitRow } from '../../lib/research/permitResearch'
import {
  BID_COMPANY_SHOWING,
  BID_COMPANY_SHOWING_WORDS,
  bidCompanies,
  bidCompaniesShowing,
  bidCompanyChipCounts,
  builtTile,
  clockAt,
  clockDaysWords,
  clockNote,
  clockScaleDays,
  clockTile,
  clockTitle,
  marketClocks,
  readsWords,
  type BidCompany,
  type BidCompanyPermits,
  type BidCompanyShowing,
  type MarketClock,
} from '../../lib/research/permitMarket'

/**
 * Permits, Market (punch list #405, step one): the opinion beside Builders. Builders is where a
 * name is looked up. Market says what the permits mean for us: whether the companies we price
 * for build in the cities we read, and how long there is to call once a city shows a job.
 *
 * Two parts in this step. **Do the companies we bid build here?** lists every company we priced
 * a job for in two years beside the permits its names pulled, with what that reads as. A name on
 * the row opens the builder's sheet, the one Builders opens. A company with no permit on record
 * offers **Tie a name**, since it may file under a person or another name. **The clock** draws
 * the quarter marks of the days between two dates on the city's permits. The call list, who
 * holds the work and how much is being built are step two.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }
const chip = (on: boolean): CSSProperties => ({ padding: '5px 11px', borderRadius: 999, fontSize: '0.78rem', border: `1px solid ${on ? '#2563eb' : 'var(--border)'}`, background: on ? 'var(--bg-blue-tint)' : 'var(--surface)', color: on ? 'var(--text-blue-800)' : 'var(--text-base)', fontWeight: on ? 600 : 400, minHeight: 32, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' })
const th: CSSProperties = { textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, padding: '8px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '9px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }
const num: CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const smallPress: CSSProperties = { background: 'var(--surface)', color: 'var(--text-base)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: '0.8125rem', minHeight: 34, cursor: 'pointer', fontFamily: 'inherit' }
const linkPress: CSSProperties = { background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-link)', cursor: 'pointer', textAlign: 'left' }
// A press inside a line of small words: the underline alone marks it, in the words' own colour.
const wordPress: CSSProperties = { background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 2 }
const tile: CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 12px', minWidth: 0 }
const section: CSSProperties = { borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }
const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 600 }

type Opened = { city: string; row: BuilderRow }

export function PermitMarket({
  city,
  authUserId,
  todayYmd,
  isMobile,
  rows,
  rowsLoading,
  onChanged,
}: {
  city: string
  authUserId: string
  todayYmd: string
  isMobile: boolean
  /** Every permit the tab holds for the city, with the plumbing permit that counts for each. The clock reads them. */
  rows: readonly ResearchPermitRow[]
  rowsLoading: boolean
  /** A mark or a kind changed on a builder's sheet: the deck's rows carry them, so they read again. */
  onChanged: () => void
}) {
  const market = usePermitMarket(city, todayYmd)
  const answers = useBuilderAnswers()
  const ground = answers.ground
  const [showing, setShowing] = useState<BidCompanyShowing>('builds')
  const [opened, setOpened] = useState<Opened | null>(null)
  const [tying, setTying] = useState<BidCompany | null>(null)

  const companies = useMemo(() => (market.ground ? bidCompanies({ bids: market.ground.bids, builders: market.ground.builders, book: ground?.book ?? null, todayYmd }) : []), [market.ground, ground, todayYmd])
  const counts = useMemo(() => bidCompanyChipCounts(companies), [companies])
  const list = useMemo(() => bidCompaniesShowing(companies, showing), [companies, showing])
  const cityBuilders = useMemo(() => market.ground?.builders.find((c) => c.city === city)?.rows ?? [], [market.ground, city])
  const namesPlumbers = useMemo(() => cityNamesPlumbers(cityBuilders), [cityBuilders])
  const clocks = useMemo(() => marketClocks({ city, applications: market.applications ?? [], rows, namesPlumbers, todayYmd }), [city, market.applications, rows, namesPlumbers, todayYmd])
  const scale = clockScaleDays(clocks)

  /** A name on a company's row: the builder's sheet, with the bids a tie adds, as Builders opens it. */
  const openSource = (s: BidCompanyPermits) => {
    const row = market.ground?.builders.find((c) => c.city === s.city)?.rows.find((r) => r.key === s.builderKey)
    if (!row) return
    setOpened({ city: s.city, row: ground ? (withAnsweredBids([row], ground.book, ground.bids)[0] ?? row) : row })
  }

  if (market.loading && !market.ground) return <div style={muted}>Reading the market…</div>
  if (market.error && !market.ground) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', color: 'var(--text-red-700)', fontSize: '0.875rem' }}>
        <span>{market.error}</span>
        <button type="button" onClick={market.reload} style={smallPress}>
          Retry
        </button>
      </div>
    )
  }

  const tiles = [builtTile(companies), clockTile(clocks)].filter((t): t is { value: string; words: string } => t != null)
  const whereLine = (c: BidCompany) =>
    c.sources.length === 0 ? null : (
      <span style={muted}>
        {c.sources.map((s, i) => (
          <span key={`${s.city}:${s.builderKey}`}>
            {i > 0 ? ' · ' : ''}
            <button type="button" onClick={() => openSource(s)} title={`${s.name}, on ${s.city}’s permits. Opens the builder.`} style={wordPress}>
              {s.city} {s.permits}
              {s.tied ? `, as ${s.name}` : ''}
            </button>
          </span>
        ))}
      </span>
    )
  const readsCell = (c: BidCompany) => {
    const r = readsWords(c)
    return (
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <PermitChip chip={{ words: r.tag, tone: r.tone }} />
        <span style={muted}>{r.hint}</span>
        {c.reads === 'no_permit' && c.customerIds.length > 0 && (
          <button type="button" onClick={() => setTying(c)} aria-label={`Tie a name to ${c.name}`} style={linkPress}>
            Tie a name
          </button>
        )}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div data-market-tiles style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, minmax(0, 1fr))`, gap: 8 }}>
        {tiles.map((t) => (
          <div key={t.words} style={tile}>
            <strong style={{ display: 'block', fontSize: '1.375rem', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>{t.value}</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.words}</span>
          </div>
        ))}
      </div>

      <section aria-labelledby="market-bid-table" style={section}>
        <div>
          <h3 id="market-bid-table" style={heading}>
            Do the companies we bid build here?
          </h3>
          <div style={muted}>Every company we priced a job for in two years, beside the commercial permits its names pulled in twelve months in the cities we read. This is where estimating hours go.</div>
        </div>
        <div role="group" aria-label="Which companies" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {BID_COMPANY_SHOWING.map((s) => (
            <button key={s} type="button" aria-pressed={showing === s} onClick={() => setShowing(s)} style={chip(showing === s)}>
              {BID_COMPANY_SHOWING_WORDS[s]} {counts[s]}
            </button>
          ))}
        </div>

        {answers.error && (
          <div style={{ ...muted, color: 'var(--text-red-700)' }}>
            <div>{answers.error}</div>
            <div style={muted}>Until the answers on names read, a company’s permits count its exact name only.</div>
          </div>
        )}

        {companies.length === 0 ? (
          <EmptyState {...emptyWordsWithPress(emptyWords({ kind: 'data', noun: 'bids in the last two years', page: { label: 'Bids', tail: 'is where a bid is made.' } }), { to: '/bids' })} compact />
        ) : list.length === 0 ? (
          showing === 'builds' ? (
            <EmptyState main="No company we bid has a permit on record under its own name." next={{ label: BID_COMPANY_SHOWING_WORDS.no_permit, onPress: () => setShowing('no_permit') }} tail="lists them, each with Tie a name." compact />
          ) : showing === 'tie' ? (
            <EmptyState main="No name on the permits looks like a company we bid." next={{ label: BID_COMPANY_SHOWING_WORDS.no_permit, onPress: () => setShowing('no_permit') }} tail="lists every company to tie by hand." compact />
          ) : (
            <EmptyState main="Nothing waiting on a tie. Every company we bid has a permit on record." compact />
          )
        ) : isMobile ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', overflow: 'hidden' }}>
            {list.map((c, i) => (
              <div key={c.key} data-market-company={c.key} style={{ display: 'grid', gap: 4, padding: '11px 14px', borderTop: i === 0 ? 0 : '1px solid var(--border)' }}>
                <strong style={{ fontSize: '0.9375rem' }}>{c.name}</strong>
                <span style={{ fontSize: '0.8125rem' }}>
                  {c.bids} bid{c.bids === 1 ? '' : 's'}, {c.won} won · {c.permits} permit{c.permits === 1 ? '' : 's'}
                </span>
                {whereLine(c)}
                {readsCell(c)}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={th}>Company</th>
                  <th style={{ ...th, textAlign: 'right' }}>Our bids</th>
                  <th style={{ ...th, textAlign: 'right' }}>Won</th>
                  <th style={{ ...th, textAlign: 'right' }}>Permits here, 12 mo</th>
                  <th style={th}>Reads as</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.key} data-market-company={c.key}>
                    <td style={td}>
                      <strong>{c.name}</strong>
                      {c.sources.length > 0 && (
                        <>
                          <br />
                          {whereLine(c)}
                        </>
                      )}
                    </td>
                    <td style={num}>{c.bids}</td>
                    <td style={num}>{c.won}</td>
                    <td style={num}>{c.permits}</td>
                    <td style={td}>{readsCell(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={muted}>
          A bid counts under its customer’s name. A permit counts under that exact name, or under a name a person tied to the customer. No permit on record is not “never builds”: the company may file under a person, an expediter or another name. <strong>Tie a name</strong> finds it. A city’s count reaches back twelve months, or to the day its records start.
        </div>
      </section>

      <section aria-labelledby="market-clock" style={section}>
        <div>
          <h3 id="market-clock" style={heading}>
            The clock
          </h3>
          <div style={muted}>How long you have, from the day the city first shows a job.</div>
        </div>
        {clocks.length === 0 ? (
          <div style={muted}>{rowsLoading || market.applications == null ? 'Reading the permits…' : `${city}’s permits carry too few pairs of dates to draw a clock yet.`}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {clocks.map((c) => (
              <ClockBar key={c.kind} clock={c} scale={scale} />
            ))}
          </div>
        )}
      </section>

      {opened && (
        <MarketBuilderSheet
          opened={opened}
          authUserId={authUserId}
          todayYmd={todayYmd}
          namesPlumbers={cityNamesPlumbers(market.ground?.builders.find((c) => c.city === opened.city)?.rows ?? [])}
          ground={ground}
          onAnswered={answers.reload}
          onClose={() => setOpened(null)}
          onSaved={() => {
            market.reload()
            onChanged()
          }}
        />
      )}
      {tying && (
        <FindNamesSheet
          customerIds={tying.customerIds}
          customerName={tying.name}
          onClose={() => {
            setTying(null)
            // A tie made on the sheet moves the company's count.
            answers.reload()
          }}
        />
      )}
    </div>
  )
}

/** One clock: the middle half as a band, the middle as a mark with its days. */
function ClockBar({ clock, scale }: { clock: MarketClock; scale: number }) {
  const { q1, median, q3 } = clock.spread
  const left = clockAt(q1, scale)
  const width = Math.max(1.5, clockAt(q3, scale) - left)
  const mid = clockAt(median, scale)
  return (
    <div data-market-clock={clock.kind}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{clockTitle(clock)}</div>
      <div role="img" aria-label={`${clockTitle(clock)}. The middle is ${clockDaysWords(median)}. The middle half is ${q1} to ${q3} days.`} style={{ position: 'relative', height: 22, background: 'var(--bg-200)', borderRadius: 8, margin: '8px 0 4px' }}>
        <span style={{ position: 'absolute', top: 0, bottom: 0, left: `${left}%`, width: `${width}%`, background: 'var(--border-blue)', borderRadius: 8 }} />
        <span style={{ position: 'absolute', top: -3, bottom: -3, left: `${mid}%`, width: 2, background: 'var(--text-strong)' }} />
      </div>
      <div style={{ position: 'relative', height: 18, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        <span style={{ position: 'absolute', left: 0 }}>{clock.kind === 'application' ? 'applied' : 'issued'}</span>
        <strong style={{ position: 'absolute', left: `${Math.max(14, Math.min(80, mid))}%`, transform: 'translateX(-50%)', whiteSpace: 'nowrap', color: 'var(--text-strong)' }}>{clockDaysWords(median)}</strong>
        <span style={{ position: 'absolute', right: 0 }}>{scale} days</span>
      </div>
      <div style={{ ...muted, marginTop: 4 }}>{clockNote(clock)}</div>
    </div>
  )
}

/** The builder's sheet Builders opens, for a name on a company's row. Its counts say how far back that city's records reach. */
function MarketBuilderSheet({ opened, authUserId, todayYmd, namesPlumbers, ground, onAnswered, onClose, onSaved }: { opened: Opened; authUserId: string; todayYmd: string; namesPlumbers: boolean; ground: BuilderAnswersGround | null; onAnswered: () => void; onClose: () => void; onSaved: () => void }) {
  const recordsStart = usePermitRecordsStart(opened.city)
  const reach = useMemo(() => recordsReach(recordsStart, todayYmd), [recordsStart, todayYmd])
  return <BuilderSheet row={opened.row} city={opened.city} authUserId={authUserId} todayYmd={todayYmd} reach={reach} namesPlumbers={namesPlumbers} ground={ground} onAnswered={onAnswered} onClose={onClose} onSaved={onSaved} />
}
