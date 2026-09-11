import { useEffect, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  OVERHEAD_POOL_SERIES,
  overheadPoolCounterpartyNote,
  overheadPoolPersonNote,
  overheadPoolTypicalLabel,
  type OverheadPoolCategory,
  type OverheadPoolDayIndex,
  type OverheadPoolLaborLine,
  type OverheadPoolPartsLine,
} from '../../lib/overheadPoolDayLines'
import { APP_CALENDAR_TZ, formatWorkDateYmdWeekdayLongFriendly } from '../../utils/dateUtils'

/**
 * The pool chart's day panel (v2.3269): what is behind one bar of People →
 * Overhead's 90-day pool chart. Opens on the segment that was clicked (office
 * labor · bid labor · office parts) or on the whole day; tabs flip between
 * them, ‹ › walk the days. Every line carries the context that makes it
 * judgeable — how often that counterparty shows up in the window and whether
 * this is its largest, a person's typical day and whether this is the longest,
 * "awaiting approval" on recorded-but-unreviewed sessions, internal transfers
 * struck through as not counted — and the footer holds the doors to fix it.
 */
export type OverheadPoolDayModalCategory = OverheadPoolCategory | 'day'

const money = (v: number, cents = false): string => `$${v.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`
const timeOf = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ }) : '—'
}
const sourceLabel = (s: OverheadPoolPartsLine['source']): string => (s === 'mercury' ? 'card' : s === 'supply' ? 'supply invoice' : 'tally')

