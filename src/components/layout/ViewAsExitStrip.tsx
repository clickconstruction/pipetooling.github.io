import { IMPERSONATION_EXIT_ARIA_LABEL } from '../../lib/impersonationUiLabels'

/**
 * The way back from View as, on a phone (v2.7782, the owner's ask of 2026-11-18): one amber line
 * above the header that holds the whole press with its whole name. As the last press of the
 * header's icon row its name was cut off and it ran 20 px past the edge of a 375 px screen.
 *
 * The line is the press. It is a flat band from edge to edge, one line of words tall, with no box
 * drawn inside it, so viewing as someone costs the page 24 px. A long name wraps inside the band.
 * The band's look is `.appViewAsStripExit` in `index.css` alone: an inline style here would bring
 * the tall outlined button back.
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
      >
        {label}
      </button>
    </div>
  )
}
