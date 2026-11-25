/**
 * The frame the painted map's two question sheets share (punch list #392): **Paint a map** and
 * **Which job is it for?**. On a phone each is a sheet on the bottom edge. At a desk each is a
 * window hung from near the top, so it stays put while its list grows or shrinks.
 *
 * On a phone the scrim is the part of the page that shows, not the whole page box (the simulator's walk of
 * 2026-11-25, Safari at 402 by 874 points): pinned to the page box it ran under Safari's bar, and a sheet shorter
 * than that box had nothing to scroll, so **Start with a place** sat behind the bar. The band also ends at the top of
 * the keyboard, which the picker's search brings up. `PhoneSheet` sizes its backdrop the same way.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { useVisualViewportBox } from '../../hooks/useVisualViewportBox'
import { visibleBand, type VisibleBand } from '../../lib/visibleBand'

const DESK_QUERY = '(min-width: 769px)'

/** Whether the screen is a desk's, the app's own line at 768. A screen that cannot say is a phone's. */
export function usePaintedSheetDesk(): boolean {
  const ask = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(DESK_QUERY).matches
  const [desk, setDesk] = useState(ask)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(DESK_QUERY)
    const heard = () => setDesk(mql.matches)
    heard()
    mql.addEventListener('change', heard)
    return () => mql.removeEventListener('change', heard)
  }, [])
  return desk
}

/** The part of the page that shows, for a sheet's scrim. Null where the browser cannot say: the scrim keeps the page box. */
export function usePaintedSheetBand(): VisibleBand | null {
  return visibleBand(useVisualViewportBox())
}

/**
 * The scrim and the sheet: a phone's sheet on the bottom edge, or a desk's window hung from near the top. `shows` is
 * the band a phone's scrim fills, from `usePaintedSheetBand`. A desk's window, and a phone that cannot say what
 * shows, keep the whole page box. The sheet is at most as tall as its scrim and scrolls inside it.
 */
export function paintedSheetFrame(desk: boolean, shows: VisibleBand | null = null): { scrim: CSSProperties; sheet: CSSProperties } {
  const look: CSSProperties = { background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: desk ? 'flex-start' : 'flex-end', justifyContent: 'center', boxSizing: 'border-box' }
  // Each box pads its own top by the status bar: the dim covers the bar and the sheet starts below it.
  const scrim: CSSProperties =
    !desk && shows
      ? { ...look, position: 'fixed', top: shows.top, left: 0, right: 0, height: shows.height, padding: 'env(safe-area-inset-top, 0px) 0 0' }
      : { ...look, position: 'fixed', inset: 0, padding: desk ? '56px 16px 24px' : 'env(safe-area-inset-top, 0px) 0 0' }
  return {
    scrim,
    sheet: { background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 520, maxHeight: '100%', overflowY: 'auto', ...(desk ? { borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.35)' } : { borderTopLeftRadius: 14, borderTopRightRadius: 14 }) },
  }
}
