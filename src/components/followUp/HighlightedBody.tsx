/**
 * Messages, cut 2's screens, PR C3: a line's highlights in place of its first lines (the prototype's `bodyHtml`), each
 * with who highlighted it and when, and *remove*. The message window still holds the whole message.
 */
import type { MessageHighlight } from '../../lib/followUp/followUpRows'
import { highlightedByWords } from '../../lib/messages/highlights'

export function HighlightedBody({ highlights, nowIso, busy, onRemove }: { highlights: readonly MessageHighlight[]; nowIso: string; busy: boolean; onRemove: (highlightId: string) => void }) {
  return (
    <div data-highlighted-body style={{ display: 'grid', gap: '0.3rem' }}>
      {highlights.map((h) => (
        <div key={h.id} style={{ borderLeft: '3px solid var(--bg-amber-200)', background: 'var(--bg-amber-tint)', borderRadius: 4, padding: '0.25rem 0.5rem', whiteSpace: 'pre-wrap' }}>
          {h.text}
          <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            {highlightedByWords(h.by, h.at, nowIso)} ·{' '}
            <button
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation()
                onRemove(h.id)
              }}
              title="Takes these words off the highlights. The message stays."
              style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit' }}
            >
              remove
            </button>
          </small>
        </div>
      ))}
    </div>
  )
}
