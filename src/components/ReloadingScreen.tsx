import { createPortal } from 'react-dom'

/**
 * *Reloading…*, drawn over the whole page from the gear menu's **Hard Reload** until the page leaves (punch
 * list #406). The reload waits on the wipe of the service worker, up to `WIPE_DEADLINE_MS`, and right after a
 * deploy it waits the whole three seconds. Until now nothing was drawn in that time: the menu closed and the
 * page stood as it was, every press on it live.
 *
 * It covers the page, so no other press lands while the reload is on its way. It has no press of its own and
 * no way back: the reload it stands for always leaves, on the wipe or on its deadline. Drawn on `document.body`,
 * since the header it is pressed from can hold a fixed child to its own box.
 */
export function ReloadingScreen() {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      data-testid="reloading-screen"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100001,
        padding: 'var(--app-top-chrome, 0px) 1rem 0',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface)',
        color: 'var(--text-muted)',
        fontSize: '1rem',
      }}
    >
      Reloading…
    </div>,
    document.body,
  )
}
