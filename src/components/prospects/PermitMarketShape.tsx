import type { CSSProperties } from 'react'
import { builderTiesWords, type BuilderTies, type KindCount, type MonthCount, type PlumberBoard } from '../../lib/research/permitMarketShape'

/**
 * Permits, Market: the two boxes under the clock (punch list #405, step two). **Who holds the
 * work** lists the plumbers a city's permits name by jobs, and says how tied the builders are to
 * one. The view draws it only where the permits name plumbers. **How much is being built**
 * draws the city's commercial permits a month, by kind, and how big they are.
 */
const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.45 }
const heading: CSSProperties = { margin: 0, fontSize: '0.9375rem', fontWeight: 600 }
const bar: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(96px, 38%) minmax(0, 1fr) 44px', gap: 8, alignItems: 'center', fontSize: '0.8125rem', margin: '4px 0' }
const wordPress: CSSProperties = { background: 'none', border: 0, padding: 0, fontFamily: 'inherit', fontSize: 'inherit', color: 'inherit', cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 2, textAlign: 'left' }

function Bar({ name, n, widest, quiet = false }: { name: string; n: number; widest: number; quiet?: boolean }) {
  return (
    <div style={bar}>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>
        {name}
      </span>
      <span style={{ display: 'block', height: 12, borderRadius: 6, background: quiet ? 'var(--bg-200)' : 'var(--border-blue)', width: `${widest > 0 ? Math.max(2, (n / widest) * 100) : 0}%` }} />
      <span style={{ textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{n.toLocaleString('en-US')}</span>
    </div>
  )
}

export function WhoHoldsTheWork({ city, board, ties, onOpenBuilder }: { city: string; board: PlumberBoard; ties: BuilderTies; /** A builder that shops around opens its sheet. */ onOpenBuilder: (builderKey: string) => void }) {
  const widest = Math.max(board.top[0]?.jobs ?? 0, 1)
  return (
    <div data-market-holds>
      <h3 style={heading}>
        Who holds the work <span style={{ ...muted, fontWeight: 400 }}>· {city}</span>
      </h3>
      <div style={{ ...muted, marginBottom: 6 }}>The plumbers named on the permits, by jobs, and how tied each builder is to one.</div>
      {board.top.map((p) => (
        <Bar key={p.key} name={p.name} n={p.jobs} widest={widest} />
      ))}
      {board.others.plumbers > 0 && <Bar name={`${board.others.plumbers} other${board.others.plumbers === 1 ? '' : 's'}`} n={board.others.jobs} widest={Math.max(board.others.jobs, widest)} quiet />}
      <div style={{ ...muted, marginTop: 6 }}>{builderTiesWords(ties)}</div>
      {ties.shoppers.length > 0 && (
        <div style={{ ...muted, marginTop: 4 }}>
          {ties.shoppers.slice(0, 5).map((s, i) => (
            <span key={s.key}>
              {i > 0 ? ' · ' : ''}
              <button type="button" onClick={() => onOpenBuilder(s.key)} title={`${s.name}: ${s.plumbers} plumbers on ${s.jobs} named jobs. Opens the builder.`} style={wordPress}>
                {s.name}
              </button>
            </span>
          ))}
          {ties.shoppers.length > 5 ? ` · and ${ties.shoppers.length - 5} more` : ''}
        </div>
      )}
    </div>
  )
}

export function HowMuchIsBuilt({ city, months, kinds, sizeWords }: { city: string; months: readonly MonthCount[]; kinds: readonly KindCount[]; /** The line about how big the permits are, or why none is drawn. */ sizeWords: string }) {
  const tallest = Math.max(...months.map((m) => m.n), 1)
  const widest = Math.max(kinds[0]?.n ?? 0, 1)
  return (
    <>
      <div data-market-months>
        <h3 style={heading}>
          How much is being built <span style={{ ...muted, fontWeight: 400 }}>· {city}, commercial permits a month</span>
        </h3>
        {months.length === 0 ? (
          <div style={{ ...muted, marginTop: 6 }}>{city}’s records do not cover a whole month yet.</div>
        ) : (
          <div role="img" aria-label={`Commercial permits a month in ${city}: ${months.map((m) => `${m.label} ${m.n}`).join(', ')}`}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 110, borderBottom: '1px solid var(--border)', marginTop: 22 }}>
              {months.map((m) => (
                <div key={m.ym} style={{ flex: '1 1 0', minWidth: 0, height: `${Math.max(2, (m.n / tallest) * 100)}%`, background: 'var(--border-blue)', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                  <span style={{ position: 'absolute', top: -16, left: 0, right: 0, textAlign: 'center', fontSize: '0.66rem', fontWeight: 600, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{m.n}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 5, fontSize: '0.66rem', color: 'var(--text-muted)', marginTop: 3 }}>
              {months.map((m) => (
                <span key={m.ym} style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <div data-market-kinds>
        <h3 style={heading}>
          What kind, and how big <span style={{ ...muted, fontWeight: 400 }}>· {city}, 12 months</span>
        </h3>
        <div style={{ marginTop: 6 }}>
          {kinds.map((k) => (
            <Bar key={k.kind} name={k.kind} n={k.n} widest={widest} />
          ))}
        </div>
        <div style={{ ...muted, marginTop: 6 }}>{sizeWords}</div>
      </div>
    </>
  )
}