const th: CSSProperties = { textAlign: 'left', fontSize: '0.66rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0.35rem 0.4rem', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '0.4rem', borderBottom: '1px solid var(--border)', verticalAlign: 'top', fontSize: '0.8125rem' }
const amt: CSSProperties = { textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const chip: CSSProperties = { display: 'inline-block', fontSize: '0.66rem', fontWeight: 600, padding: '0 6px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-muted)', marginLeft: 6, verticalAlign: 1 }
const srcBadge: CSSProperties = { display: 'inline-block', fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '0 5px', borderRadius: 4, border: '1px solid var(--border-strong)', background: 'var(--bg-subtle)', color: 'var(--text-700)', marginRight: 6 }
const note: CSSProperties = { fontSize: '0.74rem', color: 'var(--text-muted)' }
const btn: CSSProperties = { background: 'var(--bg-subtle)', border: '1px solid var(--border-strong)', color: 'var(--text-strong)', borderRadius: 6, padding: '0.15rem 0.55rem', cursor: 'pointer', font: 'inherit', fontSize: '0.8125rem' }
const linkStyle: CSSProperties = { color: 'var(--text-link)', fontSize: '0.8125rem' }

export function OverheadPoolDayModal({
  index,
  ymd,
  category,
  cardLabelForLine,
  onChange,
  onShowWeek,
  onClose,
}: {
  index: OverheadPoolDayIndex
  ymd: string
  category: OverheadPoolDayModalCategory
  /** Card nickname for a Mercury line ("Taunya · 4471"); '' when the line has no card. */
  cardLabelForLine: (line: OverheadPoolPartsLine) => string
  onChange: (ymd: string, category: OverheadPoolDayModalCategory) => void
  /** Move the week table below to the week holding this day. */
  onShowWeek: (ymd: string) => void
  onClose: () => void
}) {
  const day = index.byYmd.get(ymd) ?? { ymd, office: [], bid: [], parts: [], sums: { office: 0, bid: 0, parts: 0, total: 0 }, excludedPartsUsd: 0 }
  const pos = index.ymds.indexOf(ymd)
  const prevYmd = pos > 0 ? index.ymds[pos - 1] : null
  const nextYmd = pos >= 0 && pos < index.ymds.length - 1 ? index.ymds[pos + 1] : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && prevYmd) onChange(prevYmd, category)
      else if (e.key === 'ArrowRight' && nextYmd) onChange(nextYmd, category)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, onChange, prevYmd, nextYmd, category])

  const share = (v: number) => (index.poolUsd > 0 ? `${((100 * v) / index.poolUsd).toFixed(1)}% of the ${index.ymds.length}-day pool` : null)
  const sub =
    category === 'day'
      ? [`${money(day.sums.total, true)} into the pool that day`, overheadPoolTypicalLabel(day.sums.total, index.typicalDayUsd) ?? (day.sums.total > 0 ? null : 'nothing that day'), share(day.sums.total)]
      : [
          `${money(day.sums[category], true)} of that day's ${money(day.sums.total, true)}`,
          overheadPoolTypicalLabel(day.sums[category], index.typicalByCategory[category], `a typical day for ${OVERHEAD_POOL_SERIES[category].label.toLowerCase()}`) ?? (day.sums[category] > 0 ? null : `nothing for ${OVERHEAD_POOL_SERIES[category].label.toLowerCase()}`),
          share(day.sums[category]),
        ]
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const cats: OverheadPoolCategory[] = category === 'day' ? ['office', 'bid', 'parts'] : [category]

  const laborTable = (lines: OverheadPoolLaborLine[], cat: 'office' | 'bid') =>
    lines.length === 0 ? (
      <p style={{ ...note, margin: '0.25rem 0 0.5rem' }}>Nothing in {OVERHEAD_POOL_SERIES[cat].label.toLowerCase()} that day.</p>
    ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Person</th>
            <th style={th}>Session</th>
            <th style={{ ...th, ...amt }}>Hours</th>
            <th style={{ ...th, ...amt }}>Labor $</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const pn = overheadPoolPersonNote(index, l)
            return (
              <tr key={l.sessionId ?? `${l.userName}-${i}`}>
                <td style={td}>
                  {l.userName}
                  {l.awaitingApproval ? (
                    <span style={{ ...chip, color: 'var(--text-amber-800)', borderColor: 'var(--border-amber)' }} title="Counted as recorded time; approve or reject it in People → Hours">
                      awaiting approval
                    </span>
                  ) : null}
                  {l.missingWage ? (
                    <span style={chip} title="No wage on file — hours count, dollars price at $0">
                      no wage
                    </span>
                  ) : null}
                  {pn ? <div style={note}>{pn}</div> : null}
                </td>
                <td style={td}>
                  {l.clockedInAt ? `${timeOf(l.clockedInAt)} → ${timeOf(l.clockedOutAt)}` : <span style={note}>session</span>}
                  {l.notes ? <div style={{ ...note, fontStyle: 'italic' }}>“{l.notes}”</div> : null}
                </td>
                <td style={{ ...td, ...amt }}>{l.hours.toFixed(1)}</td>
                <td style={{ ...td, ...amt }}>{money(l.laborUsd, true)}</td>
              </tr>
            )
          })}
          <tr>
            <td style={{ ...td, borderBottom: 0, fontWeight: 700 }}>
              {lines.length} {lines.length === 1 ? 'session' : 'sessions'}
            </td>
            <td style={{ ...td, borderBottom: 0 }} />
            <td style={{ ...td, ...amt, borderBottom: 0, fontWeight: 700 }}>{lines.reduce((s, l) => s + l.hours, 0).toFixed(1)}</td>
            <td style={{ ...td, ...amt, borderBottom: 0, fontWeight: 700 }}>{money(day.sums[cat], true)}</td>
          </tr>
        </tbody>
      </table>
    )

  const partsTable = (lines: OverheadPoolPartsLine[]) =>
    lines.length === 0 ? (
      <p style={{ ...note, margin: '0.25rem 0 0.5rem' }}>Nothing in office parts that day.</p>
    ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Purchase</th>
            <th style={th}>Paid with</th>
            <th style={{ ...th, ...amt }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => {
            const cn = overheadPoolCounterpartyNote(index, l, money, `${index.ymds.length} days`)
            const card = cardLabelForLine(l)
            const muted: CSSProperties = l.counted ? {} : { color: 'var(--text-faint)', textDecoration: 'line-through' }
            return (
              <tr key={`${l.source}-${l.label}-${i}`}>
                <td style={{ ...td, ...muted }}>
                  <span style={srcBadge}>{sourceLabel(l.source)}</span>
                  {l.label}
                  {!l.counted ? (
                    <span style={{ ...chip, textDecoration: 'none' }} title="Movement between your own accounts — listed here, never counted in the pool">
                      internal transfer · not counted
                    </span>
                  ) : l.bucket === 'fuel_gas' ? (
                    <span style={{ ...chip, textDecoration: 'none' }}>fuel &amp; gas</span>
                  ) : null}
                  {cn ? <div style={{ ...note, textDecoration: 'none' }}>{cn}</div> : null}
                </td>
                <td style={{ ...td, ...muted }}>{card || (l.source === 'supply' ? <span style={note}>supply house invoice</span> : l.source === 'tally' ? <span style={note}>tally entry</span> : <span style={note}>no card (ACH, wire or check)</span>)}</td>
                <td style={{ ...td, ...amt, ...muted }}>{money(l.amountUsd, true)}</td>
              </tr>
            )
          })}
          <tr>
            <td style={{ ...td, borderBottom: 0, fontWeight: 700 }}>
              {lines.filter((l) => l.counted).length} {lines.filter((l) => l.counted).length === 1 ? 'purchase' : 'purchases'}
              {day.excludedPartsUsd > 0 ? <span style={note}> · {money(day.excludedPartsUsd, true)} not counted</span> : null}
            </td>
            <td style={{ ...td, borderBottom: 0 }} />
            <td style={{ ...td, ...amt, borderBottom: 0, fontWeight: 700 }}>{money(day.sums.parts, true)}</td>
          </tr>
        </tbody>
      </table>
    )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="overhead-pool-day-title"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div onMouseDown={stop} style={{ width: 'min(760px, 100%)', maxHeight: '90vh', overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, boxShadow: '0 20px 50px rgba(0,0,0,0.35)' }}>
        <div style={{ padding: '0.75rem 0.9rem 0.6rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div id="overhead-pool-day-title" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-strong)' }}>
              {category !== 'day' ? <i aria-hidden style={{ display: 'inline-block', width: 11, height: 11, borderRadius: 2, background: OVERHEAD_POOL_SERIES[category].color, marginRight: 7, verticalAlign: -1 }} /> : null}
              {category !== 'day' ? `${OVERHEAD_POOL_SERIES[category].label} · ` : ''}
              {formatWorkDateYmdWeekdayLongFriendly(ymd)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub.filter(Boolean).join(' · ')}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4, flexShrink: 0 }}>
            <button type="button" style={btn} disabled={!prevYmd} onClick={() => prevYmd && onChange(prevYmd, category)} title="Previous day (←)" aria-label="Previous day">
              ‹
            </button>
            <button type="button" style={btn} disabled={!nextYmd} onClick={() => nextYmd && onChange(nextYmd, category)} title="Next day (→)" aria-label="Next day">
              ›
            </button>
            <button type="button" style={btn} onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
        <div role="tablist" aria-label="What to show" style={{ display: 'flex', padding: '0 0.9rem', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {(
            [
              ['day', 'Whole day', day.sums.total],
              ['office', OVERHEAD_POOL_SERIES.office.label, day.sums.office],
              ['bid', OVERHEAD_POOL_SERIES.bid.label, day.sums.bid],
              ['parts', OVERHEAD_POOL_SERIES.parts.label, day.sums.parts],
            ] as const
          ).map(([key, label, v]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={category === key}
              onClick={() => onChange(ymd, key)}
              style={{ background: 'none', border: 'none', borderBottom: `2px solid ${category === key ? 'var(--text-strong)' : 'transparent'}`, color: category === key ? 'var(--text-strong)' : 'var(--text-muted)', padding: '0.5rem 0.6rem', font: 'inherit', fontSize: '0.8125rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              {key !== 'day' ? <i aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: OVERHEAD_POOL_SERIES[key].color }} /> : null}
              {label} <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-700)' }}>{money(v)}</span>
            </button>
          ))}
        </div>
        <div style={{ padding: '0.6rem 0.9rem 0.9rem' }}>
          {cats.map((c) => (
            <div key={c} style={{ marginTop: category === 'day' ? '0.5rem' : 0 }}>
              {category === 'day' ? (
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-700)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <i aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: OVERHEAD_POOL_SERIES[c].color }} />
                  {OVERHEAD_POOL_SERIES[c].label} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {money(day.sums[c], true)}</span>
                </div>
              ) : null}
              {c === 'parts' ? partsTable(day.parts) : laborTable(c === 'office' ? day.office : day.bid, c)}
            </div>
          ))}
        </div>
        <div style={{ padding: '0.6rem 0.9rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem 1rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <button type="button" onClick={() => onShowWeek(ymd)} style={{ ...btn, color: 'var(--text-link)', background: 'transparent', border: 'none', padding: 0, fontSize: '0.8125rem', textDecoration: 'underline' }}>
            Show this week in the table below ↓
          </button>
          {category !== 'office' && category !== 'bid' ? (
            <span>
              <Link to="/banking?tab=accounting" style={linkStyle}>
                Banking → Accounting
              </Link>{' '}
              re-label or move a card purchase
            </span>
          ) : null}
          {category !== 'parts' ? (
            <span>
              <Link to="/people?tab=hours" style={linkStyle}>
                People → Hours
              </Link>{' '}
              approve or reject a session
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
