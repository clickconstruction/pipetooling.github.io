/**
 * What shows while an on-demand window's code loads (`lazyWindow`): a small note in the middle of the
 * screen. It is not a window and takes no press, so the page under it stays as it was. It waits a
 * moment before it shows (`.windowOpening` in `index.css`), so a window that is already on the device
 * opens with no flash of words.
 */
export function WindowOpening({ words = 'Opening…' }: { words?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="windowOpening"
      data-window-opening=""
      style={{
        position: 'fixed',
        left: '50%',
        top: '45%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10060,
        pointerEvents: 'none',
        padding: '0.6rem 1rem',
        borderRadius: 10,
        border: '1px solid var(--border-strong)',
        background: 'var(--surface)',
        color: 'var(--text-700)',
        fontSize: '0.9375rem',
        fontWeight: 600,
        boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
      }}
    >
      {words}
    </div>
  )
}
