import type { CSSProperties } from 'react'
import type { LegalTimelineStrip as Strip, StripDay, StripDot } from '../../../lib/legal/timelineStrip'
import type { TimelineLook } from './LegalTimelinePanel'

/**
 * The Timeline's strip of days (v2.6107, punch list #214, PR 4): the kernel's cells drawn as columns,
 * today outlined, weekends washed, each item a dot in its own shape — a filled dot done, a ring
 * planned, a red ring overdue, a diamond a lien-clock deadline, small lane dots for what was said,
 * done and filed. A press on a day asks the panel to scroll the line to it. Reads the kernel only.
 */

function dotStyle(dot: StripDot, look: TimelineLook): CSSProperties {
  const base: CSSProperties = { width: 7, height: 7, borderRadius: '50%', boxSizing: 'border-box', flex: 'none' }
  switch (dot) {
    case 'late': return { ...base, width: 8, height: 8, background: look.surface, border: `2px solid ${look.stop}` }
    case 'deadline': return { ...base, width: 8, height: 8, borderRadius: 1, transform: 'rotate(45deg)', background: look.band, border: `1.5px solid ${look.warn}` }
    case 'done': return { ...base, background: look.text }
    case 'planned': return { ...base, width: 8, height: 8, background: look.surface, border: `2px solid ${look.text}` }
    case 'did': return { ...base, background: look.accent }
    case 'paper': return { ...base, background: look.muted }
    case 'said': return { ...base, background: '#a855f7' }
  }
}

function dayTitle(d: StripDay): string {
  const n = d.count
  return `${d.ymd}${n ? ` · ${n} item${n === 1 ? '' : 's'}` : ''}${d.more ? ` (${d.more} more than shown)` : ''}`
}

export default function LegalTimelineStrip({ strip, look, onDay }: { strip: Strip; look: TimelineLook; onDay?: (ymd: string) => void }) {
  if (strip.days.length === 0) return null
  return (
    <div data-legal-timeline-strip title={strip.words} style={{ margin: '4px 0 8px', minWidth: 0 }}>
      <div role="group" aria-label={strip.words} style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 1, alignItems: 'end', height: 46 }}>
        {strip.days.map((d) => (
          <button
            key={d.ymd}
            type="button"
            data-legal-timeline-strip-day={d.ymd}
            data-today={d.today ? 'yes' : undefined}
            aria-label={dayTitle(d)}
            title={dayTitle(d)}
            onClick={onDay && d.count ? () => onDay(d.ymd) : undefined}
            style={{ display: 'grid', gap: 2, alignContent: 'end', justifyItems: 'center', height: '100%', padding: '0 0 2px', border: 0, borderRadius: 3, background: d.today ? look.band : d.weekend ? look.surface : 'transparent', outline: d.today ? `1px solid ${look.accent}` : undefined, cursor: onDay && d.count ? 'pointer' : 'default', minWidth: 0 }}
          >
            {d.dots.map((dot, i) => <span key={i} aria-hidden data-legal-timeline-strip-dot={dot} style={dotStyle(dot, look)} />)}
            {d.more ? <span aria-hidden style={{ fontSize: 8, lineHeight: 1, color: look.muted }}>+{d.more}</span> : null}
          </button>
        ))}
      </div>
      <div aria-hidden style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(0, 1fr)', gap: 1, fontSize: '0.6rem', color: look.muted, textAlign: 'center', marginTop: 2 }}>
        {strip.days.map((d) => <span key={d.ymd} style={{ whiteSpace: 'nowrap', overflow: 'visible', visibility: d.label ? 'visible' : 'hidden' }}>{d.label}</span>)}
      </div>
    </div>
  )
}
