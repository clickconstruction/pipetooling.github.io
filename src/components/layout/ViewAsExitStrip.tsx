import { IMPERSONATION_CHROME_BUTTON_STYLE } from '../../lib/impersonationSession'
import { IMPERSONATION_EXIT_ARIA_LABEL } from '../../lib/impersonationUiLabels'

/**
 * The way back from View as, on a phone (v2.7782, the owner's ask of 2026-11-18): one amber line
 * above the header that holds the whole button with its whole name. As the last press of the
 * header's icon row its name was cut off and it ran 20 px past the edge of a 375 px screen.
 * A long name wraps inside the strip.
 *
 * `Layout` mounts it just before `.appNavChrome`, outside it, so the search bar that covers the
 * header never covers the way back. The strip takes the status-bar padding and the chrome under it
 * keeps its plain padding (`.appViewAsStrip` in `index.css`).
 */
export function ViewAsExitStrip({ label, title, onExit }: { label: string; title: string; onExit: () => void }) {
  return (
    <div className="appViewAsStrip" data-view-as-exit="strip">
      <button
        type="button"
        className="appViewAsStripExit"
        onClick={onExit}
        title={title}
        aria-label={IMPERSONATION_EXIT_ARIA_LABEL}
        style={IMPERSONATION_CHROME_BUTTON_STYLE}
      >
        {label}
      </button>
    </div>
  )
}
