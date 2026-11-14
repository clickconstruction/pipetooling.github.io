import type { CSSProperties } from 'react'
import { daysBetweenYmd, formatYmdMonthDay } from '../../lib/jobs/billedExpectedPay'
import type { HouseNoticeBarTone, HouseNoticeSourceKind, HouseNoticeStrip as Strip } from '../../lib/materials/houseNoticeStrip'

/**
 * A house's notice window drawn (punch list #217, people-docs-8, a prototype): the kernel's rows on
 * one calendar in the Lien timeline's mini Windows shape — a name column, a month axis, today a
 * blue line down every row, each house's window a bar with the days already gone hatched, its
 * unpaid invoices as ticks on their days, the day the house gave as a diamond; under the rows one
 * mark per house saying where its date came from, a dashed *guessed* mark for the app's estimate
 * and a solid *they said* mark for the house's word. Reads the kernel only; theme tokens, the
 * saturated status colours the lien chart's own.
 */

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const BAR_TONE: Record<HouseNoticeBarTone, { bg: string; line: string; ink: string }> = {
  open: { bg: 'var(--bg-amber-tint)', line: 'var(--text-amber-800)', ink: 'var(--text-amber-800)' },
  soon: { bg: 'var(--bg-amber-tint)', line: 'var(--text-amber-800)', ink: 'var(--text-amber-800)' },
  closed: { bg: 'var(--bg-subtle)', line: 'var(--text-red-600)', ink: 'var(--text-muted)' },
}

const SOURCE_STYLE: Record<HouseNoticeSourceKind, CSSProperties> = {
  guessed: { border: '1px dashed var(--text-amber-800)', color: 'var(--text-amber-800)', background: 'var(--surface)' },
  said: { border: '1px solid var(--border-strong)', color: 'var(--text-700)', background: 'var(--surface)' },
  closed: { border: '1px dashed var(--border-strong)', color: 'var(--text-muted)', background: 'var(--surface)' },
  none: { border: '1px dashed var(--border)', color: 'var(--text-muted)', background: 'var(--surface)' },
}

const NAME_COL = 'minmax(120px, 30%)'

