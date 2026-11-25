import type { CSSProperties } from 'react'
import type { VisibleBand } from '../visibleBand'

/**
 * The sheet's scrim (punch list #398). Pinned to the whole page it ignored the keyboard: the simulator's walk of
 * 2026-11-25 had Safari's address pill over **Add 1 and another part** and the keyboard's bar over **Pick a different
 * part**. Given the band that shows, it starts where the band starts and is as tall, as `PhoneSheet`'s backdrop is,
 * so every sheet of the On site tab ends at the top of the keys. With no band, a desk or a browser that cannot say,
 * it keeps the page box.
 */
export function onSiteSheetScrim(band: VisibleBand | null): CSSProperties {
  const look: CSSProperties = { zIndex: 800, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-end' }
  return band
    ? { ...look, position: 'fixed', top: band.top, left: 0, right: 0, height: band.height, paddingTop: 'var(--app-top-chrome, 0px)' }
    : { ...look, position: 'fixed', inset: 0, paddingTop: 'var(--app-top-chrome, 0px)' }
}
