/**
 * The On site tab's bottom sheet (punch list #209): a title, a line under it, a body that scrolls, and buttons that
 * stay on screen under the body. Lived inside `TallyOnSiteTab.tsx` until v2.7298, when the sticker's sheet
 * (`StickerNewSheet.tsx`) needed it too.
 */
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useVisualViewportBox } from '../../hooks/useVisualViewportBox'
import { visibleBand, type VisibleBand } from '../../lib/visibleBand'
import { onSiteSheetFit, onSiteSheetScrim, onSiteSheetTail, onSiteSheetTight, type OnSiteSheetFit } from '../../lib/materials/onSiteSheetScrim'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.85rem' }

/** The box screen's bar for a press (punch list #398): 48 high or more. */
export const SHEET_TOUCH_MIN = 48
/** What the × stood before the phone walk of 2026-11-21 read it at 39 by 38 on a box's More sheet. */
const CLOSE_DRAWN = { width: 39, height: 38 }

/**
 * The sheet's ×: 48 by 48, the bar every other press on a box's screen already met. The margins give back what it
 * grew by, so the title row is as tall as it was and the × is drawn where it was.
 */
export const SHEET_CLOSE_STYLE: CSSProperties = {
  marginLeft: 'auto',
  background: 'none',
  border: 'none',
  fontSize: '1.25rem',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  minHeight: SHEET_TOUCH_MIN,
  minWidth: SHEET_TOUCH_MIN,
  marginTop: -(SHEET_TOUCH_MIN - CLOSE_DRAWN.height) / 2,
  marginBottom: -(SHEET_TOUCH_MIN - CLOSE_DRAWN.height) / 2,
  marginRight: -(SHEET_TOUCH_MIN - CLOSE_DRAWN.width) / 2,
}

/** The room a sheet follows: the part of the page that shows on a phone, and none at a desk. */
function useOnSiteSheetBand(): VisibleBand | null {
  const phone = useIsMobile()
  const shows = visibleBand(useVisualViewportBox())
  return phone ? shows : null
}

/** What a sheet, and a control inside one, draws for the room there is (`onSiteSheetFit`). */
export function useOnSiteSheetFit(): OnSiteSheetFit {
  return onSiteSheetFit(onSiteSheetTight(useOnSiteSheetBand()))
}

export function Sheet({ title, sub, children, onClose, footer, fill }: { title: string; sub?: string; children: ReactNode; onClose: () => void; /** Buttons that stay on screen under the body, whatever the body does with a drag or a wheel. */ footer?: ReactNode; /** The body fills the sheet and the sheet fills the screen: for a map, which eats the scroll. */ fill?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // On a phone the scrim is the part of the page that shows, so the sheet's foot stands on the keyboard's top.
  const band = useOnSiteSheetBand()
  // With the keys up the room is short (finding 310): the sheet takes all of it and gives up its handle and some padding,
  // so a step's controls show without a scroll. Under its foot its surface runs on, so no row of the page shows there.
  const fit = onSiteSheetFit(onSiteSheetTight(band))
  const tail = onSiteSheetTail(band)
  return (
    <div data-on-site-sheet={band ? 'band' : 'page'} style={onSiteSheetScrim(band)} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: 'var(--surface)', color: 'var(--text-strong)', borderTopLeftRadius: 16, borderTopRightRadius: 16, ...(fill ? { flex: '1 1 auto', minHeight: 0 } : { maxHeight: fit.maxHeight }), overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: 480, width: '100%', margin: '0 auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: 'none', padding: fit.headPad, display: 'grid', gap: '0.4rem' }}>
          {fit.handle ? <div data-on-site-sheet-handle style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto' }} /> : null}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{title}</h2>
            <button type="button" onClick={onClose} aria-label="Close" style={SHEET_CLOSE_STYLE}>×</button>
          </div>
          {sub ? <p style={{ ...muted, margin: '-0.2rem 0 0' }}>{sub}</p> : null}
        </div>
        <div style={fill ? { flex: '1 1 auto', minHeight: 0, padding: '0.6rem 1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' } : { flex: '1 1 auto', minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: fit.bodyPad, display: 'grid', gap: fit.bodyGap, alignContent: 'start' }}>
          {children}
        </div>
        {footer ? <div style={{ flex: 'none', borderTop: '1px solid var(--border)', padding: `${fit.footPadTop} 1rem calc(${fit.footPadBottom} + env(safe-area-inset-bottom, 0px))`, display: 'grid', gap: '0.5rem', background: 'var(--surface)' }}>{footer}</div> : null}
      </div>
      {tail ? <div aria-hidden data-on-site-sheet-tail style={tail} onClick={(e) => e.stopPropagation()} /> : null}
    </div>
  )
}
