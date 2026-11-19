/**
 * The frame the painted map's two question sheets share (punch list #392): **Paint a map** and
 * **Which job is it for?**. On a phone each is a sheet on the bottom edge. At a desk each is a
 * window hung from near the top, so it stays put while its list grows or shrinks.
 */
import { useEffect, useState, type CSSProperties } from 'react'

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

/** The scrim and the sheet: a phone's sheet on the bottom edge, or a desk's window hung from near the top. */
export function paintedSheetFrame(desk: boolean): { scrim: CSSProperties; sheet: CSSProperties } {
  return {
    scrim: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: desk ? 'flex-start' : 'flex-end', justifyContent: 'center', padding: desk ? '56px 16px 24px' : 'env(safe-area-inset-top, 0px) 0 0', boxSizing: 'border-box' },
    sheet: { background: 'var(--surface)', color: 'var(--text-strong)', width: '100%', maxWidth: 520, maxHeight: '100%', overflowY: 'auto', ...(desk ? { borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.35)' } : { borderTopLeftRadius: 14, borderTopRightRadius: 14 }) },
  }
}
