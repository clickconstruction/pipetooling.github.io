/**
 * Scroll an element into view once it is actually visible (v2.3697). A Settings tab
 * mounts hidden until its groups load and a modal's rows mount before the window is
 * laid out, so a scroll fired on mount lands on nothing. Polls briefly, then gives up.
 * Returns a cancel function.
 */
export function scrollWhenVisible(get: () => HTMLElement | null, opts: { block?: ScrollLogicalPosition; timeoutMs?: number; everyMs?: number } = {}): () => void {
  const deadline = Date.now() + (opts.timeoutMs ?? 5000)
  let timer: ReturnType<typeof setTimeout> | null = null
  const tick = () => {
    const el = get()
    if (el && el.offsetParent !== null) {
      // A hidden document never runs the smooth animation (no frames): scroll at once there, smoothly when someone is looking.
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      el.scrollIntoView?.({ behavior: hidden ? 'auto' : 'smooth', block: opts.block ?? 'center' })
      return
    }
    if (Date.now() < deadline) timer = setTimeout(tick, opts.everyMs ?? 150)
  }
  timer = setTimeout(tick, 150)
  return () => {
    if (timer != null) clearTimeout(timer)
  }
}
