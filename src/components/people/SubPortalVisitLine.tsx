/**
 * The one line under a sub's name (v2.2922): "Opened their page Sep 4 · 6 times"
 * in green, "Never opened" in amber, with the last team look beside it. Tap or
 * click opens the visits modal; a long press on a phone opens it too, with text
 * selection off on this one line so the hold does not start a highlight.
 */
import { useLongPress } from '../../hooks/useLongPress'
import { visitLine, type SubPortalVisitSummary } from '../../lib/portal/subPortalVisits'

const TONE = { green: 'var(--text-green-700)', amber: 'var(--text-amber-800)', gray: 'var(--text-muted)' } as const

export function SubPortalVisitLine({ summary, hasLink, onOpen, style }: { summary: SubPortalVisitSummary | null | undefined; hasLink?: boolean; onOpen: () => void; style?: React.CSSProperties }) {
  const press = useLongPress(onOpen)
  const line = visitLine(summary, { hasLink })
  if (!line) return null
  return (
    <button
      type="button"
      {...press.handlers}
      onClick={() => {
        if (press.consumeLongPress()) return
        onOpen()
      }}
      title="Every visit to their portal — tap for the trail"
      style={{ display: 'inline-block', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: '0.75rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', color: 'inherit', ...style }}
    >
      <span style={{ color: TONE[line.tone], fontWeight: 600 }}>{line.outside}</span>
      {line.team ? <span style={{ color: 'var(--text-muted)' }}> · {line.team}</span> : null}
    </button>
  )
}