export function HeldHouseNoticeStrip({
  strip,
  onTellUs,
  showChips = true,
  testId,
}: {
  strip: Strip
  /** The *They told us…* door for a house, drawn as the arrow on its mark. */
  onTellUs?: (houseId: string) => void
  /** The job's chips lead the strip; false when the caller draws them above, on the job's own line. */
  showChips?: boolean
  testId?: string
}) {
  const { first, last, ticks } = strip.axis
  const total = Math.max(1, daysBetweenYmd(first, last) ?? 1)
  const pct = (ymd: string) => Math.max(0, Math.min(100, ((daysBetweenYmd(first, ymd) ?? 0) / total) * 100))
  const todayAt = pct(strip.todayYmd)
  return (
    <div data-held-notice-strip data-testid={testId} title={strip.words} style={{ display: 'grid', gap: 0, fontSize: '0.75rem', minWidth: 0, margin: '0.5rem 0 0.2rem' }}>
      {showChips && strip.chips.length ? (
        <div data-held-notice-chips style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
          {strip.chips.map((c) => (
            <span key={c.key} data-held-notice-chip={c.key} style={{ fontSize: '0.68rem', fontWeight: 700, padding: '0 0.5rem', borderRadius: 999, lineHeight: 1.75, background: c.tone === 'ok' ? 'var(--bg-emerald-tint)' : 'var(--bg-amber-tint)', color: c.tone === 'ok' ? 'var(--text-emerald-800)' : 'var(--text-amber-800)' }}>
              {c.text}
            </span>
          ))}
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: `${NAME_COL} minmax(0, 1fr)` }}>
        <span />
        <div data-held-notice-axis style={{ position: 'relative', height: 24, borderBottom: '1px solid var(--border-strong)', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
          {ticks.map((t) => (
            <span key={t} data-held-notice-month={t.slice(0, 7)} style={{ position: 'absolute', left: `${pct(t)}%`, bottom: 2, paddingLeft: 3, borderLeft: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
              {MONTH_SHORT[Number(t.slice(5, 7)) - 1]}
            </span>
          ))}
          <span style={{ position: 'absolute', left: `${todayAt}%`, top: 0, paddingLeft: 4, fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-link)', whiteSpace: 'nowrap', transform: todayAt > 75 ? 'translateX(-100%)' : undefined }}>
            today · {formatYmdMonthDay(strip.todayYmd)}
          </span>
        </div>
      </div>
      {strip.rows.map((r) => (
        <div key={r.houseId} data-held-notice-row={r.houseId} data-held-notice-source={r.source.kind} title={r.title} style={{ display: 'grid', gridTemplateColumns: `${NAME_COL} minmax(0, 1fr)`, alignItems: 'center', minHeight: 44, borderBottom: '1px dashed var(--border)' }}>
          <div style={{ minWidth: 0, paddingRight: 6, lineHeight: 1.25, fontWeight: 600, color: r.ahead ? 'var(--text-strong)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
          <div style={{ position: 'relative', height: 44 }}>
            <span aria-hidden data-held-notice-today style={{ position: 'absolute', left: `${todayAt}%`, top: 0, bottom: 0, borderLeft: '2px solid var(--text-link)', zIndex: 2 }} />
            {r.bar ? (
              <span
                data-held-notice-bar={r.bar.tone}
                title={r.bar.words}
                style={{ position: 'absolute', top: 8, height: 14, left: `${pct(r.bar.start)}%`, width: `${Math.max(1.5, pct(r.bar.end) - pct(r.bar.start))}%`, borderRadius: 4, border: `1px solid ${BAR_TONE[r.bar.tone].line}`, background: BAR_TONE[r.bar.tone].bg, boxSizing: 'border-box', overflow: 'hidden' }}
              >
                {r.bar.hatchTo && r.bar.hatchTo > r.bar.start ? (
                  <span aria-hidden data-held-notice-hatch style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, ((pct(r.bar.hatchTo) - pct(r.bar.start)) / Math.max(0.1, pct(r.bar.end) - pct(r.bar.start))) * 100)}%`, background: `repeating-linear-gradient(135deg, color-mix(in srgb, ${BAR_TONE[r.bar.tone].line} 40%, transparent) 0 3px, color-mix(in srgb, ${BAR_TONE[r.bar.tone].line} 12%, transparent) 3px 6px)` }} />
                ) : null}
              </span>
            ) : null}
            {r.bar?.tone === 'closed' ? (
              <span aria-hidden data-held-notice-struck style={{ position: 'absolute', top: 6, left: `${pct(r.bar.end)}%`, marginLeft: -8, width: 16, height: 16, borderRadius: '50%', background: 'var(--text-red-600)', color: 'var(--surface)', fontSize: 10, fontWeight: 800, lineHeight: '16px', textAlign: 'center', border: '2px solid var(--surface)', boxSizing: 'border-box', zIndex: 3 }}>
                ✗
              </span>
            ) : null}
            {r.ticks.map((t) => (
              <span key={`${t.ymd}:${t.words}`} aria-hidden data-held-notice-invoice={t.ymd} title={t.words} style={{ position: 'absolute', left: `${pct(t.ymd)}%`, top: 4, height: 22, borderLeft: '2px solid var(--text-strong)', zIndex: 3 }} />
            ))}
            {r.told ? (
              <span aria-hidden data-held-notice-told={r.told.ymd} title={`${r.told.who} said its notice ${r.told.past ? 'went' : 'goes'} out ${formatYmdMonthDay(r.told.ymd)}`} style={{ position: 'absolute', left: `${pct(r.told.ymd)}%`, top: 10, width: 10, height: 10, marginLeft: -5, borderRadius: 1, transform: 'rotate(45deg)', background: 'var(--bg-violet-100)', border: '1.5px solid var(--text-violet-700)', boxSizing: 'border-box', zIndex: 4 }} />
            ) : null}
            <span data-held-notice-caption style={{ position: 'absolute', top: 26, ...(r.bar && pct(r.bar.start) > 55 ? { right: 0, textAlign: 'right' } : { left: `${pct(r.bar?.start ?? r.ticks[0]?.ymd ?? first)}%` }), maxWidth: '100%', fontSize: '0.68rem', lineHeight: 1.3, color: r.bar ? BAR_TONE[r.bar.tone].ink : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[r.bar?.words ?? '', r.ticks.length ? `${r.ticks.length === 1 ? 'unpaid invoice' : 'unpaid invoices'} ${r.ticks.map((t) => formatYmdMonthDay(t.ymd)).join(' · ')}` : ''].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      ))}
      <div data-held-notice-sources style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.5rem', marginTop: '0.45rem' }}>
        {strip.rows.map((r) => (
          <span key={r.houseId} data-held-notice-source-mark={r.source.kind} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.7rem', padding: '0.1rem 0.55rem', borderRadius: 999, ...SOURCE_STYLE[r.source.kind] }}>
            {r.source.words}
            {onTellUs && r.source.kind !== 'said' ? (
              <button type="button" onClick={() => onTellUs(r.houseId)} title={`They told us… · write down the day ${r.name} gives`} aria-label={`They told us, for ${r.name}`} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--text-link)', cursor: 'pointer', font: 'inherit', fontSize: '0.75rem', lineHeight: 1 }}>
                ↗
              </button>
            ) : null}
          </span>
        ))}
      </div>
      <div aria-hidden style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem 0.8rem', marginTop: '0.3rem', fontSize: '0.66rem', color: 'var(--text-muted)' }}>
        {strip.legend.map((l) => <span key={l}>{l}</span>)}
      </div>
    </div>
  )
}
