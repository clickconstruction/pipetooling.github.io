/**
 * What the marks mean (the owner, 2026-11-02): a small round ? on the History card's header opens
 * a window that reads every mark the feed draws, grouped under the chip that narrows to it, each
 * with its glyph in its family's colour, its name and one line on what the line records. The rows
 * and the marks come from `lib/developments/historyLegend.ts`, the table the feed's own badge
 * reads, so the legend never drifts from the list.
 */
import { useState, type CSSProperties } from 'react'
import ResponsiveModalShell from '../ResponsiveModalShell'
import { HISTORY_LEGEND_INTRO, HISTORY_LEGEND_PRESS, HISTORY_LEGEND_TITLE, legendByChip, type HistoryMark, type MarkTone } from '../../lib/developments/historyLegend'

const TONE: Record<MarkTone, { bg: string; fg: string }> = {
  grey: { bg: 'var(--bg-muted)', fg: 'var(--text-700)' },
  blue: { bg: 'var(--bg-blue-tint)', fg: 'var(--text-blue-800)' },
  green: { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-600)' },
  red: { bg: 'var(--bg-red-tint)', fg: 'var(--text-red-600)' },
  amber: { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)' },
}

/** The glyph in its family's colour, the badge the feed draws before every line. */
export function HistoryMarkBadge({ mark, title }: { mark: HistoryMark; title?: string }) {
  const t = TONE[mark.tone]
  return (
    <span aria-hidden title={title} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 999, background: t.bg, color: t.fg, fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
      {mark.glyph}
    </span>
  )
}

const group: CSSProperties = { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0.9rem 0 0.25rem' }
const row: CSSProperties = { display: 'grid', gridTemplateColumns: '22px minmax(6rem, 8rem) 1fr', gap: '0.25rem 0.6rem', alignItems: 'start', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.875rem' }

export function HistoryLegendWindow({ onClose }: { onClose: () => void }) {
  return (
    <ResponsiveModalShell title={HISTORY_LEGEND_TITLE} onRequestClose={onClose} maxWidthDesktop={560} zIndex={1150} footer={<button type="button" onClick={onClose} style={{ minHeight: 44, padding: '0 1rem', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontWeight: 600, cursor: 'pointer' }}>Close</button>}>
      <div data-testid="history-legend">
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{HISTORY_LEGEND_INTRO}</p>
        {legendByChip().map((g) => (
          <section key={g.chip} aria-label={g.label}>
            <p style={group}>{g.label}</p>
            {g.rows.map((r) => (
              <div key={r.key} style={row} data-testid="history-legend-row">
                <HistoryMarkBadge mark={r.mark} />
                <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{r.name}</span>
                <span style={{ color: 'var(--text-700)' }}>{r.words}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </ResponsiveModalShell>
  )
}

/** The round ? on the History card's header: one press opens the legend, Close or Escape shuts it. */
export function HistoryLegendPress() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={HISTORY_LEGEND_PRESS}
        title={HISTORY_LEGEND_PRESS}
        style={{ width: 24, height: 24, borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-700)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
      >
        ?
      </button>
      {open ? <HistoryLegendWindow onClose={() => setOpen(false)} /> : null}
    </>
  )
}
