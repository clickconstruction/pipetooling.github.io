import { useEffect } from 'react'
import { warmWhenIdle, type LazyWindow } from '../lib/lazyWindow'

/**
 * Warms a provider's on-demand windows once the app has drawn and the page is idle, so the first open
 * finds them loaded. `on` is false until there is someone signed in: a public page never pays for a
 * window it cannot open. Pass a list that keeps its identity (a module-level constant).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a list of windows with different props
export function useWarmWindows(windows: ReadonlyArray<LazyWindow<any>>, on: boolean): void {
  useEffect(() => {
    if (!on) return
    return warmWhenIdle(windows.map((w) => w.preload))
  }, [windows, on])
}
