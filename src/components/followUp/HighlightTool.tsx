/**
 * Messages, cut 2's screens, PR C3: the message window's first tool (cut 1's `messageWindowFirst` slot, the prototype's
 * `#hlbtn`): *Highlight the selected words* while words are selected in the whole message, else, when the line has
 * highlights, *Remove the highlight(s)*.
 */
import { HIGHLIGHT_BUTTON, HIGHLIGHT_TIP, removeHighlightsLabel } from '../../lib/messages/highlights'
import { clauseButtonStyle, clausePrimaryStyle } from '../contracts/clauseStyles'

export function HighlightTool({ selection, count, busy, onHighlight, onRemoveAll }: { selection: string; count: number; busy: boolean; onHighlight: () => void; onRemoveAll: () => void }) {
  if (!selection && count > 0) {
    return (
      <button type="button" disabled={busy} onClick={onRemoveAll} title="Takes the highlights off this message. The message stays." style={{ ...clauseButtonStyle, padding: '0.2rem 0.55rem', fontSize: '0.8rem' }}>
        {removeHighlightsLabel(count)}
      </button>
    )
  }
  return (
    <button
      type="button"
      disabled={busy || !selection}
      onClick={onHighlight}
      title={HIGHLIGHT_TIP}
      style={selection ? { ...clausePrimaryStyle, padding: '0.2rem 0.55rem', fontSize: '0.8rem' } : { ...clauseButtonStyle, padding: '0.2rem 0.55rem', fontSize: '0.8rem', opacity: 0.6 }}
    >
      {HIGHLIGHT_BUTTON}
    </button>
  )
}
