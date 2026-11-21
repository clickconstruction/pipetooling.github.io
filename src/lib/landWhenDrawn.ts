/**
 * Land on something a later draw will put on the page: look for it every so often, and call `land` once it is there
 * with a height. Give up after `tries` looks. The answer is the press that stops the looking, for the screen to call
 * when it closes.
 *
 * It exists because the same loop written inline in `JobFormModal` was never stopped. The window could close with the
 * loop still running, and in a test the loop's next look came after the page was gone, threw
 * `document is not defined` and turned a whole CI run red with every test passing (2026-11-21, PR #9208). So the
 * loop stops three ways: when it lands, when it gives up, and when its page is gone. A stop is safe to call twice.
 */
export interface LandWhenDrawnOptions {
  /** How often to look, in ms. */
  everyMs?: number
  /** How many looks before giving up. */
  tries?: number
}

export function landWhenDrawn(find: () => HTMLElement | null, land: (el: HTMLElement) => void, options: LandWhenDrawnOptions = {}): () => void {
  const everyMs = options.everyMs ?? 100
  const most = options.tries ?? 50
  let looks = 0
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    clearInterval(tick)
  }
  const tick = setInterval(() => {
    // A page that is gone has nothing to land on: a closed window, or a test whose document was torn down.
    if (typeof document === 'undefined') {
      stop()
      return
    }
    const el = find()
    looks += 1
    if (el && el.getBoundingClientRect().height > 0) {
      stop()
      land(el)
    } else if (looks >= most) stop()
  }, everyMs)
  return stop
}
