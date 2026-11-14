/**
 * How the paint looks off the map (punch list #345): the short bar that marks a painted line in a
 * list. No map code here, so a job's window can show the bar without loading Leaflet.
 */
import type { CSSProperties } from 'react'

/** The paint. Saturated on purpose: it has to read over grass, dirt and roofs, in both themes. */
export const PAINT_COLOR = '#ff5a1f'

/** The bar that stands for a painted line beside its name. */
export const PAINT_SWATCH: CSSProperties = { width: 20, height: 5, borderRadius: 3, background: PAINT_COLOR, flex: 'none' }
