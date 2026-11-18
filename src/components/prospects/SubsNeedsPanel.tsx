import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { gcProjectHref } from '../../lib/gc/links'
import { NEEDS_GROUP_WORDS, NEEDS_RULE, benchLineParts, bestDoor, bookChipWords, dueWords, needsHeadWords, quotesWords, tradePartnersHref, type GcNeeds, type NeedTone } from '../../lib/prospects/gcNeeds'

/** The needs panel's tones (v2.5782): the theme's text tokens, so dark mode lightens them. */
const NEED_TONE_COLOR: Record<NeedTone, string> = { red: 'var(--text-red-700)', amber: 'var(--text-amber-700)', green: 'var(--text-green-700)', quiet: 'var(--text-600)' }

/**
 * The panel over the Subs deck. Moved out of `src/pages/Prospects.tsx` unchanged; the page decides when it shows
 * (the Subs lane, with the bench read answered or failed).
 */
export function SubsNeedsPanel({
  needs,
  benchFailed,
  tradeFilter,
  onTradeFilter,
  onAddSub,
}: {
  needs: GcNeeds
  /** The bench could not be read: the panel says so in place of its head words. */
  benchFailed: boolean
  /** The trade the deck is filtered to (`?trade=`), which lights its row. */
  tradeFilter: string | null
  onTradeFilter: (trade: string | null) => void
  onAddSub: (trade: string) => void
}) {
  return (
      // What GC mode needs right now (v2.5782, punch list #148): one row a trade, worst first, each row
      // leading to the companies to call in the owner's order: the bench, then the subs here, then Add a sub.
      <section
        role="group"
        aria-label="What GC mode needs right now"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.6rem 0.75rem', marginBottom: '0.75rem', fontSize: '0.8125rem' }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-700)', fontSize: '0.875rem' }}>What GC mode needs right now</span>
          <span style={{ color: 'var(--text-muted)' }}>{benchFailed ? 'the bench could not be read' : `${needsHeadWords(needs)} · ${NEEDS_RULE}`}</span>
          {tradeFilter && (
            <button type="button" onClick={() => onTradeFilter(null)} style={{ marginLeft: 'auto', font: 'inherit', fontSize: '0.75rem', color: 'var(--text-link)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
              All subs
            </button>
          )}
        </div>
        {needs.rows.map((need, i) => {
          const heading = needs.rows[i - 1]?.why !== need.why ? NEEDS_GROUP_WORDS[need.why] : null
          const on = (tradeFilter ?? '').trim().toLowerCase() === need.trade.trim().toLowerCase()
          const deep = need.why === 'bench' && need.benchShort === 0
          const best = bestDoor(need)
          const door = (primary: boolean): CSSProperties => ({
            font: 'inherit',
            fontSize: '0.75rem',
            fontWeight: 600,
            border: `1px solid ${primary ? '#2563eb' : 'var(--border)'}`,
            background: primary ? '#2563eb' : 'var(--surface)',
            color: primary ? 'white' : 'var(--text-700)',
            borderRadius: 6,
            padding: '0.2rem 0.55rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          })
          return (
            <div key={need.trade}>
              {heading && <div style={{ fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.5rem 0 0.15rem' }}>{heading}</div>}
              <div className="gcNeedRow" aria-current={on ? 'true' : undefined} style={{ background: on ? 'var(--bg-blue-200)' : i % 2 ? 'var(--bg-subtle)' : 'transparent', color: deep ? 'var(--text-muted)' : 'var(--text-strong)' }}>
                <span style={{ fontWeight: 700 }}>{need.trade}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                  {need.asks.map((ask) => {
                    const quotes = quotesWords(ask)
                    const due = dueWords(ask.bidDue, ask.daysLeft)
                    return (
                      <span key={ask.projectId}>
                        <Link to={gcProjectHref(ask.projectId)} style={{ color: 'var(--text-link)', fontWeight: 600 }}>
                          {ask.projectName}
                        </Link>{' '}
                        · <span style={{ color: NEED_TONE_COLOR[quotes.tone], fontWeight: quotes.tone === 'quiet' ? 400 : 600 }}>{quotes.text}</span> ·{' '}
                        <span style={{ color: NEED_TONE_COLOR[due.tone], fontWeight: due.tone === 'quiet' ? 400 : 600 }}>{due.text}</span>
                      </span>
                    )
                  })}
                  <span style={{ color: deep ? 'var(--text-muted)' : 'var(--text-600)' }}>{benchLineParts(need).join(' · ')}</span>
                </div>
                <div className="gcNeedDoors">
                  {need.asks.length > 0 && need.unasked > 0 && (
                    <Link to={tradePartnersHref(need.trade)} style={door(best === 'ask')}>
                      Ask them →
                    </Link>
                  )}
                  {need.toCall > 0 && (
                    <button type="button" aria-pressed={on} onClick={() => onTradeFilter(on ? null : need.trade)} style={door(best === 'call' && !on)}>
                      {on ? 'All subs' : `Call for ${need.trade}`}
                    </button>
                  )}
                  <button type="button" onClick={() => onAddSub(need.trade)} style={door(best === 'add')}>
                    Add a sub
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {needs.book.length > 0 && (
          <>
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.5rem 0 0.15rem' }}>
              {NEEDS_GROUP_WORDS.book} <span style={{ textTransform: 'none', letterSpacing: 0 }}>· the scope book's trades</span>
            </div>
            <div role="group" aria-label="Trades nobody does yet" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.2rem 0.5rem 0.3rem' }}>
              {needs.book.map((t) => {
                const on = t.toCall > 0 && (tradeFilter ?? '').trim().toLowerCase() === t.trade.trim().toLowerCase()
                return (
                  <button
                    key={t.trade}
                    type="button"
                    aria-pressed={t.toCall > 0 ? on : undefined}
                    onClick={() => (t.toCall > 0 ? onTradeFilter(on ? null : t.trade) : onAddSub(t.trade))}
                    title={t.toCall > 0 ? `${t.toCall} to call here: press to call for ${t.trade} alone` : `Add a sub that does ${t.trade}`}
                    style={{ font: 'inherit', fontSize: '0.8125rem', border: `1px solid ${on ? '#3b82f6' : 'var(--border)'}`, background: on ? 'var(--bg-blue-200)' : 'var(--surface)', color: 'var(--text-strong)', borderRadius: 999, padding: '0.1rem 0.6rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {bookChipWords(t)} {t.toCall === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>+</span>}
                  </button>
                )
              })}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Press a chip to add a sub for that trade.</span>
            </div>
          </>
        )}
      </section>
  )
}
