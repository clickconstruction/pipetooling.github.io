/**
 * How the paint looks off the map (punch list #345): the short bar that marks a painted line in a
 * list, and the colours both of a painted map's canvases draw in. No map code here, so a job's
 * window can show the bar without loading Leaflet.
 */
import type { CSSProperties } from 'react'

/** The paint. Saturated on purpose: it has to read over grass, dirt and roofs, in both themes. */
export const PAINT_COLOR = '#ff5a1f'

/** The dark edge under a painted line, and the ink of a place's mark. The same on a photograph in either theme. */
export const PAINT_INK = '#111827'
/** The paper of a place's mark and of a corner. */
export const PAINT_PAPER = '#ffffff'
/** Where the person is, and the dot a finger places. */
export const PAINT_ME_BLUE = '#2563eb'

/** The bar that stands for a painted line beside its name. */
export const PAINT_SWATCH: CSSProperties = { width: 20, height: 5, borderRadius: 3, background: PAINT_COLOR, flex: 'none' }
