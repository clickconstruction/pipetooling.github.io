import type { CSSProperties } from 'react'
import { chaseClockLegend, type ChaseClockLabel, type ChaseClockMark, type ChaseClockStrip as Strip } from '../../lib/bids/chaseClockStrip'

/**
 * One pending bid's chase clock drawn (punch list #217, bids-7, a prototype): the kernel's days as
 * columns, the send a blue dot, each contact a filled dot, the call-again day a diamond — solid
 * when a person promised it, dashed when the rule made it — the tab-gettable day a green tick,
 * today a blue column. The labels under the strip come from the kernel, which has already let
 * the lesser of two close neighbours give way. Reads the kernel only; theme tokens throughout,
 * the one saturated green a status colour as the Legal strip's are.
 */

const INK: Record<ChaseClockMark, string> = {
  sent: 'var(--text-link)',
  contact: 'var(--text-strong)',
  promised: 'var(--text-amber-800)',
  default: 'var(--text-amber-800)',
  gettable: 'var(--text-green-700)',
}

function markStyle(mark: ChaseClockMark | 'today'): CSSProperties {
  const dot: CSSProperties = { width: 7, height: 7, borderRadius: '50%', boxSizing: 'border-box', flex: 'none', display: 'inline-block' }
  switch (mark) {
    case 'sent':
      return { ...dot, background: INK.sent }
    case 'contact':
      return { ...dot, background: INK.contact }
    case 'promised':
      return { ...dot, width: 8, height: 8, borderRadius: 1, transform: 'rotate(45deg)', background: 'var(--bg-amber-tint)', border: `1.5px solid ${INK.promised}` }
    case 'default':
      return { ...dot, width: 8, height: 8, borderRadius: 1, transform: 'rotate(45deg)', background: 'var(--surface)', border: `1.5px dashed ${INK.default}` }
    case 'gettable':
      return { width: 0, height: 0, flex: 'none', display: 'inline-block', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: `9px solid ${INK.gettable}` }
    case 'today':
      return { width: 0, height: 10, flex: 'none', display: 'inline-block', borderLeft: '2px solid var(--text-link)' }
  }
}

const LABEL_INK: Record<ChaseClockLabel['tone'], string> = { muted: 'var(--text-muted)', blue: 'var(--text-link)', amber: 'var(--text-amber-800)', green: 'var(--text-green-700)' }

export function ChaseClockStrip({ strip, testId }: { strip: Strip; testId?: string }) {
  const n = strip.days.length
  if (n === 0) return null
  const at = (ymd: string) => ((strip.days.findIndex((d) => d.ymd === ymd) + 0.5) / n) * 100
  return (
    <div data-chase-clock data-testid={testId} data-to-chase={strip.toChase ? 'yes' : undefined} title={strip.words} style={{ margin: '0.3rem 0 0', minWidth: 0 }}>
      <div role="img" aria-label={strip.words} style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 1, alignItems: 'end', height: 30 }}>
        {strip.days.map((d) => (
          <span
            key={d.ymd}
            data-chase-clock-day={d.ymd}
            data-today={d.today ? 'yes' : undefined}
            data-pinned={d.pinned ? 'yes' : undefined}
            title={d.title}
            style={{ display: 'grid', gap: 2, alignContent: 'end', justifyItems: 'center', height: '100%', padding: '0 0 3px', borderRadius: 3, boxSizing: 'border-box', background: d.today ? 'var(--bg-blue-tint)' : d.weekend ? 'var(--bg-muted)' : 'transparent', outline: d.today ? '1px solid var(--text-link)' : undefined, borderLeft: d.pinned ? '2px dashed var(--border-strong)' : undefined, minWidth: 0 }}
          >
            {d.marks.map((m, i) => <i key={i} aria-hidden data-chase-clock-mark={m} style={markStyle(m)} />)}
          </span>
        ))}
      </div>
      <div aria-hidden style={{ position: 'relative', height: '1rem', marginTop: 2, fontSize: '0.62rem', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
        {strip.labels.map((l) => (
          <span
            key={`${l.ymd}:${l.text}`}
            data-chase-clock-label={l.tone}
            style={{
              position: 'absolute',
              top: 0,
              left: `${at(l.ymd)}%`,
              transform: l.align === 'left' ? 'translateX(-4px)' : l.align === 'right' ? 'translateX(calc(-100% + 4px))' : 'translateX(-50%)',
              color: LABEL_INK[l.tone],
              fontWeight: l.tone === 'blue' || l.tone === 'amber' ? 700 : 500,
            }}
          >
            {l.text}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The legend, drawn once above a list of strips. */
export function ChaseClockLegend({ style }: { style?: CSSProperties }) {
  return (
    <div data-chase-clock-legend style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.9rem', fontSize: '0.68rem', color: 'var(--text-muted)', ...style }}>
      {chaseClockLegend().map((item) => (
        <span key={item.mark} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <i aria-hidden style={markStyle(item.mark)} />
          {item.words}
        </span>
      ))}
    </div>
  )
}
